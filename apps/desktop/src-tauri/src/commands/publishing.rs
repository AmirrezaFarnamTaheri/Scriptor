//! Reviewed publication jobs use the shared process broker and owner-bound cancellation.
use crate::authorization::{SensitiveOperation, require_sensitive_operation};
use crate::commands::vault::validate_expected_vault;
use crate::state::{AppState, active_session};
use scriptor_system_bridge::{ProcessSpec, run_process};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::{
    Arc, Mutex, OnceLock,
    atomic::{AtomicBool, Ordering},
};
use std::time::Duration;
use tauri::Manager;

#[derive(Clone)]
struct OwnedJob {
    vault_id: String,
    cancel: Arc<AtomicBool>,
}
static JOBS: OnceLock<Mutex<HashMap<String, OwnedJob>>> = OnceLock::new();
fn jobs() -> &'static Mutex<HashMap<String, OwnedJob>> {
    JOBS.get_or_init(Mutex::default)
}
struct JobLease(String);
impl Drop for JobLease {
    fn drop(&mut self) {
        if let Ok(mut jobs) = jobs().lock() {
            jobs.remove(&self.0);
        }
    }
}

#[derive(Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
pub enum PublicationJob {
    Build,
    Cloudflare {
        account_id: String,
        project: String,
        api_token: String,
    },
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicationResult {
    exit_code: i32,
    stdout: String,
    stderr: String,
    truncated: bool,
    timed_out: bool,
}

fn validate_target(account: &str, project: &str, token: &str) -> Result<(), String> {
    if account.len() != 32 || !account.bytes().all(|ch| ch.is_ascii_hexdigit()) {
        return Err("Invalid Cloudflare account ID".into());
    }
    if project.is_empty()
        || project.len() > 63
        || !project
            .bytes()
            .all(|ch| ch.is_ascii_lowercase() || ch.is_ascii_digit() || ch == b'-')
        || project.starts_with('-')
        || project.ends_with('-')
    {
        return Err("Invalid Pages project name".into());
    }
    if !(20..=512).contains(&token.len())
        || !token
            .bytes()
            .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, b'_' | b'-'))
    {
        return Err("Enter a valid Cloudflare API token".into());
    }
    Ok(())
}
fn domain_name(domain: &str) -> Result<(), String> {
    if domain.len() > 253
        || domain.split('.').count() < 2
        || domain.parse::<std::net::IpAddr>().is_ok()
        || domain.split('.').any(|label| {
            label.is_empty()
                || label.len() > 63
                || label.starts_with('-')
                || label.ends_with('-')
                || !label
                    .bytes()
                    .all(|ch| ch.is_ascii_lowercase() || ch.is_ascii_digit() || ch == b'-')
        })
    {
        return Err("Invalid custom domain".into());
    }
    Ok(())
}
fn bounded_file(path: &Path, limit: u64) -> Result<Vec<u8>, String> {
    let file = std::fs::File::open(path).map_err(|_| "Publication file could not be opened")?;
    if !file
        .metadata()
        .map_err(|_| "Publication metadata is unavailable")?
        .is_file()
    {
        return Err("Publication input must be a regular file".into());
    }
    let mut bytes = Vec::new();
    file.take(limit + 1)
        .read_to_end(&mut bytes)
        .map_err(|_| "Publication file could not be read")?;
    if bytes.len() as u64 > limit {
        return Err("Publication file exceeds its bound".into());
    }
    Ok(bytes)
}
fn site_root(output: &str) -> Result<PathBuf, String> {
    if output.len() > 4096
        || output.chars().any(char::is_control)
        || !Path::new(output).is_absolute()
    {
        return Err("Choose an absolute local site folder".into());
    }
    let root = std::fs::canonicalize(output)
        .map_err(|_| "Write the reviewed local site before building it")?;
    let package: serde_json::Value =
        serde_json::from_slice(&bounded_file(&root.join("package.json"), 65536)?)
            .map_err(|_| "Invalid local site package")?;
    if package.get("name").and_then(|value| value.as_str()) != Some("scriptor-publish") {
        return Err("Selected folder is not a Scriptor publication project".into());
    }
    let _: serde_json::Value = serde_json::from_slice(&bounded_file(
        &root.join(scriptor_publish_runner::PUBLISH_STATE_FILE),
        4 * 1024 * 1024,
    )?)
    .map_err(|_| "Invalid managed publication state")?;
    Ok(root)
}

