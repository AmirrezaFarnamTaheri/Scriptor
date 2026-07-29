use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::thread;
use std::time::{Duration, Instant};

use scriptor_daemon::{read_endpoint, reset_rpc_session, rpc_call, DaemonEndpoint};
use scriptor_ipc::{RpcMethod, RpcPayload, RpcRequest, RpcResult};

pub const IN_PROCESS_DEPRECATION: &str =
    "warning: --in-process uses deprecated direct SQLite indexer; daemon routing is the default";

const DAEMON_STARTUP_TIMEOUT: Duration = Duration::from_secs(30);
const DAEMON_STARTUP_POLL_INTERVAL: Duration = Duration::from_millis(250);

pub fn warn_in_process_deprecated() {
    eprintln!("{IN_PROCESS_DEPRECATION}");
}

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
            ["scriptor-daemon", "../scriptor-daemon", "../../scriptor-daemon"]
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

pub fn daemon_ping() -> Result<String, Box<dyn std::error::Error>> {
    let response = rpc_call(RpcRequest::new(1, RpcMethod::Ping))?;
    match response.result {
        RpcResult::Ok(RpcPayload::Pong { version }) => Ok(version),
        RpcResult::Err(message) => Err(message.into()),
        _ => Err("unexpected daemon ping response".into()),
    }
}

pub fn ensure_daemon_running() -> Result<DaemonEndpoint, Box<dyn std::error::Error>> {
    if daemon_ping().is_ok() {
        return read_endpoint().map_err(Into::into);
    }

    let binary = resolve_daemon_binary();
    let binary_display = binary.display().to_string();
    let mut child = Command::new(&binary)
        .arg("serve")
        // A daemon outlives the CLI invocation that launched it. Inheriting a
        // PowerShell or CI pipeline's handles keeps that pipeline open forever,
        // even after the CLI exits. Detach all three standard streams.
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

        match daemon_ping() {
            Ok(_) => return read_endpoint().map_err(Into::into),
            Err(error) => last_ping_error = Some(error.to_string()),
        }

        if Instant::now() >= deadline {
            break;
        }
        thread::sleep(DAEMON_STARTUP_POLL_INTERVAL);
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

pub fn open_vault(path: &Path) -> Result<(), Box<dyn std::error::Error>> {
    let response = rpc_call(RpcRequest::new(
        2,
        RpcMethod::OpenVault {
            path: path.display().to_string(),
        },
    ))?;
    match response.result {
        RpcResult::Ok(RpcPayload::VaultOpened { .. }) => Ok(()),
        RpcResult::Err(message) => Err(message.into()),
        _ => Err("unexpected daemon open vault response".into()),
    }
}

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
}
