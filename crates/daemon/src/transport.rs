use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicUsize, Ordering};
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

use crate::locks::lock_recover;
use crate::command_gateway;
use crate::events::EventHub;
use crate::handler::DaemonState;
use crate::watcher::restart_vault_watcher;

const SOCKET_BASENAME: &str = "scriptor-core";
const ENDPOINT_FILE: &str = "daemon-endpoint.json";
const MAX_RPC_PER_CONNECTION_PER_SEC: u32 = 60;
const MAX_CONCURRENT_CONNECTIONS: usize = 32;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct DaemonEndpoint {
    pub socket_name: String,
    pub pid: u32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub nonce: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub hmac: Option<String>,
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

/// A failing OS random source is an environment problem, not a bug: surface it
/// as an error so the caller can report it instead of aborting the daemon.
fn generate_nonce() -> Result<String, IpcError> {
    let mut bytes = [0u8; 32];
    getrandom::getrandom(&mut bytes)
        .map_err(|error| IpcError::Codec(format!("random source unavailable: {error}")))?;
    Ok(hex::encode(bytes))
}

fn compute_endpoint_hmac(socket_name: &str, pid: u32, nonce: &str) -> Result<String, IpcError> {
    let mac = hmac_sha256_simple(&format!("{socket_name}:{pid}:{nonce}"))?;
    Ok(hex::encode(mac))
}

fn hmac_sha256_simple(message: &str) -> Result<[u8; 32], IpcError> {
    use sha2::{Digest, Sha256};

    let key = endpoint_hmac_key()?;
    let mut key_bytes = [0u8; 32];
    let key_src = key.as_bytes();
    let copy_len = key_src.len().min(32);
    key_bytes[..copy_len].copy_from_slice(&key_src[..copy_len]);

    let mut ipad = [0x36u8; 64];
    let mut opad = [0x5cu8; 64];
    for i in 0..32 {
        ipad[i] ^= key_bytes[i];
        opad[i] ^= key_bytes[i];
    }

    let mut inner = Sha256::new();
    inner.update(ipad);
    inner.update(message.as_bytes());
    let inner_hash = inner.finalize();

    let mut outer = Sha256::new();
    outer.update(opad);
    outer.update(inner_hash);
    let result = outer.finalize();

    let mut out = [0u8; 32];
    out.copy_from_slice(&result);
    Ok(out)
}

/// Constant-time byte comparison so HMAC verification does not leak match
/// prefixes through timing. Length mismatch returns early, which only reveals
/// the length (fixed at 64 hex chars for valid endpoints).
fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    a.iter().zip(b.iter()).fold(0u8, |acc, (x, y)| acc | (x ^ y)) == 0
}

fn endpoint_hmac_key() -> Result<String, IpcError> {
    let data_dir = scriptor_data_dir("scriptor").unwrap_or_else(|_| std::env::temp_dir());
    let key_path = data_dir.join(".endpoint-hmac-key");
    if let Ok(existing) = fs::read_to_string(&key_path) {
        let trimmed = existing.trim().to_string();
        if !trimmed.is_empty() {
            return Ok(trimmed);
        }
    }
    let nonce = generate_nonce()?;
    if let Err(error) = fs::create_dir_all(&data_dir) {
        tracing::warn!(
            target: "scriptor_daemon::transport",
            data_dir = %data_dir.display(),
            %error,
            "failed to create data dir for HMAC key",
        );
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        let mut opts = fs::OpenOptions::new();
        opts.write(true).create(true).truncate(true).mode(0o600);
        if let Ok(mut file) = opts.open(&key_path) {
            use std::io::Write;
            if let Err(error) = file.write_all(nonce.as_bytes()) {
                tracing::warn!(
                    target: "scriptor_daemon::transport",
                    key_path = %key_path.display(),
                    %error,
                    "failed to write HMAC key",
                );
            }
        }
    }
    #[cfg(not(unix))]
    {
        if let Err(error) = fs::write(&key_path, &nonce) {
            tracing::warn!(
                target: "scriptor_daemon::transport",
                key_path = %key_path.display(),
                %error,
                "failed to write HMAC key",
            );
        }
    }
    Ok(nonce)
}