#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct BuildStamp {
    vault_id: String,
    source_hash: String,
    output_hash: String,
}
const BUILD_STAMP: &str = ".scriptor-publishing-build.json";
fn fingerprint(root: &Path, sources: bool) -> Result<String, String> {
    let mut pending = if sources {
        vec![
            root.join("src"),
            root.join("public"),
            root.join("package.json"),
            root.join("pnpm-lock.yaml"),
            root.join("astro.config.mjs"),
            root.join(scriptor_publish_runner::PUBLISH_STATE_FILE),
        ]
    } else {
        vec![root.join("dist")]
    };
    let mut entries = Vec::new();
    let mut seen = 0usize;
    let mut bytes = 0u64;
    while let Some(path) = pending.pop() {
        let metadata = match std::fs::symlink_metadata(&path) {
            Ok(value) => value,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound && sources => continue,
            Err(_) => return Err("Publication snapshot input is unavailable".into()),
        };
        seen += 1;
        if seen > 10000 || metadata.file_type().is_symlink() {
            return Err("Publication snapshot exceeds its bound or contains a symlink".into());
        }
        let canonical = std::fs::canonicalize(&path)
            .map_err(|_| "Cannot resolve publication snapshot input")?;
        if !canonical.starts_with(root) {
            return Err("Publication snapshot escapes the site folder".into());
        }
        if metadata.is_dir() {
            for item in
                std::fs::read_dir(path).map_err(|_| "Cannot enumerate publication snapshot")?
            {
                if pending.len() + seen >= 10000 {
                    return Err("Publication snapshot exceeds its entry bound".into());
                }
                pending.push(
                    item.map_err(|_| "Cannot read publication snapshot entry")?
                        .path(),
                );
            }
        } else if metadata.is_file() {
            let content = bounded_file(&path, 16 * 1024 * 1024)?;
            bytes += content.len() as u64;
            if bytes > 256 * 1024 * 1024 {
                return Err("Publication snapshot exceeds 256 MiB".into());
            }
            let name = path
                .strip_prefix(root)
                .map_err(|_| "Invalid publication snapshot path")?
                .to_str()
                .ok_or("Invalid publication filename")?
                .replace('\\', "/");
            entries.push((name, scriptor_vault::content_hash_bytes(&content)));
        } else {
            return Err("Publication snapshot requires regular files".into());
        }
    }
    entries.sort();
    Ok(scriptor_vault::content_hash_bytes(
        &serde_json::to_vec(&entries).map_err(|_| "Cannot encode publication snapshot")?,
    ))
}
fn ensure_reviewed_site(vault_root: &Path, root: &Path) -> Result<(), String> {
    let plan = scriptor_publish_runner::plan_starlight_site(vault_root, root)
        .map_err(|error| error.to_string())?;
    if !plan.changed.is_empty() || !plan.orphaned.is_empty() {
        return Err("Published sources or privacy eligibility changed. Apply the reviewed updates and removals, then rebuild before deployment.".into());
    }
    Ok(())
}
fn verified_build(root: &Path, vault_id: &str) -> Result<BuildStamp, String> {
    let stamp: BuildStamp = serde_json::from_slice(&bounded_file(&root.join(BUILD_STAMP), 4096)?)
        .map_err(|_| "Invalid publication build receipt")?;
    if stamp.vault_id != vault_id
        || stamp.source_hash != fingerprint(root, true)?
        || stamp.output_hash != fingerprint(root, false)?
    {
        return Err("Build receipt is stale or belongs to another vault. Rebuild the reviewed site before deployment.".into());
    }
    Ok(stamp)
}

