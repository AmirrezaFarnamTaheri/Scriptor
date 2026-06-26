use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use scriptor_ipc::{
    fuzz_corpus::is_expected_disconnect, read_frame_resyncing, write_frame, RateLimiter, IpcError, RpcMethod,
    RpcPayload, RpcRequest, RpcResponse, RpcResult, ServerMessage,
};
use scriptor_system_bridge::scriptor_data_dir;
use interprocess::local_socket::prelude::*;
use interprocess::local_socket::{GenericFilePath, GenericNamespaced, ListenerOptions, Name};
use serde::{Deserialize, Serialize};

use scriptor_export_runner::run_export_job;
use scriptor_indexer::rebuild_index;

use crate::command_gateway;
use crate::events::EventHub;
use crate::handler::DaemonState;
use crate::watcher::restart_vault_watcher;

const SOCKET_BASENAME: &str = "scriptor-core";
const ENDPOINT_FILE: &str = "daemon-endpoint.json";
const MAX_RPC_PER_CONNECTION_PER_SEC: u32 = 60;

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

pub fn remove_endpoint_file() -> Result<(), IpcError> {
    let path = endpoint_file_path()?;
    if path.exists() {
        fs::remove_file(&path).map_err(IpcError::from)?;
    }
    Ok(())
}

fn process_alive(pid: u32) -> bool {
    if pid == 0 {
        return false;
    }
    #[cfg(unix)]
    {
        std::process::Command::new("kill")
            .args(["-0", &pid.to_string()])
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .status()
            .map(|status| status.success())
            .unwrap_or(false)
    }
    #[cfg(windows)]
    {
        use std::ffi::c_void;
        unsafe extern "system" {
            fn OpenProcess(access: u32, inherit: i32, pid: u32) -> *mut c_void;
            fn CloseHandle(handle: *mut c_void) -> i32;
        }
        const PROCESS_QUERY_LIMITED_INFORMATION: u32 = 0x1000;
        unsafe {
            let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
            if handle.is_null() {
                return false;
            }
            CloseHandle(handle);
            true
        }
    }
}

fn verify_endpoint_process(endpoint: &DaemonEndpoint) -> Result<(), IpcError> {
    if process_alive(endpoint.pid) {
        return Ok(());
    }
    let _ = remove_endpoint_file();
    Err(IpcError::Codec(format!(
        "daemon endpoint stale (pid {} not running)",
        endpoint.pid
    )))
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
    verify_endpoint_process(&endpoint)?;
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

    struct EndpointCleanup;
    impl Drop for EndpointCleanup {
        fn drop(&mut self) {
            let _ = remove_endpoint_file();
        }
    }
    let _endpoint_guard = EndpointCleanup;

    let state = Arc::new(Mutex::new(DaemonState::default()));
    let event_hub = EventHub::new();
    loop {
        let stream = listener.accept().map_err(IpcError::from)?;
        let state = Arc::clone(&state);
        let event_hub = Arc::clone(&event_hub);
        std::thread::spawn(move || {
            if let Err(error) = handle_connection(stream, &state, &event_hub) {
                eprintln!("scriptor-daemon connection error: {error}");
            }
        });
    }
}

