use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, ExitStatus, Stdio};
use std::sync::Arc;
use std::thread;
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::args::{ExportFormat, build_pandoc_args};
use crate::cancel::{DEFAULT_EXPORT_TIMEOUT, ExportCancelSlot, wait_for_child_with_timeout};
use crate::error::ExportError;
use crate::log::{log_entry_from_output, write_export_log};
use crate::pandoc::discover_pandoc_with_trusted_hash;
use crate::validate::validate_export_artifact;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ExportJobInput {
    pub format: String,
    pub source_markdown: String,
    pub output_directory: String,
    pub source_stem: String,
    pub title: Option<String>,
    pub dry_run: bool,
    #[serde(default)]
    pub extra_pandoc_args: Vec<String>,
    #[serde(default)]
    pub vault_root: String,
    #[serde(default)]
    pub job_id: Option<String>,
    #[serde(default)]
    pub preserve_temp_on_failure: bool,
    #[serde(default)]
    pub trusted_pandoc_hash: Option<String>,
    /// I-3 interlock: how to handle sealed spans in the source markdown.
    /// `false` (default) → refuse with an error.
    /// `true`  → replace sealed spans with `[redacted]` before export.
    #[serde(default)]
    pub redact_secrets: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ExportJobOutput {
    pub job_id: String,
    pub format: String,
    pub artifact_path: String,
    pub command: Vec<String>,
    pub stdout: String,
    pub stderr: String,
    pub duration_ms: u64,
    pub dry_run: bool,
}

pub type ExportProgressCallback = Arc<dyn Fn(&str) + Send + Sync>;

const MAX_CAPTURED_PROCESS_OUTPUT_BYTES: usize = 256 * 1024;
const PROCESS_OUTPUT_TRUNCATION_MARKER: &str = "\n...[output truncated by Scriptor]...\n";

fn append_bounded(target: &mut String, chunk: &str) {
    if target.ends_with(PROCESS_OUTPUT_TRUNCATION_MARKER) {
        return;
    }
    let remaining = MAX_CAPTURED_PROCESS_OUTPUT_BYTES.saturating_sub(target.len());
    if chunk.len() <= remaining {
        target.push_str(chunk);
        return;
    }
    if remaining > 0 {
        let mut end = remaining.min(chunk.len());
        while end > 0 && !chunk.is_char_boundary(end) {
            end -= 1;
        }
        target.push_str(&chunk[..end]);
    }
    target.push_str(PROCESS_OUTPUT_TRUNCATION_MARKER);
}

fn drain_pipe_bounded<R: Read>(mut reader: R, progress: Option<ExportProgressCallback>) -> String {
    let mut captured = String::new();
    let mut buffer = [0u8; 8192];
    loop {
        match reader.read(&mut buffer) {
            Ok(0) => break,
            Ok(read) => {
                let chunk = String::from_utf8_lossy(&buffer[..read]);
                if let Some(callback) = progress.as_ref() {
                    callback(&chunk);
                }
                append_bounded(&mut captured, &chunk);
            }
            Err(error) => {
                log::warn!("failed to drain export process output: {error}");
                break;
            }
        }
    }
    captured
}

fn wait_for_child_direct(mut child: Child, timeout: Duration) -> Result<ExitStatus, ExportError> {
    let started = Instant::now();
    loop {
        match child.try_wait() {
            Ok(Some(status)) => return Ok(status),
            Ok(None) if started.elapsed() < timeout => {
                thread::sleep(Duration::from_millis(50));
            }
            Ok(None) => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(ExportError::Process(format!(
                    "pandoc timed out after {} seconds",
                    timeout.as_secs()
                )));
            }
            Err(source) => {
                return Err(ExportError::Io {
                    path: PathBuf::from("pandoc"),
                    source,
                });
            }
        }
    }
}

fn normalized_lexical(path: &Path) -> PathBuf {
    let mut output = PathBuf::new();
    for component in path.components() {
        match component {
            std::path::Component::ParentDir => { output.pop(); }
            std::path::Component::CurDir => {}
            std::path::Component::Normal(part) => output.push(part),
            std::path::Component::RootDir => output.push(std::path::MAIN_SEPARATOR_STR),
            std::path::Component::Prefix(prefix) => output.push(prefix.as_os_str()),
        }
    }
    output
}

