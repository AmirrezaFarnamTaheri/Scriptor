use std::fs;

use super::backup::recover_interrupted_restore;

fn restore_journal(root: &std::path::Path) -> std::path::PathBuf {
    root.join(".scriptor").join("restore-journal")
}

#[test]
fn unreadable_restore_state_preserves_journal() {
    let directory = tempfile::tempdir().expect("tempdir");
    let journal = restore_journal(directory.path());
    fs::create_dir_all(journal.join("state")).expect("state directory");

    let error = recover_interrupted_restore(directory.path())
        .expect_err("a directory cannot be read as the restore state file");

    assert!(error.contains("Failed to read restore journal state"));
    assert!(
        journal.exists(),
        "failed recovery must preserve the journal"
    );
}

#[cfg(unix)]
#[test]
fn linked_restore_state_cannot_drive_rollback_outside_vault_provenance() {
    use std::os::unix::fs::symlink;

    let directory = tempfile::tempdir().expect("tempdir");
    let root = directory.path().join("vault");
    let journal = restore_journal(&root);
    let rollback = journal.join("rollback");
    fs::create_dir_all(&rollback).expect("rollback directory");
    fs::write(root.join("current.md"), "# Current vault\n").expect("current vault note");
    fs::write(rollback.join("original.md"), "# Prior vault\n").expect("rollback snapshot");

    // A copied or tampered journal must not trust a marker reached through an
    // external symlink. Otherwise the foreign "promoting" value can trigger
    // a destructive rollback of the *current* vault.
    let foreign_state = directory.path().join("foreign-restore-state");
    fs::write(&foreign_state, "promoting").expect("foreign state");
    symlink(&foreign_state, journal.join("state")).expect("state symlink");

    let error = recover_interrupted_restore(&root)
        .expect_err("linked restore state must never authorize rollback");
    assert!(
        error.contains("state") && error.contains("regular file"),
        "unexpected recovery error: {error}"
    );
    assert_eq!(
        fs::read_to_string(root.join("current.md")).expect("original vault still intact"),
        "# Current vault\n"
    );
    assert!(!root.join("original.md").exists(), "rollback must not run");
    assert!(journal.exists(), "untrusted journal must remain for inspection");
    assert!(
        fs::symlink_metadata(journal.join("state"))
            .expect("marker retained")
            .file_type()
            .is_symlink()
    );
    assert_eq!(
        fs::read_to_string(&foreign_state).expect("external marker intact"),
        "promoting"
    );
}

#[cfg(unix)]
#[test]
fn rollback_copy_failure_after_clear_preserves_recovery_journal() {
    use std::os::unix::fs::symlink;

    let directory = tempfile::tempdir().expect("tempdir");
    let root = directory.path();
    let journal = restore_journal(root);
    let rollback = journal.join("rollback");
    fs::create_dir_all(&rollback).expect("rollback directory");
    fs::write(root.join("partial.md"), "partial restored generation").expect("partial vault file");
    fs::write(journal.join("state"), "promoting").expect("promoting state");

    // copy_tree deliberately rejects symlinks. This forces the recovery path
    // to fail only after clear_persistent_vault_content has already succeeded.
    symlink("missing-target.md", rollback.join("unsupported-link.md")).expect("rollback symlink");

    let error =
        recover_interrupted_restore(root).expect_err("rollback copy must fail on a symlink");

    assert!(error.contains("Failed to restore rollback snapshot"));
    assert!(
        !root.join("partial.md").exists(),
        "the clear phase must have executed"
    );
    assert!(
        journal.exists(),
        "failed rollback copy must preserve recovery metadata"
    );
    assert_eq!(
        fs::read_to_string(journal.join("state")).expect("state retained"),
        "rollback-in-progress"
    );

    // The durable state records that clearing began. A subsequent vault open
    // must retry this rollback rather than discard its only surviving copy.
    fs::remove_file(rollback.join("unsupported-link.md")).expect("repair rollback snapshot");
    fs::write(rollback.join("original.md"), "# Original\n").expect("rollback note");
    recover_interrupted_restore(root).expect("retry interrupted rollback");
    assert_eq!(
        fs::read_to_string(root.join("original.md")).expect("restored original"),
        "# Original\n"
    );
    assert!(!root.join("partial.md").exists());
    assert!(
        !journal.exists(),
        "successful retry must remove the journal"
    );
}

#[cfg(unix)]
#[test]
fn journal_cleanup_failure_is_reported_and_journal_remains() {
    use std::os::unix::fs::PermissionsExt;

    let directory = tempfile::tempdir().expect("tempdir");
    let root = directory.path();
    let scriptor = root.join(".scriptor");
    let journal = restore_journal(root);
    let rollback = journal.join("rollback");
    fs::create_dir_all(&rollback).expect("rollback directory");
    fs::write(rollback.join("original.md"), "# Original\n").expect("rollback note");
    fs::write(journal.join("state"), "promoting").expect("promoting state");

    // The vault root remains writable so rollback promotion succeeds. Removing
    // the journal, however, requires write permission on its `.scriptor`
    // parent and therefore fails on the unprivileged CI runner.
    let mut permissions = fs::metadata(&scriptor).expect("metadata").permissions();
    let original_mode = permissions.mode();
    permissions.set_mode(0o555);
    fs::set_permissions(&scriptor, permissions).expect("make .scriptor readonly");

    let result = recover_interrupted_restore(root);

    let mut restore_permissions = fs::metadata(&scriptor)
        .expect("metadata after recovery")
        .permissions();
    restore_permissions.set_mode(original_mode);
    fs::set_permissions(&scriptor, restore_permissions).expect("restore permissions");

    let error = result.expect_err("journal removal should fail when its parent is readonly");
    assert!(error.contains("Failed to remove completed restore journal"));
    assert!(
        journal.exists(),
        "cleanup failure must leave the journal available for retry"
    );
    assert_eq!(
        fs::read_to_string(root.join("original.md")).expect("rollback was promoted"),
        "# Original\n"
    );
}
