//! LaTeX compilation commands backed by the Tectonic engine.
//!
//! Tectonic is a self-contained TeX/LaTeX engine that auto-downloads the TeX
//! Live packages it needs on first use, so `latex_compile` runs with an
//! outbound-network allowance (unlike `code_chunk_run`, which denies network).
//! Running an external engine over vault content is a sensitive operation and
//! is therefore gated through the authorization broker.

use std::path::{Component, Path, PathBuf};
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
/// Authorization scope for a LaTeX compile.
///
/// Built from the raw vault-relative request strings so the frontend can
/// construct the identical value when requesting the grant. The scope shown
/// to the user names both the source document and the directory generated
/// files are written to, so an approval covers the output destination too.
///
/// The pair is JSON-serialized rather than delimiter-joined: a plain
/// `"input (output: dir)"` format is ambiguous, because `("a", "b (output: c")`
/// and `("a (output: b", "c")` produce the same string and one grant would
/// authorize the other. Both sides use the same serializer, so an exact
/// string match means an exact path pair.
pub(crate) fn latex_authorization_scope(input_path: &str, output_dir: &str) -> String {
    serde_json::to_string(&(input_path, output_dir))
        .expect("authorization scope serialization is infallible for UTF-8 paths")
}

/// Validates a vault-relative output directory without creating anything.
///
/// Returns the joined candidate path together with the canonicalized vault
/// root, so [`materialize_vault_output_dir`] can re-verify containment after
/// creation. Splitting validation from creation means an unauthorized request
/// leaves the filesystem untouched, and a symlinked ancestor is rejected
/// before `create_dir_all` would follow it outside the vault.
fn validate_vault_output_dir(
    canonical_vault: &Path,
    output_dir: &str,
) -> Result<(PathBuf, PathBuf), String> {
    let requested = PathBuf::from(output_dir.trim());
    if requested.is_absolute() {
        return Err("LaTeX output directory must be relative to the vault root".into());
    }
    if requested.components().any(|part| {
        matches!(
            part,
            Component::ParentDir | Component::RootDir | Component::Prefix(_)
        )
    }) {
        return Err("LaTeX output directory must not escape the active vault".into());
    }
    let candidate = canonical_vault.join(&requested);
    // Resolve the nearest existing ancestor before any directory is created,
    // so a symlink pointing outside the vault is rejected here rather than
    // followed by create_dir_all.
    let mut ancestor = canonical_vault.to_path_buf();
    for component in requested.components() {
        ancestor.push(component);
        if ancestor.exists() {
            let resolved = std::fs::canonicalize(&ancestor)
                .map_err(|error| format!("invalid LaTeX output directory {output_dir}: {error}"))?;
            if !resolved.starts_with(canonical_vault) {
                return Err("LaTeX output directory resolves outside the active vault".into());
            }
        }
    }
    Ok((candidate, canonical_vault.to_path_buf()))
}

