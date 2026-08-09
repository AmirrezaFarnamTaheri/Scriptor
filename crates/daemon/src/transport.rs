use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};

use interprocess::local_socket::prelude::*;
use interprocess::local_socket::{GenericFilePath, GenericNamespaced, ListenerOptions, Name};
use scriptor_ipc::{
    IpcError, RateLimiter, RpcMethod, RpcPayload, RpcRequest, RpcResponse, RpcResult,
    ServerMessage, fuzz_corpus::is_expected_disconnect, read_frame_resyncing, write_frame,
};
use scriptor_system_bridge::scriptor_data_dir;
use serde::{Deserialize, Serialize};

use scriptor_export_runner::run_export_job;
use scriptor_indexer::rebuild_index;

use crate::command_gateway;
use crate::events::EventHub;
use crate::handler::DaemonState;
use crate::locks::lock_recover;
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
        let data_dir =
            scriptor_data_dir("scriptor").map_err(|error| IpcError::Codec(error.to_string()))?;
        let socket_path = data_dir.join(format!("{SOCKET_BASENAME}.sock"));
        Ok(socket_path.display().to_string())
    }
}

pub fn endpoint_file_path() -> Result<PathBuf, IpcError> {
    let data_dir =
        scriptor_data_dir("scriptor").map_err(|error| IpcError::Codec(error.to_string()))?;
    Ok(data_dir.join(ENDPOINT_FILE))
}

/// A failing OS random source is an environment problem, not a bug: surface it
/// as an error so the caller can report it instead of aborting the daemon.
fn generate_nonce() -> Result<String, IpcError> {
    let mut bytes = [0u8; 32];
    getrandom::fill(&mut bytes)
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
    a.iter()
        .zip(b.iter())
        .fold(0u8, |acc, (x, y)| acc | (x ^ y))
        == 0
}

fn endpoint_hmac_key() -> Result<String, IpcError> {
    let data_dir = scriptor_data_dir("scriptor").map_err(|error| {
        IpcError::Codec(format!("cannot resolve daemon data directory: {error}"))
    })?;
    let key_path = data_dir.join(".endpoint-hmac-key");
    match fs::read_to_string(&key_path) {
        Ok(existing) => {
            let trimmed = existing.trim().to_string();
            if trimmed.is_empty() {
                return Err(IpcError::Codec(format!(
                    "daemon endpoint HMAC key is empty: {}",
                    key_path.display()
                )));
            }
            return Ok(trimmed);
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
        Err(error) => return Err(IpcError::from(error)),
    }

    fs::create_dir_all(&data_dir).map_err(IpcError::from)?;
    let nonce = generate_nonce()?;

    #[cfg(unix)]
    let opened = {
        use std::os::unix::fs::OpenOptionsExt;
        let mut opts = fs::OpenOptions::new();
        opts.write(true)
            .create_new(true)
            .mode(0o600)
            .open(&key_path)
    };
    #[cfg(not(unix))]
    let opened = fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&key_path);

    match opened {
        Ok(mut file) => {
            use std::io::Write;
            file.write_all(nonce.as_bytes()).map_err(IpcError::from)?;
            file.sync_all().map_err(IpcError::from)?;
            Ok(nonce)
        }
        Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => {
            let existing = fs::read_to_string(&key_path).map_err(IpcError::from)?;
            let trimmed = existing.trim().to_string();
            if trimmed.is_empty() {
                Err(IpcError::Codec(format!(
                    "daemon endpoint HMAC key is empty after concurrent creation: {}",
                    key_path.display()
                )))
            } else {
                Ok(trimmed)
            }
        }
        Err(error) => Err(IpcError::from(error)),
    }
}

