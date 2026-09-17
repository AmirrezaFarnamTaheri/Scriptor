//! LaTeX compilation commands backed by the Tectonic engine.
//!
//! Tectonic is a self-contained TeX/LaTeX engine that auto-downloads the TeX
//! Live packages it needs on first use, so `latex_compile` runs with an
//! outbound-network allowance (unlike `code_chunk_run`, which denies network).
//! Running an external engine over vault content is a sensitive operation and
//! is therefore gated through the authorization broker.

use std::path::{Path, PathBuf};
use std::sync::atomic::Ordering;
use std::time::Duration;

use scriptor_system_bridge::{NetworkPolicy, ProcessSpec, run_process};
use serde::Serialize;

use crate::authorization::{SensitiveOperation, require_sensitive_operation};
use crate::state::{AppState, active_session};

const MAX_OUTPUT_BYTES: usize = 512 * 1024;
const TIMEOUT_SECS: u64 = 180;

#[derive(Debug, Serialize)]
pub struct LatexCompileOutput {
    pub output_path: String,
    pub stdout: String,
    pub stderr: String,
    pub duration_ms: u64,
}

fn mark_truncated(value: String, truncated: bool) -> String {
    if truncated {
        format!("{value}\n[truncated]")
    } else {
        value
    }
}

fn tectonic_binary_names() -> &'static [&'static str] {
    if cfg!(windows) {
        &["tectonic.exe", "tectonic"]
    } else {
        &["tectonic"]
    }
}

fn find_on_path() -> Option<PathBuf> {
    let path_var = std::env::var_os("PATH")?;
    for dir in std::env::split_paths(&path_var) {
        for name in tectonic_binary_names() {
            let candidate = dir.join(name);
            if candidate.is_file() {
                return Some(candidate);
            }
        }
    }
    None
}

fn is_tectonic_binary(path: &Path) -> bool {
    path.file_name()
        .and_then(|name| name.to_str())
        .map(|name| {
            let lower = name.to_ascii_lowercase();
            tectonic_binary_names()
                .iter()
                .any(|candidate| lower == *candidate)
        })
        .unwrap_or(false)
}

fn resolve_tectonic(config_path: Option<&str>) -> Option<PathBuf> {
    if let Some(raw) = config_path.map(str::trim).filter(|value| !value.is_empty()) {
        let candidate = PathBuf::from(raw);
        if candidate.is_file() && is_tectonic_binary(&candidate) {
            return Some(candidate);
        }
    }
    find_on_path()
}

const ALLOWED_EXTRA_FLAGS: &[&str] = &[
    "--keep-logs",
    "--keep-intermediates",
    "--synctex",
    "--chatter",
    "--print",
];

fn sanitize_extra_flags(flags: Vec<String>) -> Result<Vec<String>, String> {
    let mut accepted = Vec::with_capacity(flags.len());
    for flag in flags {
        let trimmed = flag.trim();
        if trimmed.is_empty() {
            continue;
        }
        let name = trimmed.split('=').next().unwrap_or(trimmed);
        if !ALLOWED_EXTRA_FLAGS.contains(&name) {
            return Err(format!("unsupported LaTeX engine flag: {trimmed}"));
        }
        accepted.push(trimmed.to_string());
    }
    Ok(accepted)
}

#[tauri::command]
pub fn latex_discover_tectonic(config_path: Option<String>) -> Option<String> {
    resolve_tectonic(config_path.as_deref()).map(|path| path.display().to_string())
}

/// Request cancellation of the active compile. `run_process` observes this
/// shared slot and terminates the Tectonic process tree when possible.
#[tauri::command]
pub fn latex_cancel_compile(state: tauri::State<AppState>) -> bool {
    !state.latex_cancel.swap(true, Ordering::SeqCst)
}

fn derive_output_path(input_path: &Path, output_dir: &Path) -> PathBuf {
    let stem = input_path
        .file_stem()
        .map(|value| value.to_os_string())
        .unwrap_or_else(|| "document".into());
    let mut file_name = stem;
    file_name.push(".pdf");
    output_dir.join(file_name)
}

fn resolve_vault_input(vault_root: &Path, input_path: &str) -> Result<PathBuf, String> {
    let requested = PathBuf::from(input_path);
    let candidate = if requested.is_absolute() {
        requested
    } else {
        vault_root.join(requested)
    };
    let canonical = std::fs::canonicalize(&candidate)
        .map_err(|error| format!("LaTeX source not found: {input_path}: {error}"))?;
    if !canonical.starts_with(vault_root) {
        return Err("LaTeX source must be inside the active vault".to_string());
    }
    if !canonical.is_file() {
        return Err(format!("LaTeX source not found: {input_path}"));
    }
    let extension = canonical
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default();
    if !matches!(extension.to_ascii_lowercase().as_str(), "tex" | "ltx") {
        return Err("LaTeX compilation requires a .tex or .ltx source file".to_string());
    }
    Ok(canonical)
}

