//! Bounded PDF snapshots, compiled in a separate OS-memory-limited worker.
 //! No external package fetch or arbitrary destination is permitted.
use std::fs;
use std::io::{Read, Write};
use std::sync::atomic::{AtomicBool, Ordering};

use scriptor_export_runner::inprocess_pdf::{
    BUNDLED_ASSET_NOTICES, MAX_ASSET_BYTES, MAX_MARKDOWN_BYTES, MAX_TOTAL_ASSET_BYTES,
    MAX_PDF_BYTES, PdfAsset, PdfDocument, markdown_image_paths,
};
use scriptor_export_runner::inprocess_pdf::worker::{PdfWorkerRequest, PdfWorkerReceipt, PDF_WORKER_MARKER};
use scriptor_system_bridge::{ProcessSpec, run_process};
use scriptor_vault::{RelativeVaultPath, VaultRoot};
use serde::Serialize;

use crate::AppState;
use crate::state::active_session;

static EXPORTING: AtomicBool = AtomicBool::new(false);
struct ExportLease;
impl Drop for ExportLease {
    fn drop(&mut self) {
        EXPORTING.store(false, Ordering::Release);
    }
}

#[derive(Debug, Serialize)]
pub struct OfflinePdfOutput {
    artifact_path: String,
    page_count: usize,
    warnings: Vec<String>,
    duration_ms: u64,
}

fn bounded_file(root: &VaultRoot, path: &str, limit: usize) -> Result<Vec<u8>, String> {
    let relative = RelativeVaultPath::parse(path).map_err(|e| e.to_string())?;
    // Reject links even when their target happens to remain inside the vault.
    let mut prefix = root.root().to_path_buf();
    for part in relative.as_str().split('/') {
        prefix.push(part);
        let metadata = fs::symlink_metadata(&prefix).map_err(|e| e.to_string())?;
        if metadata.file_type().is_symlink() {
            return Err("PDF resources cannot use symbolic links".into());
        }
    }
    let absolute = root
        .resolve_relative(&relative)
        .map_err(|e| e.to_string())?;
    let file = fs::File::open(&absolute).map_err(|e| e.to_string())?;
    if !file.metadata().map_err(|e| e.to_string())?.is_file() {
        return Err("PDF resources must be regular files".into());
    }
    let mut bytes = Vec::new();
    file.take(limit as u64 + 1)
        .read_to_end(&mut bytes)
        .map_err(|e| e.to_string())?;
    if bytes.len() > limit {
        return Err("PDF resource exceeds its byte limit".into());
    }
    Ok(bytes)
}

fn snapshot_assets(
    root: &VaultRoot,
    note_path: &str,
    markdown: &str,
) -> Result<Vec<PdfAsset>, String> {
    if markdown.len() > MAX_MARKDOWN_BYTES {
        return Err("Offline PDF source exceeds 256 KiB".into());
    }
    let note = RelativeVaultPath::parse(note_path).map_err(|e| e.to_string())?;
    if !note.as_str().ends_with(".md") {
        return Err("Offline PDF source must be a Markdown note".into());
    }
    // Prove the source belongs to this vault even when exporting an unsaved editor snapshot.
    let _source = bounded_file(root, note.as_str(), MAX_MARKDOWN_BYTES)?;
    let parent = note.as_str().rsplit_once('/').map(|(parent, _)| parent);
    let mut total = 0usize;
    let mut assets = Vec::new();
    for path in markdown_image_paths(markdown).map_err(|e| e.to_string())? {
        let relative = parent.map_or_else(|| path.clone(), |parent| format!("{parent}/{path}"));
        let bytes = bounded_file(root, &relative, MAX_ASSET_BYTES)?;
        total = total
            .checked_add(bytes.len())
            .ok_or("PDF asset byte overflow")?;
        if total > MAX_TOTAL_ASSET_BYTES {
            return Err("Offline PDF assets exceed 32 MiB".into());
        }
        assets.push(PdfAsset { path, bytes });
    }
    Ok(assets)
}

