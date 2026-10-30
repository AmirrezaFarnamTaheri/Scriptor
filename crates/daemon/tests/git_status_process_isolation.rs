//! An OS-process-level companion to the authenticated in-process socket tests.
//! This uses the real debug daemon binary and separate authenticated client
//! processes, not a mock transport. It is NOT a packaged desktop acceptance test.

use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Output, Stdio};
use std::thread;
use std::time::{Duration, Instant};

use scriptor_ipc::{RpcMethod, RpcPayload, RpcRequest, RpcResult};
use serde_json::{Value, json};

const PROBE_ENV: &str = "SCRIPTOR_MAT008_PROCESS_PROBE";
const PROBE_PREFIX: &str = "MAT008_PROCESS_EVIDENCE_BEGIN";
const PROBE_SUFFIX: &str = "MAT008_PROCESS_EVIDENCE_END";
const TEST_KEY: &str = "mat-008-two-process-restart-debug-test-key-only";

fn probe_rpc(method: RpcMethod) -> scriptor_ipc::RpcResponse {
    scriptor_daemon::shared_rpc_client()
        .call_with_timeout(RpcRequest::new(108, method), Duration::from_secs(20))
        .expect("authenticated IPC must return a response, not fail transport")
}

fn open_vault(path: &str) -> String {
    let reply = probe_rpc(RpcMethod::OpenVault {
        path: path.to_owned(),
    });
    match reply.result {
        RpcResult::Ok(RpcPayload::VaultOpened { vault_id, .. }) => vault_id,
        other => panic!("opening the fixture vault must succeed: {other:?}"),
    }
}

fn read_git_status(expected_vault_id: String) -> Value {
    let reply = probe_rpc(RpcMethod::GitStatus { expected_vault_id });
    match reply.result {
        RpcResult::Ok(RpcPayload::GitStatus { .. }) => json!({ "result": "current" }),
        RpcResult::Error(error) => json!({
            "result": "denied",
            "reason": format!("{error:?}"),
        }),
        other => panic!("unexpected GitStatus reply: {other:?}"),
    }
}

fn emit(value: Value) {
    println!("{PROBE_PREFIX}{}{PROBE_SUFFIX}", value);
}

fn wait_for(path: &Path, purpose: &str) {
    let deadline = Instant::now() + Duration::from_secs(25);
    while Instant::now() < deadline {
        if path.exists() {
            return;
        }
        thread::sleep(Duration::from_millis(50));
    }
    panic!("timed out waiting for {purpose}: {}", path.display());
}

// Cargo test launches THIS test binary as another operating-system process,
// selected by --exact, to prove that two distinct clients authenticate with
// the real daemon. It exits immediately in ordinary test-suite execution.
#[test]
fn process_probe_entrypoint() {
    let Ok(mode) = std::env::var(PROBE_ENV) else {
        return;
    };
    match mode.as_str() {
        "watch_a" => {
            let path = std::env::var("SCRIPTOR_MAT008_VAULT").expect("A path");
            let ready = PathBuf::from(std::env::var("SCRIPTOR_MAT008_READY").expect("ready file"));
            let signal =
                PathBuf::from(std::env::var("SCRIPTOR_MAT008_SIGNAL").expect("signal file"));
            let id = open_vault(&path);
            let staged = ready.with_extension("tmp");
            fs::write(&staged, json!({ "vault_id": id }).to_string()).expect("write ready");
            fs::rename(staged, ready).expect("publish ready");
            wait_for(&signal, "vault B to switch the shared daemon");
            let status = read_git_status(id.clone());
            emit(json!({
                "role": "A",
                "vault_id": id,
                "status": status,
                "pid": std::process::id()
            }));
        }
        "switch_b" => {
            let path = std::env::var("SCRIPTOR_MAT008_VAULT").expect("B path");
            let id = open_vault(&path);
            let status = read_git_status(id.clone());
            emit(json!({
                "role": "B",
                "vault_id": id,
                "status": status,
                "pid": std::process::id()
            }));
        }
        "status" => {
            let id = std::env::var("SCRIPTOR_MAT008_ID").expect("requested identity");
            emit(json!({
                "role": "status",
                "status": read_git_status(id),
                "pid": std::process::id()
            }));
        }
        other => panic!("unknown probe mode: {other}"),
    }
}

