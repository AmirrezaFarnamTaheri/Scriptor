use scriptor_vault::{
    RelativeVaultPath, VaultError, open_vault, read_note, write_frontmatter_field,
};

#[test]
fn a_loaded_cell_cannot_overwrite_a_newer_note() {
    let dir = tempfile::tempdir().unwrap();
    std::fs::write(
        dir.path().join("note.md"),
        "---\nstatus: draft\n---\nBody\n",
    )
    .unwrap();
    let session = open_vault(dir.path()).unwrap();
    let path = RelativeVaultPath::parse("note.md").unwrap();
    let loaded = read_note(&session.descriptor.id, &session.root, &path).unwrap();
    let newer = "---\nstatus: reviewed\n---\nNew body\n";
    std::fs::write(dir.path().join("note.md"), newer).unwrap();
    let result = write_frontmatter_field(
        &session.descriptor.id,
        &session.root,
        &path,
        "status",
        "published",
        Some(&loaded.metadata.content_hash),
    );
    assert!(matches!(result, Err(VaultError::HashMismatch { .. })));
    assert_eq!(
        std::fs::read_to_string(dir.path().join("note.md")).unwrap(),
        newer
    );
    let current = read_note(&session.descriptor.id, &session.root, &path).unwrap();
    let saved = write_frontmatter_field(
        &session.descriptor.id,
        &session.root,
        &path,
        "status",
        "published",
        Some(&current.metadata.content_hash),
    )
    .unwrap();
    assert!(saved.markdown.contains("status: published"));
    assert!(saved.markdown.ends_with("New body\n"));
}

#[test]
fn a_cell_value_cannot_inject_another_field_or_note_body() {
    let dir = tempfile::tempdir().unwrap();
    std::fs::write(dir.path().join("note.md"), "Body\n").unwrap();
    let session = open_vault(dir.path()).unwrap();
    let path = RelativeVaultPath::parse("note.md").unwrap();
    for (field, value) in [
        ("status\npublish", "true"),
        ("status", "draft\npublish: true"),
        ("status:", "true"),
    ] {
        assert!(
            write_frontmatter_field(
                &session.descriptor.id,
                &session.root,
                &path,
                field,
                value,
                None
            )
            .is_err()
        );
    }
    assert_eq!(
        std::fs::read_to_string(dir.path().join("note.md")).unwrap(),
        "Body\n"
    );
}