struct CancelGuard(std::sync::Arc<std::sync::atomic::AtomicBool>);
impl Drop for CancelGuard {
    fn drop(&mut self) {
        self.0.store(false, Ordering::SeqCst);
    }
}

/// Compile a `.tex`/`.ltx` file inside the active vault to PDF using Tectonic.
#[tauri::command]
pub fn latex_compile(
    state: tauri::State<AppState>,
    input_path: String,
    output_dir: String,
    tectonic_path: Option<String>,
    extra_flags: Vec<String>,
    authorization_token: String,
) -> Result<LatexCompileOutput, String> {
    // Resolve relative paths against the authoritative native vault rather than
    // the desktop process CWD. Canonicalization also rejects symlinks/traversal
    // that escape the active vault.
    let session = active_session(&state)?;
    let canonical_vault = std::fs::canonicalize(session.root.root())
        .map_err(|error| format!("Invalid active vault root: {error}"))?;
    let vault_id = session.descriptor.id.clone();
    drop(session);
    let input = resolve_vault_input(&canonical_vault, &input_path)?;

    require_sensitive_operation(
        &state,
        &authorization_token,
        SensitiveOperation::LatexCompilation,
        Some(&input.display().to_string()),
        Some(&vault_id),
    )?;

    state.latex_cancel.store(false, Ordering::SeqCst);
    let _cancel_guard = CancelGuard(std::sync::Arc::clone(&state.latex_cancel));

    let binary = resolve_tectonic(tectonic_path.as_deref()).ok_or_else(|| {
        "Tectonic was not found. Install it or set the LaTeX engine path in vault settings."
            .to_string()
    })?;

    let output = PathBuf::from(&output_dir);
    std::fs::create_dir_all(&output).map_err(|error| {
        format!("failed to create LaTeX output directory {output_dir}: {error}")
    })?;

    let mut args: Vec<String> = vec![
        input.display().to_string(),
        "--outdir".to_string(),
        output.display().to_string(),
    ];
    args.extend(sanitize_extra_flags(extra_flags)?);

    let work_dir = input
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or(output.clone());

    let receipt = run_process(
        ProcessSpec::new(binary.as_os_str())
            .args(args)
            .current_dir(&work_dir)
            .timeout(Duration::from_secs(TIMEOUT_SECS))
            .max_output_bytes(MAX_OUTPUT_BYTES)
            .cancel_slot(std::sync::Arc::clone(&state.latex_cancel))
            .network_policy(NetworkPolicy::Allow),
    )
    .map_err(|error| {
        if state.latex_cancel.load(Ordering::Relaxed) {
            "compile cancelled by user".to_string()
        } else {
            error.to_string()
        }
    })?;

    if receipt.exit_code != 0 {
        return Err(format!(
            "Tectonic exited with code {}: {}",
            receipt.exit_code,
            mark_truncated(receipt.stderr, receipt.stderr_truncated)
        ));
    }

    Ok(LatexCompileOutput {
        output_path: derive_output_path(&input, &output).display().to_string(),
        stdout: mark_truncated(receipt.stdout, receipt.stdout_truncated),
        stderr: mark_truncated(receipt.stderr, receipt.stderr_truncated),
        duration_ms: receipt.duration_ms,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn derives_pdf_path_from_source_stem() {
        let out = derive_output_path(
            Path::new("/vault/paper.tex"),
            Path::new("/vault/.scriptor/latex"),
        );
        assert!(out.ends_with("paper.pdf"));
    }

    #[test]
    fn falls_back_to_document_when_stem_missing() {
        let out = derive_output_path(Path::new("/vault/"), Path::new("/out"));
        assert!(out.ends_with("document.pdf") || out.ends_with("vault.pdf"));
    }

    #[test]
    fn resolves_relative_input_inside_vault_and_rejects_escape() {
        let vault = tempfile::tempdir().expect("vault");
        let nested = vault.path().join("papers");
        std::fs::create_dir_all(&nested).expect("papers");
        let source = nested.join("paper.tex");
        std::fs::write(&source, "\\documentclass{article}").expect("source");
        let canonical_vault = std::fs::canonicalize(vault.path()).expect("canonical vault");

        let resolved = resolve_vault_input(&canonical_vault, "papers/paper.tex").expect("resolve");
        assert_eq!(
            resolved,
            std::fs::canonicalize(&source).expect("canonical source")
        );

        let outside_dir = tempfile::tempdir().expect("outside dir");
        let outside = outside_dir.path().join("outside.tex");
        std::fs::write(&outside, "\\documentclass{article}").expect("outside source");
        let error = resolve_vault_input(&canonical_vault, outside.to_string_lossy().as_ref())
            .expect_err("outside source must be rejected");
        assert!(error.contains("inside the active vault"));
    }
}
