use std::ffi::{OsStr, OsString};
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, ExitStatus, Stdio};
use std::thread;
use std::time::{Duration, Instant};

use serde::Serialize;

use crate::{BridgeError, hash_file};

const POLL_INTERVAL: Duration = Duration::from_millis(25);
#[allow(dead_code)]
const TERMINATION_GRACE: Duration = Duration::from_millis(250);
const DEFAULT_MAX_OUTPUT_BYTES: usize = 256 * 1024;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NetworkPolicy {
    Allow,
    Deny,
}

#[derive(Debug, Clone)]
pub struct ProcessSpec {
    pub program: OsString,
    pub args: Vec<OsString>,
    pub current_dir: Option<PathBuf>,
    pub timeout: Duration,
    pub max_output_bytes: usize,
    pub network_policy: NetworkPolicy,
    pub expected_sha256: Option<String>,
    pub environment: Vec<(OsString, OsString)>,
    pub allow_unsandboxed_network_denial: bool,
}

impl ProcessSpec {
    pub fn new(program: impl Into<OsString>) -> Self {
        Self {
            program: program.into(),
            args: Vec::new(),
            current_dir: None,
            timeout: Duration::from_secs(30),
            max_output_bytes: DEFAULT_MAX_OUTPUT_BYTES,
            network_policy: NetworkPolicy::Allow,
            expected_sha256: None,
            environment: Vec::new(),
            allow_unsandboxed_network_denial: false,
        }
    }

    pub fn arg(mut self, arg: impl Into<OsString>) -> Self {
        self.args.push(arg.into());
        self
    }

    pub fn args<I, S>(mut self, args: I) -> Self
    where
        I: IntoIterator<Item = S>,
        S: Into<OsString>,
    {
        self.args.extend(args.into_iter().map(Into::into));
        self
    }

    pub fn current_dir(mut self, path: impl Into<PathBuf>) -> Self {
        self.current_dir = Some(path.into());
        self
    }

    pub fn timeout(mut self, timeout: Duration) -> Self {
        self.timeout = timeout.max(Duration::from_millis(1));
        self
    }

    pub fn max_output_bytes(mut self, max_output_bytes: usize) -> Self {
        self.max_output_bytes = max_output_bytes.max(1024);
        self
    }

    pub fn network_policy(mut self, policy: NetworkPolicy) -> Self {
        self.network_policy = policy;
        self
    }

    pub fn allow_unsandboxed_network_denial(mut self, allow: bool) -> Self {
        self.allow_unsandboxed_network_denial = allow;
        self
    }

    pub fn expected_sha256(mut self, sha256: Option<String>) -> Self {
        self.expected_sha256 = sha256;
        self
    }

