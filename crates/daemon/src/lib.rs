pub mod command_gateway;
pub mod mcp_stdio;
pub mod client;
pub mod events;
pub mod export_job;
pub mod handler;
pub mod index_job;
pub mod locks;
pub mod transport;
pub mod watcher;

pub use client::{register_rpc_event_handler, reset_rpc_session, shared_rpc_client, DaemonRpcClient};
pub use handler::DaemonState;
pub use transport::{connect_client, default_socket_name, endpoint_file_path, read_endpoint, remove_endpoint_file, rpc_call, serve_forever, write_endpoint, DaemonEndpoint};