// Deploy from an owned copy whose digest matches the reviewed receipt. Holding
// this directory alive keeps later edits to the working site's dist out of the upload.
struct DeploymentSnapshot {
    root: PathBuf,
}
impl Drop for DeploymentSnapshot {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.root);
    }
}
fn deployment_snapshot(root: &Path, expected_hash: &str) -> Result<DeploymentSnapshot, String> {
    let destination =
        std::env::temp_dir().join(format!("scriptor-publish-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir(&destination).map_err(|_| "Cannot create deployment snapshot")?;
    let mut snapshot = DeploymentSnapshot { root: destination };
    snapshot.root =
        std::fs::canonicalize(&snapshot.root).map_err(|_| "Cannot resolve deployment snapshot")?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&snapshot.root, std::fs::Permissions::from_mode(0o700))
            .map_err(|_| "Cannot protect deployment snapshot")?;
    }
    let mut pending = vec![root.join("dist")];
    let mut seen = 0usize;
    let mut bytes = 0u64;
    while let Some(path) = pending.pop() {
        seen += 1;
        let metadata =
            std::fs::symlink_metadata(&path).map_err(|_| "Cannot inspect deployment input")?;
        if seen > 10000 || metadata.file_type().is_symlink() {
            return Err("Deployment input exceeds its bound or contains a symlink".into());
        }
        let canonical =
            std::fs::canonicalize(&path).map_err(|_| "Cannot resolve deployment input")?;
        if !canonical.starts_with(root) {
            return Err("Deployment input escapes the site".into());
        }
        let target = snapshot.root.join(
            path.strip_prefix(root)
                .map_err(|_| "Invalid deployment path")?,
        );
        if metadata.is_dir() {
            std::fs::create_dir_all(&target).map_err(|_| "Cannot create deployment folder")?;
            for item in std::fs::read_dir(&path).map_err(|_| "Cannot enumerate deployment input")? {
                if seen + pending.len() >= 10000 {
                    return Err("Deployment input exceeds its entry bound".into());
                }
                pending.push(item.map_err(|_| "Cannot inspect deployment entry")?.path());
            }
        } else if metadata.is_file() {
            let content = bounded_file(&path, 16 * 1024 * 1024)?;
            bytes += content.len() as u64;
            if bytes > 256 * 1024 * 1024 {
                return Err("Deployment input exceeds 256 MiB".into());
            }
            if let Some(parent) = target.parent() {
                std::fs::create_dir_all(parent).map_err(|_| "Cannot create deployment folder")?;
            }
            std::fs::write(&target, content).map_err(|_| "Cannot write deployment snapshot")?;
        } else {
            return Err("Deployment input requires regular files".into());
        }
    }
    if fingerprint(&snapshot.root, false)? != expected_hash {
        return Err(
            "Built site changed while staging deployment; rebuild before deployment".into(),
        );
    }
    Ok(snapshot)
}
fn job_spec(
    root: PathBuf,
    request: &PublicationJob,
    cancel: Arc<AtomicBool>,
) -> Result<ProcessSpec, String> {
    let mut spec = match request {
        PublicationJob::Build => {
            let mut spec = ProcessSpec::new(if cfg!(windows) { "pnpm.cmd" } else { "pnpm" });
            spec.args = vec!["run".into(), "build".into()];
            spec
        }
        PublicationJob::Cloudflare {
            account_id,
            project,
            api_token,
        } => {
            validate_target(account_id, project, api_token)?;
            let dist = std::fs::canonicalize(root.join("dist"))
                .map_err(|_| "Build the site before deploying it")?;
            if !dist.starts_with(&root) || !dist.join("index.html").is_file() {
                return Err("Site output is missing or escapes the project".into());
            }
            let mut spec = ProcessSpec::new(if cfg!(windows) {
                "wrangler.cmd"
            } else {
                "wrangler"
            });
            spec.args = vec![
                "pages".into(),
                "deploy".into(),
                "dist".into(),
                "--project-name".into(),
                project.into(),
            ];
            spec.environment = vec![
                ("CLOUDFLARE_API_TOKEN".into(), api_token.into()),
                ("CLOUDFLARE_ACCOUNT_ID".into(), account_id.into()),
                ("CI".into(), "true".into()),
            ];
            spec
        }
    };
    spec.current_dir = Some(root);
    spec.timeout = Duration::from_secs(300);
    spec.max_output_bytes = 256 * 1024;
    spec.cancel_slot = Some(cancel);
    Ok(spec)
}
fn publication_process_error(
    error: scriptor_system_bridge::BridgeError,
    request: &PublicationJob,
) -> String {
    let message = error.to_string();
    if let PublicationJob::Cloudflare { api_token, .. } = request {
        message.replace(api_token, "[redacted]")
    } else {
        message
    }
}
#[tauri::command]
pub async fn publishing_build_site(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    output_path: String,
    job_id: String,
    expected_vault_id: String,
    authorization_token: String,
) -> Result<PublicationResult, String> {
    {
        let session = active_session(&state)?;
        validate_expected_vault(&session.descriptor.id, Some(&expected_vault_id))?;
        let scope = format!("site-build:{output_path}:{job_id}");
        require_sensitive_operation(
            &state,
            &authorization_token,
            SensitiveOperation::PublishBuild,
            Some(&scope),
            Some(&session.descriptor.id),
        )?;
    }
    run_publication(
        app,
        output_path,
        job_id,
        PublicationJob::Build,
        expected_vault_id,
    )
    .await
}
#[tauri::command]
#[allow(clippy::too_many_arguments)] // Existing typed bridge supplies the scoped deployment fields.
pub async fn publishing_deploy_site(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    output_path: String,
    job_id: String,
    account_id: String,
    project: String,
    api_token: String,
    expected_vault_id: String,
    authorization_token: String,
) -> Result<PublicationResult, String> {
    validate_target(&account_id, &project, &api_token)?;
    {
        let session = active_session(&state)?;
        validate_expected_vault(&session.descriptor.id, Some(&expected_vault_id))?;
        let scope = format!("pages-deploy:{output_path}:{account_id}:{project}:{job_id}");
        require_sensitive_operation(
            &state,
            &authorization_token,
            SensitiveOperation::PublishDeploy,
            Some(&scope),
            Some(&session.descriptor.id),
        )?;
    }
    run_publication(
        app,
        output_path,
        job_id,
        PublicationJob::Cloudflare {
            account_id,
            project,
            api_token,
        },
        expected_vault_id,
    )
    .await
}
async fn run_publication(
    app: tauri::AppHandle,
    output_path: String,
    job_id: String,
    request: PublicationJob,
    expected_vault_id: String,
) -> Result<PublicationResult, String> {
    if uuid::Uuid::parse_str(&job_id).is_err() {
        return Err("Invalid publication job identity".into());
    }
    let cancel = Arc::new(AtomicBool::new(false));
    {
        let mut jobs = jobs()
            .lock()
            .map_err(|_| "Publication job state unavailable")?;
        if jobs.len() >= 4 || jobs.contains_key(&job_id) {
            return Err("Publication job capacity reached or identity is already active".into());
        }
        jobs.insert(
            job_id.clone(),
            OwnedJob {
                vault_id: expected_vault_id.clone(),
                cancel: cancel.clone(),
            },
        );
    }
    let lease = JobLease(job_id);
    tauri::async_runtime::spawn_blocking(move || {
        let _lease = lease;
        let state = app.state::<AppState>();
        let session = active_session(&state)?;
        validate_expected_vault(&session.descriptor.id, Some(&expected_vault_id))?;
        let root = site_root(&output_path)?;
        ensure_reviewed_site(session.root.root(), &root)?;
        let source_hash = fingerprint(&root, true)?;
        let snapshot = if matches!(request, PublicationJob::Cloudflare { .. }) {
            let stamp = verified_build(&root, &expected_vault_id)?;
            let snapshot = deployment_snapshot(&root, &stamp.output_hash)?;
            ensure_reviewed_site(session.root.root(), &root)?;
            Some(snapshot)
        } else {
            None
        };
        let process_root = snapshot
            .as_ref()
            .map_or_else(|| root.clone(), |snapshot| snapshot.root.clone());
        let spec = job_spec(process_root, &request, cancel)?;
        let result = run_process(spec).map_err(|error| publication_process_error(error, &request))?;
        if matches!(request, PublicationJob::Build) && result.exit_code == 0 && !result.timed_out {
            if source_hash != fingerprint(&root, true)? {
                return Err(
                    "Site sources changed during the build; rebuild before deployment".into(),
                );
            }
            ensure_reviewed_site(session.root.root(), &root)?;
            let stamp = BuildStamp {
                vault_id: expected_vault_id,
                source_hash,
                output_hash: fingerprint(&root, false)?,
            };
            scriptor_vault::atomic_write(
                &root.join(BUILD_STAMP),
                &serde_json::to_vec(&stamp).map_err(|_| "Cannot encode build receipt")?,
            )
            .map_err(|error| error.to_string())?;
        }
        let redact = |value: String| {
            if let PublicationJob::Cloudflare { api_token, .. } = &request {
                value.replace(api_token, "[redacted]")
            } else {
                value
            }
        };
        Ok(PublicationResult {
            exit_code: result.exit_code,
            stdout: redact(result.stdout),
            stderr: redact(result.stderr),
            truncated: result.stdout_truncated || result.stderr_truncated,
            timed_out: result.timed_out,
        })
    })
    .await
    .map_err(|_| "Publication worker failed".to_string())?
}
#[tauri::command]
pub fn publishing_cancel_job(job_id: String, expected_vault_id: String) -> Result<bool, String> {
    let jobs = jobs()
        .lock()
        .map_err(|_| "Publication job state unavailable")?;
    let Some(job) = jobs.get(&job_id) else {
        return Ok(false);
    };
    if job.vault_id != expected_vault_id {
        return Err("Publication cancellation belongs to another vault".into());
    }
    job.cancel.store(true, Ordering::SeqCst);
    Ok(true)
}
#[derive(Serialize)]
pub struct DomainResult {
    domain: String,
    status: String,
    cname_target: String,
}
#[tauri::command]
pub async fn publishing_configure_domain(
    state: tauri::State<'_, AppState>,
    account_id: String,
    project: String,
    domain: String,
    api_token: String,
    expected_vault_id: String,
    authorization_token: String,
) -> Result<DomainResult, String> {
    validate_target(&account_id, &project, &api_token)?;
    domain_name(&domain)?;
    let scope = format!("pages-domain:{account_id}:{project}:{domain}");
    {
        let session = active_session(&state)?;
        validate_expected_vault(&session.descriptor.id, Some(&expected_vault_id))?;
        require_sensitive_operation(
            &state,
            &authorization_token,
            SensitiveOperation::PublishDeploy,
            Some(&scope),
            Some(&session.descriptor.id),
        )?;
    }
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(20))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|_| "Could not create domain client")?;
    let response=client.post(format!("https://api.cloudflare.com/client/v4/accounts/{account_id}/pages/projects/{project}/domains")).bearer_auth(&api_token).json(&serde_json::json!({"name":domain})).send().await.map_err(|_| "Domain configuration request failed")?;
    if !response.status().is_success() {
        return Err(format!(
            "Cloudflare rejected domain configuration ({})",
            response.status()
        ));
    }
    let mut response = response;
    let mut bytes = Vec::new();
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|_| "Domain response could not be read")?
    {
        if bytes.len() + chunk.len() > 128 * 1024 {
            return Err("Domain response exceeds its bound".into());
        }
        bytes.extend_from_slice(&chunk);
    }
    let value: serde_json::Value =
        serde_json::from_slice(&bytes).map_err(|_| "Invalid domain response")?;
    if value.get("success").and_then(|value| value.as_bool()) != Some(true) {
        return Err("Cloudflare did not confirm domain configuration".into());
    }
    let result = value.get("result").ok_or("Domain result is missing")?;
    if result.get("name").and_then(|value| value.as_str()) != Some(domain.as_str()) {
        return Err("Domain response identity mismatch".into());
    }
    let status = result
        .get("status")
        .and_then(|value| value.as_str())
        .filter(|value| value.len() < 64)
        .unwrap_or("pending")
        .to_string();
    Ok(DomainResult {
        domain,
        status,
        cname_target: format!("{project}.pages.dev"),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn deployment_timeout_diagnostics_do_not_expose_api_credentials() {
        let token = "private_test_token_123456789";
        let request = PublicationJob::Cloudflare {
            account_id: "a".repeat(32),
            project: "notes".into(),
            api_token: token.into(),
        };
        let error = scriptor_system_bridge::BridgeError::ProcessTimeout {
            program: PathBuf::from("wrangler"),
            timeout_ms: 300_000,
            stdout: String::new(),
            stderr: format!("request rejected using {token}"),
        };
        let message = publication_process_error(error, &request);
        assert!(!message.contains(token));
        assert!(message.contains("[redacted]"));
        assert!(message.contains("timed out"));
    }
    #[test]
    fn targets_reject_argument_and_path_injection() {
        assert!(validate_target(&"a".repeat(32), "notes", &"a".repeat(40)).is_ok());
        for project in ["--help", "../x", "name; command", ""] {
            assert!(validate_target(&"a".repeat(32), project, &"a".repeat(40)).is_err());
        }
        for domain in [
            "https://evil.test",
            "127.0.0.1",
            "*.example.test",
            "x.test/path",
        ] {
            assert!(domain_name(domain).is_err());
        }
        assert!(domain_name("notes.example.test").is_ok());
    }
    #[test]
    fn build_specs_are_fixed_bounded_and_cancellable() {
        let cancel = Arc::new(AtomicBool::new(false));
        let spec = job_spec(
            PathBuf::from("site"),
            &PublicationJob::Build,
            cancel.clone(),
        )
        .unwrap();
        assert_eq!(
            spec.args,
            vec![std::ffi::OsString::from("run"), "build".into()]
        );
        assert_eq!(spec.max_output_bytes, 256 * 1024);
        assert_eq!(spec.timeout, Duration::from_secs(300));
        assert!(Arc::ptr_eq(spec.cancel_slot.as_ref().unwrap(), &cancel));
    }

    #[test]
    fn deployment_uses_receipt_bound_snapshot_and_rejects_drift() {
        let dir = tempfile::tempdir().unwrap();
        let root = std::fs::canonicalize(dir.path()).unwrap();
        std::fs::create_dir(root.join("dist")).unwrap();
        std::fs::write(root.join("dist/index.html"), "reviewed").unwrap();
        let hash = fingerprint(&root, false).unwrap();
        let snapshot = deployment_snapshot(&root, &hash).unwrap();
        std::fs::write(root.join("dist/index.html"), "changed").unwrap();
        assert_eq!(
            std::fs::read_to_string(snapshot.root.join("dist/index.html")).unwrap(),
            "reviewed"
        );
        assert!(deployment_snapshot(&root, &hash).is_err());
        let owned = snapshot.root.clone();
        drop(snapshot);
        assert!(!owned.exists());
    }
}
