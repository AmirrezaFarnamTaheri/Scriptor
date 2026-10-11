use scriptor_mobile_runtime::{EngineRuntime, MobileRuntime, RuntimeError};

#[test]
fn markdown_survives_restart_and_search_reads_disk_authority() {
    let dir = tempfile::tempdir().unwrap();
    let runtime = MobileRuntime::open(dir.path()).unwrap();
    let scope = runtime.scope();
    let saved = runtime
        .save(scope, "Research/paper.md", "# Paper\nEvidence", "<missing>")
        .unwrap();
    assert_eq!(
        runtime.read(scope, "Research/paper.md").unwrap().markdown,
        "# Paper\nEvidence"
    );
    assert_eq!(runtime.search(scope, "Evidence").unwrap().notes.len(), 1);
    let again = MobileRuntime::open(dir.path()).unwrap();
    assert_eq!(
        again
            .read(again.scope(), "Research/paper.md")
            .unwrap()
            .metadata
            .content_hash,
        saved.metadata.content_hash
    );
}

#[test]
fn background_and_cancel_invalidate_scope_without_destroying_files() {
    let dir = tempfile::tempdir().unwrap();
    let runtime = MobileRuntime::open(dir.path()).unwrap();
    let old = runtime.scope();
    runtime.save(old, "a.md", "original", "<missing>").unwrap();
    runtime.set_foreground(false);
    assert!(matches!(
        runtime.read(old, "a.md"),
        Err(RuntimeError::Inactive)
    ));
    runtime.set_foreground(true);
    assert!(matches!(
        runtime.save(old, "a.md", "lost", "<missing>"),
        Err(RuntimeError::Cancelled)
    ));
    let current = runtime.scope();
    runtime.cancel();
    assert!(matches!(
        runtime.search(current, ""),
        Err(RuntimeError::Cancelled)
    ));
    assert_eq!(
        runtime.read(runtime.scope(), "a.md").unwrap().markdown,
        "original"
    );
}

#[test]
fn stale_save_traversal_and_internal_paths_are_rejected() {
    let dir = tempfile::tempdir().unwrap();
    let runtime = MobileRuntime::open(dir.path()).unwrap();
    let scope = runtime.scope();
    runtime
        .save(scope, "a.md", "original", "<missing>")
        .unwrap();
    for path in [
        "../escape.md",
        ".scriptor/config.md",
        "image.png",
        "folder/.git/a.md",
    ] {
        assert!(runtime.save(scope, path, "bad", "<missing>").is_err());
    }
    assert!(
        runtime
            .save(scope, "a.md", "overwrite", "<missing>")
            .is_err()
    );
    assert!(runtime.save(scope, "a.md", "overwrite", "").is_err());
    assert_eq!(runtime.read(scope, "a.md").unwrap().markdown, "original");
}

#[test]
fn revisions_are_real_and_restore_has_compare_and_swap_guard() {
    let dir = tempfile::tempdir().unwrap();
    let runtime = MobileRuntime::open(dir.path()).unwrap();
    let scope = runtime.scope();
    let first = runtime.save(scope, "a.md", "first", "<missing>").unwrap();
    let second = runtime
        .save(scope, "a.md", "second", &first.metadata.content_hash)
        .unwrap();
    let history = runtime.history(scope, "a.md").unwrap();
    assert!(!history.is_empty());
    assert_eq!(
        runtime.revision(scope, "a.md", &history[0].id).unwrap(),
        "first"
    );
    assert!(
        runtime
            .restore(scope, "a.md", &history[0].id, &first.metadata.content_hash)
            .is_err()
    );
    runtime
        .restore(scope, "a.md", &history[0].id, &second.metadata.content_hash)
        .unwrap();
    assert_eq!(runtime.read(scope, "a.md").unwrap().markdown, "first");
}

#[test]
fn oversized_notes_and_queries_fail_closed() {
    let dir = tempfile::tempdir().unwrap();
    let runtime = MobileRuntime::open(dir.path()).unwrap();
    let scope = runtime.scope();
    let too_large = "a".repeat(scriptor_mobile_runtime::MAX_NOTE_BYTES as usize + 1);
    assert!(matches!(
        runtime.save(scope, "large.md", &too_large, "<missing>"),
        Err(RuntimeError::Limit(_))
    ));
    std::fs::write(dir.path().join("large.md"), too_large).unwrap();
    assert!(matches!(
        runtime.read(scope, "large.md"),
        Err(RuntimeError::Limit(_))
    ));
    assert!(runtime.search(scope, "").unwrap().truncated);
    assert!(runtime.search(scope, &"x".repeat(513)).is_err());
}

#[test]
fn listing_reports_truncation_instead_of_claiming_complete_results() {
    let dir = tempfile::tempdir().unwrap();
    for index in 0..101 {
        std::fs::write(dir.path().join(format!("{index}.md")), "# note").unwrap();
    }
    let runtime = MobileRuntime::open(dir.path()).unwrap();
    let results = runtime.search(runtime.scope(), "").unwrap();
    assert_eq!(results.notes.len(), 100);
    assert!(results.truncated);
}
