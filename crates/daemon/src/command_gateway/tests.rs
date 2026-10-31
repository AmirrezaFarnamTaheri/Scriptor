use super::*;

#[test]
fn list_commands_meets_minimum() {
    assert!(list_commands().len() >= 85);
}

#[test]
fn dispatch_health_check_works() {
    let mut state = DaemonState::default();
    let result = dispatch(&mut state, "health_check", &json!({})).expect("health_check");
    assert_eq!(result, json!("ok"));
}

#[test]
fn require_bytes_accepts_valid_byte_array() {
    let payload = json!({ "data": [0, 1, 127, 255] });
    assert_eq!(require_bytes(&payload, "data"), Ok(vec![0, 1, 127, 255]));
}

#[test]
fn require_bytes_rejects_out_of_range_and_non_integer_values() {
    assert!(require_bytes(&json!({ "data": [0, 256] }), "data").is_err());
    assert!(require_bytes(&json!({ "data": [1, -1] }), "data").is_err());
    assert!(require_bytes(&json!({ "data": [1, 1.5] }), "data").is_err());
    assert!(require_bytes(&json!({ "data": [1, "2"] }), "data").is_err());
    assert!(require_bytes(&json!({ "data": "abc" }), "data").is_err());
    assert!(require_bytes(&json!({}), "data").is_err());
}

#[test]
fn read_only_whole_vault_scans_run_outside_lock_and_mutations_do_not() {
    for command in [
        "vault_rename_dry_run",
        "vault_rename_tag_dry_run",
        "vault_rename_section_dry_run",
        "vault_rename_block_dry_run",
        "vault_health",
    ] {
        assert!(
            is_outside_lock_command(command),
            "{command} reads the whole vault and must be dispatched outside the daemon lock"
        );
    }
    for command in ["vault_rename_apply", "vault_lint_fix", "vault_save_note"] {
        assert!(
            !is_outside_lock_command(command),
            "{command} mutates notes and must stay serialized by the daemon lock"
        );
    }
}

#[test]
fn read_only_outside_lock_command_serves_rename_preview_from_cloned_session() {
    let vault = tempfile::tempdir().expect("vault dir");
    fs::write(vault.path().join("alpha.md"), "# Alpha\n").expect("write note");
    let session = scriptor_vault::open_vault(vault.path()).expect("open vault");
    let json = run_read_only_vault_command(
        &session,
        None,
        "vault_rename_dry_run",
        &json!({
            "from_path": "alpha.md",
            "to_path": "beta.md",
            "update_links": false,
        }),
    )
    .expect("rename dry run");
    assert!(
        json.contains("\"affected_files\"") && json.contains("alpha.md"),
        "preview should report the affected source note: {json}"
    );
}

#[test]
fn read_only_outside_lock_health_requires_index_cache() {
    let vault = tempfile::tempdir().expect("vault dir");
    let session = scriptor_vault::open_vault(vault.path()).expect("open vault");
    let error = run_read_only_vault_command(&session, None, "vault_health", &json!({}))
        .expect_err("vault_health needs the index cache");
    assert_eq!(error, "no index cache is open; call OpenVault first");
}

#[test]
fn git_commit_gateway_rejects_stale_and_missing_vault_before_queueing() {
    let vault = tempfile::tempdir().expect("temporary vault");
    let session = scriptor_vault::open_vault(vault.path()).expect("open vault");
    let mut state = DaemonState {
        session: Some(session),
        ..DaemonState::default()
    };

    for payload in [
        json!({
            "files": ["sample.md"],
            "message": "Wrong target",
            "expected_vault_id": "former-vault",
        }),
        json!({
            "files": ["sample.md"],
            "message": "Unknown target",
        }),
    ] {
        let error = dispatch(&mut state, "git_commit_cmd", &payload)
            .expect_err("Git commits without matching vault ownership must be denied");
        assert!(
            error.contains("Git commit vault identity"),
            "wrong or missing vault must fail at identity check, not GitQueue: {error}"
        );
    }
}

#[test]
fn git_commit_gateway_accepts_originating_vault_identity() {
    let vault = tempfile::tempdir().expect("temporary vault");
    let session = scriptor_vault::open_vault(vault.path()).expect("open vault");
    let active_id = session.descriptor.id.clone();
    let state = DaemonState {
        session: Some(session),
        ..DaemonState::default()
    };
    super::require_git_commit_vault_identity(&state, &json!({ "expected_vault_id": active_id }))
        .expect("matching vault identity must be admitted");
}