    pub fn env(mut self, key: impl Into<OsString>, value: impl Into<OsString>) -> Self {
        self.environment.push((key.into(), value.into()));
        self
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessReceipt {
    pub program: String,
    pub resolved_program: String,
    pub program_sha256: Option<String>,
    pub exit_code: i32,
    pub duration_ms: u64,
    pub timed_out: bool,
    pub stdout: String,
    pub stderr: String,
    pub stdout_truncated: bool,
    pub stderr_truncated: bool,
}

pub fn run_process(spec: ProcessSpec) -> Result<ProcessReceipt, BridgeError> {
    let resolved = resolve_executable(&spec.program, spec.current_dir.as_deref())?;
    let actual_hash = if resolved.is_file() {
        Some(hash_file(&resolved)?)
    } else {
        None
    };
    if let Some(expected) = spec.expected_sha256.as_deref() {
        let actual = actual_hash
            .as_deref()
            .ok_or_else(|| BridgeError::ProcessPolicy {
                message: format!("cannot hash executable {}", resolved.display()),
            })?;
        if !actual.eq_ignore_ascii_case(expected.trim()) {
            return Err(BridgeError::ProcessPolicy {
                message: format!(
                    "executable hash mismatch for {}: expected {} got {}",
                    resolved.display(),
                    expected,
                    actual
                ),
            });
        }
    }

    if spec.network_policy == NetworkPolicy::Deny
        && !sandbox_available()
        && !spec.allow_unsandboxed_network_denial
    {
        return Err(BridgeError::ProcessPolicy {
            message: "network-denied execution requires a supported sandbox; set an explicit trusted-workspace override only after review".into(),
        });
    }

    let mut command = sandboxed_command(&spec, &resolved)?;
    configure_minimal_environment(&mut command, &spec.environment);
    if let Some(current_dir) = spec.current_dir.as_deref() {
        command.current_dir(current_dir);
    }
    command
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    configure_process_group(&mut command);

    let started = Instant::now();
    let mut child = command
        .spawn()
        .map_err(|source| BridgeError::ProcessSpawn {
            program: resolved.clone(),
            source,
        })?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| BridgeError::ProcessPolicy {
            message: "failed to capture child stdout".into(),
        })?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| BridgeError::ProcessPolicy {
            message: "failed to capture child stderr".into(),
        })?;
    let stdout_limit = spec.max_output_bytes;
    let stderr_limit = spec.max_output_bytes;
    let stdout_reader = thread::spawn(move || read_bounded(stdout, stdout_limit));
    let stderr_reader = thread::spawn(move || read_bounded(stderr, stderr_limit));

    let mut timed_out = false;
    let status = loop {
        if let Some(status) = child
            .try_wait()
            .map_err(|source| BridgeError::ProcessWait {
                program: resolved.clone(),
                source,
            })?
        {
            break status;
        }
        if started.elapsed() >= spec.timeout {
            timed_out = true;
            terminate_process_tree(&mut child);
            break child.wait().map_err(|source| BridgeError::ProcessWait {
                program: resolved.clone(),
                source,
            })?;
        }
        thread::sleep(POLL_INTERVAL);
    };

    let (stdout, stdout_truncated) =
        stdout_reader
            .join()
            .map_err(|_| BridgeError::ProcessPolicy {
                message: "stdout reader thread panicked".into(),
            })??;
    let (stderr, stderr_truncated) =
        stderr_reader
            .join()
            .map_err(|_| BridgeError::ProcessPolicy {
                message: "stderr reader thread panicked".into(),
            })??;

    let receipt = ProcessReceipt {
        program: Path::new(&spec.program).display().to_string(),
        resolved_program: resolved.display().to_string(),
        program_sha256: actual_hash,
        exit_code: exit_code(status),
        duration_ms: started.elapsed().as_millis().try_into().unwrap_or(u64::MAX),
        timed_out,
        stdout: String::from_utf8_lossy(&stdout).into_owned(),
        stderr: String::from_utf8_lossy(&stderr).into_owned(),
        stdout_truncated,
        stderr_truncated,
    };

    if timed_out {
        return Err(BridgeError::ProcessTimeout {
            program: resolved,
            timeout_ms: spec.timeout.as_millis().try_into().unwrap_or(u64::MAX),
            stdout: receipt.stdout,
            stderr: receipt.stderr,
        });
    }
    Ok(receipt)
}

fn configure_minimal_environment(command: &mut Command, additions: &[(OsString, OsString)]) {
    command.env_clear();
    for key in [
        "PATH",
        "HOME",
        "USERPROFILE",
        "TEMP",
        "TMP",
        "TMPDIR",
        "SYSTEMROOT",
        "COMSPEC",
        "PATHEXT",
        "LANG",
        "LC_ALL",
    ] {
        if let Some(value) = std::env::var_os(key) {
            command.env(key, value);
        }
    }
    command
        .env("GIT_TERMINAL_PROMPT", "0")
        .env("GCM_INTERACTIVE", "Never")
        .env("NO_COLOR", "1");
    for (key, value) in additions {
        command.env(key, value);
    }
}

