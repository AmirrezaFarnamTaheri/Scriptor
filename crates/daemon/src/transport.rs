use std::fs;
use std::io::{self, Read, Write};
use std::path::Path;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::{Duration, Instant};

use interprocess::local_socket::prelude::*;
use interprocess::local_socket::ListenerOptions;
use scriptor_ipc::{
    IpcError, RateLimiter, RpcError, RpcEvent, RpcMethod, RpcPayload, RpcRequest, RpcResponse,
    RpcResult, ServerMessage, encode_server_message, fuzz_corpus::is_expected_disconnect,
    read_frame,
};

use scriptor_export_runner::run_export_job;
use scriptor_indexer::rebuild_index;

use crate::command_gateway;
use crate::events::EventHub;
use crate::handler::DaemonState;
use crate::locks::lock_recover;
use crate::watcher::restart_vault_watcher;

const MAX_RPC_PER_CONNECTION_PER_SEC: u32 = 60;
const MAX_RPC_GLOBAL_PER_SEC: u32 = 512;
const MAX_CONCURRENT_CONNECTIONS: usize = 32;
pub const DAEMON_PROTOCOL_VERSION: u32 = 1;
const HANDSHAKE_TIMEOUT: Duration = Duration::from_secs(5);
const IDLE_REQUEST_TIMEOUT: Duration = Duration::from_secs(60);
const WRITE_TIMEOUT: Duration = Duration::from_secs(10);
const SUBSCRIPTION_POLL_INTERVAL: Duration = Duration::from_secs(1);

static GLOBAL_RPC_LIMITER: OnceLock<Mutex<RateLimiter>> = OnceLock::new();

fn global_rpc_limiter() -> &'static Mutex<RateLimiter> {
    GLOBAL_RPC_LIMITER.get_or_init(|| Mutex::new(RateLimiter::per_second(MAX_RPC_GLOBAL_PER_SEC)))
}

/// Poll a nonblocking local-socket stream until I/O succeeds or the absolute
/// deadline expires. Keeping the partial progress inside `Read::read`/
/// `Write::write` means `read_exact` and `write_all` can safely use this
/// adapter without restarting a partially consumed frame.
struct DeadlineIo<'a, T> {
    inner: &'a mut T,
    deadline: Instant,
}

impl<'a, T> DeadlineIo<'a, T> {
    fn new(inner: &'a mut T, timeout: Duration) -> Self {
        Self {
            inner,
            deadline: Instant::now() + timeout,
        }
    }

    fn wait_or_timeout(&self) -> io::Result<()> {
        if Instant::now() >= self.deadline {
            return Err(io::Error::new(
                io::ErrorKind::TimedOut,
                "local IPC deadline exceeded",
            ));
        }
        std::thread::sleep(Duration::from_millis(2));
        Ok(())
    }
}

impl<T: Read> Read for DeadlineIo<'_, T> {
    fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
        loop {
            match self.inner.read(buf) {
                Err(error) if error.kind() == io::ErrorKind::WouldBlock => self.wait_or_timeout()?,
                result => return result,
            }
        }
    }
}

impl<T: Write> Write for DeadlineIo<'_, T> {
    fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
        loop {
            match self.inner.write(buf) {
                Err(error) if error.kind() == io::ErrorKind::WouldBlock => self.wait_or_timeout()?,
                result => return result,
            }
        }
    }

    fn flush(&mut self) -> io::Result<()> {
        loop {
            match self.inner.flush() {
                Err(error) if error.kind() == io::ErrorKind::WouldBlock => self.wait_or_timeout()?,
                result => return result,
            }
        }
    }
}

fn read_frame_with_timeout<R: Read>(reader: &mut R, timeout: Duration) -> Result<Vec<u8>, IpcError> {
    let mut io = DeadlineIo::new(reader, timeout);
    read_frame(&mut io)
}

fn write_encoded_with_timeout<W: Write>(
    writer: &mut W,
    frame: &[u8],
    timeout: Duration,
) -> Result<(), IpcError> {
    let mut io = DeadlineIo::new(writer, timeout);
    io.write_all(frame).map_err(IpcError::from)?;
    io.flush().map_err(IpcError::from)
}