#[test]
fn history_preview_rejects_missing_and_stale_vault_identity_before_revision_read() {
    let vault_a = tempfile::tempdir().expect("vault A");
    let vault_b = tempfile::tempdir().expect("vault B");
    let session_a = scriptor_vault::open_vault(vault_a.path()).expect("open vault A");
    let session_b = scriptor_vault::open_vault(vault_b.path()).expect("open vault B");
    assert_ne!(session_a.descriptor.id, session_b.descriptor.id);

    let stale_id = session_a.descriptor.id;
    let active_id = session_b.descriptor.id.clone();
    let mut state = DaemonState {
        session: Some(session_b),
        ..DaemonState::default()
    };

    for payload in [
        json!({ "path": "notes/research.md", "revisionId": "old" }),
        json!({ "path": "notes/research.md", "revisionId": "old", "expectedVaultId": stale_id }),
        json!({ "path": "notes/research.md", "revisionId": "old", "expected_vault_id": "" }),
    ] {
        let err = dispatch(&mut state, "vault_read_note_history_revision", &payload).expect_err(
            "a missing, blank or stale origin must not open the active vault's revision",
        );
        assert!(
            err.to_lowercase().contains("vault identity"),
            "preview must fail at the identity boundary, not the filesystem: {err}"
        );
    }

    for key in ["expectedVaultId", "expected_vault_id"] {
        let mut payload = json!({ "path": "notes/research.md", "revisionId": "old" });
        payload[key] = json!(active_id);
        let err = dispatch(&mut state, "vault_read_note_history_revision", &payload)
            .expect_err("this test deliberately uses an absent revision");
        assert!(
            !err.to_lowercase().contains("vault identity"),
            "matching origin must advance to the real revision read: {err}"
        );
    }
}


#[test]
fn direct_gateway_cannot_restore_retained_revision_without_desktop_authorization() {
    let vault = tempfile::tempdir().expect("temporary vault");
    let session = scriptor_vault::open_vault(vault.path()).expect("open vault");
    let vault_id = session.descriptor.id.clone();
    let relative = RelativeVaultPath::parse("note.md").expect("note path");
    let current = scriptor_vault::save_note(
        &vault_id,
        &session.root,
        &relative,
        "# Newer note must survive\n",
        None,
    )
    .expect("write current note");
    let historical = "# Older reviewed content\n";
    let revision = scriptor_vault::append_note_history(
        &session.root,
        "note.md",
        historical,
        &scriptor_vault::content_hash(historical),
    )
    .expect("retain historical note");

    let mut state = DaemonState {
        session: Some(session),
        ..DaemonState::default()
    };
    // This payload mimics a fully reviewed desktop restore. Authorization is
    // still native-only: a daemon caller must not be able to perform the write.
    let payload = json!({
        "path": "note.md",
        "revisionId": revision.id,
        "expectedVaultId": vault_id,
        "expectedRevisionHash": scriptor_vault::content_hash(historical),
        "expectedCurrentHash": current.metadata.content_hash,
    });
    let error = dispatch(&mut state, "vault_restore_note_history_revision", &payload)
        .expect_err("daemon dispatch must reject desktop-only recovery");
    assert!(
        error.contains("desktop authorization"),
        "denial must occur before any history read or filesystem mutation: {error}"
    );
    let session = state.require_session().expect("vault remains open");
    let after = scriptor_vault::read_note(
        &session.descriptor.id,
        &session.root,
        &relative,
    )
    .expect("read unchanged note");
    assert_eq!(after.markdown, "# Newer note must survive\n");
}

#[test]
fn direct_gateway_dispatch_rejects_every_desktop_only_command_before_arguments() {
    let mut state = DaemonState::default();
    for command in [
        "vault_delete_note",
        "vault_lint_fix",
        "vault_restore_note_history_revision",
        "git_pull_cmd",
        "git_push_cmd",
        "git_resolve_conflict_cmd",
        "pdf_translate",
        "plantuml_render",
    ] {
        assert!(requires_desktop_authorization(command), "{command} must stay restricted");
        let error = dispatch(&mut state, command, &json!({}))
            .expect_err("restricted operation must fail at the gateway boundary");
        assert!(
            error.contains("desktop authorization"),
            "{command} must reject before attempting session, paths, or side effects: {error}"
        );
    }
}
