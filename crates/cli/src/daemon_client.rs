use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::thread;
use std::time::{Duration, Instant};

use scriptor_system_bridge::process_alive;

use scriptor_daemon::{
    DaemonEndpoint, read_endpoint, reset_rpc_session, rpc_call, shared_rpc_client,
};
use scriptor_ipc::{RpcMethod, RpcPayload, RpcRequest, RpcResult};

pub const IN_PROCESS_DEPRECATION: &str =
    "warning: --in-process uses deprecated direct SQLite indexer; daemon routing is the default";

const DAEMON_STARTUP_TIMEOUT: Duration = Duration::from_secs(30);
const DAEMON_STARTUP_POLL_INTERVAL: Duration = Duration::from_millis(250);
const DAEMON_EXISTING_PROBE_TIMEOUT: Duration = Duration::from_secs(1);
const DAEMON_EXISTING_RECOVERY_TIMEOUT: Duration = Duration::from_secs(5);
const DAEMON_EXISTING_RECOVERY_POLL_INTERVAL: Duration = Duration::from_millis(100);
const DAEMON_STARTUP_PING_TIMEOUT: Duration = Duration::from_secs(1);
const DAEMON_COMMAND_PING_TIMEOUT: Duration = Duration::from_secs(5);
const DAEMON_SOCKET_ENV: &str = "SCRIPTOR_DAEMON_SOCKET";

/// Emit the compatibility warning for the deprecated in-process indexer.
pub fn warn_in_process_deprecated() {
    eprintln!("{IN_PROCESS_DEPRECATION}");
}

/// Resolve the daemon sidecar from an explicit override, beside the CLI, or PATH.
pub fn resolve_daemon_binary() -> PathBuf {
    if let Ok(path) = std::env::var("SCRIPTOR_DAEMON_BIN") {
        return PathBuf::from(path);
    }

    if let Ok(exe) = std::env::current_exe()
        && let Some(parent) = exe.parent()
    {
        let candidates = if cfg!(windows) {
            [
                "scriptor-daemon.exe",
                "../scriptor-daemon.exe",
                "../../scriptor-daemon.exe",
            ]
        } else {
            [
                "scriptor-daemon",
                "../scriptor-daemon",
                "../../scriptor-daemon",
            ]
        };
        for candidate in candidates {
            let path = parent.join(candidate);
            if path.is_file() {
                return path;
            }
        }
    }

    if cfg!(windows) {
        PathBuf::from("scriptor-daemon.exe")
    } else {
        PathBuf::from("scriptor-daemon")
    }
}

/// Perform one ping within a caller-supplied whole-RPC budget.
fn daemon_ping_with_timeout(timeout: Duration) -> Result<String, Box<dyn std::error::Error>> {
    let response =
        shared_rpc_client().call_with_timeout(RpcRequest::new(1, RpcMethod::Ping), timeout)?;
    match response.result {
        RpcResult::Ok(RpcPayload::Pong { version }) => Ok(version),
        RpcResult::Error(error) => Err(error.to_string().into()),
        _ => Err("unexpected daemon ping response".into()),
    }
}

/// Ping an already-running daemon without inheriting the 120-second budget
/// reserved for long-running export and index RPCs.
pub fn daemon_ping() -> Result<String, Box<dyn std::error::Error>> {
    daemon_ping_with_timeout(DAEMON_COMMAND_PING_TIMEOUT)
}

/// Build the daemon serve command, including an optional isolated socket name.
fn daemon_serve_command(binary: &Path, socket_override: Option<&str>) -> Command {
    // PROCESS_BROKER_EXCEPTION(cli-daemon-serve)
    let mut command = Command::new(binary);
    command.arg("serve");
    if let Some(socket) = socket_override.filter(|value| !value.trim().is_empty()) {
        command.args(["--socket", socket]);
    }
    command
}

/// Cap one startup probe by both the per-ping limit and remaining startup budget.
fn bounded_startup_ping_timeout(now: Instant, deadline: Instant) -> Option<Duration> {
    let remaining = deadline.checked_duration_since(now)?;
    if remaining.is_zero() {
        None
    } else {
        Some(remaining.min(DAEMON_STARTUP_PING_TIMEOUT))
    }
}