/// The compiler runs in the packaged desktop executable's separate worker
/// process. The broker terminates timed-out workers; the worker applies its OS
/// memory limit BEFORE reading or compiling the bounded snapshot.
fn compile_pdf_isolated(
    markdown: &str,
    title: &str,
    assets: Vec<PdfAsset>,
) -> Result<PdfDocument, String> {
    let private = tempfile::tempdir().map_err(|error| error.to_string())?;
    let input = private.path().join("request.json");
    let output = private.path().join("result.pdf");
    let receipt = private.path().join("receipt.json");
    let request = PdfWorkerRequest {
        markdown: markdown.to_owned(),
        title: Some(title.to_owned()),
        assets,
    };
    let encoded = serde_json::to_vec(&request).map_err(|error| error.to_string())?;
    if encoded.len() > 140 * 1024 * 1024 {
        return Err("Offline PDF request exceeds its isolated-worker transport bound".into());
    }
    let mut file = fs::OpenOptions::new().write(true).create_new(true)
        .open(&input).map_err(|error| error.to_string())?;
    file.write_all(&encoded).and_then(|()| file.sync_all())
        .map_err(|error| error.to_string())?;
    drop(file);

    let executable = std::env::current_exe().map_err(|error| error.to_string())?;
    let spec = ProcessSpec::new(executable)
        .arg(PDF_WORKER_MARKER)
        .arg(input.as_os_str())
        .arg(output.as_os_str())
        .arg(receipt.as_os_str())
        .current_dir(private.path())
        .timeout(std::time::Duration::from_secs(30))
        .max_output_bytes(4096);
    let result = run_process(spec).map_err(|error| format!("Isolated PDF worker could not finish: {error}"))?;
    if result.exit_code != 0 || result.timed_out {
        return Err(format!("Isolated PDF worker failed (exit {}): {}", result.exit_code, result.stderr));
    }
    let pdf = fs::read(&output).map_err(|error| format!("PDF worker did not publish output: {error}"))?;
    if pdf.len() > MAX_PDF_BYTES || !pdf.starts_with(b"%PDF-")
        || !pdf.trim_ascii_end().ends_with(b"%%EOF") {
        return Err("PDF worker returned invalid or oversized output".into());
    }
    let metadata: PdfWorkerReceipt = serde_json::from_slice(
        &fs::read(&receipt).map_err(|error| error.to_string())?
    ).map_err(|_| "PDF worker returned invalid metadata")?;
    if metadata.page_count == 0 || metadata.page_count > 256
        || metadata.warnings.len() > 4
        || metadata.sha256 != scriptor_vault::content_hash_bytes(&pdf) {
        return Err("PDF worker response was truncated or corrupt".into());
    }
    Ok(PdfDocument { bytes: pdf, page_count: metadata.page_count, warnings: metadata.warnings })
}

fn publish_pdf(root: &VaultRoot, bytes: &[u8]) -> Result<String, String> {
    let _lock = scriptor_vault::fs::lock_vault_mutation(root.root()).map_err(|e| e.to_string())?;
    if root.root().join(".scriptor/rename-txn.json").is_file() {
        return Err("Vault rename transaction is pending; retry export after recovery".into());
    }
    let relative =
        RelativeVaultPath::parse(".scriptor/exports/offline").map_err(|e| e.to_string())?;
    let directory = root
        .resolve_relative(&relative)
        .map_err(|e| e.to_string())?;
    fs::create_dir_all(&directory).map_err(|e| e.to_string())?;
    let directory = root
        .resolve_relative(&relative)
        .map_err(|e| e.to_string())?;
    let identifier = uuid::Uuid::new_v4();
    let destination = directory.join(format!("{identifier}.pdf"));
    let staging = directory.join(format!(".{identifier}.staging"));
    struct Staging(std::path::PathBuf);
    impl Drop for Staging {
        fn drop(&mut self) {
            let _ = fs::remove_file(&self.0);
        }
    }
    let mut file = fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&staging)
        .map_err(|e| e.to_string())?;
    let _staging = Staging(staging.clone());
    file.write_all(bytes)
        .and_then(|()| file.sync_all())
        .map_err(|e| e.to_string())?;
    drop(file);
    // Hard-link publication is atomic and fails if an external writer creates the
    // destination. A check followed by rename/atomic_write would replace that file.
    fs::hard_link(&staging, &destination)
        .map_err(|e| format!("Cannot publish PDF without replacing an existing file: {e}"))?;
    #[cfg(unix)]
    fs::File::open(&directory)
        .and_then(|file| file.sync_all())
        .map_err(|e| e.to_string())?;
    Ok(destination.display().to_string())
}