fn resolve_executable(program: &OsStr, current_dir: Option<&Path>) -> Result<PathBuf, BridgeError> {
    let candidate = PathBuf::from(program);
    if candidate.components().count() > 1 || candidate.is_absolute() {
        let candidate = if candidate.is_absolute() {
            candidate
        } else {
            current_dir
                .unwrap_or_else(|| Path::new("."))
                .join(candidate)
        };
        return std::fs::canonicalize(&candidate).map_err(|source| BridgeError::Io {
            path: candidate,
            source,
        });
    }
    let path = std::env::var_os("PATH").ok_or_else(|| BridgeError::ProcessPolicy {
        message: "PATH is unavailable while resolving external executable".into(),
    })?;
    for directory in std::env::split_paths(&path) {
        for name in executable_names(program) {
            let candidate = directory.join(name);
            if candidate.is_file() {
                return std::fs::canonicalize(&candidate).map_err(|source| BridgeError::Io {
                    path: candidate,
                    source,
                });
            }
        }
    }
    Err(BridgeError::ProcessPolicy {
        message: format!(
            "external executable not found: {}",
            Path::new(program).display()
        ),
    })
}

fn executable_names(program: &OsStr) -> Vec<OsString> {
    #[cfg(windows)]
    {
        let path = Path::new(program);
        if path.extension().is_some() {
            return vec![program.to_os_string()];
        }
        [".exe", ".cmd", ".bat", ".com"]
            .into_iter()
            .map(|extension| {
                let mut name = program.to_os_string();
                name.push(extension);
                name
            })
            .collect()
    }
    #[cfg(not(windows))]
    {
        vec![program.to_os_string()]
    }
}

fn read_bounded(mut reader: impl Read, limit: usize) -> Result<(Vec<u8>, bool), BridgeError> {
    let mut stored = Vec::with_capacity(limit.min(64 * 1024));
    let mut buffer = [0u8; 8192];
    let mut truncated = false;
    loop {
        let read = reader
            .read(&mut buffer)
            .map_err(|source| BridgeError::ProcessRead { source })?;
        if read == 0 {
            break;
        }
        let remaining = limit.saturating_sub(stored.len());
        if remaining > 0 {
            stored.extend_from_slice(&buffer[..read.min(remaining)]);
        }
        if read > remaining {
            truncated = true;
        }
    }
    Ok((stored, truncated))
}

fn exit_code(status: ExitStatus) -> i32 {
    status.code().unwrap_or(-1)
}

#[cfg(unix)]
fn configure_process_group(command: &mut Command) {
    use std::os::unix::process::CommandExt;
    command.process_group(0);
}

#[cfg(not(unix))]
fn configure_process_group(_command: &mut Command) {}

#[cfg(unix)]
fn terminate_process_tree(child: &mut Child) {
    let group = format!("-{}", child.id());
    let _ = Command::new("kill").args(["-TERM", &group]).status();
    thread::sleep(TERMINATION_GRACE);
    if child.try_wait().ok().flatten().is_none() {
        let _ = Command::new("kill").args(["-KILL", &group]).status();
        let _ = child.kill();
    }
}

#[cfg(windows)]
fn terminate_process_tree(child: &mut Child) {
    let _ = Command::new("taskkill")
        .args(["/PID", &child.id().to_string(), "/T", "/F"])
        .status();
    let _ = child.kill();
}

#[cfg(not(any(unix, windows)))]
fn terminate_process_tree(child: &mut Child) {
    let _ = child.kill();
}

fn sandbox_available() -> bool {
    #[cfg(target_os = "linux")]
    {
        command_exists("bwrap")
    }
    #[cfg(target_os = "macos")]
    {
        command_exists("sandbox-exec")
    }
    #[cfg(not(any(target_os = "linux", target_os = "macos")))]
    {
        false
    }
}

#[allow(dead_code)]
fn command_exists(name: &str) -> bool {
    resolve_executable(OsStr::new(name), None).is_ok()
}

