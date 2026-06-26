use std::path::{Path, PathBuf};
use std::process::Command;
use std::thread;
use std::time::Duration;

use scriptor_daemon::{read_endpoint, reset_rpc_session, rpc_call, DaemonEndpoint};
use scriptor_ipc::{RpcMethod, RpcPayload, RpcRequest, RpcResult};

pub const IN_PROCESS_DEPRECATION: &str =
    "warning: --in-process uses deprecated direct SQLite indexer; daemon routing is the default";

pub fn warn_in_process_deprecated() {
    eprintln!("{IN_PROCESS_DEPRECATION}");
}

pub fn resolve_daemon_binary() -> PathBuf {
    if let Ok(path) = std::env::var("SCRIPTOR_DAEMON_BIN") {
        return PathBuf::from(path);
    }

    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            let candidates = if cfg!(windows) {
                ["scriptor-daemon.exe", "../scriptor-daemon.exe", "../../scriptor-daemon.exe"]
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
    }

    if cfg!(windows) {
        PathBuf::from("scriptor-daemon.exe")
    } else {
        PathBuf::from("scriptor-daemon")
    }
}

pub fn daemon_ping() -> Result<String, Box<dyn std::error::Error>> {
    let response = rpc_call(RpcRequest {
        id: 1,
        method: RpcMethod::Ping,
    })?;
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
    Command::new(&binary)
        .arg("serve")
        .spawn()
        .map_err(|error| format!("failed to start {binary_display}: {error}"))?;

    reset_rpc_session();

    for _ in 0..40 {
        thread::sleep(Duration::from_millis(250));
        if daemon_ping().is_ok() {
            return read_endpoint().map_err(Into::into);
        }
    }

    Err(format!("daemon did not become ready after spawning {binary_display}").into())
}

pub fn open_vault(path: &Path) -> Result<(), Box<dyn std::error::Error>> {
    let response = rpc_call(RpcRequest {
        id: 2,
        method: RpcMethod::OpenVault {
            path: path.display().to_string(),
        },
    })?;
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