pub fn write_endpoint(socket_name: &str) -> Result<DaemonEndpoint, IpcError> {
    let nonce = generate_nonce()?;
    let pid = std::process::id();
    let hmac = compute_endpoint_hmac(socket_name, pid, &nonce)?;
    let path = endpoint_file_path()?;
    let temp_path = path.with_file_name(format!("{ENDPOINT_FILE}.tmp-{pid}-{nonce}"));
    let endpoint = DaemonEndpoint {
        socket_name: socket_name.to_string(),
        pid,
        nonce: Some(nonce),
        hmac: Some(hmac),
    };
    let json = serde_json::to_string_pretty(&endpoint)
        .map_err(|error| IpcError::Codec(error.to_string()))?;

    let write_result = (|| -> Result<(), IpcError> {
        #[cfg(unix)]
        let mut file = {
            use std::os::unix::fs::OpenOptionsExt;
            let mut opts = fs::OpenOptions::new();
            opts.write(true)
                .create_new(true)
                .mode(0o600)
                .open(&temp_path)
                .map_err(IpcError::from)?
        };
        #[cfg(not(unix))]
        let mut file = fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temp_path)
            .map_err(IpcError::from)?;

        use std::io::Write;
        file.write_all(json.as_bytes()).map_err(IpcError::from)?;
        file.sync_all().map_err(IpcError::from)?;
        drop(file);

        #[cfg(not(unix))]
        match fs::remove_file(&path) {
            Ok(()) => {}
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(error) => return Err(IpcError::from(error)),
        }

        fs::rename(&temp_path, &path).map_err(IpcError::from)?;
        Ok(())
    })();

    if let Err(error) = write_result {
        let _ = fs::remove_file(&temp_path);
        return Err(error);
    }

    Ok(endpoint)
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
        return Err(IpcError::Codec(
            "endpoint HMAC mismatch; file may be tampered".into(),
        ));
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
        // PROCESS_BROKER_EXCEPTION(daemon-process-liveness-unix)
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
        // SAFETY: `pid` is not a pointer and is passed directly to Win32. The
        // handle is null-checked and closed exactly once without escaping.
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

fn retryable_endpoint_error(error: &IpcError) -> bool {
    match error {
        IpcError::Io(error) => matches!(
            error.kind(),
            std::io::ErrorKind::NotFound | std::io::ErrorKind::WouldBlock
        ),
        IpcError::Codec(message) => message.starts_with("daemon endpoint stale (pid "),
        _ => false,
    }
}

fn retryable_connect_error(error: &std::io::Error) -> bool {
    matches!(
        error.kind(),
        std::io::ErrorKind::NotFound
            | std::io::ErrorKind::WouldBlock
            | std::io::ErrorKind::ConnectionRefused
    )
}

fn wait_for_retry(
    start: std::time::Instant,
    retry_budget: std::time::Duration,
    retry_interval: std::time::Duration,
    error: IpcError,
) -> Result<(), IpcError> {
    let remaining = retry_budget.saturating_sub(start.elapsed());
    if remaining.is_zero() {
        return Err(error);
    }
    std::thread::sleep(retry_interval.min(remaining));
    Ok(())
}

fn connect_authenticated_client_inner(
    mut on_socket_retry: impl FnMut(&DaemonEndpoint),
) -> Result<(LocalSocketStream, DaemonEndpoint), IpcError> {
    let start = std::time::Instant::now();
    let retry_budget = std::time::Duration::from_millis(500);
    let retry_interval = std::time::Duration::from_millis(10);
    loop {
        let endpoint = match read_endpoint() {
            Ok(endpoint) => endpoint,
            Err(error) if retryable_endpoint_error(&error) => {
                wait_for_retry(start, retry_budget, retry_interval, error)?;
                continue;
            }
            Err(error) => return Err(error),
        };

        if let Err(error) = verify_endpoint_process(&endpoint) {
            if retryable_endpoint_error(&error) {
                wait_for_retry(start, retry_budget, retry_interval, error)?;
                continue;
            }
            return Err(error);
        }

        let name = resolve_name(&endpoint.socket_name)?;
        match LocalSocketStream::connect(name.borrow()) {
            Ok(stream) => return Ok((stream, endpoint)),
            Err(error) if retryable_connect_error(&error) => {
                on_socket_retry(&endpoint);
                wait_for_retry(start, retry_budget, retry_interval, IpcError::from(error))?;
            }
            Err(error) => return Err(IpcError::from(error)),
        }
    }
}