pub fn handle_connection(
    mut stream: LocalSocketStream,
    state: &Arc<Mutex<DaemonState>>,
    event_hub: &Arc<EventHub>,
) -> Result<(), IpcError> {
    let event_rx = event_hub.register();
    let mut limiter = RateLimiter::per_second(MAX_RPC_PER_CONNECTION_PER_SEC);

    let drain_events = |stream: &mut LocalSocketStream, event_rx: &std::sync::mpsc::Receiver<scriptor_ipc::RpcEvent>| {
        while let Ok(event) = event_rx.try_recv() {
            write_frame(stream, &ServerMessage::Event(event))?;
        }
        Ok::<(), IpcError>(())
    };

    loop {
        drain_events(&mut stream, &event_rx)?;
        let body = match read_frame_resyncing(&mut stream) {
            Ok(body) => body,
            Err(error) if is_expected_disconnect(&error) => return Ok(()),
            Err(error) => return Err(error),
        };
        let request: RpcRequest =
            postcard::from_bytes(&body).map_err(|error| IpcError::Codec(error.to_string()))?;

        if matches!(request.method, RpcMethod::SubscribeEvents) {
            let response = RpcResponse {
                id: request.id,
                result: RpcResult::Ok(RpcPayload::Unit),
            };
            write_frame(&mut stream, &ServerMessage::Response(response))?;
            loop {
                match event_rx.recv() {
                    Ok(event) => write_frame(&mut stream, &ServerMessage::Event(event))?,
                    Err(_) => return Ok(()),
                }
            }
        }

        let response = if limiter.allow() {
            dispatch_request(state, request, event_hub)
        } else {
            RpcResponse {
                id: request.id,
                result: RpcResult::Err("rate limit exceeded".into()),
            }
        };
        write_frame(&mut stream, &ServerMessage::Response(response))?;
        drain_events(&mut stream, &event_rx)?;
    }
}

fn dispatch_request(
    state: &Arc<Mutex<DaemonState>>,
    request: RpcRequest,
    event_hub: &Arc<EventHub>,
) -> RpcResponse {
    let id = request.id;
    let response = match request.method {
        RpcMethod::Invoke {
            command,
            payload_json,
        } if command_gateway::is_outside_lock_command(&command) => {
            dispatch_invoke_outside_lock(state, id, &command, &payload_json, event_hub)
        }
        RpcMethod::ExportRunNote { .. } | RpcMethod::ExportRunMarkdown { .. } => {
            dispatch_export_sync(state, id, &request.method)
        }
        RpcMethod::RebuildIndex => dispatch_rebuild_sync(state, id),
        RpcMethod::OpenVault { .. } => {
            let response = state.lock().expect("daemon state lock").handle(request);
            if matches!(response.result, RpcResult::Ok(RpcPayload::VaultOpened { .. })) {
                if let Err(error) = restart_vault_watcher(state) {
                    eprintln!("scriptor-daemon watcher start error: {error}");
                }
            }
            response
        }
        _ => state.lock().expect("daemon state lock").handle(request),
    };

    if let RpcResult::Ok(RpcPayload::ConfigReloaded { json, generation }) = &response.result {
        event_hub.broadcast_config_reloaded(json.clone(), *generation);
    }

    response
}

fn dispatch_invoke_outside_lock(
    state: &Arc<Mutex<DaemonState>>,
    id: u64,
    command: &str,
    payload_json: &str,
    _event_hub: &Arc<EventHub>,
) -> RpcResponse {
    let payload: serde_json::Value = match serde_json::from_str(payload_json) {
        Ok(value) => value,
        Err(error) => {
            return RpcResponse {
                id,
                result: RpcResult::Err(error.to_string()),
            };
        }
    };

    let result: Result<String, String> = match command {
        "export_run_note" | "export_run_markdown" => {
            let input = {
                let guard = state.lock().expect("daemon state lock");
                command_gateway::prepare_export_run(&guard, command, &payload)
            };
            match input {
                Ok(input) => run_export_job(input)
                    .map_err(|error| error.to_string())
                    .and_then(|output| serde_json::to_string(&output).map_err(|error| error.to_string())),
                Err(error) => Err(error),
            }
        }
        "indexer_rebuild" => {
            let session = {
                let guard = state.lock().expect("daemon state lock");
                guard.wait_index_rebuild();
                match guard.session().cloned() {
                    Some(session) => session,
                    None => {
                        return RpcResponse {
                            id,
                            result: RpcResult::Err(
                                "no vault is open; call OpenVault first".into(),
                            ),
                        };
                    }
                }
            };
            rebuild_index(&session, &[])
                .map_err(|error| error.to_string())
                .and_then(|summary| serde_json::to_string(&summary).map_err(|error| error.to_string()))
        }
        "vault_open" => match require_invoke_str(&payload, "root_path") {
            Ok(root_path) => {
                let output = {
                    let mut guard = state.lock().expect("daemon state lock");
                    match guard.open_vault_invoke(root_path) {
                        Ok(output) => output,
                        Err(error) => return RpcResponse {
                            id,
                            result: RpcResult::Err(error),
                        },
                    }
                };
                if let Err(error) = restart_vault_watcher(state) {
                    eprintln!("scriptor-daemon watcher start error: {error}");
                }
                serde_json::to_string(&output).map_err(|error| error.to_string())
            }
            Err(error) => Err(error),
        }
        other => Err(format!("unsupported outside-lock invoke command: {other}")),
    };

    match result {
        Ok(json) => RpcResponse {
            id,
            result: RpcResult::Ok(RpcPayload::Json { json }),
        },
        Err(message) => RpcResponse {
            id,
            result: RpcResult::Err(message),
        },
    }
}

