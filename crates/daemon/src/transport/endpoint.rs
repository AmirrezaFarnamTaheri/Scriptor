use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use interprocess::local_socket::prelude::*;
use interprocess::local_socket::{GenericFilePath, GenericNamespaced, Name};
use scriptor_ipc::IpcError;
use scriptor_system_bridge::{process_alive, scriptor_data_dir};
use serde::{Deserialize, Serialize};

use super::DAEMON_PROTOCOL_VERSION;

const SOCKET_BASENAME: &str = "scriptor-core";
const ENDPOINT_FILE: &str = "daemon-endpoint.json";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct DaemonEndpoint {
    pub socket_name: String,
    pub pid: u32,
    #[serde(default)]
    pub protocol_version: u32,
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
    use hmac::{Hmac, KeyInit, Mac};
    use sha2::Sha256;

    type HmacSha256 = Hmac<Sha256>;

    let key = endpoint_hmac_key()?;
    let mut mac = HmacSha256::new_from_slice(key.as_bytes())
        .map_err(|e| IpcError::Codec(format!("invalid HMAC key length: {e}")))?;
    mac.update(message.as_bytes());
    let result = mac.finalize().into_bytes();

    let mut out = [0u8; 32];
    out.copy_from_slice(&result);
    Ok(out)
}

/// Constant-time HMAC comparison; length mismatch only reveals the fixed endpoint digest length.
fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    use subtle::ConstantTimeEq;
    if a.len() != b.len() {
        return false;
    }
    a.ct_eq(b).into()
}

#[cfg(not(test))]
const KEYCHAIN_ACCOUNT: &str = "daemon-endpoint-hmac-key";
#[cfg(all(debug_assertions, not(test)))]
const TEST_HMAC_KEY_ENV: &str = "SCRIPTOR_TEST_DAEMON_HMAC_KEY";

fn endpoint_hmac_key() -> Result<String, IpcError> {
    #[cfg(test)]
    {
        Ok("scriptor-daemon-transport-test-key-0001".to_string())
    }

    #[cfg(not(test))]
    {
        endpoint_hmac_key_runtime()
    }
}

#[cfg(not(test))]
fn endpoint_hmac_key_runtime() -> Result<String, IpcError> {
    use scriptor_system_bridge::{keychain_get, keychain_set};

    // Headless debug-only integration tests cannot rely on a desktop secret-service daemon.
    // Release builds never compile this override and always use the operating-system keychain.
    #[cfg(debug_assertions)]
    if let Ok(key) = std::env::var(TEST_HMAC_KEY_ENV)
        && key.len() >= 32
    {
        return Ok(key);
    }

    // The OS keychain is the sole durable authority for daemon authentication.
    match keychain_get(KEYCHAIN_ACCOUNT) {
        Ok(Some(key)) if !key.trim().is_empty() => return Ok(key.trim().to_string()),
        Ok(_) => {}
        Err(err) => {
            return Err(IpcError::Codec(format!(
                "daemon keychain unavailable: {err}"
            )));
        }
    }

    // Generate and store the current key through the keychain API.
    let nonce = generate_nonce()?;
    keychain_set(KEYCHAIN_ACCOUNT, &nonce).map_err(|err| {
        IpcError::Codec(format!("cannot store daemon HMAC key in keychain: {err}"))
    })?;
    Ok(nonce)
}

pub fn write_endpoint(socket_name: &str) -> Result<DaemonEndpoint, IpcError> {
    let nonce = generate_nonce()?;
    let pid = std::process::id();
    let hmac = compute_endpoint_hmac(socket_name, pid, &nonce)?;
    let endpoint = DaemonEndpoint {
        socket_name: socket_name.to_string(),
        pid,
        protocol_version: DAEMON_PROTOCOL_VERSION,
        nonce: Some(nonce),
        hmac: Some(hmac),
    };
    persist_endpoint(&endpoint)?;
    Ok(endpoint)
}

fn persist_endpoint(endpoint: &DaemonEndpoint) -> Result<(), IpcError> {
    let path = endpoint_file_path()?;
    let temp_path = path.with_file_name(format!(
        "{ENDPOINT_FILE}.tmp-{}-{}",
        endpoint.pid,
        uuid::Uuid::new_v4()
    ));
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

    Ok(())
}

pub fn read_endpoint() -> Result<DaemonEndpoint, IpcError> {
    let bytes = fs::read(endpoint_file_path()?).map_err(IpcError::from)?;
    let endpoint: DaemonEndpoint =
        serde_json::from_slice(&bytes).map_err(|error| IpcError::Codec(error.to_string()))?;

    if endpoint.protocol_version != DAEMON_PROTOCOL_VERSION {
        return Err(IpcError::Codec(format!(
            "daemon protocol version mismatch: endpoint={}, client={DAEMON_PROTOCOL_VERSION}",
            endpoint.protocol_version
        )));
    }

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

fn verify_endpoint_process(endpoint: &DaemonEndpoint) -> Result<(), IpcError> {
    if process_alive(endpoint.pid) {
        return Ok(());
    }
    // Endpoint-file ownership belongs to the daemon. A client may have read an
    // old endpoint immediately before a replacement daemon atomically wrote a
    // new one; unlinking here could delete that fresh endpoint. Re-read/retry
    // instead and let the daemon create/remove its own discoverability file.
    Err(IpcError::Io(io::Error::new(
        io::ErrorKind::NotConnected,
        format!("daemon endpoint stale (pid {} not running)", endpoint.pid),
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
            std::io::ErrorKind::NotFound
                | std::io::ErrorKind::WouldBlock
                | std::io::ErrorKind::NotConnected
        ),
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
