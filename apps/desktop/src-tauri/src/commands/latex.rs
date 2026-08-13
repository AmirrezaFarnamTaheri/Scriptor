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
use crate::state::AppState;

/// Tectonic can emit verbose logs while fetching packages; allow more headroom
/// than the code-chunk runner but still bound the captured output.
const MAX_OUTPUT_BYTES: usize = 512 * 1024;
/// First runs may download a package bundle; give the engine generous time.
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

/// Candidate executable names to probe on `PATH` (Windows adds the `.exe` form).
fn tectonic_binary_names() -> &'static [&'static str] {
    if cfg!(windows) {
        &["tectonic.exe", "tectonic"]
    } else {
        &["tectonic"]
    }
}

/// Resolve `tectonic` on the process `PATH`, returning the first match.
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

/// Whether `path`'s file name is a recognized Tectonic executable. Guards
/// against a caller pointing `tectonic_path` at an arbitrary binary: the
/// compile authorization scope covers only the input document, so the
/// executable that actually runs must be Tectonic and nothing else.
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

/// Resolve a usable Tectonic binary from an explicit config path or `PATH`.
/// An explicit path is honored only when it both exists and is named
/// `tectonic`/`tectonic.exe`; otherwise resolution falls back to `PATH`.
fn resolve_tectonic(config_path: Option<&str>) -> Option<PathBuf> {
    if let Some(raw) = config_path.map(str::trim).filter(|value| !value.is_empty()) {
        let candidate = PathBuf::from(raw);
        if candidate.is_file() && is_tectonic_binary(&candidate) {
            return Some(candidate);
        }
    }
    find_on_path()
}

/// Engine flags the frontend is permitted to forward. Anything outside this
/// allow-list is rejected so an approved "compile" cannot be repurposed to
/// change the output target, input, or engine behavior beyond what consent
/// covered. Value-bearing flags (`--flag value`) are accepted as their own
/// argument; the value that follows is not interpreted as a flag.
const ALLOWED_EXTRA_FLAGS: &[&str] = &[
    "--keep-logs",
    "--keep-intermediates",
    "--synctex",
    "--chatter",
    "--print",
];

/// Validate caller-supplied extra flags against {@link ALLOWED_EXTRA_FLAGS}.
/// Returns the trimmed, non-empty flags on success or the first offending
/// token on rejection.
fn sanitize_extra_flags(flags: Vec<String>) -> Result<Vec<String>, String> {
    let mut accepted = Vec::with_capacity(flags.len());
    for flag in flags {
        let trimmed = flag.trim();
        if trimmed.is_empty() {
            continue;
        }
        // Compare only the flag name, not any `=value` suffix.
        let name = trimmed.split('=').next().unwrap_or(trimmed);
        if !ALLOWED_EXTRA_FLAGS.contains(&name) {
            return Err(format!("unsupported LaTeX engine flag: {trimmed}"));
        }
        accepted.push(trimmed.to_string());
    }
    Ok(accepted)
}

/// Discover the Tectonic engine. Tries the configured path first, then `PATH`.
/// Returns the resolved absolute path, or `None` when Tectonic is unavailable.
/// Read-only probe — no authorization required.
#[tauri::command]
pub fn latex_discover_tectonic(config_path: Option<String>) -> Option<String> {
    resolve_tectonic(config_path.as_deref()).map(|path| path.display().to_string())
}

/// Best-effort cancellation. `run_process` runs synchronously and cannot
/// interrupt an in-flight external engine, so this only aborts a compile that
/// has not yet launched. Returns whether a cancellation was newly requested.
#[tauri::command]
pub fn latex_cancel_compile(state: tauri::State<AppState>) -> bool {
    !state.latex_cancel.swap(true, Ordering::SeqCst)
}

/// Derive the PDF output path Tectonic writes for `input_path` under `output_dir`.
fn derive_output_path(input_path: &Path, output_dir: &Path) -> PathBuf {
    let stem = input_path
        .file_stem()
        .map(|value| value.to_os_string())
        .unwrap_or_else(|| "document".into());
    let mut file_name = stem;
    file_name.push(".pdf");
    output_dir.join(file_name)
}

/// Compile a `.tex` file to PDF using Tectonic.
#[tauri::command]
pub fn latex_compile(
    state: tauri::State<AppState>,
    input_path: String,
    output_dir: String,
    tectonic_path: Option<String>,
    extra_flags: Vec<String>,
    authorization_token: String,
) -> Result<LatexCompileOutput, String> {
    require_sensitive_operation(
        &state,
        &authorization_token,
        SensitiveOperation::LatexCompilation,
        Some(&input_path),
    )?;

    // Honor a cancellation requested before this compile began, then reset.
    if state.latex_cancel.swap(false, Ordering::SeqCst) {
        return Err("compile cancelled before it started".into());
    }

    let input = PathBuf::from(&input_path);
    if !input.is_file() {
        return Err(format!("LaTeX source not found: {input_path}"));
    }

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
            // Tectonic fetches TeX Live packages over the network on demand.
            .network_policy(NetworkPolicy::Allow),
    )
    .map_err(|error| error.to_string())?;

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
}