fn validate_output_dir_within_vault(vault_root: &Path, output_dir: &Path) -> Result<(), ExportError> {
    let canonical_root = vault_root.canonicalize().map_err(|source| ExportError::Io {
        path: vault_root.to_path_buf(),
        source,
    })?;
    let absolute = if output_dir.is_absolute() {
        output_dir.to_path_buf()
    } else {
        canonical_root.join(output_dir)
    };
    let normalized = normalized_lexical(&absolute);
    if !normalized.starts_with(&canonical_root) {
        return Err(ExportError::InvalidOutput(output_dir.to_path_buf()));
    }
    let relative = normalized.strip_prefix(&canonical_root).unwrap_or(Path::new(""));
    let mut prefix = canonical_root.clone();
    for component in relative.components() {
        let std::path::Component::Normal(part) = component else { continue };
        prefix.push(part);
        if !prefix.exists() { break; }
        let canonical = prefix.canonicalize().map_err(|source| ExportError::Io {
            path: prefix.clone(),
            source,
        })?;
        if !canonical.starts_with(&canonical_root) {
            return Err(ExportError::InvalidOutput(output_dir.to_path_buf()));
        }
    }
    Ok(())
}

pub fn run_export_job(input: ExportJobInput) -> Result<ExportJobOutput, ExportError> {
    run_export_job_with_cancel(input, None, None)
}

pub fn run_export_job_with_cancel(
    input: ExportJobInput,
    cancel_slot: Option<&ExportCancelSlot>,
    progress: Option<ExportProgressCallback>,
) -> Result<ExportJobOutput, ExportError> {
    let format = ExportFormat::parse(&input.format)?;
    let pandoc = match discover_pandoc_with_trusted_hash(input.trusted_pandoc_hash.as_deref()) {
        Ok(found) => found,
        Err(_) if input.dry_run => crate::pandoc::PandocDiscovery {
            path: "pandoc".into(),
            version: "not-installed".into(),
            sha256: None,
        },
        Err(error) => return Err(error),
    };

    let output_dir = PathBuf::from(&input.output_directory);
    let vault_root = if input.vault_root.is_empty() {
        output_dir.clone()
    } else {
        PathBuf::from(&input.vault_root)
    };
    validate_output_dir_within_vault(&vault_root, &output_dir)?;
    fs::create_dir_all(&output_dir).map_err(|source| ExportError::Io {
        path: output_dir.clone(),
        source,
    })?;

    let artifact_name = format!("{}.{}", input.source_stem, format.extension());
    let artifact_path = output_dir.join(&artifact_name);
    match artifact_path.strip_prefix(&output_dir) {
        Ok(relative)
            if !relative
                .components()
                .any(|component| matches!(component, std::path::Component::ParentDir)) => {}
        _ => return Err(ExportError::InvalidOutput(artifact_path)),
    }

    // Source markdown and generated diagrams are sensitive transient material. Keep
    // them outside the vault so failed/cancelled exports cannot become publish or
    // Git candidates. TempDir guarantees cleanup on every return path.
    let temp_guard = tempfile::Builder::new()
        .prefix("scriptor-export-")
        .tempdir()
        .map_err(|source| ExportError::Io {
            path: std::env::temp_dir(),
            source,
        })?;
    let temp_dir = temp_guard.path();
    let source_path = temp_dir.join(format!("{}.md", Uuid::new_v4()));

    let seal_mode = if input.redact_secrets {
        crate::sealed::RedactSecretsMode::Redact
    } else {
        crate::sealed::RedactSecretsMode::Refuse
    };
    let safe_markdown =
        crate::sealed::check_or_redact(&input.source_markdown, seal_mode, &input.source_stem)
            .map_err(|e| ExportError::SealedContent(e.to_string()))?;

    let processed_markdown = if input.dry_run {
        // A dry run must not render diagrams or mutate persistent storage.
        safe_markdown
    } else {
        crate::diagram_preprocess::preprocess_diagrams(&safe_markdown, temp_dir)?.0
    };
    fs::write(&source_path, &processed_markdown).map_err(|source| ExportError::Io {
        path: source_path.clone(),
        source,
    })?;

    let resolved_extra =
        crate::theme::resolve_extra_args(&vault_root, &output_dir, &input.extra_pandoc_args)?;
    let args = build_pandoc_args(
        format,
        &source_path,
        &artifact_path,
        input.title.as_deref(),
        &resolved_extra,
    )?;

    let mut command = vec![pandoc.path.clone()];
    command.extend(args.clone());

    if input.dry_run {
        return Ok(ExportJobOutput {
            job_id: Uuid::new_v4().to_string(),
            format: input.format,
            artifact_path: artifact_path.display().to_string(),
            command,
            stdout: String::new(),
            stderr: String::new(),
            duration_ms: 0,
            dry_run: true,
        });
    }

    let job_id = input
        .job_id
        .clone()
        .unwrap_or_else(|| Uuid::new_v4().to_string());
    let started = Instant::now();

    // PROCESS_BROKER_EXCEPTION(export-pandoc-job)
    let mut child = Command::new(&pandoc.path)
        .args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| ExportError::Process(error.to_string()))?;

    let stdout_pipe = child.stdout.take();
    let stderr_pipe = child.stderr.take();
    // Drain both pipes concurrently while retaining only a bounded diagnostic
    // window. This prevents a chatty converter from becoming a memory/log DoS.
    let stdout_reader = stdout_pipe.map(|pipe| {
        thread::spawn(move || drain_pipe_bounded(pipe, None))
    });
    let stderr_reader = stderr_pipe.map(|pipe| {
        let progress_cb = progress.clone();
        thread::spawn(move || drain_pipe_bounded(pipe, progress_cb))
    });

    let status = if let Some(slot) = cancel_slot {
        wait_for_child_with_timeout(slot, &job_id, child, DEFAULT_EXPORT_TIMEOUT)?
    } else {
        wait_for_child_direct(child, DEFAULT_EXPORT_TIMEOUT)?
    };

    let stdout = stdout_reader
        .map(|handle| handle.join().unwrap_or_default())
        .unwrap_or_default();
    let stderr = stderr_reader
        .map(|handle| handle.join().unwrap_or_default())
        .unwrap_or_default();

    if !status.success() {
        if input.preserve_temp_on_failure {
            let failed_dir = vault_root.join(".scriptor/exports/failed");
            if let Err(source) = fs::create_dir_all(&failed_dir) {
                log::warn!("failed to create preserved-export directory {}: {source}", failed_dir.display());
            } else {
                let preserved = failed_dir.join(format!("failed-{job_id}.md"));
                if let Err(source) = fs::copy(&source_path, &preserved) {
                    log::warn!("failed to preserve export source {}: {source}", preserved.display());
                }
            }
        }
        let failure_output = ExportJobOutput {
            job_id: job_id.clone(),
            format: input.format.clone(),
            artifact_path: artifact_path.display().to_string(),
            command: command.clone(),
            stdout,
            stderr: stderr.clone(),
            duration_ms: started.elapsed().as_millis() as u64,
            dry_run: false,
        };
        if let Err(error) = write_export_log(&vault_root, &log_entry_from_output(&failure_output, false)) {
            log::warn!("failed to write export failure log: {error}");
        }
        return Err(ExportError::Process(format!("pandoc failed: {stderr}")));
    }

    validate_export_artifact(&artifact_path, format)?;

    let output = ExportJobOutput {
        job_id,
        format: input.format,
        artifact_path: artifact_path.display().to_string(),
        command,
        stdout,
        stderr,
        duration_ms: started.elapsed().as_millis() as u64,
        dry_run: false,
    };
    if let Err(error) = write_export_log(&vault_root, &log_entry_from_output(&output, true)) {
        log::warn!("failed to write export success log: {error}");
    }
    Ok(output)
}

