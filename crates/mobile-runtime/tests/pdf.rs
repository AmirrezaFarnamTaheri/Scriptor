#![cfg(feature = "pdf")]
use scriptor_mobile_runtime::{EngineRuntime, MobileRuntime};

#[test]
fn exports_saved_source_as_real_pdf_and_rejects_stale_hashes() {
    let dir = tempfile::tempdir().unwrap();
    let runtime = MobileRuntime::open(dir.path()).unwrap();
    let scope = runtime.scope();
    let note = runtime
        .save(
            scope,
            "Research/paper.md",
            "# Offline paper\n\nEvidence with **emphasis**.",
            "<missing>",
        )
        .unwrap();
    assert!(
        runtime
            .export_pdf(scope, "Research/paper.md", "old")
            .is_err()
    );
    let pdf = runtime
        .export_pdf(scope, "Research/paper.md", &note.metadata.content_hash)
        .unwrap();
    assert!(pdf.bytes.starts_with(b"%PDF-"));
    assert_eq!(pdf.page_count, 1);
    assert!(pdf.filename.ends_with(".pdf"));
    assert!(
        !dir.path().join(".scriptor/exports").exists(),
        "runtime compiler does not publish an unapproved destination"
    );
    runtime.cancel();
    assert!(
        runtime
            .export_pdf(scope, "Research/paper.md", &note.metadata.content_hash)
            .is_err()
    );
}

#[test]
fn rejects_missing_remote_and_internal_image_resources_before_publication() {
    let dir = tempfile::tempdir().unwrap();
    let runtime = MobileRuntime::open(dir.path()).unwrap();
    let scope = runtime.scope();
    for (index, body) in [
        "![remote](https://example.com/a.png)",
        "![missing](missing.png)",
        "![private](.scriptor/secret.png)",
    ]
    .iter()
    .enumerate()
    {
        let path = format!("{index}.md");
        let saved = runtime.save(scope, &path, body, "<missing>").unwrap();
        assert!(
            runtime
                .export_pdf(scope, &path, &saved.metadata.content_hash)
                .is_err()
        );
    }
}