fn sandboxed_command(spec: &ProcessSpec, resolved: &Path) -> Result<Command, BridgeError> {
    if spec.network_policy != NetworkPolicy::Deny || !sandbox_available() {
        let mut command = Command::new(resolved);
        command.args(&spec.args);
        return Ok(command);
    }

    #[cfg(target_os = "linux")]
    {
        let bwrap = resolve_executable(OsStr::new("bwrap"), None)?;
        let mut command = Command::new(bwrap);
        command.args([
            "--die-with-parent",
            "--unshare-net",
            "--ro-bind",
            "/",
            "/",
            "--dev",
            "/dev",
            "--proc",
            "/proc",
        ]);
        if let Some(current_dir) = spec.current_dir.as_deref() {
            command.args([
                "--bind",
                &current_dir.display().to_string(),
                &current_dir.display().to_string(),
            ]);
            command.args(["--chdir", &current_dir.display().to_string()]);
        }
        command.arg("--").arg(resolved).args(&spec.args);
        return Ok(command);
    }

    #[cfg(target_os = "macos")]
    {
        let sandbox_exec = resolve_executable(OsStr::new("sandbox-exec"), None)?;
        let current_dir = spec
            .current_dir
            .as_deref()
            .unwrap_or_else(|| Path::new("/tmp"));
        let writable_subpath = escape_sandbox_profile_string(current_dir.as_os_str());
        let profile = format!(
            "(version 1) (deny default) (allow process*) (allow file-read*) (allow file-write* (subpath \"{}\")) (deny network*)",
            writable_subpath
        );
        let mut command = Command::new(sandbox_exec);
        command
            .args(["-p", &profile])
            .arg(resolved)
            .args(&spec.args);
        return Ok(command);
    }

    #[allow(unreachable_code)]
    Err(BridgeError::ProcessPolicy {
        message: "network-denied sandboxing is unavailable on this platform".into(),
    })
}

/// Escapes a path for use inside a quoted macOS sandbox profile string.
///
/// A vault path can contain quotes and backslashes. Interpolating it directly
/// would let the path terminate the string and alter the generated policy.
#[allow(dead_code)]
fn escape_sandbox_profile_string(value: &OsStr) -> String {
    value
        .to_string_lossy()
        .replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace('\n', "\\n")
        .replace('\r', "\\r")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bounded_reader_drains_but_caps_memory() {
        let input = vec![b'x'; 64 * 1024];
        let (stored, truncated) = read_bounded(input.as_slice(), 1024).expect("read");
        assert_eq!(stored.len(), 1024);
        assert!(truncated);
    }

    #[test]
    fn process_receipt_captures_output() {
        #[cfg(windows)]
        let spec = ProcessSpec::new("cmd").args(["/C", "echo", "hello"]);
        #[cfg(not(windows))]
        let spec = ProcessSpec::new("sh").args(["-c", "printf hello"]);
        let receipt = run_process(spec).expect("run");
        assert_eq!(receipt.exit_code, 0);
        assert_eq!(receipt.stdout.trim(), "hello");
    }

    #[test]
    fn process_timeout_is_reported() {
        #[cfg(windows)]
        let spec = ProcessSpec::new("cmd")
            .args(["/C", "ping", "127.0.0.1", "-n", "6", ">", "NUL"])
            .timeout(Duration::from_millis(50));
        #[cfg(not(windows))]
        let spec = ProcessSpec::new("sh")
            .args(["-c", "sleep 5"])
            .timeout(Duration::from_millis(50));
        assert!(matches!(
            run_process(spec),
            Err(BridgeError::ProcessTimeout { .. })
        ));
    }

    #[test]
    fn macos_sandbox_paths_cannot_inject_profile_rules() {
        let escaped = escape_sandbox_profile_string(OsStr::new(
            r#"/tmp/vault\") (allow network*) (subpath \"/"#,
        ));
        assert_eq!(
            escaped,
            r#"/tmp/vault\") (allow network*) (subpath \"/"#
                .replace('\\', "\\\\")
                .replace('"', "\\\"")
        );
        assert!(!escaped.contains(r#"/tmp/vault")"#));
    }
}