fn write_response_with_timeout<W: Write>(
    writer: &mut W,
    response: RpcResponse,
) -> Result<(), IpcError> {
    let frame = match encode_server_message(&ServerMessage::Response(response.clone())) {
        Ok(frame) => frame,
        Err(IpcError::FrameTooLarge(size)) => encode_server_message(&ServerMessage::Response(
            RpcResponse {
                id: response.id,
                result: RpcResult::Error(RpcError::with_code(
                    "rpc.payload_too_large",
                    format!("response exceeds local IPC frame budget ({size} bytes)"),
                    false,
                )),
            },
        ))?,
        Err(error) => return Err(error),
    };
    write_encoded_with_timeout(writer, &frame, WRITE_TIMEOUT)
}

fn write_event_with_timeout<W: Write>(writer: &mut W, event: RpcEvent) -> Result<(), IpcError> {
    let frame = match encode_server_message(&ServerMessage::Event(event)) {
        Ok(frame) => frame,
        Err(IpcError::FrameTooLarge(_)) => encode_server_message(&ServerMessage::Event(RpcEvent {
            payload: scriptor_ipc::RpcEventPayload::ResyncRequired {
                reason: "event exceeded local IPC frame budget".into(),
            },
        }))?,
        Err(error) => return Err(error),
    };
    write_encoded_with_timeout(writer, &frame, WRITE_TIMEOUT)
}

