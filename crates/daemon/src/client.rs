use std::io::{self, Read, Write};
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, LazyLock, Mutex};
use std::thread;
use std::time::{Duration, Instant};

use interprocess::local_socket::prelude::*;
use interprocess::local_socket::{ConnectOptions, GenericFilePath, GenericNamespaced};
use interprocess::ConnectWaitMode;
use scriptor_ipc::{
    fuzz_corpus::is_expected_disconnect, read_frame_resyncing, write_frame, IpcError, RpcEvent,
    RpcMethod, RpcRequest, RpcResponse, ServerMessage,
};

use crate::locks::lock_recover;
use crate::transport::{connect_client, read_endpoint};

/// Upper bound on how long a single `call` waits for the daemon to answer.
/// Generous enough for the synchronous export/reindex RPCs, but finite: the
/// callers are UI command threads that must never block forever.
const RPC_READ_TIMEOUT: Duration = Duration::from_secs(120);

/// Poll interval used only for nonblocking transports such as Windows named
/// pipes. Keeping the retry inside the `Read`/`Write` adapter preserves partial
/// frame progress instead of restarting a length-prefixed read mid-frame.
const NONBLOCKING_RETRY_INTERVAL: Duration = Duration::from_millis(5);

/// How many frames that are not the awaited response may be observed before
/// `read_response_frame` gives up. Without this, a daemon that never emits the
/// matching id (or a desynced stream) parks the caller indefinitely.
const MAX_UNMATCHED_FRAMES: usize = 512;

fn should_reconnect(error: &IpcError) -> bool {
    is_expected_disconnect(error) || matches!(error, IpcError::Io(_))
}

fn is_read_timeout(error: &IpcError) -> bool {
    matches!(
        error,
        IpcError::Io(io) if matches!(
            io.kind(),
            std::io::ErrorKind::WouldBlock | std::io::ErrorKind::TimedOut
        )
    )
}

/// Adapts a nonblocking transport to ordinary blocking `Read`/`Write` calls
/// while enforcing one absolute deadline for the whole RPC attempt.
///
/// Windows local sockets are named pipes. `interprocess` deliberately reports
/// receive-timeout configuration as unsupported for them, but it does support
/// nonblocking mode. Retrying `WouldBlock` here is materially safer than
/// retrying `read_frame_resyncing`: this adapter retains the caller's partially
/// filled buffers, so a wake-up in the middle of an 8-byte frame header cannot
/// desynchronise the stream.
struct DeadlineIo<'a, T> {
    inner: &'a mut T,
    deadline: Instant,
    retry_zero_reads: bool,
}

impl<'a, T> DeadlineIo<'a, T> {
    fn new(inner: &'a mut T, deadline: Instant) -> Self {
        Self::new_with_zero_read_retry(inner, deadline, cfg!(windows))
    }

    fn new_with_zero_read_retry(
        inner: &'a mut T,
        deadline: Instant,
        retry_zero_reads: bool,
    ) -> Self {
        Self {
            inner,
            deadline,
            retry_zero_reads,
        }
    }

    fn wait_for_io(&self) -> io::Result<()> {
        let now = Instant::now();
        if now >= self.deadline {
            return Err(io::Error::new(
                io::ErrorKind::TimedOut,
                "RPC I/O deadline exceeded",
            ));
        }
        thread::sleep((self.deadline - now).min(NONBLOCKING_RETRY_INTERVAL));
        Ok(())
    }
}

impl<T: Read> Read for DeadlineIo<'_, T> {
    fn read(&mut self, buffer: &mut [u8]) -> io::Result<usize> {
        if buffer.is_empty() {
            return Ok(0);
        }

        loop {
            match self.inner.read(buffer) {
                Err(error) if error.kind() == io::ErrorKind::Interrupted => continue,
                Err(error) if error.kind() == io::ErrorKind::WouldBlock => self.wait_for_io()?,
                // Windows PIPE_NOWAIT may report a temporarily empty named pipe
                // as a zero-byte read instead of WouldBlock. Retrying inside the
                // adapter preserves read_exact's partially filled buffer and keeps
                // the operation bounded by the same absolute RPC deadline.
                Ok(0) if self.retry_zero_reads => self.wait_for_io()?,
                result => return result,
            }
        }
    }
}

