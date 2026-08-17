use super::*;
use crate::events::EventHub;
use scriptor_ipc::{
    RpcEventPayload, RpcMethod, RpcPayload, RpcRequest, RpcResponse, RpcResult, ServerMessage,
};
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
        let socket = dir
            .path()
            .join(format!("ipc-{unique}.sock"))
            .display()
            .to_string();
        (socket, Some(dir))
    }
}

fn create_listener_with_retry(
    name: &str,
    max_attempts: u32,
) -> interprocess::local_socket::Listener {
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

/// Poll `condition` until it holds or `timeout` elapses, returning whether
/// it became true.
///
/// Preferred over a fixed sleep for cross-thread handshakes: a sleep sized
/// for an idle machine silently becomes a race on a loaded CI runner, and
/// the resulting failure surfaces far from its cause.
fn wait_for(timeout: Duration, mut condition: impl FnMut() -> bool) -> bool {
    let deadline = std::time::Instant::now() + timeout;
    while std::time::Instant::now() < deadline {
        if condition() {
            return true;
        }
        std::thread::sleep(Duration::from_millis(10));
    }
    condition()
}

struct PipeGuard {
    name: Option<String>,
}

impl PipeGuard {
    fn new(name: &str) -> Self {
        Self {
            name: Some(name.to_string()),
        }
    }

    fn disarm(&mut self) {
        self.name = None;
    }
}

impl Drop for PipeGuard {
    fn drop(&mut self) {
        if let Some(ref name) = self.name
            && !cfg!(windows)
        {
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
    ENDPOINT_LOCK
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
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
    assert!(
        result.is_err(),
        "endpoint without nonce/hmac must be rejected"
    );
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
    assert!(
        result.is_err(),
        "tampered endpoint must fail HMAC verification"
    );
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
    assert_eq!(
        counter.load(Ordering::SeqCst),
        0,
        "slot must be released on panic"
    );
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

    ready_rx
        .recv_timeout(Duration::from_secs(5))
        .expect("listener ready");
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
    assert!(
        panicked.join().is_err(),
        "helper thread should have panicked"
    );
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

    ready_rx
        .recv_timeout(Duration::from_secs(5))
        .expect("listener ready");
    let response = rpc_call_with_retry(RpcRequest::new(1, RpcMethod::Ping), 5)
        .expect("daemon must still answer RPCs after poisoning");
    assert!(matches!(
        response.result,
        RpcResult::Ok(RpcPayload::Pong { .. })
    ));
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

    ready_rx
        .recv_timeout(Duration::from_secs(5))
        .expect("listener ready");
    let client = crate::client::DaemonRpcClient::new();
    for id in 1..=20 {
        let response = client
            .call(RpcRequest::new(id, RpcMethod::Ping))
            .expect("rpc");
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

    ready_rx
        .recv_timeout(Duration::from_secs(5))
        .expect("listener ready");
    let client = crate::client::DaemonRpcClient::new();
    let error = client
        .call(RpcRequest::new(7, RpcMethod::Ping))
        .expect_err("mismatched ids must not hang the caller");
    assert!(
        error
            .to_string()
            .contains("without a response matching request 7"),
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
            daemon.handle(RpcRequest::new(
                0,
                RpcMethod::OpenVault { path: vault_path },
            ));
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

    ready_rx
        .recv_timeout(Duration::from_secs(10))
        .expect("listener ready");
    let event_hub_ref = eh_rx
        .recv_timeout(Duration::from_secs(5))
        .expect("recv event hub");

    // Second registration on the same client must be able to start a
    // listener now that the daemon is reachable.
    let (event_tx, event_rx) = std::sync::mpsc::channel();
    client.register_event_handler(move |event| {
        if let RpcEventPayload::ConfigReloaded { json, generation } = event.payload {
            let _ = event_tx.send((json, generation));
        }
    });
    assert!(
        client.has_event_listener(),
        "listener must start once the daemon is reachable again"
    );

    // `has_event_listener` only reports that the listener thread was
    // spawned; it may not have completed its SubscribeEvents handshake
    // yet. Broadcasts reach registered subscribers only, so firing the
    // reload before then loses the event and the receive below times out.
    // Wait on the hub's own view rather than guessing with a sleep — a
    // fixed delay here is what made this test flake under CPU load.
    let subscribed = wait_for(Duration::from_secs(10), || {
        event_hub_ref.subscriber_count() > 0
    });
    assert!(
        subscribed,
        "event listener should register with the hub before the broadcast"
    );

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
        let handle = handle_rx
            .recv_timeout(Duration::from_secs(5))
            .expect("recv handle");
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

    ready_rx
        .recv_timeout(Duration::from_secs(5))
        .expect("listener ready");
    let first = std::thread::spawn(|| {
        let client = crate::client::DaemonRpcClient::new();
        client.call(RpcRequest::new(20, RpcMethod::Ping))
    });
    let second = std::thread::spawn(|| {
        let client = crate::client::DaemonRpcClient::new();
        client.call(RpcRequest::new(21, RpcMethod::Ping))
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
    for _ in 0..2 {
        let handle = handle_rx
            .recv_timeout(Duration::from_secs(5))
            .expect("recv handle");
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

    ready_rx
        .recv_timeout(Duration::from_secs(5))
        .expect("listener ready");
    let name = resolve_name(&socket).expect("name");
    let mut stream = LocalSocketStream::connect(name.borrow()).expect("connect");

    let mut limited = 0u32;
    for id in 0..65 {
        write_frame(&mut stream, &RpcRequest::new(id, RpcMethod::Ping)).expect("write");
        let body = read_frame_resyncing(&mut stream).expect("read");
        let response = decode_rpc_response_body(&body);
        if matches!(response.result, RpcResult::Err(ref message) if message.contains("rate limit"))
        {
            limited += 1;
        }
    }

    assert!(
        limited >= 5,
        "expected sustained burst to hit per-connection rate limit, got {limited} rejections"
    );
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
            daemon.handle(RpcRequest::new(
                0,
                RpcMethod::OpenVault { path: vault_path },
            ));
            daemon.wait_index_rebuild();
        }
        let event_hub = EventHub::new();
        ready_tx.send(()).expect("send ready");
        accept_and_handle_n(&listener, &state, &event_hub, 1);
    });

    ready_rx
        .recv_timeout(Duration::from_secs(10))
        .expect("listener ready");

    let export = std::thread::spawn(|| {
        rpc_call_with_retry(
            RpcRequest::new(
                32,
                RpcMethod::ExportStartNote {
                    note_path: "alpha.md".into(),
                    format: "html".into(),
                    dry_run: true,
                    extra_pandoc_args: vec![],
                    output_subdirectory: None,
                },
            ),
            5,
        )
    });
    let ping = std::thread::spawn(|| rpc_call_with_retry(RpcRequest::new(33, RpcMethod::Ping), 5));

    let export_resp = export.join().expect("export join").expect("export rpc");
    let ping_resp = ping.join().expect("ping join").expect("ping rpc");

    let export_ok = matches!(
        export_resp.result,
        RpcResult::Ok(RpcPayload::ExportStarted { .. })
    ) || matches!(&export_resp.result, RpcResult::Err(message) if message.contains("pandoc"));
    assert!(
        export_ok,
        "unexpected export response: {:?}",
        export_resp.result
    );
    assert!(matches!(
        ping_resp.result,
        RpcResult::Ok(RpcPayload::Pong { .. })
    ));
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
            daemon.handle(RpcRequest::new(
                0,
                RpcMethod::OpenVault { path: vault_path },
            ));
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

    ready_rx
        .recv_timeout(Duration::from_secs(10))
        .expect("listener ready");
    let event_hub_ref = eh_rx
        .recv_timeout(Duration::from_secs(5))
        .expect("recv event hub");

    let (event_tx, event_rx) = std::sync::mpsc::channel();
    let observer = crate::client::DaemonRpcClient::new();
    observer.register_event_handler(move |event| {
        if let RpcEventPayload::ConfigReloaded { json, generation } = event.payload {
            let _ = event_tx.send((json, generation));
        }
    });
    std::thread::sleep(Duration::from_millis(100));

    let reloader = crate::client::DaemonRpcClient::new();
    let response = reloader
        .call(RpcRequest::new(41, RpcMethod::ReloadConfig))
        .expect("reload rpc");
    match response.result {
        RpcResult::Ok(RpcPayload::ConfigReloaded { json, generation }) => {
            assert!(
                json.contains("notes"),
                "response should include reloaded config"
            );
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
        let handle = handle_rx
            .recv_timeout(Duration::from_secs(5))
            .expect("recv handle");
        handle.join().expect("handler thread");
    }
    pipe_guard.disarm();
}
