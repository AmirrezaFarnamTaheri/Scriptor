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
    RpcEventPayload, RpcMethod, RpcRequest, RpcResponse, ServerMessage,
};

use crate::locks::lock_recover;
use crate::transport::{connect_authenticated_client, read_endpoint};

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
const EVENT_RECONNECT_INITIAL_DELAY: Duration = Duration::from_millis(250);
const EVENT_RECONNECT_MAX_DELAY: Duration = Duration::from_secs(5);

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
}

impl<'a, T> DeadlineIo<'a, T> {
    fn new(inner: &'a mut T, deadline: Instant) -> Self {
        Self { inner, deadline }
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
        loop {
            match self.inner.read(buffer) {
                Err(error) if error.kind() == io::ErrorKind::Interrupted => continue,
                Err(error) if error.kind() == io::ErrorKind::WouldBlock => self.wait_for_io()?,
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
fn connect_client_with_timeout(
    timeout: Duration,
) -> Result<(LocalSocketStream, Option<String>), IpcError> {
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

    let retry_budget = Duration::from_millis(500).min(timeout);
    let start = Instant::now();
    let stream = loop {
        match ConnectOptions::new()
            .name(name.clone())
            .wait_mode(ConnectWaitMode::Timeout(timeout))
            .nonblocking_stream(cfg!(windows))
            .connect_sync()
        {
            Ok(s) => break s,
            Err(e) if e.kind() == io::ErrorKind::NotFound || e.kind() == io::ErrorKind::WouldBlock || e.kind() == io::ErrorKind::ConnectionRefused => {
                if start.elapsed() >= retry_budget {
                    return Err(IpcError::Io(e));
                }
                std::thread::sleep(Duration::from_millis(10));
            }
            Err(e) => return Err(IpcError::from(e)),
        }
    };
    Ok((stream, endpoint.nonce))
}

type EventHandler = Box<dyn Fn(RpcEvent) + Send + Sync>;

fn connect_event_stream() -> Result<LocalSocketStream, IpcError> {
    let (mut stream, endpoint) = connect_authenticated_client()?;
    let mut subscribe = RpcRequest::new(0, RpcMethod::SubscribeEvents);
    subscribe.endpoint_nonce = endpoint.nonce;
    write_frame(&mut stream, &subscribe)?;
    Ok(stream)
}

fn dispatch_event(handlers: &Arc<Mutex<Vec<EventHandler>>>, event: RpcEvent) {
    let handlers = lock_recover(handlers);
    for handler in handlers.iter() {
        handler(event.clone());
    }
}

/// Handle on the background thread that receives daemon events.
struct EventListener {
    stop: Arc<AtomicBool>,
    handle: thread::JoinHandle<()>,
}

struct AuthenticatedStream {
    stream: LocalSocketStream,
    endpoint_nonce: Option<String>,
}

struct ClientInner {
    stream: Mutex<Option<AuthenticatedStream>>,
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
    /// handle, and a receive timeout would let a poll wake mid-frame and desync
    /// the stream). Joining would therefore block the caller — often a UI
    /// command thread — until the daemon happens to send something. Instead the
    /// stop flag makes the thread stop dispatching immediately and exit at its
    /// next wake-up, which for the usual `reset()` trigger (daemon restart) is
    /// the moment the socket closes. `ensure_event_listener` reaps the finished
    /// handle.
    fn stop_event_listener(&self) {
        if let Some(listener) = lock_recover(&self.listener).take() {
            listener.stop.store(true, Ordering::SeqCst);
            drop(listener.handle);
        }
    }

    fn register_event_handler(&self, handler: EventHandler) {
        lock_recover(&self.event_handlers).push(handler);
        self.ensure_event_listener();
    }

    fn ensure_event_listener(&self) {
        let mut guard = lock_recover(&self.listener);
        match guard.as_ref() {
            // Still running: nothing to do.
            Some(listener) if !listener.handle.is_finished() => return,
            // Exited on its own (daemon went away); reap it and start over.
            Some(_) => {
                if let Some(listener) = guard.take() {
                    let _ = listener.handle.join();
                }
            }
            None => {}
        }

        // Connect before claiming the slot. The previous implementation flipped
        // an `event_listener_started` flag first and returned early when the
        // connection failed, which permanently blocked every later attempt to
        // start a listener for the lifetime of the process.
        let mut stream = match connect_event_stream() {
            Ok(stream) => stream,
            Err(error) => {
                tracing::warn!(
                    target: "scriptor_daemon::client",
                    %error,
                    "event listener could not connect; will retry on next registration",
                );
                return;
            }
        };
        let handlers = Arc::clone(&self.event_handlers);
        let stop = Arc::new(AtomicBool::new(false));
        let thread_stop = Arc::clone(&stop);
        let handle = thread::spawn(move || {
            loop {
                while !thread_stop.load(Ordering::SeqCst) {
                    let body = match read_frame_resyncing(&mut stream) {
                        Ok(body) => body,
                        Err(_) => break,
                    };

                    // Re-check after the blocking read: a listener that was retired
                    // while waiting must not deliver stale events to handlers that
                    // a newer listener now owns.
                    if thread_stop.load(Ordering::SeqCst) {
                        return;
                    }

                    let event = match postcard::from_bytes::<ServerMessage>(&body) {
                        Ok(ServerMessage::Event(event)) => event,
                        Ok(ServerMessage::Response(_)) => continue,
                        Err(_) => continue,
                    };
                    dispatch_event(&handlers, event);
                }

                if thread_stop.load(Ordering::SeqCst) {
                    return;
                }

                let mut retry_delay = EVENT_RECONNECT_INITIAL_DELAY;
                loop {
                    if thread_stop.load(Ordering::SeqCst) {
                        return;
                    }
                    thread::sleep(retry_delay);
                    match connect_event_stream() {
                        Ok(next_stream) => {
                            stream = next_stream;
                            dispatch_event(
                                &handlers,
                                RpcEvent {
                                    payload: RpcEventPayload::ResyncRequired {
                                        reason: "daemon event stream reconnected".into(),
                                    },
                                },
                            );
                            break;
                        }
                        Err(error) => {
                            tracing::debug!(
                                target: "scriptor_daemon::client",
                                %error,
                                ?retry_delay,
                                "event listener reconnect pending",
                            );
                            retry_delay = (retry_delay * 2).min(EVENT_RECONNECT_MAX_DELAY);
                        }
                    }
                }
            }
        });

        *guard = Some(EventListener { stop, handle });
    }

    fn ensure_connected(
        &self,
        deadline: Instant,
    ) -> Result<std::sync::MutexGuard<'_, Option<AuthenticatedStream>>, IpcError> {
        if Instant::now() >= deadline {
            return Err(IpcError::Io(io::Error::new(
                io::ErrorKind::TimedOut,
                "RPC connection deadline exceeded",
            )));
        }

        let mut guard = lock_recover(&self.stream);
        if guard.is_none() {
            let remaining = deadline.checked_duration_since(Instant::now()).ok_or_else(|| {
                IpcError::Io(io::Error::new(
                    io::ErrorKind::TimedOut,
                    "RPC connection deadline exceeded",
                ))
            })?;
            if remaining.is_zero() {
                return Err(IpcError::Io(io::Error::new(
                    io::ErrorKind::TimedOut,
                    "RPC connection deadline exceeded",
                )));
            }

            // The timeout and Windows nonblocking mode are applied while the
            // stream is created. Applying them afterwards leaves `connect`
            // itself outside the whole-call deadline and can park forever on
            // a busy named pipe.
            let (stream, endpoint_nonce) = connect_client_with_timeout(remaining)?;
            #[cfg(not(windows))]
            {
                stream
                    .set_recv_timeout(Some(remaining))
                    .map_err(IpcError::from)?;
                stream
                    .set_send_timeout(Some(remaining))
                    .map_err(IpcError::from)?;
            }
            if Instant::now() >= deadline {
                return Err(IpcError::Io(io::Error::new(
                    io::ErrorKind::TimedOut,
                    "RPC connection deadline exceeded",
                )));
            }
            *guard = Some(AuthenticatedStream {
                stream,
                endpoint_nonce,
            });
        }
        Ok(guard)
    }

    fn dispatch_inline_event(&self, event: RpcEvent) {
        dispatch_event(&self.event_handlers, event);
    }

    fn read_response_frame<R: Read>(
        &self,
        stream: &mut R,
        request_id: u64,
        timeout: Duration,
    ) -> Result<RpcResponse, IpcError> {
        // Both bounds matter: the absolute I/O deadline stops a silent daemon
        // from parking the caller, and the frame budget stops a chatty daemon
        // whose response id never matches from doing the same.
        for _ in 0..MAX_UNMATCHED_FRAMES {
            let body = match read_frame_resyncing(stream) {
                Ok(body) => body,
                Err(error) if is_read_timeout(&error) => {
                    return Err(IpcError::Codec(format!(
                        "timed out after {:.3}s waiting for response to request {request_id}",
                        timeout.as_secs_f64()
                    )));
                }
                Err(error) => return Err(error),
            };
            if let Ok(message) = postcard::from_bytes::<ServerMessage>(&body) {
                match message {
                    ServerMessage::Response(response) => {
                        if response.id == request_id {
                            return Ok(response);
                        }
                    }
                    ServerMessage::Event(event) => self.dispatch_inline_event(event),
                }
                continue;
            }

            if let Ok(response) = postcard::from_bytes::<RpcResponse>(&body)
                && response.id == request_id
            {
                return Ok(response);
            }
        }

        Err(IpcError::Codec(format!(
            "gave up after {MAX_UNMATCHED_FRAMES} frames without a response matching request {request_id}"
        )))
    }

    fn call_once(
        &self,
        connection: &mut AuthenticatedStream,
        request: &RpcRequest,
        deadline: Instant,
        timeout: Duration,
    ) -> Result<RpcResponse, IpcError> {
        let remaining = deadline.checked_duration_since(Instant::now()).ok_or_else(|| {
            IpcError::Io(io::Error::new(
                io::ErrorKind::TimedOut,
                "RPC I/O deadline exceeded",
            ))
        })?;
        if remaining.is_zero() {
            return Err(IpcError::Io(io::Error::new(
                io::ErrorKind::TimedOut,
                "RPC I/O deadline exceeded",
            )));
        }
        #[cfg(not(windows))]
        {
            connection
                .stream
                .set_recv_timeout(Some(remaining))
                .map_err(IpcError::from)?;
            connection
                .stream
                .set_send_timeout(Some(remaining))
                .map_err(IpcError::from)?;
        }

        let mut authenticated_request = request.clone();
        authenticated_request.endpoint_nonce = connection.endpoint_nonce.clone();
        let mut io = DeadlineIo::new(&mut connection.stream, deadline);
        write_frame(&mut io, &authenticated_request)?;
        self.read_response_frame(&mut io, request.id, timeout)
    }

    fn call_with_timeout(
        &self,
        request: RpcRequest,
        timeout: Duration,
    ) -> Result<RpcResponse, IpcError> {
        if timeout.is_zero() {
            return Err(IpcError::Io(io::Error::new(
                io::ErrorKind::TimedOut,
                "RPC timeout must be greater than zero",
            )));
        }

        // One absolute deadline covers the initial attempt and the one allowed
        // reconnect. A short caller budget therefore cannot expand to two full
        // socket timeouts.
        let deadline = Instant::now() + timeout;
        let mut guard = self.ensure_connected(deadline)?;
        let stream = guard.as_mut().expect("connected stream");
        match self.call_once(stream, &request, deadline, timeout) {
            Ok(response) => Ok(response),
            Err(error) if should_reconnect(&error) && Instant::now() < deadline => {
                drop(guard);
                // Only the request socket is recycled here; the event listener
                // is independent and must survive an RPC-level reconnect.
                self.drop_stream();
                let mut guard = self.ensure_connected(deadline)?;
                let stream = guard.as_mut().expect("connected stream");
                self.call_once(stream, &request, deadline, timeout)
            }
            Err(error) => {
                // A timeout or a decode failure can leave unconsumed bytes in
                // the socket, so never reuse it for the next call.
                drop(guard);
                self.drop_stream();
                Err(error)
            }
        }
    }

    fn call(&self, request: RpcRequest) -> Result<RpcResponse, IpcError> {
        self.call_with_timeout(request, RPC_READ_TIMEOUT)
    }
}

/// Persistent local-socket session that multiplexes RPCs on one connection.
pub struct DaemonRpcClient {
    inner: ClientInner,
}

impl DaemonRpcClient {
    pub fn new() -> Self {
        Self {
            inner: ClientInner::new(),
        }
    }

    /// Drop the cached connection so the next `call` opens a fresh socket.
    pub fn reset(&self) {
        self.inner.reset();
    }

    pub fn register_event_handler(&self, handler: impl Fn(RpcEvent) + Send + Sync + 'static) {
        self.inner.register_event_handler(Box::new(handler));
    }

    pub fn call(&self, request: RpcRequest) -> Result<RpcResponse, IpcError> {
        self.inner.call(request)
    }

    /// Execute one RPC within a caller-supplied whole-call budget. The budget
    /// includes socket setup, request write, response read, and one reconnect.
    pub fn call_with_timeout(
        &self,
        request: RpcRequest,
        timeout: Duration,
    ) -> Result<RpcResponse, IpcError> {
        self.inner.call_with_timeout(request, timeout)
    }

    /// Whether a live event-listener thread is currently claimed by this client.
    #[cfg(test)]
    pub(crate) fn has_event_listener(&self) -> bool {
        lock_recover(&self.inner.listener).is_some()
    }
}

impl Default for DaemonRpcClient {
    fn default() -> Self {
        Self::new()
    }
}

static SHARED_CLIENT: LazyLock<DaemonRpcClient> = LazyLock::new(DaemonRpcClient::new);

pub fn shared_rpc_client() -> &'static DaemonRpcClient {
    &SHARED_CLIENT
}

/// Clear the process-wide RPC session (e.g. after daemon restart).
pub fn reset_rpc_session() {
    SHARED_CLIENT.reset();
}

pub fn register_rpc_event_handler(handler: impl Fn(RpcEvent) + Send + Sync + 'static) {
    SHARED_CLIENT.register_event_handler(handler);
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::VecDeque;

    struct ScriptedIo {
        reads: VecDeque<io::Result<Vec<u8>>>,
        written: Vec<u8>,
    }

    impl Read for ScriptedIo {
        fn read(&mut self, buffer: &mut [u8]) -> io::Result<usize> {
            match self.reads.pop_front().expect("scripted read") {
                Ok(bytes) => {
                    let count = bytes.len().min(buffer.len());
                    buffer[..count].copy_from_slice(&bytes[..count]);
                    if count < bytes.len() {
                        self.reads.push_front(Ok(bytes[count..].to_vec()));
                    }
                    Ok(count)
                }
                Err(error) => Err(error),
            }
        }
    }

    impl Write for ScriptedIo {
        fn write(&mut self, buffer: &[u8]) -> io::Result<usize> {
            self.written.extend_from_slice(buffer);
            Ok(buffer.len())
        }

        fn flush(&mut self) -> io::Result<()> {
            Ok(())
        }
    }

    #[test]
    fn deadline_io_retries_would_block_without_losing_partial_read() {
        let mut scripted = ScriptedIo {
            reads: VecDeque::from([
                Ok(vec![1, 2]),
                Err(io::Error::from(io::ErrorKind::WouldBlock)),
                Ok(vec![3, 4]),
            ]),
            written: Vec::new(),
        };
        let mut io = DeadlineIo::new(&mut scripted, Instant::now() + Duration::from_secs(1));
        let mut buffer = [0u8; 4];
        io.read_exact(&mut buffer).expect("read completes");
        assert_eq!(buffer, [1, 2, 3, 4]);
    }

    #[test]
    fn deadline_io_turns_permanent_would_block_into_timeout() {
        let mut scripted = ScriptedIo {
            reads: VecDeque::from([Err(io::Error::from(io::ErrorKind::WouldBlock))]),
            written: Vec::new(),
        };
        let mut io = DeadlineIo::new(&mut scripted, Instant::now());
        let error = io.read(&mut [0u8; 1]).expect_err("deadline must expire");
        assert_eq!(error.kind(), io::ErrorKind::TimedOut);
    }

    #[test]
    fn zero_duration_connection_is_rejected_before_endpoint_lookup() {
        let error = connect_client_with_timeout(Duration::ZERO)
            .expect_err("zero connection timeout must fail");
        assert!(is_read_timeout(&error));
    }

    #[test]
    fn zero_duration_call_is_rejected_before_connecting() {
        let client = DaemonRpcClient::new();
        let error = client
            .call_with_timeout(
                RpcRequest::new(1, RpcMethod::Ping),
                Duration::ZERO,
            )
            .expect_err("zero timeout must fail");
        assert!(is_read_timeout(&error));
    }
}