/// Verify whether the authenticated endpoint's recorded process is still running.
///
/// Merely opening a Windows process handle is insufficient: a terminated process
/// object remains openable while another handle is retained. Querying its exit
/// code distinguishes that stale object from a genuinely running daemon.
/// Recover from a transient connection failure without killing or trusting the
/// endpoint PID as the final arbiter.
///
/// Windows may recycle a terminated daemon's PID while the signed endpoint is
/// still present. Conversely, a genuinely live daemon may briefly cycle named-
/// pipe instances. We first retry the authenticated endpoint. If it remains
/// unavailable, the caller is allowed to start exactly one replacement process:
/// the operating system's socket bind then decides whether the old listener is
/// truly still owned. This avoids killing a reused PID and avoids racing two
/// successfully bound daemons.
fn recover_existing_daemon(
    mut endpoint: DaemonEndpoint,
    initial_error: String,
) -> Result<Option<DaemonEndpoint>, Box<dyn std::error::Error>> {
    let deadline = Instant::now() + DAEMON_EXISTING_RECOVERY_TIMEOUT;
    let mut last_error = initial_error.clone();

    loop {
        if !process_alive(endpoint.pid) {
            return Ok(None);
        }

        let now = Instant::now();
        let Some(ping_timeout) = bounded_startup_ping_timeout(now, deadline) else {
            break;
        };

        // Every retry starts from a fresh local socket. An EOF may leave the
        // previous stream between frames and therefore unsafe to reuse.
        reset_rpc_session();
        match daemon_ping_with_timeout(ping_timeout) {
            Ok(_) => {
                let current = read_endpoint()?;
                if process_alive(current.pid) {
                    return Ok(Some(current));
                }
                return Ok(None);
            }
            Err(error) => last_error = error.to_string(),
        }

        // Another authorised process may replace a genuinely dead daemon while
        // this caller is recovering. Follow the newly signed endpoint instead
        // of retaining an obsolete PID/socket pair.
        if let Ok(current) = read_endpoint() {
            endpoint = current;
        }
        if !process_alive(endpoint.pid) {
            return Ok(None);
        }

        let now = Instant::now();
        let Some(remaining) = deadline.checked_duration_since(now) else {
            break;
        };
        if remaining.is_zero() {
            break;
        }
        thread::sleep(remaining.min(DAEMON_EXISTING_RECOVERY_POLL_INTERVAL));
    }

    eprintln!(
        "warning: authenticated daemon endpoint {} (pid {}) remained unavailable; probing socket ownership with one replacement bind; initial ping error: {}; last ping error: {}",
        endpoint.socket_name, endpoint.pid, initial_error, last_error,
    );
    Ok(None)
}

/// Ensure a daemon is reachable, spawning and monitoring the sidecar when needed.
pub fn ensure_daemon_running() -> Result<DaemonEndpoint, Box<dyn std::error::Error>> {
    let initial_ping_error = match daemon_ping_with_timeout(DAEMON_EXISTING_PROBE_TIMEOUT) {
        Ok(_) => return read_endpoint().map_err(Into::into),
        Err(error) => error.to_string(),
    };

    // A signed endpoint plus a live PID is retried before replacement. PID
    // liveness is not authoritative on its own because Windows can recycle a
    // terminated process identifier; the subsequent socket bind is definitive.
    if let Ok(endpoint) = read_endpoint()
        && process_alive(endpoint.pid)
        && let Some(recovered) = recover_existing_daemon(endpoint, initial_ping_error)?
    {
        return Ok(recovered);
    }

    let binary = resolve_daemon_binary();
    let binary_display = binary.display().to_string();
    let socket_override = std::env::var(DAEMON_SOCKET_ENV)
        .ok()
        .filter(|value| !value.trim().is_empty());
    let mut command = daemon_serve_command(&binary, socket_override.as_deref());
    // A daemon outlives the CLI invocation that launched it. Inheriting a
    // PowerShell or CI pipeline's handles keeps that pipeline open forever,
    // even after the CLI exits. Detach all three standard streams.
    let mut child = command
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|error| format!("failed to start {binary_display}: {error}"))?;
    let child_pid = child.id();

    reset_rpc_session();

    let deadline = Instant::now() + DAEMON_STARTUP_TIMEOUT;
    let mut last_ping_error = None;
    loop {
        match child.try_wait() {
            Ok(Some(status)) => {
                reset_rpc_session();
                // The replacement may have lost the bind race to a legitimate
                // listener that recovered while it was starting. Prefer that
                // now-responsive authenticated endpoint over a false failure.
                if daemon_ping_with_timeout(DAEMON_STARTUP_PING_TIMEOUT).is_ok() {
                    return read_endpoint().map_err(Into::into);
                }
                let detail = last_ping_error
                    .as_deref()
                    .unwrap_or("the daemon exited before the first ping completed");
                return Err(format!(
                    "{binary_display} (pid {child_pid}) exited with {status} before becoming ready; last ping error: {detail}"
                )
                .into());
            }
            Ok(None) => {}
            Err(error) => {
                let _ = child.kill();
                let _ = child.wait();
                reset_rpc_session();
                return Err(format!(
                    "failed to monitor {binary_display} (pid {child_pid}) during startup: {error}"
                )
                .into());
            }
        }

        let now = Instant::now();
        let Some(ping_timeout) = bounded_startup_ping_timeout(now, deadline) else {
            break;
        };
        match daemon_ping_with_timeout(ping_timeout) {
            Ok(_) => return read_endpoint().map_err(Into::into),
            Err(error) => last_ping_error = Some(error.to_string()),
        }

        let now = Instant::now();
        let Some(remaining) = deadline.checked_duration_since(now) else {
            break;
        };
        if remaining.is_zero() {
            break;
        }
        thread::sleep(remaining.min(DAEMON_STARTUP_POLL_INTERVAL));
    }

    let endpoint_belongs_to_child = read_endpoint()
        .map(|endpoint| endpoint.pid == child_pid)
        .unwrap_or(false);
    let _ = child.kill();
    let _ = child.wait();
    reset_rpc_session();
    if endpoint_belongs_to_child {
        let _ = scriptor_daemon::remove_endpoint_file();
    }

    let detail = last_ping_error
        .as_deref()
        .unwrap_or("no daemon ping completed");
    Err(format!(
        "daemon did not become ready within {}s after spawning {binary_display} (pid {child_pid}); last ping error: {detail}",
        DAEMON_STARTUP_TIMEOUT.as_secs()
    )
    .into())
}

