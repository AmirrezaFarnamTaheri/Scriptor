//! Native opt-in access to the vault-scoped collaboration outbox.
//! No network traffic and no renderer-callable acknowledgement function.
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use base64::Engine as _;
use serde::Serialize;
use scriptor_vault::{RelativeVaultPath, read_note};
use uuid::Uuid;

use super::collaboration_live_journal::{JournalScope, LocalJournal};
use crate::authorization::{SensitiveOperation, require_sensitive_operation};
use crate::state::{AppState, active_session, lock_recover};

const MAX_LOCAL_SESSIONS: usize = 8;
const MAX_BASE64_UPDATE_LENGTH: usize = (256 * 1024 / 3 + 1) * 4 + 4;

#[derive(Clone)]
pub(crate) struct LiveSessionLease {
    scope: JournalScope,
    journal: Arc<Mutex<LocalJournal>>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LiveStartReceipt {
    session_id: String,
    baseline_hash: String,
    file_diverged: bool,
    pending_count: i64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LiveAppendReceipt {
    duplicate: bool,
    locally_durable: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LivePendingUpdate {
    message_id: String,
    client_seq: i64,
    payload: String,
}

fn approval_scope(scope: &JournalScope) -> String {
    format!(
        "live:{}:{}:{}:{}",
        scope.room_id, scope.document_id, scope.epoch, scope.note_path
    )
}

fn lease_for(
    leases: &HashMap<String, LiveSessionLease>,
    session_id: &str,
    expected_vault_id: &str,
) -> Result<LiveSessionLease, String> {
    if session_id.len() != 36 || !session_id.is_ascii() {
        return Err("Invalid live collaboration session token".into());
    }
    let lease = leases
        .get(session_id)
        .ok_or("Live collaboration session is missing or stopped")?;
    if expected_vault_id != lease.scope.vault_id {
        return Err("Live collaboration session belongs to another vault".into());
    }
    Ok(lease.clone())
}

/// Requires a one-shot native approval for the selected Markdown note.
/// A restart or vault switch invalidates the lease but not its persisted data.
#[tauri::command]
pub fn collaboration_live_start(
    state: tauri::State<AppState>,
    expected_vault_id: String,
    room_id: String,
    document_id: String,
    epoch: u64,
    peer_id: String,
    note_path: String,
    authorization_token: String,
) -> Result<LiveStartReceipt, String> {
    let session = active_session(&state)?;
    super::vault::validate_expected_vault(&session.descriptor.id, Some(&expected_vault_id))?;
    let scope = JournalScope {
        vault_id: session.descriptor.id.clone(),
        room_id,
        document_id,
        epoch,
        peer_id,
        note_path,
    };
    scope.validate()?;
    {
        let leases = lock_recover(&state.live_collaboration_sessions, "collaboration leases");
        if leases.len() >= MAX_LOCAL_SESSIONS {
            return Err("Local collaboration session limit reached".into());
        }
    }
    let relative = RelativeVaultPath::parse(&scope.note_path)
        .map_err(|error| error.to_string())?;
    let document = read_note(&scope.vault_id, &session.root, &relative)
        .map_err(|error| error.to_string())?;
    require_sensitive_operation(
        &state,
        &authorization_token,
        SensitiveOperation::LiveCollaborationStart,
        Some(&approval_scope(&scope)),
        Some(&scope.vault_id),
    )?;
    let mut journal = LocalJournal::open(session.root.root())?;
    let begin = journal.begin(&scope, &document.metadata.content_hash)?;
    let session_id = Uuid::new_v4().to_string();
    let mut leases = lock_recover(&state.live_collaboration_sessions, "collaboration leases");
    if leases.len() >= MAX_LOCAL_SESSIONS {
        return Err("Local collaboration session limit reached".into());
    }
    leases.insert(
        session_id.clone(),
        LiveSessionLease {
            scope,
            journal: Arc::new(Mutex::new(journal)),
        },
    );
    Ok(LiveStartReceipt {
        session_id,
        baseline_hash: begin.baseline_hash,
        file_diverged: begin.file_diverged,
        pending_count: begin.pending_count,
    })
}

/// An update is accepted only after its SQLite FULL/WAL transaction commits.
/// This is a local durable receipt, not an acknowledgement from the relay.
#[tauri::command]
pub fn collaboration_live_append(
    state: tauri::State<AppState>,
    expected_vault_id: String,
    session_id: String,
    message_id: String,
    client_seq: u64,
    payload: String,
) -> Result<LiveAppendReceipt, String> {
    if payload.len() > MAX_BASE64_UPDATE_LENGTH {
        return Err("Local collaboration update exceeds its payload limit".into());
    }
    let session = active_session(&state)?;
    super::vault::validate_expected_vault(&session.descriptor.id, Some(&expected_vault_id))?;
    let lease = {
        let leases = lock_recover(&state.live_collaboration_sessions, "collaboration leases");
        lease_for(&leases, &session_id, &expected_vault_id)?
    };
    let decoded = base64::engine::general_purpose::STANDARD
        .decode(payload.as_bytes())
        .map_err(|_| "Invalid collaboration update encoding")?;
    if decoded.is_empty()
        || decoded.len() > 256 * 1024
        || base64::engine::general_purpose::STANDARD.encode(&decoded) != payload
    {
        return Err("Invalid collaboration update payload".into());
    }
    let relative = RelativeVaultPath::parse(&lease.scope.note_path)
        .map_err(|error| error.to_string())?;
    let document = read_note(&lease.scope.vault_id, &session.root, &relative)
        .map_err(|error| error.to_string())?;
    let mut journal = lock_recover(&lease.journal, "collaboration local journal");
    let result = journal.append(
        &lease.scope,
        &document.metadata.content_hash,
        &message_id,
        client_seq,
        &decoded,
    )?;
    Ok(LiveAppendReceipt {
        duplicate: result.duplicate,
        locally_durable: result.locally_durable,
    })
}

/// Replay never clears local data. Re-authorization for the same document is
/// required after a process restart, and a switched vault rejects stale IDs.
#[tauri::command]
pub fn collaboration_live_pending(
    state: tauri::State<AppState>,
    expected_vault_id: String,
    session_id: String,
    after_sequence: u64,
) -> Result<Vec<LivePendingUpdate>, String> {
    let session = active_session(&state)?;
    super::vault::validate_expected_vault(&session.descriptor.id, Some(&expected_vault_id))?;
    let lease = {
        let leases = lock_recover(&state.live_collaboration_sessions, "collaboration leases");
        lease_for(&leases, &session_id, &expected_vault_id)?
    };
    let journal = lock_recover(&lease.journal, "collaboration local journal");
    let pending = journal.pending(&lease.scope, after_sequence)?;
    Ok(pending
        .into_iter()
        .map(|update| LivePendingUpdate {
            message_id: update.message_id,
            client_seq: update.client_seq,
            payload: base64::engine::general_purpose::STANDARD.encode(update.payload),
        })
        .collect())
}

/// Stop drops only this process-local lease, retaining unsent journal entries.
#[tauri::command]
pub fn collaboration_live_stop(
    state: tauri::State<AppState>,
    expected_vault_id: String,
    session_id: String,
) -> Result<bool, String> {
    let session = active_session(&state)?;
    super::vault::validate_expected_vault(&session.descriptor.id, Some(&expected_vault_id))?;
    let mut leases = lock_recover(&state.live_collaboration_sessions, "collaboration leases");
    if let Some(existing) = leases.get(&session_id) {
        if existing.scope.vault_id != expected_vault_id {
            return Err("Live collaboration session belongs to another vault".into());
        }
    }
    Ok(leases.remove(&session_id).is_some())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn approval_scope_binds_the_selected_room_document_epoch_and_path() {
        let scope = JournalScope {
            vault_id: "vault".into(),
            room_id: "room".into(),
            document_id: "doc".into(),
            epoch: 7,
            peer_id: "alice".into(),
            note_path: "nested/file.md".into(),
        };
        assert_eq!(approval_scope(&scope), "live:room:doc:7:nested/file.md");
    }

    #[test]
    fn an_unknown_session_token_is_not_a_read_capability() {
        let empty: HashMap<String, LiveSessionLease> = HashMap::new();
        assert!(lease_for(&empty, "missing", "vault_B").is_err());
    }
}
