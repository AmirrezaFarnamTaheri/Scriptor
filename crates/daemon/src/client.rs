use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, LazyLock, Mutex};
use std::thread;
use std::time::Duration;

use interprocess::local_socket::prelude::*;
use scriptor_ipc::{
    fuzz_corpus::is_expected_disconnect, read_frame_resyncing, write_frame, IpcError, RpcEvent, RpcMethod, RpcRequest,
    RpcResponse, ServerMessage,
};

use crate::locks::lock_recover;
use crate::transport::connect_client;

/// Upper bound on how long a single `call` waits for the daemon to answer.
/// Generous enough for the synchronous export/reindex RPCs, but finite: the
/// callers are UI command threads that must never block forever.
const RPC_READ_TIMEOUT: Duration = Duration::from_secs(120);

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
        lock_recover(&self.event_handlers)
            .push(handler);
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
        let mut stream = match connect_client() {
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
        let subscribe = RpcRequest::new(0, RpcMethod::SubscribeEvents);
        if let Err(error) = write_frame(&mut stream, &subscribe) {
            tracing::warn!(
                target: "scriptor_daemon::client",
                %error,
                "event listener could not subscribe; will retry on next registration",
            );
            return;
        }

        let handlers = Arc::clone(&self.event_handlers);
        let stop = Arc::new(AtomicBool::new(false));
        let thread_stop = Arc::clone(&stop);
        let handle = thread::spawn(move || {
            while !thread_stop.load(Ordering::SeqCst) {
                let body = match read_frame_resyncing(&mut stream) {
                    Ok(body) => body,
                    Err(_) => break,
                };

                // Re-check after the blocking read: a listener that was retired
                // while waiting must not deliver stale events to handlers that
                // a newer listener now owns.
                if thread_stop.load(Ordering::SeqCst) {
                    break;
                }

                let event = match postcard::from_bytes::<ServerMessage>(&body) {
                    Ok(ServerMessage::Event(event)) => event,
                    Ok(ServerMessage::Response(_)) => continue,
                    Err(_) => continue,
                };

                let handlers = lock_recover(&handlers);
                for handler in handlers.iter() {
                    handler(event.clone());
                }
            }
        });

        *guard = Some(EventListener { stop, handle });
    }

    fn ensure_connected(&self) -> Result<std::sync::MutexGuard<'_, Option<LocalSocketStream>>, IpcError> {
        let mut guard = lock_recover(&self.stream);
        if guard.is_none() {
            let stream = connect_client()?;
            stream
                .set_recv_timeout(Some(RPC_READ_TIMEOUT))
                .map_err(IpcError::from)?;
            *guard = Some(stream);
        }
        Ok(guard)
    }

    fn dispatch_inline_event(&self, event: RpcEvent) {
        let handlers = lock_recover(&self.event_handlers);
        for handler in handlers.iter() {
            handler(event.clone());
        }
    }

    fn read_response_frame(
        &self,
        stream: &mut LocalSocketStream,
        request_id: u64,
    ) -> Result<RpcResponse, IpcError> {
        // Both bounds matter: the socket-level receive timeout stops a silent
        // daemon from parking the caller, and the frame budget stops a chatty
        // one whose response id never matches from doing the same.
        for _ in 0..MAX_UNMATCHED_FRAMES {
            let body = match read_frame_resyncing(stream) {
                Ok(body) => body,
                Err(error) if is_read_timeout(&error) => {
                    return Err(IpcError::Codec(format!(
                        "timed out after {}s waiting for response to request {request_id}",
                        RPC_READ_TIMEOUT.as_secs()
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
                && response.id == request_id {
                    return Ok(response);
                }
        }

        Err(IpcError::Codec(format!(
            "gave up after {MAX_UNMATCHED_FRAMES} frames without a response matching request {request_id}"
        )))
    }

    fn call(&self, request: RpcRequest) -> Result<RpcResponse, IpcError> {
        let mut guard = self.ensure_connected()?;
        let stream = guard.as_mut().expect("connected stream");
        match (|| {
            write_frame(stream, &request)?;
            self.read_response_frame(stream, request.id)
        })() {
            Ok(response) => Ok(response),
            Err(error) if should_reconnect(&error) => {
                drop(guard);
                // Only the request socket is recycled here; the event listener
                // is independent and must survive an RPC-level reconnect.
                self.drop_stream();
                let mut guard = self.ensure_connected()?;
                let stream = guard.as_mut().expect("connected stream");
                write_frame(stream, &request)?;
                self.read_response_frame(stream, request.id)
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