fn require_invoke_str(payload: &serde_json::Value, key: &str) -> Result<String, String> {
    payload
        .get(key)
        .and_then(serde_json::Value::as_str)
        .map(str::to_string)
        .ok_or_else(|| format!("missing or invalid string field: {key}"))
}

fn dispatch_export_sync(state: &Arc<Mutex<DaemonState>>, id: u64, method: &RpcMethod) -> RpcResponse {
    let prepared = state
        .lock()
        .expect("daemon state lock")
        .prepare_export_input(method);
    let result = match prepared {
        Ok(input) => match run_export_job(input) {
            Ok(output) => {
                let json = match serde_json::to_string(&output) {
                    Ok(json) => json,
                    Err(error) => return RpcResponse {
                        id,
                        result: RpcResult::Err(error.to_string()),
                    },
                };
                RpcResult::Ok(RpcPayload::ExportResult { json })
            }
            Err(error) => RpcResult::Err(error.to_string()),
        },
        Err(error) => RpcResult::Err(error),
    };
    RpcResponse { id, result }
}

fn dispatch_rebuild_sync(state: &Arc<Mutex<DaemonState>>, id: u64) -> RpcResponse {
    let session = {
        let guard = state.lock().expect("daemon state lock");
        guard.wait_index_rebuild();
        match guard.session().cloned() {
            Some(session) => session,
            None => {
                return RpcResponse {
                    id,
                    result: RpcResult::Err("no vault is open; call OpenVault first".into()),
                };
            }
        }
    };

    let result = match rebuild_index(&session, &[]) {
        Ok(summary) => RpcResult::Ok(RpcPayload::RebuildSummary {
            indexed_notes: summary.indexed_notes,
            skipped_notes: summary.skipped_notes,
            links_written: summary.links_written,
        }),
        Err(error) => RpcResult::Err(error.to_string()),
    };
    RpcResponse { id, result }
}

