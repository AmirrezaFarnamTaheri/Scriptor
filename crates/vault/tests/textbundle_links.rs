use scriptor_vault::{RelativeVaultPath, export_text_bundle, open_vault};

fn vault_with_note() -> (tempfile::TempDir, scriptor_vault::VaultSession) {
    let dir = tempfile::tempdir().unwrap();
    std::fs::write(dir.path().join("a.md"), "# Title\n\nbody\n").unwrap();
    let session = open_vault(dir.path()).unwrap();
    (dir, session)
}

#[test]
fn export_overwrites_an_existing_regular_archive() {
    let (_vault_dir, session) = vault_with_note();
    let out_dir = tempfile::tempdir().unwrap();
    let out = out_dir.path().join("a.textpack");
    std::fs::write(&out, vec![b'x'; 64 * 1024]).unwrap();
    let note = RelativeVaultPath::parse("a.md").unwrap();
    export_text_bundle(&session.descriptor.id, &session.root, &note, &out).unwrap();
    let bytes = std::fs::read(&out).unwrap();
    assert_eq!(&bytes[..2], b"PK");
    assert!(bytes.len() < 64 * 1024, "stale tail was truncated");
}

#[cfg(unix)]
#[test]
fn export_never_truncates_through_a_planted_symlink() {
    let (_vault_dir, session) = vault_with_note();
    let out_dir = tempfile::tempdir().unwrap();
    let victim = out_dir.path().join("victim.txt");
    std::fs::write(&victim, "keep me").unwrap();
    let link = out_dir.path().join("a.textpack");
    std::os::unix::fs::symlink(&victim, &link).unwrap();
    let note = RelativeVaultPath::parse("a.md").unwrap();
    assert!(export_text_bundle(&session.descriptor.id, &session.root, &note, &link).is_err());
    assert_eq!(std::fs::read_to_string(&victim).unwrap(), "keep me");
}
