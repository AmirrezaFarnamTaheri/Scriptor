//! Native opt-in access to the vault-scoped collaboration outbox.
//! No network traffic and no renderer-callable acknowledgement function.
use std::collections::HashMap;
use std::sync::{
    Arc, Mutex,
    atomic::{AtomicBool, AtomicU64, Ordering},
};

use base64::Engine as _;
use scriptor_vault::{RelativeVaultPath, SaveNoteOptions, SaveNoteOutput, VaultUpdateLock, content_hash, read_note, save_note_with_options, try_lock_vault_update};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::collaboration_live_journal::{JournalScope, LocalJournal};
use crate::authorization::{SensitiveOperation, require_sensitive_operation};
use crate::state::{AppState, active_session, lock_recover};

const MAX_LOCAL_SESSIONS: usize = 8;
const MAX_BASE64_UPDATE_LENGTH: usize = (256 * 1024 / 3 + 1) * 4 + 4;

#[derive(Clone)]
pub(crate) struct LiveSessionLease {
    pub(crate) scope: JournalScope,
    pub(crate) journal: Arc<Mutex<LocalJournal>>,
    /// Lifetime-held OS lock prevents a second installed Scriptor from claiming
    /// this note's canonical file projection; released only with final lease.
    pub(crate) _projection_owner: Arc<VaultUpdateLock>,
    pub(crate) relay_generation: Arc<AtomicU64>,
    pub(crate) relay_active: Arc<AtomicBool>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LiveStartRequest {
    expected_vault_id: String,
    room_id: String,
    document_id: String,
    epoch: u64,
    peer_id: String,
    note_path: String,
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

fn scope_owns_note(scope: &JournalScope, vault_id: &str, note_path: &str) -> bool {
    scope.vault_id == vault_id && scope.note_path == note_path
}

/// Prevent normal autosave/daemon writes from racing a native collaborative
/// source owner. This is a fail-closed safeguard, not yet a CAS projector.
pub(crate) fn reject_if_live_owned(
    state: &AppState,
    vault_id: &str,
    note_path: &str,
) -> Result<(), String> {
    let leases = lock_recover(&state.live_collaboration_sessions, "collaboration leases");
    if leases
        .values()
        .any(|lease| scope_owns_note(&lease.scope, vault_id, note_path))
    {
        return Err(
            "Live collaboration owns this Markdown note; ordinary save is disabled".into(),
        );
    }
    Ok(())
}

fn approval_scope(scope: &JournalScope) -> String {
    format!(
        "live:{}:{}:{}:{}",
        scope.room_id, scope.document_id, scope.epoch, scope.note_path
    )
}

pub(crate) fn lease_for(
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
    request: LiveStartRequest,
    authorization_token: String,
) -> Result<LiveStartReceipt, String> {
    let LiveStartRequest {
        expected_vault_id,
        room_id,
        document_id,
        epoch,
        peer_id,
        note_path,
    } = request;
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
    let relative = RelativeVaultPath::parse(&scope.note_path).map_err(|error| error.to_string())?;
    let document =
        read_note(&scope.vault_id, &session.root, &relative).map_err(|error| error.to_string())?;
    require_sensitive_operation(
        &state,
        &authorization_token,
        SensitiveOperation::LiveCollaborationStart,
        Some(&approval_scope(&scope)),
        Some(&scope.vault_id),
    )?;
    let mut journal = LocalJournal::open(session.root.root())?;
    let begin = journal.begin(&scope, &document.metadata.content_hash)?;
    let ownership_key = scriptor_vault::hash::path_hash(&scope.note_path);
    let ownership_target = session.root.root().join(".scriptor")
        .join("collaboration").join(format!("live-owner-{ownership_key}"));
    let file_owner = try_lock_vault_update(&ownership_target)
        .map_err(|error| error.to_string())?
        .ok_or("Another Scriptor process already owns this live note's file projection")?;
    let session_id = Uuid::new_v4().to_string();
    let mut leases = lock_recover(&state.live_collaboration_sessions, "collaboration leases");
    if leases.len() >= MAX_LOCAL_SESSIONS {
        return Err("Local collaboration session limit reached".into());
    }
    if leases.values().any(|existing| {
        scope_owns_note(&existing.scope, &scope.vault_id, &scope.note_path)
    }) {
        return Err("Live collaboration already has an owner for this note".into());
    }
    leases.insert(
        session_id.clone(),
        LiveSessionLease {
            scope,
            journal: Arc::new(Mutex::new(journal)),
            _projection_owner: Arc::new(file_owner),
            relay_generation: Arc::new(AtomicU64::new(0)),
            relay_active: Arc::new(AtomicBool::new(false)),
        },
    );
    Ok(LiveStartReceipt {
        session_id,
        baseline_hash: begin.baseline_hash,
        file_diverged: begin.file_diverged,
        pending_count: begin.pending_count,
    })
}

/// This is a public Ed25519 registration credential. The corresponding
/// private key stays in the OS keychain and is never returned to the renderer.
#[tauri::command]
pub fn collaboration_live_public_key(
    state: tauri::State<AppState>,
    expected_vault_id: String,
    session_id: String,
) -> Result<String, String> {
    let session = active_session(&state)?;
    super::vault::validate_expected_vault(&session.descriptor.id, Some(&expected_vault_id))?;
    let lease = {
        let leases = lock_recover(&state.live_collaboration_sessions, "collaboration leases");
        lease_for(&leases, &session_id, &expected_vault_id)?
    };
    super::collaboration_live_identity::public_key_pem(&lease.scope)
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
    let relative =
        RelativeVaultPath::parse(&lease.scope.note_path).map_err(|error| error.to_string())?;
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

/// Only the owner of the native approved note may materialize canonical text.
/// Scriptor's standard vault CAS, backup and note-history protections remain
/// authoritative. A crash after a file save but before journal advancement
/// leaves the outbox intact and requires a safe, exact-content retry.
#[tauri::command]
pub fn collaboration_live_project(
    state: tauri::State<AppState>,
    expected_vault_id: String,
    session_id: String,
    markdown: String,
    expected_content_hash: String,
) -> Result<SaveNoteOutput, String> {
    if markdown.len() > 2 * 1024 * 1024
        || expected_content_hash.len() != 64
        || !expected_content_hash.bytes().all(|byte| byte.is_ascii_hexdigit())
    {
        return Err("Invalid or oversized collaboration projection".into());
    }
    let session = active_session(&state)?;
    super::vault::validate_expected_vault(&session.descriptor.id, Some(&expected_vault_id))?;
    let lease = {
        let leases = lock_recover(&state.live_collaboration_sessions, "collaboration leases");
        lease_for(&leases, &session_id, &expected_vault_id)?
    };
    let mut journal = lock_recover(&lease.journal, "collaboration local journal");
    if journal.projected_baseline(&lease.scope)? != expected_content_hash {
        return Err("Collaboration projection baseline changed; refusing stale overwrite".into());
    }
    let relative =
        RelativeVaultPath::parse(&lease.scope.note_path).map_err(|error| error.to_string())?;
    let current = read_note(&lease.scope.vault_id, &session.root, &relative)
        .map_err(|error| error.to_string())?;
    let next_hash = content_hash(&markdown);
    let receipt = if current.metadata.content_hash == expected_content_hash {
        save_note_with_options(
            &lease.scope.vault_id,
            &session.root,
            &relative,
            &markdown,
            Some(&expected_content_hash),
            SaveNoteOptions { dry_run: false },
        ).map_err(|error| error.to_string())?
    } else if current.metadata.content_hash == next_hash {
        // Idempotent restart recovery. The file is byte-identical to the
        // requested projection, so advancing the baseline cannot overwrite
        // another author's data or produce a duplicate history entry.
        SaveNoteOutput {
            metadata: current.metadata,
            previous_content_hash: Some(expected_content_hash.clone()),
            dry_run: false,
        }
    } else {
        return Err("Collaboration source changed externally; retain journal and resolve conflict".into());
    };
    if !journal.advance_projected_baseline(&lease.scope, &expected_content_hash, &next_hash)? {
        return Err("Collaboration projection journal CAS failed; retain recovery data".into());
    }
    Ok(receipt)
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
    if let Some(existing) = leases.get(&session_id)
        && existing.scope.vault_id != expected_vault_id
    {
        return Err("Live collaboration session belongs to another vault".into());
    }
    if let Some(lease) = leases.remove(&session_id) {
        lease.relay_generation.fetch_add(1, Ordering::AcqRel);
        lease.relay_active.store(false, Ordering::Release);
        Ok(true)
    } else {
        Ok(false)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn local_file_can_have_only_one_collaboration_owner() {
        let owned = JournalScope {
            vault_id: "vault_A".into(),
            room_id: "room_one".into(),
            document_id: "doc_one".into(),
            epoch: 2,
            peer_id: "peer_one".into(),
            note_path: "notes/owner.md".into(),
        };
        assert!(scope_owns_note(&owned, "vault_A", "notes/owner.md"));
        assert!(!scope_owns_note(&owned, "vault_B", "notes/owner.md"));
        assert!(!scope_owns_note(&owned, "vault_A", "notes/other.md"));
    }

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