pub fn write_endpoint(socket_name: &str) -> Result<(), IpcError> {
    let nonce = generate_nonce()?;
    let pid = std::process::id();
    let hmac = compute_endpoint_hmac(socket_name, pid, &nonce)?;
    let endpoint = DaemonEndpoint {
        socket_name: socket_name.to_string(),
        pid,
        nonce: Some(nonce),
        hmac: Some(hmac),
    };
    let json = serde_json::to_string_pretty(&endpoint).map_err(|error| IpcError::Codec(error.to_string()))?;
    let path = endpoint_file_path()?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        let mut opts = fs::OpenOptions::new();
        opts.write(true).create(true).truncate(true).mode(0o600);
        let mut file = opts.open(&path).map_err(IpcError::from)?;
        use std::io::Write;
        file.write_all(json.as_bytes()).map_err(IpcError::from)?;
    }
    #[cfg(not(unix))]
    {
        fs::write(&path, json).map_err(IpcError::from)?;
    }
    Ok(())
}

pub fn read_endpoint() -> Result<DaemonEndpoint, IpcError> {
    let bytes = fs::read(endpoint_file_path()?).map_err(IpcError::from)?;
    let endpoint: DaemonEndpoint =
        serde_json::from_slice(&bytes).map_err(|error| IpcError::Codec(error.to_string()))?;

    // Verification is mandatory: an endpoint file without nonce/hmac is rejected
    // outright so a tampered file cannot bypass authentication by omitting them.
    let (Some(nonce), Some(hmac)) = (&endpoint.nonce, &endpoint.hmac) else {
        return Err(IpcError::Codec(
            "endpoint file missing nonce/hmac; refusing unauthenticated endpoint".into(),
        ));
    };
    let expected_hmac = compute_endpoint_hmac(&endpoint.socket_name, endpoint.pid, nonce)?;
    if !constant_time_eq(hmac.as_bytes(), expected_hmac.as_bytes()) {
        return Err(IpcError::Codec("endpoint HMAC mismatch; file may be tampered".into()));
    }

    Ok(endpoint)
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

/// RAII guard for one connection slot: decrements the active-connection counter
/// on drop, including when the handler thread panics.
struct ConnectionSlot {
    counter: Arc<AtomicUsize>,
}

impl Drop for ConnectionSlot {
    fn drop(&mut self) {
        self.counter.fetch_sub(1, Ordering::SeqCst);
    }
}

pub fn serve_forever(socket_path: Option<String>) -> Result<(), IpcError> {
    let resolved = socket_path.unwrap_or_else(|| default_socket_name().expect("socket name"));
    if !cfg!(windows)
        && let Some(parent) = Path::new(&resolved).parent() {
            fs::create_dir_all(parent).map_err(IpcError::from)?;
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
    let active_connections = Arc::new(AtomicUsize::new(0));

    loop {
        let stream = listener.accept().map_err(IpcError::from)?;
        let current = active_connections.load(Ordering::SeqCst);
        if current >= MAX_CONCURRENT_CONNECTIONS {
            tracing::warn!(
                target: "scriptor_daemon::transport",
                current,
                limit = MAX_CONCURRENT_CONNECTIONS,
                "connection limit reached; rejecting incoming connection",
            );
            drop(stream);
            continue;
        }
        let state = Arc::clone(&state);
        let event_hub = Arc::clone(&event_hub);
        active_connections.fetch_add(1, Ordering::SeqCst);
        // Decrement via a drop guard so a panicking handler cannot leak the
        // connection slot (the guard runs during unwind as well).
        let slot = ConnectionSlot {
            counter: Arc::clone(&active_connections),
        };
        std::thread::spawn(move || {
            let _slot = slot;
            if let Err(error) = handle_connection(stream, &state, &event_hub) {
                tracing::warn!(
                    target: "scriptor_daemon::transport",
                    %error,
                    "connection handler ended with error",
                );
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

        if let Some(expected_nonce) = &lock_recover(state).endpoint_nonce {
            match &request.endpoint_nonce {
                Some(provided) if provided == expected_nonce => {}
                _ => {
                    let response = RpcResponse {
                        id: request.id,
                        result: RpcResult::Err("invalid or missing endpoint nonce".into()),
                    };
                    write_frame(&mut stream, &ServerMessage::Response(response))?;
                    continue;
                }
            }
        }

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
            let response = lock_recover(state).handle(request);
            if matches!(response.result, RpcResult::Ok(RpcPayload::VaultOpened { .. }))
                && let Err(error) = restart_vault_watcher(state) {
                    tracing::warn!(
                        target: "scriptor_daemon::transport",
                        %error,
                        "vault watcher failed to restart after OpenVault",
                    );
                }
            response
        }
        _ => lock_recover(state).handle(request),
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
                let guard = lock_recover(state);
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
                let guard = lock_recover(state);
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
                    let mut guard = lock_recover(state);
                    match guard.open_vault_invoke(root_path) {
                        Ok(output) => output,
                        Err(error) => return RpcResponse {
                            id,
                            result: RpcResult::Err(error),
                        },
                    }
                };
                if let Err(error) = restart_vault_watcher(state) {
                    tracing::warn!(
                        target: "scriptor_daemon::transport",
                        %error,
                        "vault watcher failed to restart after vault_open invoke",
                    );
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
    let prepared = lock_recover(state)
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
        let guard = lock_recover(state);
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
    use uuid::Uuid;

    static ENDPOINT_LOCK: Mutex<()> = Mutex::new(());

    fn test_socket_name() -> (String, Option<tempfile::TempDir>) {
        let unique = Uuid::new_v4().to_string();
        if cfg!(windows) {
            (format!("scriptor-test-{}", unique), None)
        } else {
            let dir = tempfile::tempdir().expect("tempdir");
            let socket = dir.path().join(format!("ipc-{unique}.sock")).display().to_string();
            (socket, Some(dir))
        }
    }

    fn create_listener_with_retry(name: &str, max_attempts: u32) -> interprocess::local_socket::Listener {
        let mut last_err = None;
        for attempt in 0..max_attempts {
            let resolved = resolve_name(name).expect("resolve name");
            match ListenerOptions::new().name(resolved.borrow()).create_sync() {
                Ok(listener) => return listener,
                Err(err) => {
                    last_err = Some(err);
                    let backoff_ms = 50 * (1u64 << attempt.min(4));
                    std::thread::sleep(Duration::from_millis(backoff_ms));
                }
            }
        }
        panic!(
            "failed to bind listener on '{}' after {} attempts: {:?}",
            name, max_attempts, last_err
        );
    }

    struct PipeGuard {
        name: Option<String>,
    }

    impl PipeGuard {
        fn new(name: &str) -> Self {
            Self { name: Some(name.to_string()) }
        }

        fn disarm(&mut self) {
            self.name = None;
        }
    }

    impl Drop for PipeGuard {
        fn drop(&mut self) {
            if let Some(ref name) = self.name
                && !cfg!(windows) {
                    let _ = std::fs::remove_file(name);
                }
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

    fn spawn_test_handler(
        stream: LocalSocketStream,
        state: Arc<Mutex<DaemonState>>,
        event_hub: Arc<EventHub>,
    ) -> std::thread::JoinHandle<()> {
        std::thread::spawn(move || {
            let _ = handle_connection(stream, &state, &event_hub);
        })
    }

    fn endpoint_lock() -> std::sync::MutexGuard<'static, ()> {
        ENDPOINT_LOCK.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    fn rpc_call_with_retry(request: RpcRequest, retries: u32) -> Result<RpcResponse, IpcError> {
        let mut last_err = None;
        for attempt in 0..=retries {
            if attempt > 0 {
                teardown_rpc_session();
                std::thread::sleep(Duration::from_millis(100));
            }
            match rpc_call(request.clone()) {
                Ok(response) => return Ok(response),
                Err(error) => last_err = Some(error),
            }
        }
        Err(last_err.unwrap())
    }

    fn accept_and_handle_n(
        listener: &interprocess::local_socket::Listener,
        state: &Arc<Mutex<DaemonState>>,
        event_hub: &Arc<EventHub>,
        count: usize,
    ) {
        let mut handled = 0usize;
        while handled < count {
            let stream = listener.accept().expect("accept");
            match handle_connection(stream, state, event_hub) {
                Ok(()) => handled += 1,
                Err(_) => continue,
            }
        }
    }

    #[test]
    fn endpoint_roundtrip() {
        let _guard = endpoint_lock();
        teardown_rpc_session();
        let socket = default_socket_name().expect("socket");
        write_endpoint(&socket).expect("write");
        let endpoint = read_endpoint().expect("read");
        assert_eq!(endpoint.socket_name, socket);
        let _ = remove_endpoint_file();
    }

    #[test]
    fn read_endpoint_rejects_missing_hmac() {
        let _guard = endpoint_lock();
        let path = endpoint_file_path().expect("endpoint path");
        if let Some(parent) = path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        let json = serde_json::json!({ "socket_name": "some-socket", "pid": 1234 }).to_string();
        std::fs::write(&path, json).expect("write endpoint");
        let result = read_endpoint();
        assert!(result.is_err(), "endpoint without nonce/hmac must be rejected");
        let _ = remove_endpoint_file();
    }

    #[test]
    fn read_endpoint_rejects_tampered_hmac() {
        let _guard = endpoint_lock();
        let socket = default_socket_name().expect("socket");
        write_endpoint(&socket).expect("write");
        let path = endpoint_file_path().expect("endpoint path");
        let raw = std::fs::read_to_string(&path).expect("read endpoint file");
        let mut endpoint: DaemonEndpoint = serde_json::from_str(&raw).expect("parse endpoint");
        endpoint.socket_name = format!("{}-tampered", endpoint.socket_name);
        std::fs::write(&path, serde_json::to_string(&endpoint).expect("serialize")).expect("rewrite");
        let result = read_endpoint();
        assert!(result.is_err(), "tampered endpoint must fail HMAC verification");
        let _ = remove_endpoint_file();
    }

    #[test]
    fn connection_slot_decrements_on_panic() {
        let counter = Arc::new(AtomicUsize::new(0));
        counter.fetch_add(1, Ordering::SeqCst);
        let slot = ConnectionSlot {
            counter: Arc::clone(&counter),
        };
        let handle = std::thread::spawn(move || {
            let _slot = slot;
            panic!("simulated handler panic");
        });
        assert!(handle.join().is_err());
        assert_eq!(counter.load(Ordering::SeqCst), 0, "slot must be released on panic");
    }

    #[test]
    fn rpc_roundtrip_over_socket() {
        let _guard = endpoint_lock();
        teardown_rpc_session();
        let (socket, _socket_dir) = test_socket_name();
        let mut pipe_guard = PipeGuard::new(&socket);
        write_endpoint(&socket).expect("write endpoint");

        let socket_for_server = socket.clone();
        let (ready_tx, ready_rx) = std::sync::mpsc::channel();
        let server = std::thread::spawn(move || {
            let listener = create_listener_with_retry(&socket_for_server, 10);
            ready_tx.send(()).expect("send ready");
            let state = Arc::new(Mutex::new(DaemonState::default()));
            let event_hub = EventHub::new();
            accept_and_handle_n(&listener, &state, &event_hub, 1);
        });

        ready_rx.recv_timeout(Duration::from_secs(5)).expect("listener ready");
        let response = rpc_call_with_retry(RpcRequest::new(1, RpcMethod::Ping), 5).expect("rpc");
        assert!(matches!(response.result, RpcResult::Ok(_)));
        teardown_rpc_session();
        server.join().expect("server thread");
        pipe_guard.disarm();
    }

    /// A panic inside a request handler poisons the shared daemon state mutex.
    /// The daemon must keep answering RPCs afterwards instead of panicking on
    /// every subsequent lock acquisition.
    #[test]
    fn serves_requests_after_state_lock_is_poisoned() {
        let _guard = endpoint_lock();
        teardown_rpc_session();
        let (socket, _socket_dir) = test_socket_name();
        let mut pipe_guard = PipeGuard::new(&socket);
        write_endpoint(&socket).expect("write endpoint");

        let state = Arc::new(Mutex::new(DaemonState::default()));
        let poisoner = Arc::clone(&state);
        let panicked = std::thread::spawn(move || {
            let _held = lock_recover(&poisoner);
            panic!("simulated handler panic while holding daemon state");
        });
        assert!(panicked.join().is_err(), "helper thread should have panicked");
        assert!(
            state.lock().is_err(),
            "the daemon state mutex should now be poisoned"
        );

        let state_for_server = Arc::clone(&state);
        let socket_for_server = socket.clone();
        let (ready_tx, ready_rx) = std::sync::mpsc::channel();
        let server = std::thread::spawn(move || {
            let listener = create_listener_with_retry(&socket_for_server, 10);
            ready_tx.send(()).expect("send ready");
            let event_hub = EventHub::new();
            accept_and_handle_n(&listener, &state_for_server, &event_hub, 1);
        });

        ready_rx.recv_timeout(Duration::from_secs(5)).expect("listener ready");
        let response = rpc_call_with_retry(RpcRequest::new(1, RpcMethod::Ping), 5)
            .expect("daemon must still answer RPCs after poisoning");
        assert!(matches!(response.result, RpcResult::Ok(RpcPayload::Pong { .. })));
        teardown_rpc_session();
        server.join().expect("server thread");
        pipe_guard.disarm();
    }

    #[test]
    fn rpc_session_multiplexes_on_single_connection() {
        let _guard = endpoint_lock();
        teardown_rpc_session();
        let (socket, _socket_dir) = test_socket_name();
        let mut pipe_guard = PipeGuard::new(&socket);
        write_endpoint(&socket).expect("write endpoint");

        let socket_for_server = socket.clone();
        let (ready_tx, ready_rx) = std::sync::mpsc::channel();
        let server = std::thread::spawn(move || {
            let listener = create_listener_with_retry(&socket_for_server, 10);
            ready_tx.send(()).expect("send ready");
            let state = Arc::new(Mutex::new(DaemonState::default()));
            let event_hub = EventHub::new();
            accept_and_handle_n(&listener, &state, &event_hub, 1);
        });

        ready_rx.recv_timeout(Duration::from_secs(5)).expect("listener ready");
        let client = crate::client::DaemonRpcClient::new();
        for id in 1..=20 {
            let response = client.call(RpcRequest::new(id, RpcMethod::Ping)).expect("rpc");
            assert!(matches!(response.result, RpcResult::Ok(_)));
            std::thread::sleep(Duration::from_millis(18));
        }
        client.reset();
        server.join().expect("server thread");
        pipe_guard.disarm();
    }

    /// A daemon that never emits the awaited id must not park the calling
    /// thread forever: the frame budget turns it into a descriptive error.
    #[test]
    fn rpc_call_bails_out_on_flood_of_unmatched_responses() {
        let _guard = endpoint_lock();
        teardown_rpc_session();
        let (socket, _socket_dir) = test_socket_name();
        let mut pipe_guard = PipeGuard::new(&socket);
        write_endpoint(&socket).expect("write endpoint");

        let socket_for_server = socket.clone();
        let (ready_tx, ready_rx) = std::sync::mpsc::channel();
        let (done_tx, done_rx) = std::sync::mpsc::channel::<()>();
        let server = std::thread::spawn(move || {
            let listener = create_listener_with_retry(&socket_for_server, 10);
            ready_tx.send(()).expect("send ready");
            let mut stream = listener.accept().expect("accept");
            read_frame_resyncing(&mut stream).expect("read request");
            for offset in 0..1024u64 {
                let response = RpcResponse {
                    id: 10_000 + offset,
                    result: RpcResult::Ok(RpcPayload::Unit),
                };
                if write_frame(&mut stream, &ServerMessage::Response(response)).is_err() {
                    break;
                }
            }
            // Keep the connection open so the client cannot mistake this for a
            // disconnect and silently retry.
            let _ = done_rx.recv_timeout(Duration::from_secs(30));
        });

        ready_rx.recv_timeout(Duration::from_secs(5)).expect("listener ready");
        let client = crate::client::DaemonRpcClient::new();
        let error = client
            .call(RpcRequest::new(7, RpcMethod::Ping))
            .expect_err("mismatched ids must not hang the caller");
        assert!(
            error.to_string().contains("without a response matching request 7"),
            "unexpected error: {error}"
        );
        client.reset();
        let _ = done_tx.send(());
        server.join().expect("server thread");
        pipe_guard.disarm();
    }

    /// A failed first connection used to latch `event_listener_started` forever,
    /// so events were never delivered again for the lifetime of the process.
    #[test]
    fn event_listener_recovers_after_failed_connection() {
        let _guard = endpoint_lock();
        teardown_rpc_session();
        let _ = remove_endpoint_file();

        let client = crate::client::DaemonRpcClient::new();
        client.register_event_handler(|_| {});
        assert!(
            !client.has_event_listener(),
            "no listener may be claimed when the daemon is unreachable"
        );

        let dir = tempfile::tempdir().expect("tempdir");
        std::fs::create_dir_all(dir.path().join(".scriptor")).expect("scriptor dir");
        std::fs::write(dir.path().join("alpha.md"), "# Alpha\n").expect("write");
        let config_json = r#"{"daily_note":{"directory":"notes","filename_format":"{iso}","title_format":"{iso}","template_path":null}}"#;
        std::fs::write(dir.path().join(".scriptor/config.json"), config_json).expect("write config");
        let vault_path = dir.path().display().to_string();

        let (socket, _socket_dir) = test_socket_name();
        let mut pipe_guard = PipeGuard::new(&socket);
        write_endpoint(&socket).expect("write endpoint");

        let socket_for_server = socket.clone();
        let (ready_tx, ready_rx) = std::sync::mpsc::channel();
        let (handle_tx, handle_rx) = std::sync::mpsc::channel();
        let (eh_tx, eh_rx) = std::sync::mpsc::channel();
        let server = std::thread::spawn(move || {
            let listener = create_listener_with_retry(&socket_for_server, 10);
            let state = Arc::new(Mutex::new(DaemonState::default()));
            let event_hub = EventHub::new();
            {
                let mut daemon = lock_recover(&state);
                daemon.handle(RpcRequest::new(0, RpcMethod::OpenVault { path: vault_path }));
                daemon.wait_index_rebuild();
            }
            eh_tx.send(Arc::clone(&event_hub)).expect("send event hub");
            ready_tx.send(()).expect("send ready");
            for _ in 0..2 {
                let stream = listener.accept().expect("accept");
                let handle = spawn_test_handler(stream, Arc::clone(&state), Arc::clone(&event_hub));
                handle_tx.send(handle).expect("send handle");
            }
        });

        ready_rx.recv_timeout(Duration::from_secs(10)).expect("listener ready");
        let event_hub_ref = eh_rx.recv_timeout(Duration::from_secs(5)).expect("recv event hub");

        // Second registration on the same client must be able to start a
        // listener now that the daemon is reachable.
        let (event_tx, event_rx) = std::sync::mpsc::channel();
        client.register_event_handler(move |event| {
            let RpcEventPayload::ConfigReloaded { json, generation } = event.payload;
            let _ = event_tx.send((json, generation));
        });
        assert!(
            client.has_event_listener(),
            "listener must start once the daemon is reachable again"
        );
        std::thread::sleep(Duration::from_millis(100));

        let reloader = crate::client::DaemonRpcClient::new();
        reloader
            .call(RpcRequest::new(51, RpcMethod::ReloadConfig))
            .expect("reload rpc");

        let (json, generation) = event_rx
            .recv_timeout(Duration::from_secs(5))
            .expect("recovered listener should receive the broadcast event");
        assert!(json.contains("notes"));
        assert_eq!(generation, 1);

        client.reset();
        reloader.reset();
        event_hub_ref.close();
        teardown_rpc_session();
        server.join().expect("server thread");
        for _ in 0..2 {
            let handle = handle_rx.recv_timeout(Duration::from_secs(5)).expect("recv handle");
            handle.join().expect("handler thread");
        }
        pipe_guard.disarm();
    }

    #[test]
    fn accepts_parallel_ping_connections() {
        let _guard = endpoint_lock();
        teardown_rpc_session();
        let (socket, _socket_dir) = test_socket_name();
        let mut pipe_guard = PipeGuard::new(&socket);
        write_endpoint(&socket).expect("write endpoint");

        let socket_for_server = socket.clone();
        let (ready_tx, ready_rx) = std::sync::mpsc::channel();
        let (handle_tx, handle_rx) = std::sync::mpsc::channel();
        let server = std::thread::spawn(move || {
            let listener = create_listener_with_retry(&socket_for_server, 10);
            ready_tx.send(()).expect("send ready");
            let state = Arc::new(Mutex::new(DaemonState::default()));
            let event_hub = EventHub::new();
            let mut accepted = 0usize;
            while accepted < 2 {
                let stream = match listener.accept() {
                    Ok(s) => s,
                    Err(_) => continue,
                };
                let handle = spawn_test_handler(stream, Arc::clone(&state), Arc::clone(&event_hub));
                handle_tx.send(handle).expect("send handle");
                accepted += 1;
            }
        });

        ready_rx.recv_timeout(Duration::from_secs(5)).expect("listener ready");
        let first = std::thread::spawn(|| {
            let client = crate::client::DaemonRpcClient::new();
            client.call(RpcRequest::new(20, RpcMethod::Ping))
        });
        let second = std::thread::spawn(|| {
            let client = crate::client::DaemonRpcClient::new();
            client.call(RpcRequest::new(21, RpcMethod::Ping))
        });
        assert!(matches!(first.join().expect("join").expect("rpc").result, RpcResult::Ok(_)));
        assert!(matches!(second.join().expect("join").expect("rpc").result, RpcResult::Ok(_)));
        server.join().expect("server thread");
        for _ in 0..2 {
            let handle = handle_rx.recv_timeout(Duration::from_secs(5)).expect("recv handle");
            handle.join().expect("handler thread");
        }
        pipe_guard.disarm();
    }

    #[test]
    fn rate_limit_rejects_sustained_burst_on_single_connection() {
        let _guard = endpoint_lock();
        teardown_rpc_session();
        let (socket, _socket_dir) = test_socket_name();
        let mut pipe_guard = PipeGuard::new(&socket);
        write_endpoint(&socket).expect("write endpoint");

        let socket_for_server = socket.clone();
        let (ready_tx, ready_rx) = std::sync::mpsc::channel();
        let server = std::thread::spawn(move || {
            let listener = create_listener_with_retry(&socket_for_server, 10);
            ready_tx.send(()).expect("send ready");
            let state = Arc::new(Mutex::new(DaemonState::default()));
            let event_hub = EventHub::new();
            accept_and_handle_n(&listener, &state, &event_hub, 1);
        });

        ready_rx.recv_timeout(Duration::from_secs(5)).expect("listener ready");
        let name = resolve_name(&socket).expect("name");
        let mut stream = LocalSocketStream::connect(name.borrow()).expect("connect");

        let mut limited = 0u32;
        for id in 0..65 {
            write_frame(&mut stream, &RpcRequest::new(id, RpcMethod::Ping)).expect("write");
            let body = read_frame_resyncing(&mut stream).expect("read");
            let response = decode_rpc_response_body(&body);
            if matches!(response.result, RpcResult::Err(ref message) if message.contains("rate limit")) {
                limited += 1;
            }
        }

        assert!(limited >= 5, "expected sustained burst to hit per-connection rate limit, got {limited} rejections");
        drop(stream);
        server.join().expect("server thread");
        pipe_guard.disarm();
    }

    #[test]
    fn ping_succeeds_during_background_export() {
        let _guard = endpoint_lock();
        teardown_rpc_session();
        let dir = tempfile::tempdir().expect("tempdir");
        std::fs::write(dir.path().join("alpha.md"), "# Alpha\n\nBody\n").expect("write");
        let vault_path = dir.path().display().to_string();

        let (socket, _socket_dir) = test_socket_name();
        let mut pipe_guard = PipeGuard::new(&socket);
        write_endpoint(&socket).expect("write endpoint");

        let socket_for_server = socket.clone();
        let (ready_tx, ready_rx) = std::sync::mpsc::channel();
        let server = std::thread::spawn(move || {
            let listener = create_listener_with_retry(&socket_for_server, 10);
            let state = Arc::new(Mutex::new(DaemonState::default()));
            {
                let mut daemon = lock_recover(&state);
                daemon.handle(RpcRequest::new(0, RpcMethod::OpenVault { path: vault_path }));
                daemon.wait_index_rebuild();
            }
            let event_hub = EventHub::new();
            ready_tx.send(()).expect("send ready");
            accept_and_handle_n(&listener, &state, &event_hub, 1);
        });

        ready_rx.recv_timeout(Duration::from_secs(10)).expect("listener ready");

        let export = std::thread::spawn(|| {
            rpc_call_with_retry(RpcRequest::new(32, RpcMethod::ExportStartNote {
                note_path: "alpha.md".into(),
                format: "html".into(),
                dry_run: true,
                extra_pandoc_args: vec![],
                output_subdirectory: None,
            }), 5)
        });
        let ping = std::thread::spawn(|| {
            rpc_call_with_retry(RpcRequest::new(33, RpcMethod::Ping), 5)
        });

        let export_resp = export.join().expect("export join").expect("export rpc");
        let ping_resp = ping.join().expect("ping join").expect("ping rpc");

        let export_ok = matches!(export_resp.result, RpcResult::Ok(RpcPayload::ExportStarted { .. }))
            || matches!(&export_resp.result, RpcResult::Err(message) if message.contains("pandoc"));
        assert!(export_ok, "unexpected export response: {:?}", export_resp.result);
        assert!(matches!(ping_resp.result, RpcResult::Ok(RpcPayload::Pong { .. })));
        teardown_rpc_session();
        server.join().expect("server thread");
        pipe_guard.disarm();
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
        let mut pipe_guard = PipeGuard::new(&socket);
        write_endpoint(&socket).expect("write endpoint");

        let socket_for_server = socket.clone();
        let (ready_tx, ready_rx) = std::sync::mpsc::channel();
        let (handle_tx, handle_rx) = std::sync::mpsc::channel();
        let (eh_tx, eh_rx) = std::sync::mpsc::channel();
        let server = std::thread::spawn(move || {
            let listener = create_listener_with_retry(&socket_for_server, 10);
            let state = Arc::new(Mutex::new(DaemonState::default()));
            let event_hub = EventHub::new();
            {
                let mut daemon = lock_recover(&state);
                daemon.handle(RpcRequest::new(0, RpcMethod::OpenVault { path: vault_path }));
                daemon.wait_index_rebuild();
            }
            eh_tx.send(Arc::clone(&event_hub)).expect("send event hub");
            ready_tx.send(()).expect("send ready");
            for _ in 0..2 {
                let stream = listener.accept().expect("accept");
                let handle = spawn_test_handler(stream, Arc::clone(&state), Arc::clone(&event_hub));
                handle_tx.send(handle).expect("send handle");
            }
        });

        ready_rx.recv_timeout(Duration::from_secs(10)).expect("listener ready");
        let event_hub_ref = eh_rx.recv_timeout(Duration::from_secs(5)).expect("recv event hub");

        let (event_tx, event_rx) = std::sync::mpsc::channel();
        let observer = crate::client::DaemonRpcClient::new();
        observer.register_event_handler(move |event| {
            let RpcEventPayload::ConfigReloaded { json, generation } = event.payload;
            let _ = event_tx.send((json, generation));
        });
        std::thread::sleep(Duration::from_millis(100));

        let reloader = crate::client::DaemonRpcClient::new();
        let response = reloader.call(RpcRequest::new(41, RpcMethod::ReloadConfig)).expect("reload rpc");
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
        event_hub_ref.close();
        teardown_rpc_session();
        server.join().expect("server thread");
        for _ in 0..2 {
            let handle = handle_rx.recv_timeout(Duration::from_secs(5)).expect("recv handle");
            handle.join().expect("handler thread");
        }
        pipe_guard.disarm();
    }
}