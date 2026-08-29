pub mod automation_stdio;
pub mod capabilities;
pub mod client;
pub mod command_gateway;
pub mod events;
pub mod export_job;
pub mod handler;
pub mod index_job;
pub mod locks;
pub mod transport;
pub mod watcher;
#[cfg(windows)]
mod windows_rpc;

use std::time::Duration;

use scriptor_ipc::{IpcError, RpcEvent, RpcRequest, RpcResponse};

pub use client::{DaemonRpcClient, register_rpc_event_handler, reset_rpc_session};
pub use handler::DaemonState;
pub use transport::{
    DaemonEndpoint, connect_client, default_socket_name, endpoint_file_path, read_endpoint,
    remove_endpoint_file, serve_forever, write_endpoint,
};

/// Public process-wide RPC facade.
///
/// Unix retains the existing persistent request session. Windows local sockets
/// are named pipes and use a fresh bounded request adapter whose handle is
/// dropped before the call returns. The independent event-listener session is
/// not interrupted by one-shot request cleanup.
pub struct SharedRpcClient;

static SHARED_RPC_CLIENT: SharedRpcClient = SharedRpcClient;

pub fn shared_rpc_client() -> &'static SharedRpcClient {
    &SHARED_RPC_CLIENT
}

impl SharedRpcClient {
    pub fn call(&self, request: RpcRequest) -> Result<RpcResponse, IpcError> {
        self.call_with_timeout(request, Duration::from_secs(120))
    }

    pub fn call_with_timeout(
        &self,
        request: RpcRequest,
        timeout: Duration,
    ) -> Result<RpcResponse, IpcError> {
        #[cfg(windows)]
        {
            windows_rpc::call_with_timeout(request, timeout)
        }
        #[cfg(not(windows))]
        {
            client::shared_rpc_client().call_with_timeout(request, timeout)
        }
    }

    pub fn reset(&self) {
        client::shared_rpc_client().reset();
    }

    pub fn register_event_handler(&self, handler: impl Fn(RpcEvent) + Send + Sync + 'static) {
        client::shared_rpc_client().register_event_handler(handler);
    }
}

/// Execute one request through the platform-appropriate request session.
pub fn rpc_call(request: RpcRequest) -> Result<RpcResponse, IpcError> {
    shared_rpc_client().call(request)
}

#[cfg(test)]
mod tests {
    use super::*;
    use scriptor_ipc::RpcMethod;

    #[test]
    fn shared_facade_rejects_zero_timeout_without_connecting() {
        let error = shared_rpc_client()
            .call_with_timeout(RpcRequest::new(1, RpcMethod::Ping), Duration::ZERO)
            .expect_err("zero timeout must fail before endpoint lookup");
        assert!(matches!(
            error,
            IpcError::Io(ref io) if io.kind() == std::io::ErrorKind::TimedOut
        ));
    }
}