impl<T: Write> Write for DeadlineIo<'_, T> {
    fn write(&mut self, buffer: &[u8]) -> io::Result<usize> {
        loop {
            match self.inner.write(buffer) {
                Err(error) if error.kind() == io::ErrorKind::Interrupted => continue,
                Err(error) if error.kind() == io::ErrorKind::WouldBlock => self.wait_for_io()?,
                result => return result,
            }
        }
    }

    fn flush(&mut self) -> io::Result<()> {
        loop {
            match self.inner.flush() {
                Err(error) if error.kind() == io::ErrorKind::Interrupted => continue,
                Err(error) if error.kind() == io::ErrorKind::WouldBlock => self.wait_for_io()?,
                result => return result,
            }
        }
    }
}

/// Connect within `timeout` and create Windows named-pipe streams in
/// nonblocking mode from the instant they are opened.
///
/// The ordinary `LocalSocketStream::connect` path waits without a bound before
/// nonblocking mode can be applied. Building the stream with `ConnectOptions`
/// keeps connection establishment inside the same absolute RPC budget as frame
/// writes and reads.
fn connect_client_with_timeout(timeout: Duration) -> Result<LocalSocketStream, IpcError> {
    if timeout.is_zero() {
        return Err(IpcError::Io(io::Error::new(
            io::ErrorKind::TimedOut,
            "daemon connection timeout must be greater than zero",
        )));
    }

    let endpoint = read_endpoint()?;
    let name = if cfg!(windows) {
        endpoint
            .socket_name
            .as_str()
            .to_ns_name::<GenericNamespaced>()
            .map_err(|error| IpcError::Codec(error.to_string()))?
    } else {
        Path::new(&endpoint.socket_name)
            .to_fs_name::<GenericFilePath>()
            .map_err(|error| IpcError::Codec(error.to_string()))?
    };

    ConnectOptions::new()
        .name(name)
        .wait_mode(ConnectWaitMode::Timeout(timeout))
        .nonblocking_stream(cfg!(windows))
        .connect_sync()
        .map_err(IpcError::from)
}

type EventHandler = Box<dyn Fn(RpcEvent) + Send + Sync>;

/// Handle on the background thread that receives daemon events.
struct EventListener {
    stop: Arc<AtomicBool>,
    handle: thread::JoinHandle<()>,
}

struct ClientInner {
    stream: Mutex<Option<LocalSocketStream>>,
    event_handlers: Arc<Mutex<Vec<EventHandler>>>,
    listener: Mutex<Option<EventListener>>,
}

impl ClientInner {
    fn new() -> Self {
        Self {
            stream: Mutex::new(None),
            event_handlers: Arc::new(Mutex::new(Vec::new())),
            listener: Mutex::new(None),
        }
    }

    /// Drops only the request/response socket. Used after an error that may have
    /// left unread bytes in the stream, so the next call starts from a clean one.
    fn drop_stream(&self) {
        *lock_recover(&self.stream) = None;
    }

    fn reset(&self) {
        self.drop_stream();
        self.stop_event_listener();
    }

