//! Vault-owned bounded persistent Python sessions, supervised by the process broker.
use crate::{
    AppState,
    authorization::{SensitiveOperation, require_sensitive_operation},
    state::active_session,
};
use base64::{Engine, engine::general_purpose::STANDARD};
use scriptor_system_bridge::{NetworkPolicy, ProcessSpec, run_process};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    collections::BTreeMap,
    fs,
    io::{Read, Write},
    path::{Path, PathBuf},
    sync::{
        Arc, Mutex, OnceLock,
        atomic::{AtomicBool, AtomicUsize, Ordering},
    },
    time::{Duration, Instant},
};
const LIFETIME: u64 = 900;
const CELL_TIMEOUT: Duration = Duration::from_secs(30);
const JSON_LIMIT: usize = 2 * 1024 * 1024;
const PNG_LIMIT: usize = 4 * 1024 * 1024;
const SCRIPT: &str = include_str!("kernel.py");
static SESSIONS: OnceLock<Mutex<BTreeMap<String, Arc<Kernel>>>> = OnceLock::new();
static TRANSITION: Mutex<()> = Mutex::new(());
static STARTING: AtomicUsize = AtomicUsize::new(0);
pub fn vault_transition_guard() -> Result<std::sync::MutexGuard<'static, ()>, String> {
    lock(&TRANSITION)
}
pub fn stop_vault_sessions(vault_id: &str) -> Result<(), String> {
    let owned: Vec<_> = lock(sessions())?
        .values()
        .filter(|kernel| kernel.vault_id == vault_id)
        .cloned()
        .collect();
    for kernel in &owned {
        kernel.cancel.store(true, Ordering::Release);
    }
    for kernel in &owned {
        stop(kernel)?;
    }
    let mut sessions = lock(sessions())?;
    for kernel in owned {
        sessions.remove(&kernel.id);
    }
    Ok(())
}
struct StartReservation;
impl Drop for StartReservation {
    fn drop(&mut self) {
        STARTING.fetch_sub(1, Ordering::AcqRel);
    }
}
fn reserve_start() -> Result<StartReservation, String> {
    let mut sessions = lock(sessions())?;
    sessions.retain(|_, kernel| kernel.alive.load(Ordering::Acquire));
    if sessions.len() + STARTING.load(Ordering::Acquire) >= 4 {
        return Err("Runtime session capacity reached; stop another kernel".into());
    }
    STARTING.fetch_add(1, Ordering::AcqRel);
    Ok(StartReservation)
}
fn sessions() -> &'static Mutex<BTreeMap<String, Arc<Kernel>>> {
    SESSIONS.get_or_init(|| Mutex::new(BTreeMap::new()))
}
fn lock<T>(mutex: &Mutex<T>) -> Result<std::sync::MutexGuard<'_, T>, String> {
    mutex.lock().map_err(|_| "Runtime state lock failed".into())
}
struct Kernel {
    id: String,
    vault_id: String,
    root: PathBuf,
    directory: PathBuf,
    started: Instant,
    cancel: Arc<AtomicBool>,
    alive: AtomicBool,
    busy: AtomicBool,
    run_id: Mutex<Option<String>>,
    failure: Mutex<Option<String>>,
    version: Mutex<(String, String)>,
}
struct PendingKernel(Option<Arc<Kernel>>);
impl Drop for PendingKernel {
    fn drop(&mut self) {
        if let Some(kernel) = self.0.as_ref() {
            kernel.cancel.store(true, Ordering::Release);
        }
    }
}
fn register_kernel(
    mut pending: PendingKernel,
    current_vault: impl FnOnce() -> Result<String, String>,
) -> Result<KernelSession, String> {
    let kernel = pending
        .0
        .as_ref()
        .ok_or("Kernel startup ownership lost")?
        .clone();
    let _transition = vault_transition_guard()?;
    if current_vault()? != kernel.vault_id {
        let _ = stop(&kernel);
        return Err("Vault changed during kernel startup".into());
    }
    let result = metadata(&kernel)?;
    lock(sessions())?.insert(kernel.id.clone(), kernel);
    // Registry ownership replaces the pending startup cancellation guard.
    pending.0 = None;
    Ok(result)
}
#[derive(Clone, Debug, Serialize)]
pub struct KernelSession {
    id: String,
    vault_id: String,
    language: &'static str,
    python_version: String,
    executable: String,
    remaining_seconds: u64,
}
#[derive(Debug, Deserialize, Serialize)]
struct Variable {
    name: String,
    r#type: String,
    value: String,
}
#[derive(Debug, Serialize)]
struct Plot {
    mime_type: &'static str,
    data_base64: String,
    caption: String,
}
#[derive(Debug, Serialize)]
pub struct KernelResult {
    session_id: String,
    language: &'static str,
    exit_code: i32,
    stdout: String,
    stderr: String,
    duration_ms: u64,
    variables: Vec<Variable>,
    plots: Vec<Plot>,
}
#[derive(Deserialize)]
struct Response {
    exit_code: i32,
    stdout: String,
    stderr: String,
    duration_ms: u64,
    variables: Vec<Variable>,
    plots: Vec<String>,
}
#[derive(Serialize)]
pub struct KernelStatus {
    session: KernelSession,
    status: &'static str,
    stdout: String,
    stderr: String,
}
fn start_scope(environment: &BTreeMap<String, String>) -> Result<String, String> {
    let pairs: Vec<_> = environment.iter().collect();
    Ok(format!(
        "runtime:start:python:{}",
        sha256_hex(&serde_json::to_vec(&pairs).map_err(|e| e.to_string())?)
    ))
}
fn run_scope(id: &str, code: &str) -> String {
    format!("runtime:run:{id}:{}", sha256_hex(code.as_bytes()))
}
fn sha256_hex(bytes: &[u8]) -> String {
    Sha256::digest(bytes)
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}
fn validate_environment(environment: &BTreeMap<String, String>) -> Result<(), String> {
    if environment.len() > 16
        || serde_json::to_vec(environment)
            .map_err(|e| e.to_string())?
            .len()
            > 8192
    {
        return Err("Runtime environment exceeds its bounds".into());
    }
    for (name, value) in environment {
        let first = name.bytes().next().unwrap_or(0);
        if name.len() > 64
            || !(first.is_ascii_uppercase() || first == b'_')
            || !name
                .bytes()
                .all(|b| b.is_ascii_uppercase() || b.is_ascii_digit() || b == b'_')
            || matches!(
                name.as_str(),
                "PATH" | "HOME" | "USERPROFILE" | "SYSTEMROOT" | "COMSPEC" | "TEMP" | "TMP"
            )
            || name.starts_with("PYTHON")
            || name.starts_with("LD_")
            || name.starts_with("DYLD_")
            || value.len() > 1024
            || value.chars().any(char::is_control)
        {
            return Err("Invalid runtime environment variable or reserved process override".into());
        }
    }
    Ok(())
}
fn bounded(path: &Path, limit: usize) -> Result<Vec<u8>, String> {
    let metadata = fs::symlink_metadata(path).map_err(|e| e.to_string())?;
    if !metadata.is_file() || metadata.file_type().is_symlink() {
        return Err("Runtime response must be a regular file".into());
    }
    let mut bytes = Vec::new();
    fs::File::open(path)
        .map_err(|e| e.to_string())?
        .take(limit as u64 + 1)
        .read_to_end(&mut bytes)
        .map_err(|e| e.to_string())?;
    if bytes.len() > limit {
        return Err("Runtime response exceeds its byte bound".into());
    }
    Ok(bytes)
}
fn confined_directory(root: &Path, id: &str) -> Result<PathBuf, String> {
    let mut directory = root.to_path_buf();
    for segment in [".scriptor", "tmp", "runtime-console"] {
        directory.push(segment);
        match fs::symlink_metadata(&directory) {
            Ok(meta) if meta.is_dir() && !meta.file_type().is_symlink() => {}
            Ok(_) => return Err("Invalid runtime directory".into()),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
                fs::create_dir(&directory).map_err(|e| e.to_string())?
            }
            Err(e) => return Err(e.to_string()),
        }
    }
    directory.push(id);
    fs::create_dir(&directory).map_err(|e| e.to_string())?;
    Ok(directory)
}
fn cleanup(kernel: &Kernel) {
    // Never recursively remove a replaced link or any directory outside this
    // session's exact canonical private mailbox.
    let expected = kernel
        .root
        .join(".scriptor/tmp/runtime-console")
        .join(&kernel.id);
    if kernel.directory != expected {
        return;
    }
    let mut prefix = kernel.root.clone();
    for segment in [".scriptor", "tmp", "runtime-console", &kernel.id] {
        prefix.push(segment);
        if !fs::symlink_metadata(&prefix)
            .is_ok_and(|meta| meta.is_dir() && !meta.file_type().is_symlink())
        {
            return;
        }
    }
    if fs::canonicalize(&kernel.directory).is_ok_and(|path| path.starts_with(&kernel.root)) {
        let _ = fs::remove_dir_all(&kernel.directory);
    }
}
fn metadata(kernel: &Kernel) -> Result<KernelSession, String> {
    let (python_version, executable) = lock(&kernel.version)?.clone();
    Ok(KernelSession {
        id: kernel.id.clone(),
        vault_id: kernel.vault_id.clone(),
        language: "python",
        python_version,
        executable,
        remaining_seconds: LIFETIME.saturating_sub(kernel.started.elapsed().as_secs()),
    })
}
fn owned(vault_id: &str, id: &str) -> Result<Arc<Kernel>, String> {
    let uuid = uuid::Uuid::parse_str(id).map_err(|_| "Invalid runtime session identity")?;
    if uuid.get_version_num() != 4 || uuid.to_string() != id {
        return Err("Invalid runtime session identity".into());
    }
    let kernel = lock(sessions())?
        .get(id)
        .cloned()
        .ok_or("Runtime session has stopped; start a new kernel")?;
    if kernel.vault_id != vault_id {
        return Err("Runtime session belongs to another vault".into());
    }
    Ok(kernel)
}
fn stop(kernel: &Kernel) -> Result<(), String> {
    kernel.cancel.store(true, Ordering::Release);
    let deadline = Instant::now() + Duration::from_secs(5);
    while kernel.alive.load(Ordering::Acquire) {
        if Instant::now() >= deadline {
            return Err("Kernel shutdown is still pending; vault switching was cancelled".into());
        }
        std::thread::sleep(Duration::from_millis(25));
    }
    cleanup(kernel);
    Ok(())
}
fn launch(
    root: PathBuf,
    vault_id: String,
    environment: BTreeMap<String, String>,
    network: NetworkPolicy,
) -> Result<PendingKernel, String> {
    let id = uuid::Uuid::new_v4().to_string();
    let directory = confined_directory(&root, &id)?;
    let script = directory.join("kernel.py");
    fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&script)
        .and_then(|mut file| file.write_all(SCRIPT.as_bytes()))
        .map_err(|e| e.to_string())?;
    let kernel = Arc::new(Kernel {
        id,
        vault_id,
        root: root.clone(),
        directory: directory.clone(),
        started: Instant::now(),
        cancel: Arc::new(AtomicBool::new(false)),
        alive: AtomicBool::new(true),
        busy: AtomicBool::new(false),
        run_id: Mutex::new(None),
        failure: Mutex::new(None),
        version: Mutex::new((String::new(), String::new())),
    });
    let mut spec = ProcessSpec::new("python")
        .args([script.as_os_str(), directory.as_os_str()])
        .current_dir(root)
        .timeout(Duration::from_secs(LIFETIME))
        .max_output_bytes(256 * 1024)
        .network_policy(network)
        .allow_unsandboxed_network_denial(super::environment_opt_in(
            super::UNSANDBOXED_CODE_EXECUTION_OPT_IN,
        ))
        .cancel_slot(kernel.cancel.clone())
        .env("MPLBACKEND", "Agg");
    for (name, value) in environment {
        spec = spec.env(name, value);
    }
    let worker = kernel.clone();
    std::thread::spawn(move || {
        let outcome = run_process(spec);
        if let Err(error) = outcome
            && let Ok(mut failure) = worker.failure.lock()
        {
            *failure = Some(error.to_string());
        }
        cleanup(&worker);
        worker.alive.store(false, Ordering::Release);
    });
    let pending = PendingKernel(Some(kernel.clone()));
    let deadline = Instant::now() + Duration::from_secs(5);
    loop {
        if !kernel.alive.load(Ordering::Acquire) {
            return Err(lock(&kernel.failure)?
                .clone()
                .unwrap_or("Python kernel stopped during startup".into()));
        }
        if let Ok(bytes) = bounded(&directory.join("ready.json"), 16384) {
            #[derive(Deserialize)]
            struct Ready {
                python_version: String,
                executable: String,
            }
            let ready: Ready =
                serde_json::from_slice(&bytes).map_err(|_| "Invalid kernel startup response")?;
            if ready.python_version.len() > 64 || ready.executable.len() > 4096 {
                kernel.cancel.store(true, Ordering::Release);
                return Err("Invalid kernel environment identity".into());
            }
            *lock(&kernel.version)? = (ready.python_version, ready.executable);
            return Ok(pending);
        }
        if Instant::now() >= deadline {
            let _ = stop(&kernel);
            return Err("Python kernel startup timed out".into());
        }
        std::thread::sleep(Duration::from_millis(25));
    }
}
fn execute(kernel: &Kernel, code: &str) -> Result<KernelResult, String> {
    if code.trim().is_empty() || code.len() > 64000 || code.contains('\0') {
        return Err("Runtime cell must contain 1-64,000 UTF-8 bytes".into());
    }
    if !kernel.alive.load(Ordering::Acquire) {
        return Err("Kernel has stopped; restart it".into());
    }
    if kernel
        .busy
        .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
        .is_err()
    {
        return Err("Kernel is already running a cell".into());
    }
    struct Busy<'a>(&'a Kernel);
    impl Drop for Busy<'_> {
        fn drop(&mut self) {
            self.0.busy.store(false, Ordering::Release);
            if let Ok(mut id) = self.0.run_id.lock() {
                *id = None;
            }
        }
    }
    let _busy = Busy(kernel);
    let run_id = uuid::Uuid::new_v4().to_string();
    struct CellFiles {
        directory: PathBuf,
        id: String,
    }
    impl Drop for CellFiles {
        fn drop(&mut self) {
            let _ = fs::remove_file(self.directory.join(format!("{}.json", self.id)));
            for index in 0..3 {
                let _ = fs::remove_file(self.directory.join(format!("{}-{index}.png", self.id)));
            }
            let _ = fs::remove_file(self.directory.join("request.pending"));
        }
    }
    let _files = CellFiles {
        directory: kernel.directory.clone(),
        id: run_id.clone(),
    };
    *lock(&kernel.run_id)? = Some(run_id.clone());
    let request = serde_json::json!({ "id": run_id, "code": code });
    let temporary = kernel.directory.join("request.pending");
    fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&temporary)
        .and_then(|mut file| file.write_all(request.to_string().as_bytes()))
        .map_err(|e| e.to_string())?;
    fs::rename(&temporary, kernel.directory.join("request.json")).map_err(|e| e.to_string())?;
    let deadline = Instant::now() + CELL_TIMEOUT;
    let response_path = kernel.directory.join(format!("{run_id}.json"));
    loop {
        if kernel.cancel.load(Ordering::Acquire) || !kernel.alive.load(Ordering::Acquire) {
            return Err(
                "Kernel execution cancelled or session expired; restart to run more cells".into(),
            );
        }
        if response_path.exists() {
            break;
        }
        if Instant::now() >= deadline {
            stop(kernel).map_err(|error| {
                format!("Cell exceeded 30 seconds; kernel shutdown is pending: {error}")
            })?;
            return Err(
                "Cell exceeded 30 seconds; the kernel and its process tree were stopped".into(),
            );
        }
        std::thread::sleep(Duration::from_millis(25));
    }
    let response: Response = serde_json::from_slice(&bounded(&response_path, JSON_LIMIT)?)
        .map_err(|_| "Invalid kernel response")?;
    if response.stdout.len() + response.stderr.len() > 262144
        || response.variables.len() > 64
        || response.plots.len() > 3
        || response.variables.iter().any(|v| {
            v.name.chars().count() > 128
                || v.r#type.chars().count() > 128
                || v.value.chars().count() > 512
        })
    {
        return Err("Kernel result exceeds its bounds".into());
    }
    let mut plots = Vec::new();
    for (index, name) in response.plots.iter().enumerate() {
        if *name != format!("{run_id}-{index}.png") {
            return Err("Invalid kernel plot ownership".into());
        }
        let bytes = bounded(&kernel.directory.join(name), PNG_LIMIT)?;
        if bytes.len() < 24 || !bytes.starts_with(b"\x89PNG\r\n\x1a\n") || &bytes[12..16] != b"IHDR"
        {
            return Err("Runtime plots must be PNG images".into());
        }
        let width = u32::from_be_bytes(bytes[16..20].try_into().unwrap());
        let height = u32::from_be_bytes(bytes[20..24].try_into().unwrap());
        if width == 0 || height == 0 || u64::from(width) * u64::from(height) > 16_000_000 {
            return Err("Runtime plot dimensions exceed their bounds".into());
        }
        plots.push(Plot {
            mime_type: "image/png",
            data_base64: STANDARD.encode(&bytes),
            caption: format!("Plot {}", index + 1),
        });
        let _ = fs::remove_file(kernel.directory.join(name));
    }
    let _ = fs::remove_file(response_path);
    Ok(KernelResult {
        session_id: kernel.id.clone(),
        language: "python",
        exit_code: response.exit_code,
        stdout: response.stdout,
        stderr: response.stderr,
        duration_ms: response.duration_ms,
        variables: response.variables,
        plots,
    })
}
#[tauri::command]
pub async fn runtime_kernel_start(
    state: tauri::State<'_, AppState>,
    expected_vault_id: String,
    environment: BTreeMap<String, String>,
    authorization_token: String,
) -> Result<KernelSession, String> {
    validate_environment(&environment)?;
    let root = {
        let session = active_session(&state)?;
        super::super::vault::validate_expected_vault(
            &session.descriptor.id,
            Some(&expected_vault_id),
        )?;
        session.root.root().to_path_buf()
    };
    require_sensitive_operation(
        &state,
        &authorization_token,
        SensitiveOperation::CodeExecution,
        Some(&start_scope(&environment)?),
        Some(&expected_vault_id),
    )?;
    if !super::environment_opt_in(super::CODE_EXECUTION_OPT_IN) {
        return Err("Code execution is disabled; enable it only for a trusted workspace".into());
    }
    let reservation = reserve_start()?;
    let owner = expected_vault_id.clone();
    let (kernel, _reservation) = tauri::async_runtime::spawn_blocking(move || {
        launch(root, owner, environment, NetworkPolicy::Deny).map(|kernel| (kernel, reservation))
    })
    .await
    .map_err(|e| e.to_string())??;
    register_kernel(kernel, || Ok(active_session(&state)?.descriptor.id.clone()))
}
#[tauri::command]
pub async fn runtime_kernel_run(
    state: tauri::State<'_, AppState>,
    expected_vault_id: String,
    session_id: String,
    code: String,
    authorization_token: String,
) -> Result<KernelResult, String> {
    {
        let session = active_session(&state)?;
        super::super::vault::validate_expected_vault(
            &session.descriptor.id,
            Some(&expected_vault_id),
        )?;
    }
    let kernel = owned(&expected_vault_id, &session_id)?;
    require_sensitive_operation(
        &state,
        &authorization_token,
        SensitiveOperation::CodeExecution,
        Some(&run_scope(&session_id, &code)),
        Some(&expected_vault_id),
    )?;
    if !super::environment_opt_in(super::CODE_EXECUTION_OPT_IN) {
        return Err("Code execution was disabled".into());
    }
    let result = tauri::async_runtime::spawn_blocking(move || execute(&kernel, &code))
        .await
        .map_err(|e| e.to_string())??;
    let session = active_session(&state)?;
    super::super::vault::validate_expected_vault(&session.descriptor.id, Some(&expected_vault_id))?;
    Ok(result)
}
#[tauri::command]
pub fn runtime_kernel_status(
    state: tauri::State<AppState>,
    expected_vault_id: String,
    session_id: String,
) -> Result<KernelStatus, String> {
    let session = active_session(&state)?;
    super::super::vault::validate_expected_vault(&session.descriptor.id, Some(&expected_vault_id))?;
    let kernel = owned(&expected_vault_id, &session_id)?;
    #[derive(Deserialize)]
    struct Progress {
        run_id: String,
        stdout: String,
        stderr: String,
    }
    let progress = bounded(&kernel.directory.join("progress.json"), JSON_LIMIT)
        .ok()
        .and_then(|bytes| serde_json::from_slice::<Progress>(&bytes).ok())
        .filter(|value| {
            Some(&value.run_id) == lock(&kernel.run_id).ok().and_then(|id| id.clone()).as_ref()
                && value.stdout.len() + value.stderr.len() <= 262144
        });
    Ok(KernelStatus {
        session: metadata(&kernel)?,
        status: if !kernel.alive.load(Ordering::Acquire) {
            "stopped"
        } else if kernel.busy.load(Ordering::Acquire) {
            "running"
        } else {
            "idle"
        },
        stdout: progress
            .as_ref()
            .map_or_else(String::new, |value| value.stdout.clone()),
        stderr: progress.map_or_else(String::new, |value| value.stderr),
    })
}
#[tauri::command]
pub async fn runtime_kernel_stop(
    state: tauri::State<'_, AppState>,
    expected_vault_id: String,
    session_id: String,
) -> Result<(), String> {
    {
        let session = active_session(&state)?;
        super::super::vault::validate_expected_vault(
            &session.descriptor.id,
            Some(&expected_vault_id),
        )?;
    }
    let kernel = owned(&expected_vault_id, &session_id)?;
    tauri::async_runtime::spawn_blocking(move || stop(&kernel))
        .await
        .map_err(|e| e.to_string())??;
    lock(sessions())?.remove(&session_id);
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn consent_is_bound_to_environment_code_and_session() {
        let one = BTreeMap::from([("PROJECT".into(), "one".into())]);
        let two = BTreeMap::from([("PROJECT".into(), "two".into())]);
        assert_ne!(start_scope(&one).unwrap(), start_scope(&two).unwrap());
        assert_ne!(run_scope("a", "x=1"), run_scope("a", "x=2"));
        assert_ne!(run_scope("a", "x=1"), run_scope("b", "x=1"));
        assert!(
            validate_environment(&BTreeMap::from([("PYTHONPATH".into(), "x".into())])).is_err()
        );
    }
    #[test]
    fn python_kernel_preserves_namespace_and_stops_with_cleanup() {
        let dir = tempfile::tempdir().unwrap();
        let root = fs::canonicalize(dir.path()).unwrap();
        let pending = launch(
            root,
            "test-vault".into(),
            BTreeMap::new(),
            NetworkPolicy::Allow,
        )
        .unwrap();
        let kernel = pending.0.as_ref().unwrap().clone();
        let first = execute(&kernel, "x = 40\nprint(x)").unwrap();
        assert_eq!(first.stdout.trim(), "40");
        let second = execute(&kernel, "x += 2\nprint(x)").unwrap();
        assert_eq!(second.stdout.trim(), "42");
        assert!(
            second
                .variables
                .iter()
                .any(|v| v.name == "x" && v.value == "42")
        );
        let failed = execute(&kernel, "raise ValueError('reviewed failure')").unwrap();
        assert_eq!(failed.exit_code, 1);
        assert!(failed.stderr.contains("reviewed failure"));
        let output = execute(&kernel, "print('x' * 300000)").unwrap();
        assert!(output.stdout.ends_with("[Output truncated]"));
        assert!(output.stdout.len() <= 262144);
        let plot = execute(&kernel, "import base64\nscriptor_display_png(base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1EAAAAASUVORK5CYII='))").unwrap();
        assert_eq!(plot.plots.len(), 1);
        assert!(plot.plots[0].data_base64.starts_with("iVBORw0KGgo"));
        stop(&kernel).unwrap();
        assert!(!kernel.directory.exists());
        assert!(execute(&kernel, "print(x)").is_err());
    }
    #[test]
    fn stopping_a_running_cell_terminates_its_kernel_and_cleans_private_artifacts() {
        let dir = tempfile::tempdir().unwrap();
        let pending = launch(
            fs::canonicalize(dir.path()).unwrap(),
            "cancel-vault".into(),
            BTreeMap::new(),
            NetworkPolicy::Allow,
        )
        .unwrap();
        let kernel = pending.0.as_ref().unwrap().clone();
        let running = kernel.clone();
        let cell = std::thread::spawn(move || {
            execute(&running, "import time\nwhile True:\n time.sleep(0.1)")
        });
        let deadline = Instant::now() + Duration::from_secs(2);
        while !kernel.busy.load(Ordering::Acquire) {
            assert!(Instant::now() < deadline);
            std::thread::sleep(Duration::from_millis(10));
        }
        stop(&kernel).unwrap();
        assert!(cell.join().unwrap().is_err());
        assert!(!kernel.alive.load(Ordering::Acquire));
        assert!(!kernel.directory.exists());
    }
    #[test]
    fn pending_start_cannot_register_after_a_vault_transition() {
        let dir = tempfile::tempdir().unwrap();
        let pending = launch(
            fs::canonicalize(dir.path()).unwrap(),
            "old-vault".into(),
            BTreeMap::new(),
            NetworkPolicy::Allow,
        )
        .unwrap();
        let kernel = pending.0.as_ref().unwrap().clone();
        let transition = vault_transition_guard().unwrap();
        let (sender, receiver) = std::sync::mpsc::channel();
        let registration = std::thread::spawn(move || {
            sender.send(()).unwrap();
            register_kernel(pending, || Ok("new-vault".into()))
        });
        receiver.recv().unwrap();
        stop_vault_sessions("old-vault").unwrap();
        drop(transition);
        assert!(registration.join().unwrap().is_err());
        assert!(!kernel.alive.load(Ordering::Acquire));
        assert!(!kernel.directory.exists());
        assert!(!lock(sessions()).unwrap().contains_key(&kernel.id));
    }
    #[test]
    fn abandoned_start_result_cancels_unregistered_process_and_cleans_mailbox() {
        let dir = tempfile::tempdir().unwrap();
        let root = fs::canonicalize(dir.path()).unwrap();
        // The blocking task owns capacity and cancellation until its result is
        // adopted. Dropping an abandoned result models a cancelled Tauri caller.
        let task = std::thread::spawn(move || {
            let reservation = reserve_start().unwrap();
            let pending = launch(
                root,
                "abandoned-vault".into(),
                BTreeMap::new(),
                NetworkPolicy::Allow,
            )
            .unwrap();
            (pending, reservation)
        });
        let result = task.join().unwrap();
        let kernel = result.0.0.as_ref().unwrap().clone();
        assert!(kernel.alive.load(Ordering::Acquire));
        drop(result);
        let deadline = Instant::now() + Duration::from_secs(5);
        while kernel.alive.load(Ordering::Acquire) {
            assert!(Instant::now() < deadline);
            std::thread::sleep(Duration::from_millis(25));
        }
        assert!(!kernel.directory.exists());
        assert!(!lock(sessions()).unwrap().contains_key(&kernel.id));
    }
}
