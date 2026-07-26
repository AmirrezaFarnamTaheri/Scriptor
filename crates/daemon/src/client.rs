use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, LazyLock, Mutex};
use std::thread;

use interprocess::local_socket::prelude::LocalSocketStream;
use scriptor_ipc::{
    fuzz_corpus::is_expected_disconnect, read_frame_resyncing, write_frame, IpcError, RpcEvent, RpcMethod, RpcRequest,
    RpcResponse, ServerMessage,
};

use crate::transport::connect_client;

fn should_reconnect(error: &IpcError) -> bool {
    is_expected_disconnect(error) || matches!(error, IpcError::Io(_))
}

type EventHandler = Box<dyn Fn(RpcEvent) + Send + Sync>;

struct ClientInner {
    stream: Mutex<Option<LocalSocketStream>>,
    event_handlers: Arc<Mutex<Vec<EventHandler>>>,
    event_listener_started: AtomicBool,
}

impl ClientInner {
    fn new() -> Self {
        Self {
            stream: Mutex::new(None),
            event_handlers: Arc::new(Mutex::new(Vec::new())),
            event_listener_started: AtomicBool::new(false),
        }
    }

    fn reset(&self) {
        *self.stream.lock().expect("rpc client lock") = None;
        self.event_listener_started.store(false, Ordering::SeqCst);
    }

    fn register_event_handler(&self, handler: EventHandler) {
        self.event_handlers
            .lock()
            .expect("event handlers lock")
            .push(handler);
        self.ensure_event_listener();
    }

    fn ensure_event_listener(&self) {
        if self.event_listener_started.swap(true, Ordering::SeqCst) {
            return;
        }

        let handlers = Arc::clone(&self.event_handlers);
        thread::spawn(move || {
            let Ok(mut stream) = connect_client() else {
                return;
            };
            let subscribe = RpcRequest::new(0, RpcMethod::SubscribeEvents);
            if write_frame(&mut stream, &subscribe).is_err() {
                return;
            }
            loop {
                let body = match read_frame_resyncing(&mut stream) {
                    Ok(body) => body,
                    Err(error) if is_expected_disconnect(&error) => break,
                    Err(_) => break,
                };

                let event = match postcard::from_bytes::<ServerMessage>(&body) {
                    Ok(ServerMessage::Event(event)) => event,
                    Ok(ServerMessage::Response(_)) => continue,
                    Err(_) => continue,
                };

                let guard = handlers.lock().expect("event handlers lock");
                for handler in guard.iter() {
                    handler(event.clone());
                }
            }
        });
    }

    fn ensure_connected(&self) -> Result<std::sync::MutexGuard<'_, Option<LocalSocketStream>>, IpcError> {
        let mut guard = self.stream.lock().expect("rpc client lock");
        if guard.is_none() {
            *guard = Some(connect_client()?);
        }
        Ok(guard)
    }

    fn dispatch_inline_event(&self, event: RpcEvent) {
        let handlers = self.event_handlers.lock().expect("event handlers lock");
        for handler in handlers.iter() {
            handler(event.clone());
        }
    }

    fn read_response_frame(
        &self,
        stream: &mut LocalSocketStream,
        request_id: u64,
    ) -> Result<RpcResponse, IpcError> {
        loop {
            let body = read_frame_resyncing(stream)?;
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
                self.reset();
                let mut guard = self.ensure_connected()?;
                let stream = guard.as_mut().expect("connected stream");
                write_frame(stream, &request)?;
                self.read_response_frame(stream, request.id)
            }
            Err(error) => Err(error),
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
