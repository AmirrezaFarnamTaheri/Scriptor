use std::fs;
use std::path::{Path, PathBuf};

use scriptor_ipc::{read_frame, write_frame, IpcError, RpcRequest, RpcResponse};
use scriptor_system_bridge::scriptor_data_dir;
use interprocess::local_socket::prelude::*;
use interprocess::local_socket::{GenericFilePath, GenericNamespaced, ListenerOptions, Name};
use serde::{Deserialize, Serialize};

use crate::handler::DaemonState;

const SOCKET_BASENAME: &str = "scriptor-core";
const ENDPOINT_FILE: &str = "daemon-endpoint.json";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct DaemonEndpoint {
    pub socket_name: String,
    pub pid: u32,
}

pub fn default_socket_name() -> Result<String, IpcError> {
    if cfg!(windows) {
        Ok(SOCKET_BASENAME.to_string())
    } else {
        let data_dir = scriptor_data_dir("scriptor").map_err(|error| IpcError::Codec(error.to_string()))?;
        let socket_path = data_dir.join(format!("{SOCKET_BASENAME}.sock"));
        Ok(socket_path.display().to_string())
    }
}

pub fn endpoint_file_path() -> Result<PathBuf, IpcError> {
    let data_dir = scriptor_data_dir("scriptor").map_err(|error| IpcError::Codec(error.to_string()))?;
    Ok(data_dir.join(ENDPOINT_FILE))
}

pub fn write_endpoint(socket_name: &str) -> Result<(), IpcError> {
    let endpoint = DaemonEndpoint {
        socket_name: socket_name.to_string(),
        pid: std::process::id(),
    };
    let json = serde_json::to_string_pretty(&endpoint).map_err(|error| IpcError::Codec(error.to_string()))?;
    fs::write(endpoint_file_path()?, json).map_err(IpcError::from)
}

pub fn read_endpoint() -> Result<DaemonEndpoint, IpcError> {
    let bytes = fs::read(endpoint_file_path()?).map_err(IpcError::from)?;
    serde_json::from_slice(&bytes).map_err(|error| IpcError::Codec(error.to_string()))
}

fn resolve_name(path: &str) -> Result<Name<'_>, IpcError> {
    if cfg!(windows) {
        path.to_ns_name::<GenericNamespaced>()
            .map_err(|error| IpcError::Codec(error.to_string()))
    } else {
        Path::new(path)
            .to_fs_name::<GenericFilePath>()
            .map_err(|error| IpcError::Codec(error.to_string()))
    }
}

pub fn connect_client() -> Result<LocalSocketStream, IpcError> {
    let endpoint = read_endpoint()?;
    let name = resolve_name(&endpoint.socket_name)?;
    LocalSocketStream::connect(name.borrow()).map_err(IpcError::from)
}

pub fn serve_forever(socket_path: Option<String>) -> Result<(), IpcError> {
    let resolved = socket_path.unwrap_or_else(|| default_socket_name().expect("socket name"));
    if !cfg!(windows) {
        if let Some(parent) = Path::new(&resolved).parent() {
            fs::create_dir_all(parent).map_err(IpcError::from)?;
        }
    }
    let name = resolve_name(&resolved)?;
    let listener = ListenerOptions::new()
        .name(name.borrow())
        .create_sync()
        .map_err(IpcError::from)?;
    write_endpoint(&resolved)?;

    let mut state = DaemonState::default();
    loop {
        let mut stream = listener.accept().map_err(IpcError::from)?;
        if let Err(error) = handle_connection(&mut stream, &mut state) {
            eprintln!("scriptor-daemon connection error: {error}");
        }
    }
}

fn handle_connection(stream: &mut LocalSocketStream, state: &mut DaemonState) -> Result<(), IpcError> {
    let body = read_frame(stream)?;
    let request: RpcRequest = postcard::from_bytes(&body).map_err(|error| IpcError::Codec(error.to_string()))?;
    let response = state.handle(request);
    write_frame(stream, &response)
}

pub fn rpc_call(request: RpcRequest) -> Result<RpcResponse, IpcError> {
    let mut stream = connect_client()?;
    write_frame(&mut stream, &request)?;
    let body = read_frame(&mut stream)?;
    postcard::from_bytes(&body).map_err(|error| IpcError::Codec(error.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use scriptor_ipc::{RpcMethod, RpcRequest, RpcResult};
    use std::sync::Mutex;
    use std::time::Duration;

    static ENDPOINT_LOCK: Mutex<()> = Mutex::new(());

    fn test_socket_name() -> (String, Option<tempfile::TempDir>) {
        if cfg!(windows) {
            (format!("scriptor-test-{}", std::process::id()), None)
        } else {
            let dir = tempfile::tempdir().expect("tempdir");
            let socket = dir.path().join("ipc.sock").display().to_string();
            (socket, Some(dir))
        }
    }

    #[test]
    fn endpoint_roundtrip() {
        let _guard = ENDPOINT_LOCK.lock().expect("lock");
        let socket = default_socket_name().expect("socket");
        write_endpoint(&socket).expect("write");
        let endpoint = read_endpoint().expect("read");
        assert_eq!(endpoint.socket_name, socket);
    }

    #[test]
    fn rpc_roundtrip_over_socket() {
        let _guard = ENDPOINT_LOCK.lock().expect("lock");
        let (socket, _socket_dir) = test_socket_name();
        write_endpoint(&socket).expect("write endpoint");

        let socket_for_server = socket.clone();
        let server = std::thread::spawn(move || {
            let name = resolve_name(&socket_for_server).expect("name");
            let listener = ListenerOptions::new()
                .name(name.borrow())
                .create_sync()
                .expect("listener");
            let mut stream = listener.accept().expect("accept");
            let mut state = DaemonState::default();
            handle_connection(&mut stream, &mut state).expect("handle");
        });

        std::thread::sleep(Duration::from_millis(250));
        let response = rpc_call(RpcRequest {
            id: 1,
            method: RpcMethod::Ping,
        })
        .expect("rpc");
        assert!(matches!(response.result, RpcResult::Ok(_)));
        server.join().expect("server thread");
    }
}
