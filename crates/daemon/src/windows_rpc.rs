use std::io::{self, Read, Write};
use std::sync::{Mutex, OnceLock};
use std::thread;
use std::time::{Duration, Instant};

use interprocess::ConnectWaitMode;
use interprocess::local_socket::prelude::*;
use interprocess::local_socket::{ConnectOptions, GenericNamespaced};
use scriptor_ipc::{
    IpcError, RpcRequest, RpcResponse, ServerMessage, fuzz_corpus::is_expected_disconnect,
    read_frame_resyncing, write_frame,
};

use crate::transport::{DaemonEndpoint, read_endpoint};

const RETRY_INTERVAL: Duration = Duration::from_millis(5);
const MAX_UNMATCHED_FRAMES: usize = 512;

static ENDPOINT_CACHE: OnceLock<Mutex<Option<DaemonEndpoint>>> = OnceLock::new();

fn endpoint_cache() -> &'static Mutex<Option<DaemonEndpoint>> {
    ENDPOINT_CACHE.get_or_init(|| Mutex::new(None))
}

fn cached_endpoint() -> Result<DaemonEndpoint, IpcError> {
    let mut guard = endpoint_cache()
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    if let Some(endpoint) = guard.as_ref() {
        return Ok(endpoint.clone());
    }
    let endpoint = read_endpoint()?;
    *guard = Some(endpoint.clone());
    Ok(endpoint)
}

fn invalidate_endpoint_cache() {
    let mut guard = endpoint_cache()
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    *guard = None;
}

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
                "Windows named-pipe RPC deadline exceeded",
            ));
        }
        thread::sleep((self.deadline - now).min(RETRY_INTERVAL));
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
                // PIPE_NOWAIT can report an empty pipe as a zero-byte read while
                // the server is still preparing the response. Retrying here
                // preserves read_exact's partial frame buffer.
                Ok(0) => self.wait_for_io()?,
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

fn remaining(deadline: Instant) -> Result<Duration, IpcError> {
    deadline
        .checked_duration_since(Instant::now())
        .filter(|duration| !duration.is_zero())
        .ok_or_else(|| {
            IpcError::Io(io::Error::new(
                io::ErrorKind::TimedOut,
                "Windows named-pipe RPC deadline exceeded",
            ))
        })
}

fn call_once(request: &mut RpcRequest, deadline: Instant) -> Result<RpcResponse, IpcError> {
    let endpoint = cached_endpoint()?;
    request.endpoint_nonce = endpoint.nonce;
    let name = endpoint
        .socket_name
        .as_str()
        .to_ns_name::<GenericNamespaced>()
        .map_err(|error| IpcError::Codec(error.to_string()))?;
    let mut stream = ConnectOptions::new()
        .name(name)
        .wait_mode(ConnectWaitMode::Timeout(remaining(deadline)?))
        .nonblocking_stream(true)
        .connect_sync()
        .map_err(IpcError::from)?;
    let mut io = DeadlineIo::new(&mut stream, deadline);
    write_frame(&mut io, request)?;

    for _ in 0..MAX_UNMATCHED_FRAMES {
        let body = read_frame_resyncing(&mut io)?;
        if let Ok(message) = postcard::from_bytes::<ServerMessage>(&body) {
            match message {
                ServerMessage::Response(response) if response.id == request.id => {
                    return Ok(response);
                }
                ServerMessage::Response(_) | ServerMessage::Event(_) => continue,
            }
        }
        if let Ok(response) = postcard::from_bytes::<RpcResponse>(&body)
            && response.id == request.id
        {
            return Ok(response);
        }
    }

    Err(IpcError::Codec(format!(
        "gave up after {MAX_UNMATCHED_FRAMES} frames without a response matching request {}",
        request.id
    )))
}

/// True when the daemon rejected the request as unauthenticated, which means the
/// endpoint snapshot we cached (including its nonce) is stale — typically the
/// daemon restarted and minted a fresh nonce that this client does not know.
fn is_unauthenticated(response: &RpcResponse) -> bool {
    matches!(
        &response.result,
        scriptor_ipc::RpcResult::Error(scriptor_ipc::RpcError::CommandFailed { code, .. })
            if code == "rpc.unauthenticated"
    )
}

pub(crate) fn call_with_timeout(
    mut request: RpcRequest,
    timeout: Duration,
) -> Result<RpcResponse, IpcError> {
    if timeout.is_zero() {
        return Err(IpcError::Io(io::Error::new(
            io::ErrorKind::TimedOut,
            "RPC timeout must be greater than zero",
        )));
    }

    let deadline = Instant::now() + timeout;
    match call_once(&mut request, deadline) {
        Ok(response) => {
            // A daemon restart leaves our cached nonce stale. If the server
            // responds `rpc.unauthenticated` (rather than failing the
            // connection), the only fix is to drop the cache and reconnect with
            // the freshly-persisted endpoint/nonce. Detect that at the RPC
            // layer so we do not retry the same stale nonce forever.
            if is_unauthenticated(&response) && Instant::now() < deadline {
                invalidate_endpoint_cache();
                return call_once(&mut request, deadline);
            }
            Ok(response)
        }
        Err(error)
            if Instant::now() < deadline
                && (is_expected_disconnect(&error) || matches!(error, IpcError::Io(_))) =>
        {
            // The daemon may have restarted between calls. Drop the verified
            // endpoint snapshot only after a connection-level failure so the
            // normal hot path does not re-read the endpoint file/keychain.
            invalidate_endpoint_cache();
            call_once(&mut request, deadline)
        }
        Err(error) => Err(error),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::VecDeque;

    struct ScriptedReader {
        reads: VecDeque<io::Result<Vec<u8>>>,
    }

    impl Read for ScriptedReader {
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

    #[test]
    fn zero_read_is_retried_without_losing_partial_progress() {
        let mut reader = ScriptedReader {
            reads: VecDeque::from([Ok(vec![1, 2]), Ok(Vec::new()), Ok(vec![3, 4])]),
        };
        let mut io = DeadlineIo::new(&mut reader, Instant::now() + Duration::from_secs(1));
        let mut buffer = [0u8; 4];
        io.read_exact(&mut buffer).expect("read completes");
        assert_eq!(buffer, [1, 2, 3, 4]);
    }

    #[test]
    fn permanent_zero_read_is_bounded_by_deadline() {
        let mut reader = ScriptedReader {
            reads: VecDeque::from([Ok(Vec::new())]),
        };
        let mut io = DeadlineIo::new(&mut reader, Instant::now());
        let error = io.read(&mut [0u8; 1]).expect_err("deadline expires");
        assert_eq!(error.kind(), io::ErrorKind::TimedOut);
    }

    #[test]
    fn empty_destination_buffer_returns_immediately() {
        let mut reader = ScriptedReader {
            reads: VecDeque::new(),
        };
        let mut io = DeadlineIo::new(&mut reader, Instant::now());
        assert_eq!(io.read(&mut []).expect("empty read succeeds"), 0);
    }
}