    /// Signals the current listener thread to stop and forgets it.
    ///
    /// The thread is *not* joined here. It spends its life blocked in a
    /// `read` on the daemon socket, which cannot be interrupted portably
    /// (`interprocess::local_socket::Stream` exposes no shutdown or duplicate
    /// handle, and a receive²È="25Í”¤°(€€€€€€€€€€€ÉÈ¡•ÉÉ½È¤¥˜Í¡½Õ±‘}É•½¹¹•Ð ™•ÉÉ½È¤€˜˜%¹ÍÑ…¹Ðèé¹½Ü ¤€ð‘•…‘±¥¹”€ôøì(€€€€€€€€€€€€€€€‘É½À¡Õ…É¤ì(€€€€€€€€€€€€€€€€¼¼=¹±äÑ¡”É•ÅÕ•ÍÐÍ½­•Ð¥ÌÉ•å±•¡•É”ìÑ¡”•Ù•¹Ð±¥ÍÑ•¹•È(€€€€€€€€€€€€€€€€¼¼¥Ì¥¹‘•Á•¹‘•¹Ð…¹µÕÍÐÍÕÉÙ¥Ù”…¸IAµ±•Ù•°É•½¹¹•Ð¸(€€€€€€€€€€€€€€€Í•±˜¹‘É½Á}ÍÑÉ•…´ ¤ì(€€€€€€€€€€€€€€€±•ÐµÕÐÕ…É€ôÍ•±˜¹•¹ÍÕÉ•}½¹¹•Ñ•¡‘•…‘±¥¹”¤üì(€€€€€€€€€€€€€€€±•ÐÍÑÉ•…´€ôÕ…É¹…Í}µÕÐ ¤¹•áÁ•Ð ‰½¹¹•Ñ•ÍÑÉ•…´ˆ¤ì(€€€€€€€€€€€€€€€Í•±˜¹…±±}½¹”¡ÍÑÉ•…´°€™É•ÅÕ•ÍÐ°‘•…‘±¥¹”°Ñ¥µ•½ÕÐ¤(€€€€€€€€€€€ô(€€€€€€€€€€€ÉÈ¡•ÉÉ½È¤€ôøì(€€€€€€€€€€€€€€€€¼¼Ñ¥µ•½ÕÐ½È„‘•½‘”™…¥±ÕÉ”…¸±•…Ù”Õ¹½¹ÍÕµ•‰åÑ•Ì¥¸(€€€€€€€€€€€€€€€€¼¼Ñ¡”Í½­•Ð°Í¼¹•Ù•ÈÉ•ÕÍ”¥Ð™½ÈÑ¡”¹•áÐ…±°¸(€€€€€€€€€€€€€€€‘É½À¡Õ…É¤ì(€€€€€€€€€€€€€€€Í•±˜¹‘É½Á}ÍÑÉ•…´ ¤ì(€€€€€€€€€€€€€€€ÉÈ¡•ÉÉ½È¤(€€€€€€€€€€€ô(€€€€€€€ô(€€€ô((€€€™¸…±° ™Í•±˜°É•ÅÕ•ÍÐèIÁI•ÅÕ•ÍÐ¤€´øI•ÍÕ±ÐñIÁI•ÍÁ½¹Í”°%ÁÉÉ½Èøì(€€€€€€€Í•±˜¹…±±}Ý¥Ñ¡}Ñ¥µ•½ÕÐ¡É•ÅÕ•ÍÐ°IA}I}Q%5=UP¤(€€€ô)ô((¼¼¼A•ÉÍ¥ÍÑ•¹Ð±½…°µÍ½­•ÐÍ•ÍÍ¥½¸Ñ¡…ÐµÕ±Ñ¥Á±•á•ÌIAÌ½¸½¹”½¹¹•Ñ¥½¸¸)ÁÕˆÍÑÉÕÐ…•µ½¹IÁ±¥•¹Ðì(€€€¥¹¹•Èè±¥•¹Ñ%¹¹•È°)ô()¥µÁ°…•µ½¹IÁ±¥•¹Ðì(€€€ÁÕˆ™¸¹•Ü ¤€´øM•±˜ì(€€€€€€€M•±˜ì(€€€€€€€€€€€¥¹¹•Èè±¥•¹Ñ%¹¹•Èèé¹•Ü ¤°(€€€€€€€ô(€€€ô((€€€€¼¼¼É½ÀÑ¡”…¡•½¹¹•Ñ¥½¸Í¼Ñ¡”¹•áÐ…±±€½Á•¹Ì„™É•Í Í½­•Ð¸(€€€ÁÕˆ™¸É•Í•Ð ™Í•±˜¤ì(€€€€€€€Í•±˜¹¥¹¹•È¹É•Í•Ð ¤ì(€€€ô((€€€ÁÕˆ™¸É•¥ÍÑ•É}•Ù•¹Ñ}¡…¹‘±•È ™Í•±˜°¡…¹‘±•Èè¥µÁ°¸¡IÁÙ•¹Ð¤€¬M•¹€¬Må¹Œ€¬€ÍÑ…Ñ¥Œ¤ì(€€€€€€€Í•±˜¹¥¹¹•È¹É•¥ÍÑ•É}•Ù•¹Ñ}¡…¹‘±•È¡	½àèé¹•Ü¡¡…¹‘±•È¤¤ì(€€€ô((€€€ÁÕˆ™¸…±° ™Í•±˜°É•ÅÕ•ÍÐèIÁI•ÅÕ•ÍÐ¤€´øI•ÍÕ±ÐñIÁI•ÍÁ½¹Í”°%ÁÉÉ½Èøì(€€€€€€€Í•±˜¹¥¹¹•È¹…±°¡É•ÅÕ•ÍÐ¤(€€€ô((€€€€¼¼¼á•ÕÑ”½¹”IAÝ¥Ñ¡¥¸„…±±•ÈµÍÕÁÁ±¥•Ý¡½±”µ…±°‰Õ‘•Ð¸Q¡”‰Õ‘•Ð(€€€€¼¼¼¥¹±Õ‘•ÌÍ½­•ÐÍ•ÑÕÀ°É•ÅÕ•ÍÐÝÉ¥Ñ”°É•ÍÁ½¹Í”É•…°…¹½¹”É•½¹¹•Ð¸(€€€ÁÕˆ™¸…±±}Ý¥Ñ¡}Ñ¥µ•½ÕÐ (€€€€€€€€™Í•±˜°(€€€€€€€É•ÅÕ•ÍÐèIÁI•ÅÕ•ÍÐ°(€€€€€€€Ñ¥µ•½ÕÐèÕÉ…Ñ¥½¸°(€€€€¤€´øI•ÍÕ±ÐñIÁI•ÍÁ½¹Í”°%ÁÉÉ½Èøì(€€€€€€€Í•±˜¹¥¹¹•È¹…±±}Ý¥Ñ¡}Ñ¥µ•½ÕÐ¡É•ÅÕ•ÍÐ°Ñ¥µ•½ÕÐ¤(€€€ô((€€€€¼¼¼]¡•Ñ¡•È„±¥Ù”•Ù•¹Ðµ±¥ÍÑ•¹•ÈÑ¡É•…¥ÌÕÉÉ•¹Ñ±ä±…¥µ•‰äÑ¡¥Ì±¥•¹Ð¸(€€€€m™œ¡Ñ•ÍÐ¥t(€€€ÁÕˆ¡É…Ñ”¤™¸¡…Í}•Ù•¹Ñ}±¥ÍÑ•¹•È ™Í•±˜¤€´ø‰½½°ì(€€€€€€€±½­}É•½Ù•È ™Í•±˜¹¥¹¹•È¹±¥ÍÑ•¹•È¤¹¥Í}Í½µ” ¤(€€€ô)ô()¥µÁ°•™…Õ±Ð™½È…•µ½¹IÁ±¥•¹Ðì(€€€™¸‘•™…Õ±Ð ¤€´øM•±˜ì(€€€€€€€M•±˜èé¹•Ü ¤(€€€ô)ô()ÍÑ…Ñ¥ŒM!I}1%9Pè1…éå1½¬ñ…•µ½¹IÁ±¥•¹Ðø€ô1…éå1½¬èé¹•Ü¡…•µ½¹IÁ±¥•¹Ðèé¹•Ü¤ì()ÁÕˆ™¸Í¡…É•‘}ÉÁ}±¥•¹Ð ¤€´ø€˜ÍÑ…Ñ¥Œ…•µ½¹IÁ±¥•¹Ðì(€€€€™M!I}1%9P)ô((¼¼¼±•…ÈÑ¡”ÁÉ½•ÍÌµÝ¥‘”IAÍ•ÍÍ¥½¸€¡”¹œ¸…™Ñ•È‘…•µ½¸É•ÍÑ…ÉÐ¤¸)ÁÕˆ™¸É•Í•Ñ}ÉÁ}Í•ÍÍ¥½¸ ¤ì(€€€M!I}1%9P¹É•Í•Ð ¤ì)ô()ÁÕˆ™¸É•¥ÍÑ•É}ÉÁ}•Ù•¹Ñ}¡…¹‘±•È¡¡…¹‘±•Èè¥µÁ°¸¡IÁÙ•¹Ð¤€¬M•¹€¬Må¹Œ€¬€ÍÑ…Ñ¥Œ¤ì(€€€M!I}1%9P¹É•¥ÍÑ•É}•Ù•¹Ñ}¡…¹‘±•È¡¡…¹‘±•È¤ì)ô((m™œ¡Ñ•ÍÐ¥t)µ½Ñ•ÍÑÌì(€€€ÕÍ”ÍÕÁ•Èèè¨ì(€€€ÕÍ”ÍÑèé½±±•Ñ¥½¹ÌèéY••ÅÕ”ì((€€€ÍÑÉÕÐMÉ¥ÁÑ•‘%¼ì(€€€€€€€É•…‘ÌèY••ÅÕ”ñ¥¼èéI•ÍÕ±ÐñY•ŒñÔàøøø°(€€€€€€€ÝÉ¥ÑÑ•¸èY•ŒñÔàø°(€€€ô((€€€¥µÁ°I•…™½ÈMÉ¥ÁÑ•‘%¼ì(€€€€€€€™¸É•… ™µÕÐÍ•±˜°‰Õ™™•Èè€™µÕÐmÔát¤€´ø¥¼èéI•ÍÕ±ÐñÕÍ¥é”øì(€€€€€€€€€€€µ…Ñ Í•±˜¹É•…‘Ì¹Á½Á}™É½¹Ð ¤¹•áÁ•Ð ‰ÍÉ¥ÁÑ•É•…ˆ¤ì(€€€€€€€€€€€€€€€=¬¡‰åÑ•Ì¤€ôøì(€€€€€€€€€€€€€€€€€€€±•Ð½Õ¹Ð€ô‰åÑ•Ì¹±•¸ ¤¹µ¥¸¡‰Õ™™•È¹±•¸ ¤¤ì(€€€€€€€€€€€€€€€€€€€‰Õ™™•Él¸¹½Õ¹Ñt¹½Áå}™É½µ}Í±¥” ™‰åÑ•Íl¸¹½Õ¹Ñt¤ì(€€€€€€€€€€€€€€€€€€€¥˜½Õ¹Ð€ð‰åÑ•Ì¹±•¸ ¤ì(€€€€€€€€€€€€€€€€€€€€€€€Í•±˜¹É•…‘Ì¹ÁÕÍ¡}™É½¹Ð¡=¬¡‰åÑ•Ím½Õ¹Ð¸¹t¹Ñ½}Ù•Œ ¤¤¤ì(€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€€€=¬¡½Õ¹Ð¤(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€ÉÈ¡•ÉÉ½È¤€ôøÉÈ¡•ÉÉ½È¤°(€€€€€€€€€€€ô(€€€€€€€ô(€€€ô((€€€¥µÁ°]É¥Ñ”™½ÈMÉ¥ÁÑ•‘%¼ì(€€€€€€€™¸ÝÉ¥Ñ” ™µÕÐÍ•±˜°‰Õ™™•Èè€™mÔát¤€´ø¥¼èéI•ÍÕ±ÐñÕÍ¥é”øì(€€€€€€€€€€€Í•±˜¹ÝÉ¥ÑÑ•¸¹•áÑ•¹‘}™É½µ}Í±¥”¡‰Õ™™•È¤ì(€€€€€€€€€€€=¬¡‰Õ™™•È¹±•¸ ¤¤(€€€€€€€ô((€€€€€€€™¸™±ÕÍ  ™µÕÐÍ•±˜¤€´ø¥¼èéI•ÍÕ±Ðð ¤øì(€€€€€€€€€€€=¬  ¤¤(€€€€€€€ô(€€€ô((€€€€mÑ•ÍÑt(€€€™¸‘•…‘±¥¹•}¥½}É•ÑÉ¥•Í}Ý½Õ±‘}‰±½­}Ý¥Ñ¡½ÕÑ}±½Í¥¹}Á…ÉÑ¥…±}É•… ¤ì(€€€€€€€±•ÐµÕÐÍÉ¥ÁÑ•€ôMÉ¥ÁÑ•‘%¼ì(€€€€€€€€€€€É•…‘ÌèY••ÅÕ”èé™É½´¡l(€€€€€€€€€€€€€€€=¬¡Ù•Œ…lÄ°€Ét¤°(€€€€€€€€€€€€€€€ÉÈ¡¥¼èéÉÉ½Èèé™É½´¡¥¼èéÉÉ½É-¥¹èé]½Õ±‘	±½¬¤¤°(€€€€€€€€€€€€€€€=¬¡Ù•Œ…lÌ°€Ñt¤°(€€€€€€€€€€€t¤°(€€€€€€€€€€€ÝÉ¥ÑÑ•¸èY•Œèé¹•Ü ¤°(€€€€€€€ôì(€€€€€€€±•ÐµÕÐ¥¼€ô•…‘±¥¹•%¼èé¹•Ü ™µÕÐÍÉ¥ÁÑ•°%¹ÍÑ…¹Ðèé¹½Ü ¤€¬ÕÉ…Ñ¥½¸èé™É½µ}Í•Ì Ä¤¤ì(€€€€€€€±•ÐµÕÐ‰Õ™™•È€ôlÁÔàì€Ñtì(€€€€€€€¥¼¹É•…‘}•á…Ð ™µÕÐ‰Õ™™•È¤¹•áÁ•Ð ‰É•…½µÁ±•Ñ•Ìˆ¤ì(€€€€€€€…ÍÍ•ÉÑ}•Ä„¡‰Õ™™•È°lÄ°€È°€Ì°€Ñt¤ì(€€€ô((€€€€mÑ•ÍÑt(€€€™¸‘•…‘±¥¹•}¥½}É•ÑÉ¥•Í}ÑÉ…¹Í¥•¹Ñ}é•É½}É•…‘}Ý¥Ñ¡½ÕÑ}±½Í¥¹}Á…ÉÑ¥…±}É•… ¤ì(€€€€€€€±•ÐµÕÐÍÉ¥ÁÑ•€ôMÉ¥ÁÑ•‘%¼ì(€€€€€€€€€€€É•…‘ÌèY••ÅÕ”èé™É½´¡l(€€€€€€€€€€€€€€€=¬¡Ù•Œ…lÄ°€Ét¤°(€€€€€€€€€€€€€€€=¬¡Y•Œèé¹•Ü ¤¤°(€€€€€€€€€€€€€€€=¬¡Ù•Œ…lÌ°€Ñt¤°(€€€€€€€€€€€t¤°(€€€€€€€€€€€ÝÉ¥ÑÑ•¸èY•Œèé¹•Ü ¤°(€€€€€€€ôì(€€€€€€€±•ÐµÕÐ¥¼€ô•…‘±¥¹•%¼èé¹•Ý}Ý¥Ñ¡}é•É½}É•…‘}É•ÑÉä (€€€€€€€€€€€€™µÕÐÍÉ¥ÁÑ•°(€€€€€€€€€€€%¹ÍÑ…¹Ðèé¹½Ü ¤€¬ÕÉ…Ñ¥½¸èé™É½µ}Í•Ì Ä¤°(€€€€€€€€€€€ÑÉÕ”°(€€€€€€€€¤ì(€€€€€€€±•ÐµÕÐ‰Õ™™•È€ôlÁÔàì€Ñtì(€€€€€€€¥¼¹É•…‘}•á…Ð ™µÕÐ‰Õ™™•È¤¹•áÁ•Ð ‰É•…½µÁ±•Ñ•Ìˆ¤ì(€€€€€€€…ÍÍ•ÉÑ}•Ä„¡‰Õ™™•È°lÄ°€È°€Ì°€Ñt¤ì(€€€ô((€€€€mÑ•ÍÑt(€€€™¸‘•…‘±¥¹•}¥½}ÑÕÉ¹Í}Á•Éµ…¹•¹Ñ}é•É½}É•…‘}¥¹Ñ½}Ñ¥µ•½ÕÐ ¤ì(€€€€€€€±•ÐµÕÐÍÉ¥ÁÑ•€ôMÉ¥ÁÑ•‘%¼ì(€€€€€€€€€€€É•…‘ÌèY••ÅÕ”èé™É½´¡m=¬¡Y•Œèé¹•Ü ¤¥t¤°(€€€€€€€€€€€ÝÉ¥ÑÑ•¸èY•Œèé¹•Ü ¤°(€€€€€€€ôì(€€€€€€€±•ÐµÕÐ¥¼€ô•…‘±¥¹•%¼èé¹•Ý}Ý¥Ñ¡}é•É½}É•…‘}É•ÑÉä (€€€€€€€€€€€€™µÕÐÍÉ¥ÁÑ•°(€€€€€€€€€€€%¹ÍÑ…¹Ðèé¹½Ü ¤°(€€€€€€€€€€€ÑÉÕ”°(€€€€€€€€¤ì(€€€€€€€±•Ð•ÉÉ½È€ô¥¼¹É•… ™µÕÐlÁÔàì€Åt¤¹•áÁ•Ñ}•ÉÈ ‰‘•…‘±¥¹”µÕÍÐ•áÁ¥É”ˆ¤ì(€€€€€€€…ÍÍ•ÉÑ}•Ä„¡•ÉÉ½È¹­¥¹ ¤°¥¼èéÉÉ½É-¥¹èéQ¥µ•‘=ÕÐ¤ì(€€€ô((€€€€mÑ•ÍÑt(€€€™¸‘•…‘±¥¹•}¥½}ÁÉ•Í•ÉÙ•Í}ÍÑ…¹‘…É‘}•½™}Ý¡•¹}é•É½}É•ÑÉå}¥Í}‘¥Í…‰±• ¤ì(€€€€€€€±•ÐµÕÐÍÉ¥ÁÑ•€ôMÉ¥ÁÑ•‘%¼ì(€€€€€€€€€€€É•…‘ÌèY••ÅÕ”èé™É½´¡m=¬¡Y•Œèé¹•Ü ¤¥t¤°(€€€€€€€€€€€ÝÉ¥ÑÑ•¸èY•Œèé¹•Ü ¤°(€€€€€€€ôì(€€€€€€€±•ÐµÕÐ¥¼€ô•…‘±¥¹•%¼èé¹•Ý}Ý¥Ñ¡}é•É½}É•…‘}É•ÑÉä (€€€€€€€€€€€€™µÕÐÍÉ¥ÁÑ•°(€€€€€€€€€€€%¹ÍÑ…¹Ðèé¹½Ü ¤€¬ÕÉ…Ñ¥½¸èé™É½µ}Í•Ì Ä¤°(€€€€€€€€€€€™…±Í”°(€€€€€€€€¤ì(€€€€€€€…ÍÍ•ÉÑ}•Ä„¡¥¼¹É•… ™µÕÐlÁÔàì€Åt¤¹•áÁ•Ð ‰=¥ÌÉ•ÑÕÉ¹•ˆ¤°€À¤ì(€€€ô((€€€€mÑ•ÍÑt(€€€™¸‘•…‘±¥¹•}¥½}•µÁÑå}‰Õ™™•É}É•ÑÕÉ¹Í}¥µµ•‘¥…Ñ•±ä ¤ì(€€€€€€€±•ÐµÕÐÍÉ¥ÁÑ•€ôMÉ¥ÁÑ•‘%¼ì(€€€€€€€€€€€É•…‘ÌèY••ÅÕ”èé¹•Ü ¤°(€€€€€€€€€€€ÝÉ¥ÑÑ•¸èY•Œèé¹•Ü ¤°(€€€€€€€ôì(€€€€€€€±•ÐµÕÐ¥¼€ô•…‘±¥¹•%¼èé¹•Ý}Ý¥Ñ¡}é•É½}É•…‘}É•ÑÉä (€€€€€€€€€€€€™µÕÐÍÉ¥ÁÑ•°(€€€€€€€€€€€%¹ÍÑ…¹Ðèé¹½Ü ¤°(€€€€€€€€€€€ÑÉÕ”°(€€€€€€€€¤ì(€€€€€€€…ÍÍ•ÉÑ}•Ä„¡¥¼¹É•… ™µÕÐmt¤¹•áÁ•Ð ‰•µÁÑäÉ•…ÍÕ••‘Ìˆ¤°€À¤ì(€€€ô((€€€€mÑ•ÍÑt(€€€™¸‘•…‘±¥¹•}¥½}ÑÕÉ¹Í}Á•Éµ…¹•¹Ñ}Ý½Õ±‘}‰±½­}¥¹Ñ½}Ñ¥µ•½ÕÐ ¤ì(€€€€€€€±•ÐµÕÐÍÉ¥ÁÑ•€ôMÉ¥ÁÑ•‘%¼ì(€€€€€€€€€€€É•…‘ÌèY••ÅÕ”èé™É½´¡mÉÈ¡¥¼èéÉÉ½Èèé™É½´¡¥¼èéÉÉ½É-¥¹èé]½Õ±‘	±½¬¤¥t¤°(€€€€€€€€€€€ÝÉ¥ÑÑ•¸èY•Œèé¹•Ü ¤°(€€€€€€€ôì(€€€€€€€±•ÐµÕÐ¥¼€ô•…‘±¥¹•%¼èé¹•Ü ™µÕÐÍÉ¥ÁÑ•°%¹ÍÑ…¹Ðèé¹½Ü ¤¤ì(€€€€€€€±•Ð•ÉÉ½È€ô¥¼¹É•… ™µÕÐlÁÔàì€Åt¤¹•áÁ•Ñ}•ÉÈ ‰‘•…‘±¥¹”µÕÍÐ•áÁ¥É”ˆ¤ì(€€€€€€€…ÍÍ•ÉÑ}•Ä„¡•ÉÉ½È¹­¥¹ ¤°¥¼èéÉÉ½É-¥¹èéQ¥µ•‘=ÕÐ¤ì(€€€ô((€€€€mÑ•ÍÑt(€€€™¸é•É½}‘ÕÉ…Ñ¥½¹}½¹¹•Ñ¥½¹}¥Í}É•©•Ñ•‘}‰•™½É•}•¹‘Á½¥¹Ñ}±½½­ÕÀ ¤ì(€€€€€€€±•Ð•ÉÉ½È€ô½¹¹•Ñ}±¥•¹Ñ}Ý¥Ñ¡}Ñ¥µ•½ÕÐ¡ÕÉ…Ñ¥½¸èéiI<¤(€€€€€€€€€€€€¹•áÁ•Ñ}•ÉÈ ‰é•É¼½¹¹•Ñ¥½¸Ñ¥µ•½ÕÐµÕÍÐ™…¥°ˆ¤ì(€€€€€€€…ÍÍ•ÉÐ„¡¥Í}É•…‘}Ñ¥µ•½ÕÐ ™•ÉÉ½È¤¤ì(€€€ô((€€€€mÑ•ÍÑt(€€€™¸é•É½}‘ÕÉ…Ñ¥½¹}…±±}¥Í}É•©•Ñ•‘}‰•™½É•}½¹¹•Ñ¥¹œ ¤ì(€€€€€€€±•Ð±¥•¹Ð€ô…•µ½¹IÁ±¥•¹Ðèé¹•Ü ¤ì(€€€€€€€±•Ð•ÉÉ½È€ô±¥•¹Ð(€€€€€€€€€€€€¹…±±}Ý¥Ñ¡}Ñ¥µ•½ÕÐ (€€€€€€€€€€€€€€€IÁI•ÅÕ•ÍÐèé¹•Ü Ä°IÁ5•Ñ¡½èéA¥¹œ¤°(€€€€€€€€€€€€€€€ÕÉ…Ñ¥½¸èéiI<°(€€€€€€€€€€€€¤(€€€€€€€€€€€€¹•áÁ•Ñ}•ÉÈ ‰é•É¼Ñ¥µ•½ÕÐµÕÍÐ™…¥°ˆ¤ì(€€€€€€€…ÍÍ•ÉÐ„¡¥Í}É•…‘}Ñ¥µ•½ÕÐ ™•ÉÉ½È¤¤ì(€€€ô)ô(