/// Creates the validated output directory and re-verifies containment, so a
/// symlink created between validation and use still cannot redirect output.
fn materialize_vault_output_dir(
    candidate: &Path,
    canonical_vault: &Path,
    output_dir: &str,
) -> Result<PathBuf, String> {
    std::fs::create_dir_all(candidate).map_err(|error| {
        format!("failed to create LaTeX output directory {output_dir}: {error}")
    })?;
    let canonical = std::fs::canonicalize(candidate)
        .map_err(|error| format!("invalid LaTeX output directory {output_dir}: {error}"))?;
    if !canonical.starts_with(canonical_vault) {
        return Err("LaTeX output directory resolves outside the active vault".into());
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
///
/// `output_dir` is vault-relative, like `input_path`: the native command
/// resolves it under the canonical vault root and rejects any path that would
/// place generated files outside the vault.
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
    // Validate the destination without touching the filesystem, so an
    // unauthorized or escaping request creates no directories.
    let (output_candidate, vault_root_canonical) =
        validate_vault_output_dir(&canonical_vault, &output_dir)?;

    require_sensitive_operation(
        &state,
        &authorization_token,
        SensitiveOperation::LatexCompilation,
        Some(&latex_authorization_scope(&input_path, &output_dir)),
        Some(&vault_id),
    )?;

    // Authorized: materialize the output directory and re-verify containment
    // before Tectonic writes into it.
    let output =
        materialize_vault_output_dir(&output_candidate, &vault_root_canonical, &output_dir)?;

    state.latex_cancel.store(false, Ordering::SeqCst);
    let _cancel_guard = CancelGuard(std::sync::Arc::clone(&state.latex_cancel));

    let binary = resolve_tectonic(tectonic_path.as_deref()).ok_or_else(|| {
        "Tectonic was not found. Install it or set the LaTeX engine path in vault settings."
            .to_string()
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

    #[test]
    fn authorization_scope_names_source_and_output_destination() {
        let scope = latex_authorization_scope("papers/report.tex", ".scriptor/latex-out");
        assert!(scope.contains("papers/report.tex"));
        assert!(scope.contains(".scriptor/latex-out"));
    }

    #[test]
    fn authorization_scope_is_unambiguous_and_matches_the_bridge_serializer() {
        // The bridge builds the identical string with JSON.stringify([a, b]),
        // so the scope must be a JSON array of the two paths in order.
        assert_eq!(
            latex_authorization_scope("papers/report.tex", ".scriptor/latex-out"),
            r#"["papers/report.tex",".scriptor/latex-out"]"#
        );
        // The old "input (output: dir)" delimiter joined these two pairs to the
        // same string, so a grant for one authorized the other.
        assert_ne!(
            latex_authorization_scope("a.tex", "b (output: c"),
            latex_authorization_scope("a (output: b", "c"),
            "distinct path pairs must not collapse to one scope"
        );
    }

    #[test]
    fn resolves_relative_output_directory_inside_vault() {
        let vault = tempfile::tempdir().expect("vault");
        let canonical_vault = std::fs::canonicalize(vault.path()).expect("canonical vault");

        let (candidate, vault_root_canonical) =
            validate_vault_output_dir(&canonical_vault, ".scriptor/latex-out")
                .expect("validate output dir");

        // Validation must not create the directory.
        assert!(!candidate.exists());

        let resolved =
            materialize_vault_output_dir(&candidate, &vault_root_canonical, ".scriptor/latex-out")
                .expect("materialize output dir");
        assert_eq!(resolved, canonical_vault.join(".scriptor/latex-out"));
        assert!(resolved.is_dir(), "the output directory is created");
    }

    #[cfg(unix)]
    #[test]
    fn rejects_symlinked_ancestor_before_creating_a_child_directory() {
        use std::os::unix::fs::symlink;

        let vault = tempfile::tempdir().expect("vault");
        let outside = tempfile::tempdir().expect("outside");
        let canonical_vault = std::fs::canonicalize(vault.path()).expect("canonical vault");
        symlink(outside.path(), vault.path().join("escape")).expect("symlink");

        // A missing child under a symlinked ancestor: lexical checks pass, and
        // without ancestor validation create_dir_all would follow the symlink
        // and create the directory outside the vault.
        let error = validate_vault_output_dir(&canonical_vault, "escape/new")
            .expect_err("a symlinked ancestor must be rejected before creation");
        assert!(error.contains("outside the active vault"));
        assert!(
            !outside.path().join("new").exists(),
            "nothing may be created outside the vault"
        );
    }

    #[test]
    fn rejects_absolute_output_directory() {
        let vault = tempfile::tempdir().expect("vault");
        let canonical_vault = std::fs::canonicalize(vault.path()).expect("canonical vault");
        // A canonicalized path is absolute on every platform, and it stays
        // inside the vault, so only the absolute-path branch can reject it.
        let absolute = canonical_vault.join("elsewhere");

        let error =
            validate_vault_output_dir(&canonical_vault, absolute.to_string_lossy().as_ref())
                .expect_err("absolute output directory must be rejected");
        assert!(error.contains("relative to the vault root"));
    }

    #[test]
    fn rejects_output_directory_that_escapes_the_vault() {
        let vault = tempfile::tempdir().expect("vault");
        let canonical_vault = std::fs::canonicalize(vault.path()).expect("canonical vault");

        let error = validate_vault_output_dir(&canonical_vault, "../../outside")
            .expect_err("traversal must be rejected");
        assert!(error.contains("escape") || error.contains("outside"));
    }

    #[cfg(unix)]
    #[test]
    fn rejects_symlinked_output_directory_pointing_outside_the_vault() {
        use std::os::unix::fs::symlink;

        let vault = tempfile::tempdir().expect("vault");
        let outside = tempfile::tempdir().expect("outside");
        let canonical_vault = std::fs::canonicalize(vault.path()).expect("canonical vault");
        symlink(outside.path(), vault.path().join("escape")).expect("symlink");

        let error = validate_vault_output_dir(&canonical_vault, "escape")
            .expect_err("a symlink escaping the vault must be rejected");
        assert!(error.contains("outside the active vault"));
    }
}