/// Open a vault in the already-running daemon session.
pub fn open_vault(path: &Path) -> Result<(), Box<dyn std::error::Error>> {
    let response = rpc_call(RpcRequest::new(
        2,
        RpcMethod::OpenVault {
            path: path.display().to_string(),
        },
    ))?;
    match response.result {
        RpcResult::Ok(RpcPayload::VaultOpened { .. }) => Ok(()),
        RpcResult::Error(error) => Err(error.to_string().into()),
        _ => Err("unexpected daemon open vault response".into()),
    }
}

/// Ensure the daemon is ready and has opened `path`.
pub fn ensure_vault_open(path: &Path) -> Result<(), Box<dyn std::error::Error>> {
    ensure_daemon_running()?;
    open_vault(path)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolve_daemon_binary_returns_path() {
        let path = resolve_daemon_binary();
        assert!(!path.as_os_str().is_empty());
    }

    #[test]
    fn daemon_serve_command_applies_isolated_socket_override() {
        let command =
            daemon_serve_command(Path::new("scriptor-daemon"), Some("scriptor-smoke-123"));
        let args = command
            .get_args()
            .map(|value| value.to_string_lossy().into_owned())
            .collect::<Vec<_>>();
        assert_eq!(
            args,
            vec![
                "serve".to_string(),
                "--socket".to_string(),
                "scriptor-smoke-123".to_string(),
            ]
        );
    }

    #[test]
    fn daemon_serve_command_ignores_blank_socket_override() {
        let command = daemon_serve_command(Path::new("scriptor-daemon"), Some("   "));
        let args = command
            .get_args()
            .map(|value| value.to_string_lossy().into_owned())
            .collect::<Vec<_>>();
        assert_eq!(args, vec!["serve".to_string()]);
    }

    #[test]
    fn startup_ping_timeout_is_capped_by_per_ping_limit() {
        let now = Instant::now();
        let deadline = now + Duration::from_secs(10);
        assert_eq!(
            bounded_startup_ping_timeout(now, deadline),
            Some(DAEMON_STARTUP_PING_TIMEOUT)
        );
    }

    #[test]
    fn startup_ping_timeout_uses_smaller_remaining_budget() {
        let now = Instant::now();
        let remaining = Duration::from_millis(125);
        assert_eq!(
            bounded_startup_ping_timeout(now, now + remaining),
            Some(remaining)
        );
        assert_eq!(bounded_startup_ping_timeout(now, now), None);
    }

    #[test]
    fn process_liveness_rejects_zero_and_accepts_current_process() {
        assert!(!process_alive(0));
        assert!(process_alive(std::process::id()));
    }

    #[cfg(windows)]
    #[test]
    fn process_liveness_rejects_exited_child_with_retained_handle() {
        // PROCESS_BROKER_EXCEPTION(cli-process-liveness-test-windows)
        let mut child = Command::new("cmd")
            .args(["/C", "exit", "0"])
            .spawn()
            .expect("spawn child");
        let pid = child.id();
        let status = child.wait().expect("wait for child");
        assert!(status.success());
        assert!(!process_alive(pid));
    }
}
