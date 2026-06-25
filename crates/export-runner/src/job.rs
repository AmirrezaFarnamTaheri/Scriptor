use std::fs;
use std::io::{BufRead, BufReader, Read};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::Arc;
use std::thread;
use std::time::Instant;

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::args::{build_pandoc_args, ExportFormat};
use crate::cancel::{wait_for_child, ExportCancelSlot};
use crate::error::ExportError;
use crate::log::{log_entry_from_output, write_export_log};
use crate::pandoc::discover_pandoc;
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

pub fn run_export_job(input: ExportJobInput) -> Result<ExportJobOutput, ExportError> {
    run_export_job_with_cancel(input, None, None)
}

pub fn run_export_job_with_cancel(
    input: ExportJobInput,
    cancel_slot: Option<&ExportCancelSlot>,
    progress: Option<ExportProgressCallback>,
) -> Result<ExportJobOutput, ExportError> {
    let format = ExportFormat::parse(&input.format)?;
    let pandoc = match discover_pandoc() {
        Ok(found) => found,
        Err(_) if input.dry_run => crate::pandoc::PandocDiscovery {
            path: "pandoc".into(),
            version: "not-installed".into(),
        },
        Err(error) => return Err(error),
    };

    let output_dir = PathBuf::from(&input.output_directory);
    fs::create_dir_all(&output_dir).map_err(|source| ExportError::Io {
        path: output_dir.clone(),
        source,
    })?;

    let artifact_name = format!("{}.{}", input.source_stem, format.extension());
    let artifact_path = output_dir.join(&artifact_name);
    match artifact_path.strip_prefix(&output_dir) {
        Ok(relative) if !relative.components().any(|component| {
            matches!(component, std::path::Component::ParentDir)
        }) => {}
        _ => return Err(ExportError::InvalidOutput(artifact_path)),
    }

    let temp_dir = output_dir.join(".tmp");
    fs::create_dir_all(&temp_dir).map_err(|source| ExportError::Io {
        path: temp_dir.clone(),
        source,
    })?;
    let source_path = temp_dir.join(format!("{}.md", Uuid::new_v4()));
    let (processed_markdown, _diagram_assets) =
        crate::diagram_preprocess::preprocess_diagrams(&input.source_markdown, &temp_dir)?;
    fs::write(&source_path, &processed_markdown).map_err(|source| ExportError::Io {
        path: source_path.clone(),
        source,
    })?;

    let vault_root = if input.vault_root.is_empty() {
        output_dir.clone()
    } else {
        PathBuf::from(&input.vault_root)
    };
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
        let _ = fs::remove_file(&source_path);
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

    let mut child = Command::new(&pandoc.path)
        .args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| ExportError::Process(error.to_string()))?;

    let mut stdout_pipe = child.stdout.take();
    let mut stderr_pipe = child.stderr.take();
    let stderr_reader = stderr_pipe.take().map(|pipe| {
        let progress_cb = progress.clone();
        thread::spawn(move || {
            let mut accumulated = String::new();
            let reader = BufReader::new(pipe);
            for line in reader.lines() {
                match line {
                    Ok(text) => {
                        let chunk = format!("{text}\n");
                        accumulated.push_str(&chunk);
                        if let Some(callback) = progress_cb.as_ref() {
                            callback(&chunk);
                        }
                    }
                    Err(_) => break,
                }
            }
            accumulated
        })
    });

    let status = if let Some(slot) = cancel_slot {
        wait_for_child(slot, &job_id, child)?
    } else {
        child
            .wait()
            .map_err(|error| ExportError::Process(error.to_string()))?
    };

    let mut stdout = String::new();
    if let Some(mut pipe) = stdout_pipe.take() {
        let _ = pipe.read_to_string(&mut stdout);
    }
    let stderr = stderr_reader
        .map(|handle| handle.join().unwrap_or_default())
        .unwrap_or_default();

    if !status.success() {
        if input.preserve_temp_on_failure {
            let preserved = output_dir.join(format!("failed-{}.md", job_id));
            let _ = fs::copy(&source_path, &preserved);
        }
        let _ = fs::remove_file(&source_path);
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
        let _ = write_export_log(&vault_root, &log_entry_from_output(&failure_output, false));
        return Err(ExportError::Process(format!(
            "pandoc failed: {stderr}"
        )));
    }

    validate_export_artifact(&artifact_path, format)?;
    let _ = fs::remove_file(&source_path);

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
    let _ = write_export_log(&vault_root, &log_entry_from_output(&output, true));
    Ok(output)
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
        });

        assert!(result.is_ok(), "expected dry-run ok: {result:?}");
        let output = result.expect("dry-run output");
        assert!(output.artifact_path.contains("Research Plan.html"));

        let _ = fs::remove_dir_all(&output_dir);
    }
}
