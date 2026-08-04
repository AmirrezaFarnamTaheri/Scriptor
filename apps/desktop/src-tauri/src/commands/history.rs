use scriptor_vault::{
    read_note, read_note_history_revision, save_note_with_options, RelativeVaultPath,
    SaveNoteOptions, SaveNoteOutput,
};

use crate::authorization::{require_sensitive_operation, SensitiveOperation};
use crate::state::{active_session, AppState};

/// Restore a historical revision only if the note has not changed since this
/// command observed its current content hash. A concurrent save between the
/// read and write is rejected by the vault's optimistic-concurrency guard.
#[tauri::command]
pub fn vault_restore_note_history_revision(
    state: tauri::State<AppState>,
    path: String,
    revision_id: String,
    authorization_token: String,
) -> Result<SaveNoteOutput, String> {
    require_sensitive_operation(
        &state,
        &authorization_token,
        SensitiveOperation::RestoreHistory,
        Some(&path),
    )?;
    let session = active_session(&state)?;
    let relative = RelativeVaultPath::parse(&path).map_err(|error| error.to_string())?;
    let current = read_note(&session.descriptor.id, &session.root, &relative)
        .map_err(|error| error.to_string())?;
    let historical_markdown = read_note_history_revision(&session.root, &path, &revision_id)
        .map_err(|error| error.to_string())?;

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