#[tauri::command]
pub fn export_pdf_licenses() -> &'static str {
    BUNDLED_ASSET_NOTICES
}

#[tauri::command]
pub async fn export_pdf_inprocess(
    state: tauri::State<'_, AppState>,
    expected_vault_id: String,
    note_path: String,
    source_markdown: String,
) -> Result<OfflinePdfOutput, String> {
    super::export::require_export_capability(&state)?;
    let root = {
        let session = active_session(&state)?;
        super::vault::validate_expected_vault(&session.descriptor.id, Some(&expected_vault_id))?;
        session.root.clone()
    };
    if EXPORTING
        .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
        .is_err()
    {
        return Err("An offline PDF export is already running; wait for it to finish".into());
    }
    // Move the lease into the worker, so abandoning the caller never starts a concurrent compiler.
    let lease = ExportLease;
    let title = note_path
        .rsplit('/')
        .next()
        .unwrap_or("Note")
        .trim_end_matches(".md")
        .to_owned();
    let started = std::time::Instant::now();
    let pdf = tauri::async_runtime::spawn_blocking(move || {
        let _lease = lease;
        let assets = snapshot_assets(&root, &note_path, &source_markdown)?;
        compile_pdf_isolated(&source_markdown, &title, assets)
    })
    .await
    .map_err(|e| format!("Offline PDF worker failed: {e}"))??;
    super::export::require_export_capability(&state)?;
    let active = active_session(&state)?;
    super::vault::validate_expected_vault(&active.descriptor.id, Some(&expected_vault_id))?;
    let artifact_path = publish_pdf(&active.root, &pdf.bytes)?;
    Ok(OfflinePdfOutput {
        artifact_path,
        page_count: pdf.page_count,
        warnings: pdf.warnings,
        duration_ms: started.elapsed().as_millis().min(u64::MAX as u128) as u64,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn publication_retains_unique_complete_artifacts_and_respects_rename_barrier() {
        let dir = tempfile::tempdir().unwrap();
        let root = VaultRoot::open(dir.path()).unwrap();
        let first = publish_pdf(&root, b"%PDF-first").unwrap();
        let second = publish_pdf(&root, b"%PDF-second").unwrap();
        assert_ne!(first, second);
        assert_eq!(fs::read(first).unwrap(), b"%PDF-first");
        assert_eq!(fs::read(second).unwrap(), b"%PDF-second");
        assert_eq!(
            fs::read_dir(dir.path().join(".scriptor/exports/offline"))
                .unwrap()
                .count(),
            2
        );
        fs::write(dir.path().join(".scriptor/rename-txn.json"), b"{}").unwrap();
        assert!(publish_pdf(&root, b"%PDF-third").is_err());
    }
    #[test]
    fn assets_are_relative_to_the_note_and_bounded() {
        let dir = tempfile::tempdir().unwrap();
        fs::create_dir(dir.path().join("notes")).unwrap();
        fs::write(dir.path().join("notes/note.md"), "# Saved").unwrap();
        fs::write(dir.path().join("notes/image.png"), b"immutable-image").unwrap();
        let root = VaultRoot::open(dir.path()).unwrap();
        let assets = snapshot_assets(&root, "notes/note.md", "![Image](image.png)").unwrap();
        assert_eq!(assets[0].path, "image.png");
        assert_eq!(assets[0].bytes, b"immutable-image");
        assert!(snapshot_assets(&root, "../outside.md", "# Bad").is_err());
        assert!(
            snapshot_assets(
                &root,
                "notes/note.md",
                "![Remote](https://example.org/a.png)"
            )
            .is_err()
        );
        assert!(snapshot_assets(&root, "notes/note.md", "![Missing](missing.png)").is_err());
        assert!(
            snapshot_assets(&root, "notes/note.md", &"x".repeat(MAX_MARKDOWN_BYTES + 1)).is_err()
        );
        assert!(bounded_file(&root, "notes/image.png", 4).is_err());
    }
}