pub fn rpc_call(request: RpcRequest) -> Result<RpcResponse, IpcError> {
    crate::client::shared_rpc_client().call(request)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::events::EventHub;
    use scriptor_ipc::{RpcEventPayload, RpcMethod, RpcPayload, RpcRequest, RpcResponse, RpcResult, ServerMessage};
    use std::sync::Mutex;
    use std::time::Duration;

    static ENDPOINT_LOCK: Mutex<()> = Mutex::new(());

    fn test_socket_name() -> (String, Option<tempfile::TempDir>) {
        static SOCKET_COUNTER: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
        let unique = SOCKET_COUNTER.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        if cfg!(windows) {
            (
                format!("scriptor-test-{}-{}", std::process::id(), unique),
                None,
            )
        } else {
            let dir = tempfile::tempdir().expect("tempdir");
            let socket = dir.path().join(format!("ipc-{unique}.sock")).display().to_string();
            (socket, Some(dir))
        }
    }

    fn teardown_rpc_session() {
        crate::client::reset_rpc_session();
    }

    fn decode_rpc_response_body(body: &[u8]) -> RpcResponse {
        if let Ok(ServerMessage::Response(response)) = postcard::from_bytes::<ServerMessage>(body) {
            return response;
        }
        postcard::from_bytes(body).expect("decode response")
    }

    fn spawn_test_handler(stream: LocalSocketStream, state: Arc<Mutex<DaemonState>>, event_hub: Arc<EventHub>) {
        std::thread::spawn(move || {
            let _ = handle_connection(stream, &state, &event_hub);
        });
    }

    fn endpoint_lock() -> std::sync::MutexGuard<'static, ()> {
        ENDPOINT_LOCK
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    #[test]
    fn endpoint_roundtrip() {
        let _guard = endpoint_lock();
        teardown_rpc_session();
        let socket = default_socket_name().expect("socket");
        write_endpoint(&socket).expect("write");
        let endpoint = read_endpoint().expect("read");
        assert_eq!(endpoint.socket_name, socket);
    }

    #[test]
    fn rpc_roundtrip_over_socket() {
        let _guard = endpoint_lock();
        teardown_rpc_session();
        let (socket, _socket_dir) = test_socket_name();
        write_endpoint(&socket).expect("write endpoint");

        let socket_for_server = socket.clone();
        let server = std::thread::spawn(move || {
            let name = resolve_name(&socket_for_server).expect("name");
            let listener = ListenerOptions::new()
                .name(name.borrow())
                .create_sync()
                .expect("listener");
            let stream = listener.accept().expect("accept");
            let state = Arc::new(Mutex::new(DaemonState::default()));
            let event_hub = EventHub::new();
            handle_connection(stream, &state, &event_hub).expect("handle");
        });

        std::thread::sleep(Duration::from_millis(250));
        let response = rpc_call(RpcRequest {
            id: 1,
            method: RpcMethod::Ping,
        })
        .expect("rpc");
        assert!(matches!(response.result, RpcResult::Ok(_)));
        teardown_rpc_session();
        server.join().expect("server thread");
    }

    #[test]
    fn rpc_session_multiplexes_on_single_connection() {
        let _guard = endpoint_lock();
        teardown_rpc_session();
        let (socket, _socket_dir) = test_socket_name();
        write_endpoint(&socket).expect("write endpoint");

        let socket_for_server = socket.clone();
        let server = std::thread::spawn(move || {
            let name = resolve_name(&socket_for_server).expect("name");
            let listener = ListenerOptions::new()
                .name(name.borrow())
                .create_sync()
                .expect("listener");
            let stream = listener.accept().expect("accept");
            let state = Arc::new(Mutex::new(DaemonState::default()));
            let event_hub = EventHub::new();
            handle_connection(stream, &state, &event_hub).expect("handle");
        });

        std::thread::sleep(Duration::from_millis(250));
        let client = crate::client::DaemonRpcClient::new();
        for id in 1..=20 {
            let response = client
                .call(RpcRequest {
                    id,
                    method: RpcMethod::Ping,
                })
                .expect("rpc");
            assert!(matches!(response.result, RpcResult::Ok(_)));
            std::thread::sleep(Duration::from_millis(18));
        }
        client.reset();
        server.join().expect("server thread");
    }

    #[test]
    fn accepts_parallel_ping_connections() {
        let _guard = endpoint_lock();
        teardown_rpc_session();
        let (socket, _socket_dir) = test_socket_name();
        write_endpoint(&socket).expect("write endpoint");

        let socket_for_server = socket.clone();
        let server = std::thread::spawn(move || {
            let name = resolve_name(&socket_for_server).expect("name");
            let listener = ListenerOptions::new()
                .name(name.borrow())
                .create_sync()
                .expect("listener");
            let state = Arc::new(Mutex::new(DaemonState::default()));
            let event_hub = EventHub::new();
            for _ in 0..2 {
                let stream = listener.accept().expect("accept");
                let state = Arc::clone(&state);
                let event_hub = Arc::clone(&event_hub);
                spawn_test_handler(stream, state, event_hub);
            }
            std::thread::sleep(Duration::from_millis(500));
        });

        std::thread::sleep(Duration::from_millis(250));
        let first = std::thread::spawn(|| {
            let client = crate::client::DaemonRpcClient::new();
            client.call(RpcRequest {
                id: 20,
                method: RpcMethod::Ping,
            })
        });
        let second = std::thread::spawn(|| {
            let client = crate::client::DaemonRpcClient::new();
            client.call(RpcRequest {
                id: 21,
                method: RpcMethod::Ping,
            })
        });
        assert!(matches!(
            first.join().expect("join").expect("rpc").result,
            RpcResult::Ok(_)
        ));
        assert!(matches!(
            second.join().expect("join").expect("rpc").result,
            RpcResult::Ok(_)
        ));
        server.join().expect("server thread");
    }

    #[test]
    fn rate_limit_rejects_sustained_burst_on_single_connection() {
        let _guard = endpoint_lock();
        teardown_rpc_session();
        let (socket, _socket_dir) = test_socket_name();
        write_endpoint(&socket).expect("write endpoint");

        let socket_for_server = socket.clone();
        let server = std::thread::spawn(move || {
            let name = resolve_name(&socket_for_server).expect("name");
            let listener = ListenerOptions::new()
                .name(name.borrow())
                .create_sync()
                .expect("listener");
            let stream = listener.accept().expect("accept");
            let state = Arc::new(Mutex::new(DaemonState::default()));
            let event_hub = EventHub::new();
            handle_connection(stream, &state, &event_hub).expect("handle");
        });

        std::thread::sleep(Duration::from_millis(250));
        let name = resolve_name(&socket).expect("name");
        let mut stream = LocalSocketStream::connect(name.borrow()).expect("connect");

        let mut limited = 0u32;
        for id in 0..65 {
            write_frame(
                &mut stream,
                &RpcRequest {
                    id,
                    method: RpcMethod::Ping,
                },
            )
            .expect("write");
            let body = read_frame_resyncing(&mut stream).expect("read");
            let response = decode_rpc_response_body(&body);
            if matches!(response.result, RpcResult::Err(ref message) if message.contains("rate limit")) {
                limited += 1;
            }
        }

        assert!(
            limited >= 5,
            "expected sustained burst to hit per-connection rate limit, got {limited} rejections"
        );
        drop(stream);
        server.join().expect("server thread");
    }

    #[test]
    fn ping_succeeds_during_background_export() {
        let _guard = endpoint_lock();
        teardown_rpc_session();
        let dir = tempfile::tempdir().expect("tempdir");
        std::fs::write(dir.path().join("alpha.md"), "# Alpha\n\nBody\n").expect("write");
        let vault_path = dir.path().display().to_string();

        let (socket, _socket_dir) = test_socket_name();
        write_endpoint(&socket).expect("write endpoint");

        let socket_for_server = socket.clone();
        let server = std::thread::spawn(move || {
            let name = resolve_name(&socket_for_server).expect("name");
            let listener = ListenerOptions::new()
                .name(name.borrow())
                .create_sync()
                .expect("listener");
            let state = Arc::new(Mutex::new(DaemonState::default()));
            {
                let mut daemon = state.lock().expect("daemon state lock");
                daemon.handle(RpcRequest {
                    id: 0,
                    method: RpcMethod::OpenVault {
                        path: vault_path,
                    },
                });
                daemon.wait_index_rebuild();
            }
            let stream = listener.accept().expect("accept");
            let state = Arc::clone(&state);
            let event_hub = EventHub::new();
            spawn_test_handler(stream, state, event_hub);
            std::thread::sleep(Duration::from_millis(500));
        });

        std::thread::sleep(Duration::from_millis(250));

        let export = std::thread::spawn(|| {
            rpc_call(RpcRequest {
                id: 32,
                method: RpcMethod::ExportStartNote {
                    note_path: "alpha.md".into(),
                    format: "html".into(),
                    dry_run: true,
                    extra_pandoc_args: vec![],
                    output_subdirectory: None,
                },
            })
        });
        let ping = std::thread::spawn(|| {
            rpc_call(RpcRequest {
                id: 33,
                method: RpcMethod::Ping,
            })
        });

        let export_resp = export.join().expect("export join").expect("export rpc");
        let ping_resp = ping.join().expect("ping join").expect("ping rpc");

        let export_ok = matches!(
            export_resp.result,
            RpcResult::Ok(RpcPayload::ExportStarted { .. })
        ) || matches!(
            &export_resp.result,
            RpcResult::Err(message) if message.contains("pandoc")
        );
        assert!(export_ok, "unexpected export response: {:?}", export_resp.result);
        assert!(matches!(ping_resp.result, RpcResult::Ok(RpcPayload::Pong { .. })));
        teardown_rpc_session();
        server.join().expect("server thread");
    }

    #[test]
    fn reload_config_broadcasts_config_json_to_connected_clients() {
        let _guard = endpoint_lock();
        teardown_rpc_session();
        let dir = tempfile::tempdir().expect("tempdir");
        std::fs::create_dir_all(dir.path().join(".scriptor")).expect("scriptor dir");
        std::fs::write(dir.path().join("alpha.md"), "# Alpha\n\nBody\n").expect("write");
        let config_json = r#"{"daily_note":{"directory":"notes","filename_format":"{iso}","title_format":"{iso}","template_path":null}}"#;
        std::fs::write(dir.path().join(".scriptor/config.json"), config_json).expect("write config");
        let vault_path = dir.path().display().to_string();

        let (socket, _socket_dir) = test_socket_name();
        write_endpoint(&socket).expect("write endpoint");

        let socket_for_server = socket.clone();
        let server = std::thread::spawn(move || {
            let name = resolve_name(&socket_for_server).expect("name");
            let listener = ListenerOptions::new()
                .name(name.borrow())
                .create_sync()
                .expect("listener");
            let state = Arc::new(Mutex::new(DaemonState::default()));
            let event_hub = EventHub::new();
            {
                let mut daemon = state.lock().expect("daemon state lock");
                daemon.handle(RpcRequest {
                    id: 0,
                    method: RpcMethod::OpenVault {
                        path: vault_path,
                    },
                });
                daemon.wait_index_rebuild();
            }
            for _ in 0..2 {
                let stream = listener.accept().expect("accept");
                let state = Arc::clone(&state);
                let event_hub = Arc::clone(&event_hub);
                spawn_test_handler(stream, state, event_hub);
            }
            std::thread::sleep(Duration::from_millis(800));
        });

        std::thread::sleep(Duration::from_millis(250));

        let (event_tx, event_rx) = std::sync::mpsc::channel();
        let observer = crate::client::DaemonRpcClient::new();
        observer.register_event_handler(move |event| {
            let RpcEventPayload::ConfigReloaded { json, generation } = event.payload;
            let _ = event_tx.send((json, generation));
        });
        std::thread::sleep(Duration::from_millis(100));

        let reloader = crate::client::DaemonRpcClient::new();
        let response = reloader
            .call(RpcRequest {
                id: 41,
                method: RpcMethod::ReloadConfig,
            })
            .expect("reload rpc");
        match response.result {
            RpcResult::Ok(RpcPayload::ConfigReloaded { json, generation }) => {
                assert!(json.contains("notes"), "response should include reloaded config");
                assert_eq!(generation, 1);
            }
            other => panic!("unexpected reload response: {other:?}"),
        }

        let (broadcast_json, broadcast_generation) = event_rx
            .recv_timeout(Duration::from_secs(2))
            .expect("observer should receive config reload event");
        assert!(broadcast_json.contains("notes"));
        assert_eq!(broadcast_generation, 1);

        observer.reset();
        reloader.reset();
        teardown_rpc_session();
        server.join().expect("server thread");
    }
}