struct ProcessGuard(Option<Child>);

impl ProcessGuard {
    fn new(child: Child) -> Self {
        Self(Some(child))
    }

    fn id(&self) -> u32 {
        self.0.as_ref().expect("child running").id()
    }

    fn finish(mut self) -> Output {
        self.0
            .take()
            .expect("child running")
            .wait_with_output()
            .expect("wait for probe")
    }

    fn stop(&mut self) {
        if let Some(mut child) = self.0.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}

impl Drop for ProcessGuard {
    fn drop(&mut self) {
        self.stop();
    }
}

struct TestEnvironment {
    appdata: PathBuf,
    home: PathBuf,
    endpoint: PathBuf,
    socket: String,
}

impl TestEnvironment {
    fn new(root: &Path) -> Self {
        let appdata = root.join("data");
        let home = root.join("home");
        fs::create_dir_all(&appdata).expect("appdata");
        fs::create_dir_all(&home).expect("home");
        let endpoint = if cfg!(target_os = "macos") {
            home.join("Library/Application Support/scriptor/daemon-endpoint.json")
        } else {
            appdata.join("scriptor/daemon-endpoint.json")
        };
        let socket = if cfg!(windows) {
            format!("scriptor-mat008-{}", std::process::id())
        } else {
            root.join("scriptor.sock").display().to_string()
        };
        Self {
            appdata,
            home,
            endpoint,
            socket,
        }
    }

    fn apply(&self, command: &mut Command) {
        command
            .env("APPDATA", &self.appdata)
            .env("XDG_DATA_HOME", &self.appdata)
            .env("HOME", &self.home)
            .env("SCRIPTOR_DAEMON_SOCKET", &self.socket)
            .env("SCRIPTOR_TEST_DAEMON_HMAC_KEY", TEST_KEY);
    }

    fn start_daemon(&self, previous_nonce: Option<&str>) -> (ProcessGuard, String) {
        let mut command = Command::new(env!("CARGO_BIN_EXE_scriptor-daemon"));
        command
            .arg("serve")
            .arg("--socket")
            .arg(&self.socket)
            .stdout(Stdio::null())
            .stderr(Stdio::null());
        self.apply(&mut command);
        let mut child = ProcessGuard::new(command.spawn().expect("spawn real daemon binary"));
        let deadline = Instant::now() + Duration::from_secs(25);
        while Instant::now() < deadline {
            if let Ok(content) = fs::read(&self.endpoint)
                && let Ok(endpoint) = serde_json::from_slice::<Value>(&content)
            {
                let pid = endpoint.get("pid").and_then(Value::as_u64);
                let nonce = endpoint.get("nonce").and_then(Value::as_str);
                if pid == Some(child.id() as u64)
                    && let Some(nonce) = nonce
                    && previous_nonce != Some(nonce)
                {
                    return (child, nonce.to_owned());
                }
            }
            if child
                .0
                .as_mut()
                .expect("daemon running")
                .try_wait()
                .expect("daemon liveness")
                .is_some()
            {
                panic!("daemon exited before its authenticated endpoint appeared");
            }
            thread::sleep(Duration::from_millis(50));
        }
        panic!("daemon did not publish a fresh authenticated endpoint");
    }

