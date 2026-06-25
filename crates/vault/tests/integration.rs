use std::fs;
use std::path::PathBuf;

use scriptor_vault::{
    open_vault, read_note, save_note, save_note_with_options, scan_vault, RelativeVaultPath,
    SaveNoteOptions, ScannedEntryKind, VaultError,
};
use tempfile::TempDir;

fn fixture_source() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../packages/test-fixtures/vaults/minimal/Research Plan.md")
}

fn copied_fixture() -> (TempDir, PathBuf) {
    let dir = tempfile::tempdir().expect("tempdir");
    let root = dir.path().to_path_buf();
    fs::copy(fixture_source(), root.join("Research Plan.md")).expect("copy fixture");
    (dir, root)
}

#[test]
fn opens_minimal_fixture_vault() -> Result<(), VaultError> {
    let (_dir, root) = copied_fixture();
    let session = open_vault(root)?;
    assert_eq!(session.descriptor.status, scriptor_vault::VaultStatus::Ready);
    Ok(())
}

#[test]
fn scans_minimal_fixture_notes() -> Result<(), VaultError> {
    let (_dir, root) = copied_fixture();
    let session = open_vault(root)?;
    let entries = scan_vault(&session.root)?;
    let notes: Vec<_> = entries
        .iter()
        .filter(|entry| entry.kind == ScannedEntryKind::Note)
        .collect();

    assert_eq!(notes.len(), 1);
    assert_eq!(notes[0].path, "Research Plan.md");
    assert!(notes[0].content_hash.is_some());
    Ok(())
}

#[test]
fn reads_fixture_note() -> Result<(), VaultError> {
    let (_dir, root) = copied_fixture();
    let session = open_vault(root)?;
    let path = RelativeVaultPath::parse("Research Plan.md")?;
    let note = read_note(&session.descriptor.id, &session.root, &path)?;

    assert_eq!(note.metadata.title, "Research Plan");
    assert!(note.markdown.contains("[[Field Notes]]"));
    Ok(())
}

#[test]
fn saves_note_atomically() -> Result<(), VaultError> {
    let dir = tempfile::tempdir().expect("tempdir");
    let root = dir.path().to_path_buf();
    let session = open_vault(root)?;
    let path = RelativeVaultPath::parse("Field Notes.md")?;
    let output = save_note(
        &session.descriptor.id,
        &session.root,
        &path,
        "# Field Notes\n\nCaptured during research.\n",
        None,
    )?;

    assert_eq!(output.metadata.title, "Field Notes");
    let saved = read_note(&session.descriptor.id, &session.root, &path)?;
    assert_eq!(saved.metadata.content_hash, output.metadata.content_hash);
    Ok(())
}

#[test]
fn rejects_path_traversal() {
    let result = RelativeVaultPath::parse("../outside.md");
    assert!(matches!(result, Err(VaultError::PathEscape(_))));
}

#[test]
fn save_dry_run_skips_disk_write() -> Result<(), VaultError> {
    let dir = tempfile::tempdir().expect("tempdir");
    let root = dir.path().to_path_buf();
    let session = open_vault(root)?;
    let path = RelativeVaultPath::parse("Dry Run.md")?;
    let output = save_note_with_options(
        &session.descriptor.id,
        &session.root,
        &path,
        "# Dry Run\n\n",
        None,
        SaveNoteOptions { dry_run: true },
    )?;

    assert!(output.dry_run);
    assert!(!session.root.resolve_relative(&path)?.exists());
    Ok(())
}

#[test]
fn save_creates_recovery_backup_before_overwrite() -> Result<(), VaultError> {
    let dir = tempfile::tempdir().expect("tempdir");
    let root = dir.path().to_path_buf();
    let session = open_vault(root)?;
    let path = RelativeVaultPath::parse("Recovery.md")?;
    save_note(
        &session.descriptor.id,
        &session.root,
        &path,
        "# Recovery\n\nv1\n",
        None,
    )?;
    save_note(
        &session.descriptor.id,
        &session.root,
        &path,
        "# Recovery\n\nv2\n",
        None,
    )?;

    let recovery_dir = session.root.root().join(".scriptor").join("recovery");
    assert!(recovery_dir.exists());
    assert!(std::fs::read_dir(&recovery_dir).ok().and_then(|mut dir| dir.next()).is_some());
    Ok(())
}
