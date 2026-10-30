use scriptor_vault::{
    RelativeVaultPath, SaveNoteOptions, SaveNoteOutput, read_note, read_note_history_revision,
    save_note_with_options,
};

use crate::authorization::{SensitiveOperation, require_sensitive_operation};
use crate::state::{AppState, active_session};

/// A reviewed revision is immutable for this approval. Read the actual source
/// bytes again and reject any missing or changed provenance before writing.
fn validate_reviewed_revision_hash(markdown: &str, expected_hash: &str) -> Result<(), String> {
    if expected_hash.trim().is_empty() {
        return Err("Missing reviewed revision hash. Review the revision again.".into());
    }
    if scriptor_vault::content_hash(markdown) != expected_hash {
        return Err("The reviewed historical revision changed since preview. Review again.".into());
    }
    Ok(())
}

/// Restore a historical revision only if the note has not changed since this
/// command observed its current content hash. A concurrent save between the
/// read and write is rejected by the vault's optimistic-concurrency guard.
#[tauri::command]
pub fn vault_restore_note_history_revision(
    state: tauri::State<AppState>,
    path: String,
    revision_id: String,
    authorization_token: String,
    expected_vault_id: String,
    expected_revision_hash: String,
) -> Result<SaveNoteOutput, String> {
    let session = active_session(&state)?;
    // Reject a vault switch before consuming sensitive authorization or reading files.
    crate::commands::vault::validate_expected_vault(
        &session.descriptor.id,
        Some(&expected_vault_id),
    )?;
    require_sensitive_operation(
        &state,
        &authorization_token,
        SensitiveOperation::RestoreHistory,
        Some(&path),
        Some(&session.descriptor.id),
    )?;
    let relative = RelativeVaultPath::parse(&path).map_err(|error| error.to_string())?;
    let current = read_note(&session.descriptor.id, &session.root, &relative)
        .map_err(|error| error.to_string())?;
    let historical_markdown = read_note_history_revision(&session.root, &path, &revision_id)
        .map_err(|error| error.to_string())?;
    validate_reviewed_revision_hash(&historical_markdown, &expected_revision_hash)?;

    save_note_with_options(
        &session.descriptor.id,
        &session.root,
        &relative,
        &historical_markdown,
        Some(&current.metadata.content_hash),
        SaveNoteOptions { dry_run: false },
    )
    .map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::validate_reviewed_revision_hash;
    use scriptor_vault::content_hash;

    #[test]
    fn reviewed_revision_exact_hash_is_accepted() {
        let markdown = "# Original note\n";
        let hash = content_hash(markdown);
        assert!(validate_reviewed_revision_hash(markdown, &hash).is_ok());
    }

    #[test]
    fn changed_revision_bytes_are_refused_before_restore() {
        let previously_reviewed = "# Original note\n";
        let changed = "# Tampered note\n";
        let hash = content_hash(previously_reviewed);
        let result = validate_reviewed_revision_hash(changed, &hash);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("changed"));
    }

    #[test]
    fn missing_reviewed_hash_cannot_authorize_restore() {
        assert!(validate_reviewed_revision_hash("# Note\n", "").is_err());
    }
}