mod endpoint;
pub use endpoint::{
    DaemonEndpoint, connect_authenticated_client,
    connect_authenticated_client_with_retry_observer, connect_client, default_socket_name,
    endpoint_file_path, read_endpoint, remove_endpoint_file, write_endpoint,
};

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
    let expected_nonce = endpoint
        .nonce
        .clone()
        .ok_or_else(|| IpcError::Codec("generated endpoint is missing nonce".into()))?;
    let mut consecutive_accept_errors = 0u32;

    loop {
        // The endpoint is a discoverability cache, not authority. If a local
        // peer deletes or tampers with it while the daemon is alive, restore
        // the same authenticated endpoint rather than minting a new nonce
        // that existing clients do not know.
        if !endpoint_file_path()?.exists() {
            persist_endpoint(&endpoint)?;
        }

        let mut stream = match listener.accept() {
            Ok(stream) => {
                consecutive_accept_errors = 0;
                stream
            }
            Err(error)
                if matches!(
                    error.kind(),
                    io::ErrorKind::Interrupted
                        | io::ErrorKind::WouldBlock
                        | io::ErrorKind::ConnectionAborted
                ) =>
            {
                consecutive_accept_errors = consecutive_accept_errors.saturating_add(1);
                std::thread::sleep(Duration::from_millis(10));
                continue;
            }
            Err(error)
                if matches!(
                    error.kind(),
                    io::ErrorKind::PermissionDenied | io::ErrorKind::InvalidInput
                ) =>
            {
                return Err(IpcError::from(error));
            }
            Err(error) => {
                consecutive_accept_errors = consecutive_accept_errors.saturating_add(1);
                let backoff_ms = 10u64
                    .saturating_mul(1u64 << consecutive_accept_errors.min(6));
                tracing::warn!(
                    target: "scriptor_daemon::transport",
                    %error,
                    consecutive_accept_errors,
                    "transient local-socket accept failure; retrying",
                );
                std::thread::sleep(Duration::from_millis(backoff_ms.min(1_000)));
                continue;
            }
        };
        stream.set_nonblocking(true).map_err(IpcError::from)?;
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
        let expected_nonce = expected_nonce.clone();
        active_connections.fetch_add(1, Ordering::SeqCst);
        // Decrement via a drop guard so a panicking handler cannot leak the
        // connection slot (the guard runs during unwind as well).
        let slot = ConnectionSlot {
            counter: Arc::clone(&active_connections),
        };
        std::thread::spawn(move || {
            let _slot = slot;
            if let Err(error) = handle_connection(stream, &state, &event_hub, &expected_nonce) {
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
    expected_nonce: &str,
) -> Result<(), IpcError> {
    let mut limiter = RateLimiter::per_second(MAX_RPC_PER_CONNECTION_PER_SEC);
    let mut first_frame = true;

    loop {
        let timeout = if first_frame {
            HANDSHAKE_TIMEOUT
        } else {
            IDLE_REQUEST_TIMEOUT
        };
        let body = match read_frame_with_timeout(&mut stream, timeout) {
            Ok(body) => body,
            Err(error) if is_expected_disconnect(&error) => return Ok(()),
            Err(IpcError::Io(error)) if error.kind() == io::ErrorKind::TimedOut => return Ok(()),
            Err(error) => return Err(error),
        };
        first_frame = false;
        let request: RpcRequest =
            postcard::from_bytes(&body).map_err(|error| IpcError::Codec(error.to_string()))?;

        let within_connection_budget = limiter.allow();
        let within_global_budget = lock_recover(global_rpc_limiter()).allow();
        if !within_connection_budget || !within_global_budget {
            let response = RpcResponse {
                id: request.id,
                result: RpcResult::Error(RpcError::with_code(
                    "rpc.rate_limited",
                    "rate limit exceeded",
                    true,
                )),
            };
            write_response_with_timeout(&mut stream, response)?;
            continue;
        }

        match &request.endpoint_nonce {
            Some(provided)
                if constant_time_eq(provided.as_bytes(), expected_nonce.as_bytes()) => {}
            _ => {
                let response = RpcResponse {
                    id: request.id,
                    result: RpcResult::Error(RpcError::with_code(
                        "rpc.unauthenticated",
                        "invalid or missing endpoint nonce",
                        false,
                    )),
                };
                write_response_with_timeout(&mut stream, response)?;
                continue;
            }
        }

        if matches!(request.method, RpcMethod::SubscribeEvents) {
            let subscription = event_hub.register();
            let response = RpcResponse {
                id: request.id,
                result: RpcResult::Ok(RpcPayload::Unit),
            };
            write_response_with_timeout(&mut stream, response)?;
            let (mut recv_half, mut send_half) = stream.split();
            let (disconnect_tx, disconnect_rx) = std::sync::mpsc::sync_channel::<()>(1);
            std::thread::spawn(move || {
                let mut probe = [0u8; 1];
                loop {
                    match recv_half.read(&mut probe) {
                        Ok(0) => {
                            let _ = disconnect_tx.try_send(());
                            break;
                        }
                        Ok(_) => {
                            // Event subscriptions are one-way after the
                            // acknowledgement. Unexpected client bytes close
                            // the stream instead of becoming a second RPC lane.
                            let _ = disconnect_tx.try_send(());
                            break;
                        }
                        Err(error) if error.kind() == io::ErrorKind::WouldBlock => {
                            std::thread::sleep(Duration::from_millis(20));
                        }
                        Err(_) => {
                            let _ = disconnect_tx.try_send(());
                            break;
                        }
                    }
                }
            });
            loop {
                if disconnect_rx.try_recv().is_ok() {
                    return Ok(());
                }
                match subscription.recv_timeout(SUBSCRIPTION_POLL_INTERVAL) {
                    Ok(event) => write_event_with_timeout(&mut send_half, event)?,
                    Err(std::sync::mpsc::RecvTimeoutError::Timeout) => continue,
                    Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => return Ok(()),
                }
            }
        }

        let response = dispatch_request(state, request, event_hub);
        write_response_with_timeout(&mut stream, response)?;
    }
}

fn dispatch_request(
    state: &Arc<Mutex<DaemonState>>,
    request: RpcRequest,
    event_hub: &Arc<EventHub>,
) -> RpcResponse {
    let id = request.id;
    // Commands that stay inside `DaemonState::handle` are authorized exactly
    // once there. Only work that intentionally escapes the global state lock
    // is checked here, immediately before the authoritative state snapshot is
    // taken, so capability enforcement has one owner per dispatch path.
    let runs_outside_lock = matches!(
        &request.method,
        RpcMethod::ExportRunNote { .. }
            | RpcMethod::ExportRunMarkdown { .. }
            | RpcMethod::RebuildIndex
            | RpcMethod::GitStatus
    ) || matches!(
        &request.method,
        RpcMethod::Invoke { command, .. } if command_gateway::is_outside_lock_command(command)
    );
    if let RpcMethod::Invoke { command, .. } = &request.method
        && command_gateway::requires_desktop_authorization(command)
    {
        return RpcResponse {
            id,
            result: RpcResult::Error(RpcError::with_code(
                "authorization.desktop_required",
                format!("command {command} requires desktop authorization and is unavailable over daemon IPC"),
                false,
            )),
        };
    }

    if runs_outside_lock {
        if let Err(error) =
            crate::capabilities::enforce(&lock_recover(state).plugin_state, &request.method)
        {
            return RpcResponse {
                id,
                result: RpcResult::Error(error),
            };
        }
    }
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
        RpcMethod::GitStatus => dispatch_git_status_sync(state, id),
        RpcMethod::OpenVault { .. } => {
            let rebuild_job = { lock_recover(state).index_rebuild.clone() };
            rebuild_job.wait();
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
                result: RpcResult::failed(error.to_string()),
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
            let rebuild_job = { lock_recover(state).index_rebuild.clone() };
            rebuild_job.wait();
            let session = {
                let guard = lock_recover(state);
                match guard.session().cloned() {
                    Some(session) => session,
                    None => {
                        return RpcResponse {
                            id,
                            result: RpcResult::failed("no vault is open; call OpenVault first"),
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
                let rebuild_job = { lock_recover(state).index_rebuild.clone() };
                rebuild_job.wait();
                let output = {
                    let mut guard = lock_recover(state);
                    match guard.open_vault_invoke(root_path) {
                        Ok(output) => output,
                        Err(error) => {
                            return RpcResponse {
                                id,
                                result: RpcResult::failed(error),
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
        "pdf_translate" => {
            let prepared = {
                let guard = lock_recover(state);
                command_gateway::prepare_pdf_translate(&guard, &payload)
            };
            prepared
                .and_then(command_gateway::run_prepared_pdf_translate)
                .and_then(|output| {
                    serde_json::to_string(&output).map_err(|error| error.to_string())
                })
        }
        "plantuml_render" => command_gateway::cmd_plantuml_render(&payload)
            .and_then(|output| serde_json::to_string(&output).map_err(|error| error.to_string())),
        "git_status_cmd" => {
            let root = {
                let guard = lock_recover(state);
                guard.require_session().map(|session| session.root.root().to_path_buf())
            };
            root.and_then(|root| {
                scriptor_native_git::git_status(&root)
                    .map_err(|error| error.to_string())
                    .and_then(|value| serde_json::to_string(&value).map_err(|error| error.to_string()))
            })
        }
        "git_commit_cmd" => {
            let files: Result<Vec<String>, String> = payload
                .get("files")
                .cloned()
                .ok_or_else(|| "missing field: files".to_string())
                .and_then(|value| serde_json::from_value(value).map_err(|error| error.to_string()));
            let message = require_invoke_str(&payload, "message");
            let queue = { lock_recover(state).git_queue() };
            match (files, message, queue) {
                (Ok(files), Ok(message), Ok(queue)) => queue
                    .enqueue(move |root| scriptor_native_git::git_commit_selected(root, &files, &message))
                    .map_err(|error| error.to_string())
                    .and_then(|value| serde_json::to_string(&value).map_err(|error| error.to_string())),
                (Err(error), _, _) | (_, Err(error), _) | (_, _, Err(error)) => Err(error),
            }
        }
        "git_pull_cmd" => {
            let queue = { lock_recover(state).git_queue() };
            queue.and_then(|queue| {
                queue
                    .enqueue(move |root| scriptor_native_git::git_pull(root, scriptor_native_git::PullStrategy::FastForward))
                    .map_err(|error| error.to_string())
                    .and_then(|value| serde_json::to_string(&value).map_err(|error| error.to_string()))
            })
        }
        "git_push_cmd" => {
            let queue = { lock_recover(state).git_queue() };
            queue.and_then(|queue| {
                queue
                    .enqueue(scriptor_native_git::git_push)
                    .map_err(|error| error.to_string())
                    .and_then(|value| serde_json::to_string(&value).map_err(|error| error.to_string()))
            })
        }
        "git_resolve_conflict_cmd" => {
            let path = require_invoke_str(&payload, "path");
            let strategy = require_invoke_str(&payload, "strategy");
            let queue = { lock_recover(state).git_queue() };
            match (path, strategy, queue) {
                (Ok(path), Ok(strategy), Ok(queue)) => queue
                    .enqueue(move |root| scriptor_native_git::git_resolve_conflict(root, &path, &strategy))
                    .map_err(|error| error.to_string())
                    .and_then(|value| serde_json::to_string(&value).map_err(|error| error.to_string())),
                (Err(error), _, _) | (_, Err(error), _) | (_, _, Err(error)) => Err(error),
            }
        }
        "git_read_conflict_markers_cmd" => {
            let path = require_invoke_str(&payload, "path");
            let root = { lock_recover(state).session().cloned() };
            match (path, root) {
                (Ok(path), Some(session)) => scriptor_vault::RelativeVaultPath::parse(&path)
                    .map_err(|error| error.to_string())
                    .and_then(|relative| session.root.resolve_relative(&relative).map_err(|error| error.to_string()))
                    .and_then(|file_path| scriptor_native_git::read_conflict_markers(&file_path).map_err(|error| error.to_string()))
                    .and_then(|value| serde_json::to_string(&value).map_err(|error| error.to_string())),
                (Err(error), _) => Err(error),
                (_, None) => Err("no vault is open; call OpenVault first".into()),
            }
        }
        "git_show_head_file_cmd" => {
            let path = require_invoke_str(&payload, "path");
            let session = { lock_recover(state).session().cloned() };
            match (path, session) {
                (Ok(path), Some(session)) => scriptor_vault::RelativeVaultPath::parse(&path)
                    .map_err(|error| error.to_string())
                    .and_then(|relative| session.root.resolve_relative(&relative).map_err(|error| error.to_string()))
                    .and_then(|resolved| {
                        let relative = resolved.strip_prefix(session.root.root()).map_err(|error| error.to_string())?;
                        scriptor_native_git::git_show_head_file(session.root.root(), &relative.to_string_lossy())
                            .map_err(|error| error.to_string())
                    })
                    .and_then(|value| serde_json::to_string(&value).map_err(|error| error.to_string())),
                (Err(error), _) => Err(error),
                (_, None) => Err("no vault is open; call OpenVault first".into()),
            }
        }
        "indexer_resolve_wikilink" => {
            let (session, cache) = {
                let guard = lock_recover(state);
                (guard.session().cloned(), guard.index_cache().cloned())
            };
            match session {
                Some(session) => match require_invoke_str(&payload, "target") {
                    Ok(target) => command_gateway::resolve_wikilink_for_session(
                        &session,
                        cache.as_ref(),
                        &target,
                    )
                    .and_then(|value| {
                        serde_json::to_string(&value).map_err(|error| error.to_string())
                    }),
                    Err(message) => Err(message),
                },
                None => Err("no vault is open; call OpenVault first".into()),
            }
        }
        "vault_rename_dry_run"
        | "vault_rename_tag_dry_run"
        | "vault_rename_section_dry_run"
        | "vault_rename_block_dry_run"
        | "vault_health" => {
            let (session, cache) = {
                let guard = lock_recover(state);
                (guard.session().cloned(), guard.index_cache().cloned())
            };
            match session {
                Some(session) => command_gateway::run_read_only_vault_command(
                    &session,
                    cache.as_ref(),
                    command,
                    &payload,
                ),
                None => Err("no vault is open; call OpenVault first".into()),
            }
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
            result: RpcResult::failed(message),
        },
    }
}

fn dispatch_git_status_sync(state: &Arc<Mutex<DaemonState>>, id: u64) -> RpcResponse {
    let root = {
        let guard = lock_recover(state);
        guard.require_session().map(|session| session.root.root().to_path_buf())
    };
    let result = root.and_then(|root| {
        scriptor_native_git::git_status(&root)
            .map_err(|error| error.to_string())
            .and_then(|status| serde_json::to_string(&status).map_err(|error| error.to_string()))
    });
    match result {
        Ok(json) => RpcResponse { id, result: RpcResult::Ok(RpcPayload::GitStatus { json }) },
        Err(message) => RpcResponse { id, result: RpcResult::failed(message) },
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
                            result: RpcResult::failed(error.to_string()),
                        };
                    }
                };
                RpcResult::Ok(RpcPayload::ExportResult { json })
            }
            Err(error) => RpcResult::failed(error.to_string()),
        },
        Err(error) => RpcResult::failed(error),
    };
    RpcResponse { id, result }
}

fn dispatch_rebuild_sync(state: &Arc<Mutex<DaemonState>>, id: u64) -> RpcResponse {
    let rebuild_job = { lock_recover(state).index_rebuild.clone() };
    rebuild_job.wait();
    let session = {
        let guard = lock_recover(state);
        match guard.session().cloned() {
            Some(session) => session,
            None => {
                return RpcResponse {
                    id,
                    result: RpcResult::failed("no vault is open; call OpenVault first"),
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
        Err(error) => RpcResult::failed(error.to_string()),
    };
    RpcResponse { id, result }
}

pub fn rpc_call(request: RpcRequest) -> Result<RpcResponse, IpcError> {
    crate::client::shared_rpc_client().call(request)
}

#[cfg(test)]
mod tests;