    fn probe(
        &self,
        action: &str,
        vault: Option<&Path>,
        id: Option<&str>,
        ready: Option<&Path>,
        signal: Option<&Path>,
    ) -> ProcessGuard {
        let mut command = Command::new(std::env::current_exe().expect("test executable"));
        command
            .args(["--exact", "process_probe_entrypoint", "--nocapture"])
            .env(PROBE_ENV, action)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        if let Some(vault) = vault {
            command.env("SCRIPTOR_MAT008_VAULT", vault);
        }
        if let Some(id) = id {
            command.env("SCRIPTOR_MAT008_ID", id);
        }
        if let Some(ready) = ready {
            command.env("SCRIPTOR_MAT008_READY", ready);
        }
        if let Some(signal) = signal {
            command.env("SCRIPTOR_MAT008_SIGNAL", signal);
        }
        self.apply(&mut command);
        ProcessGuard::new(
            command
                .spawn()
                .expect("spawn independently authenticated probe"),
        )
    }
}

fn probe_result(output: Output) -> Value {
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    assert!(
        output.status.success(),
        "authenticated probe process failed: stdout={stdout}\nstderr={stderr}"
    );
    let (_, after) = stdout
        .split_once(PROBE_PREFIX)
        .expect("probe must emit a machine-readable result");
    let (json, _) = after
        .split_once(PROBE_SUFFIX)
        .expect("probe must close the machine-readable result");
    serde_json::from_str(json).expect("valid probe result")
}

fn run_switch_scenario(
    env: &TestEnvironment,
    root: &Path,
    label: &str,
    a: &Path,
    b: &Path,
) -> (String, String) {
    let ready = root.join(format!("{label}-a-ready.json"));
    let signal = root.join(format!("{label}-allow-a-status"));
    let observer = env.probe("watch_a", Some(a), None, Some(&ready), Some(&signal));
    let observer_pid = observer.id();
    wait_for(
        &ready,
        "first independently authenticated client to open vault A",
    );
    let ready_data: Value =
        serde_json::from_slice(&fs::read(&ready).expect("ready data")).expect("valid ready data");
    let id_a = ready_data["vault_id"]
        .as_str()
        .expect("A vault identity")
        .to_owned();
    let current = probe_result(env.probe("switch_b", Some(b), None, None, None).finish());
    let id_b = current["vault_id"]
        .as_str()
        .expect("B vault identity")
        .to_owned();
    assert_ne!(id_a, id_b, "fixture vaults must have distinct identities");
    assert_eq!(
        current["status"]["result"], "current",
        "B's own Git status stays available"
    );
    assert_ne!(
        observer_pid as u64,
        current["pid"].as_u64().expect("B process pid")
    );

    fs::write(&signal, b"vault B opened").expect("release A's stale request");
    let stale = probe_result(observer.finish());
    assert_eq!(
        stale["status"]["result"], "denied",
        "A cannot read B's Git status"
    );
    assert!(
        stale["status"]["reason"]
            .as_str()
            .unwrap_or_default()
            .contains("Git status vault identity mismatch"),
        "A must be refused for an identity mismatch, not due to transport failure: {stale}"
    );
    assert_eq!(stale["vault_id"], id_a);
    (id_a, id_b)
}

#[test]
fn authenticated_two_process_status_isolation_survives_daemon_restart() {
    let temp = tempfile::tempdir().expect("isolated client/server fixture");
    let vault_a = temp.path().join("vault-a");
    let vault_b = temp.path().join("vault-b");
    fs::create_dir_all(&vault_a).expect("A vault");
    fs::create_dir_all(&vault_b).expect("B vault");
    let env = TestEnvironment::new(temp.path());

    let (mut first_daemon, first_nonce) = env.start_daemon(None);
    let (old_a, old_b) =
        run_switch_scenario(&env, temp.path(), "before-restart", &vault_a, &vault_b);

    first_daemon.stop();
    // Unix local sockets leave a filesystem node when the server is killed.
    #[cfg(unix)]
    let _ = fs::remove_file(&env.socket);

    let (mut restarted_daemon, next_nonce) = env.start_daemon(Some(&first_nonce));
    assert_ne!(
        first_nonce, next_nonce,
        "restart must issue fresh authenticated endpoint credentials"
    );

    let orphaned = probe_result(env.probe("status", None, Some(&old_b), None, None).finish());
    assert_eq!(
        orphaned["status"]["result"], "denied",
        "restarted daemon has no open vault session"
    );
    let (new_a, new_b) =
        run_switch_scenario(&env, temp.path(), "after-restart", &vault_a, &vault_b);
    assert_ne!(
        new_a, new_b,
        "new daemon still binds status to the initiating vault"
    );
    let previous = probe_result(env.probe("status", None, Some(&old_a), None, None).finish());
    assert_eq!(
        previous["status"]["result"], "denied",
        "pre-restart vault A cannot read active vault B"
    );
    restarted_daemon.stop();
    #[cfg(unix)]
    let _ = fs::remove_file(&env.socket);
}