pub fn export_artifact_stem(note_path: &str) -> String {
    use sha2::{Digest, Sha256};

    let normalized = note_path.replace('\\', "/");
    let without_md = normalized.strip_suffix(".md").unwrap_or(&normalized);
    let readable = without_md
        .split('/')
        .filter(|part| !part.is_empty())
        .map(|part| {
            part.chars()
                .map(|ch| {
                    if ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_' | '.') { ch } else { '-' }
                })
                .collect::<String>()
        })
        .collect::<Vec<_>>()
        .join("--");
    let readable = if readable.is_empty() { "note".to_string() } else { readable };
    let digest = hex::encode(Sha256::digest(normalized.as_bytes()));
    format!("{}-{}", readable, &digest[..10])
}

pub fn default_export_directory(vault_root: &Path) -> PathBuf {
    vault_root.join(".scriptor/exports")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn artifact_path_allows_spaces_in_stem_on_windows_style_dirs() {
        let output_dir = std::env::temp_dir().join("scriptor-export-test");
        let _ = fs::remove_dir_all(&output_dir);
        fs::create_dir_all(&output_dir).expect("temp dir");

        let result = run_export_job(ExportJobInput {
            format: "html".into(),
            source_markdown: "# Hello".into(),
            output_directory: output_dir.display().to_string(),
            source_stem: "Research Plan".into(),
            title: None,
            dry_run: true,
            extra_pandoc_args: vec![],
            vault_root: output_dir.display().to_string(),
            job_id: None,
            preserve_temp_on_failure: false,
            trusted_pandoc_hash: None,
            redact_secrets: false,
        });

        assert!(result.is_ok(), "expected dry-run ok: {result:?}");
        let output = result.expect("dry-run output");
        assert!(output.artifact_path.contains("Research Plan.html"));

        let _ = fs::remove_dir_all(&output_dir);
    }

    #[test]
    fn artifact_stem_preserves_path_identity() {
        let a = export_artifact_stem("a/x.md");
        let b = export_artifact_stem("b/x.md");
        assert_ne!(a, b);
        assert!(a.starts_with("a--x-"));
        assert!(b.starts_with("b--x-"));
        assert_ne!(export_artifact_stem("y.md"), export_artifact_stem("y.md.md"));
    }
}
