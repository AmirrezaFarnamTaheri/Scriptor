use scriptor_vault::{
    read_note, read_note_history_revision, save_note_with_options, RelativeVaultPath,
    SaveNoteOptions, SaveNoteOutput,
};

use crate::state::{active_session, AppState};

/// Restore a historical revision only if the note has not changed since this
/// command observed its current content hash. This closes the race where a
/// concurrent save could