pub fn connect_authenticated_client() -> Result<(LocalSocketStream, DaemonEndpoint), IpcError> {
    connect_authenticated_client_inner(|_| {})
}

/// Observability seam for deterministic reconnect regression tests.
#[doc(hidden)]
pub fn connect_authenticated_client_with_retry_observer(
    on_socket_retry: impl FnMut(&DaemonEndpoint),
) -> Result<(LocalSocketStream, DaemonEndpoint), IpcError> {
    connect_authenticated_client_inner(on_socket_retry)
}

pub fn connect_client() -> Result<LocalSocketStream, IpcError> {
    connect_authenticated_client().map(|(stream, _)| stream)
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
        && let Some(parent) = Path::new(&resolved).parent()
    {
        fs::create_dir_all(parent).map_err(IpcError::from)?;
    }
    let name = resolve_name(&resolved)?;
    let listener = ListenerOptions::new()
        .name(name.borrow())
        .create_sync()
        .map_err(IpcError::from)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if Path::new(&resolved).exists() {
            fs::set_permissions(&resolved, fs::Permissions::from_mode(0o600))
                .map_err(IpcError::from)?;
        }
    }
    let endpoint = write_endpoint(&resolved)?;

    struct EndpointCleanup;
    impl Drop for EndpointCleanup {
        fn drop(&mut self) {
            let _ = remove_endpoint_file();
        }
    }
    let _endpoint_guard = EndpointCleanup;

    let state = Arc::new(Mutex::new(DaemonState {
        endpoint_nonce: endpoint.nonce,
        ..DaemonState::default()
    }));
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

    const MAX_EVENTS_PER_DRAIN: usize = 32;
    let drain_events =
        |stream: &mut LocalSocketStream,
         event_rx: &std::sync::mpsc::Receiver<scriptor_ipc::RpcEvent>| {
            for _ in 0..MAX_EVENTS_PER_DRAIN {
                let Ok(event) = event_rx.try_recv() else {
                    break;
                };
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
            if matches!(
                response.result,
                RpcResult::Ok(RpcPayload::VaultOpened { .. })
            ) && let Err(error) = restart_vault_watcher(state)
            {
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
                    .and_then(|output| {
                        serde_json::to_string(&output).map_err(|error| error.to_string())
                    }),
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
                            result: RpcResult::Err("no vault is open; call OpenVault first".into()),
                        };
                    }
                }
            };
            rebuild_index(&session, &[])
                .map_err(|error| error.to_string())
                .and_then(|summary| {
                    serde_json::to_string(&summary).map_err(|error| error.to_string())
                })
        }
        "vault_open" => match require_invoke_str(&payload, "root_path") {
            Ok(root_path) => {
                let output = {
                    let mut guard = lock_recover(state);
                    match guard.open_vault_invoke(root_path) {
                        Ok(output) => output,
                        Err(error) => {
                            return RpcResponse {
                                id,
                                result: RpcResult::Err(error),
                            };
                        }
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
        },
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

fn dispatch_export_sync(
    state: &Arc<Mutex<DaemonState>>,
    id: u64,
    method: &RpcMethod,
) -> RpcResponse {
    let prepared = lock_recover(state).prepare_export_input(method);
    let result = match prepared {
        Ok(input) => match run_export_job(input) {
            Ok(output) => {
                let json = match serde_json::to_string(&output) {
                    Ok(json) => json,
                    Err(error) => {
                        return RpcResponse {
                            id,
                            result: RpcResult::Err(error.to_string()),
                        };
                    }
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
mod tests;
