//! Crash-safe, vault-scoped outbox for opaque local CRDT operations.
//! No renderer-callable acknowledgement API: only a future native, authenticated
//! relay transport may remove or confirm locally durable operations.
use std::fs::{self, OpenOptions};
use std::path::Path;
#[cfg(test)]
use std::path::PathBuf;
use std::time::Duration;

#[cfg(unix)]
use std::os::unix::fs::{DirBuilderExt, OpenOptionsExt, PermissionsExt};

use rusqlite::{Connection, OptionalExtension, TransactionBehavior, params};

const MAX_UPDATE_BYTES: usize = 256 * 1024;
const MAX_PENDING_BYTES: i64 = 64 * 1024 * 1024;
const PAGE_BYTES: usize = 1024 * 1024;
const MAX_PAGE_ROWS: usize = 64;

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct JournalScope {
    pub vault_id: String,
    pub room_id: String,
    pub document_id: String,
    pub epoch: u64,
    pub peer_id: String,
    pub note_path: String,
}

impl JournalScope {
    pub(crate) fn validate(&self) -> Result<(), String> {
        for id in [
            &self.vault_id,
            &self.room_id,
            &self.document_id,
            &self.peer_id,
        ] {
            if id.is_empty()
                || id.len() > 160
                || !id
                    .bytes()
                    .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_'))
            {
                return Err("Invalid collaboration scope identity".into());
            }
        }
        if self.epoch == 0 || self.epoch > i64::MAX as u64 {
            return Err("Invalid collaboration document epoch".into());
        }
        if self.note_path.len() > 1024
            || !self.note_path.ends_with(".md")
            || self.note_path.chars().any(char::is_control)
        {
            return Err("Only bounded Markdown note paths can be shared".into());
        }
        scriptor_vault::RelativeVaultPath::parse(&self.note_path)
            .map_err(|_| "Collaboration note path is not vault relative".to_string())?;
        Ok(())
    }
}

#[derive(Debug, PartialEq, Eq)]
pub(crate) struct JournalBegin {
    pub baseline_hash: String,
    pub file_diverged: bool,
    pub pending_count: i64,
}

#[derive(Debug, PartialEq, Eq)]
pub(crate) struct JournalAppend {
    pub duplicate: bool,
    pub locally_durable: bool,
}

#[derive(Debug, PartialEq, Eq)]
pub(crate) struct PendingOperation {
    pub message_id: String,
    pub client_seq: i64,
    pub payload: Vec<u8>,
}

pub(crate) struct LocalJournal {
    connection: Connection,
    #[cfg(test)]
    path: PathBuf,
}

fn create_private_directory(path: &Path, private: bool) -> Result<(), String> {
    #[cfg(not(unix))]
    let _ = private;
    match fs::symlink_metadata(path) {
        Ok(metadata) => {
            if !metadata.is_dir() || metadata.file_type().is_symlink() {
                return Err("Collaboration storage path is not a real directory".into());
            }
            #[cfg(unix)]
            if private && metadata.permissions().mode() & 0o077 != 0 {
                return Err("Collaboration storage directory is not private".into());
            }
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            #[cfg(unix)]
            let mut builder = fs::DirBuilder::new();
            #[cfg(not(unix))]
            let builder = fs::DirBuilder::new();
            #[cfg(unix)]
            builder.mode(0o700);
            builder.create(path).map_err(|error| error.to_string())?;
        }
        Err(error) => return Err(error.to_string()),
    }
    Ok(())
}

fn create_private_database(path: &Path) -> Result<(), String> {
    match fs::symlink_metadata(path) {
        Ok(metadata) => {
            if !metadata.is_file() || metadata.file_type().is_symlink() {
                return Err("Collaboration journal cannot be a symlink or special file".into());
            }
            #[cfg(unix)]
            if metadata.permissions().mode() & 0o077 != 0 {
                return Err("Collaboration journal file is not private".into());
            }
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            let mut options = OpenOptions::new();
            options.write(true).create_new(true);
            #[cfg(unix)]
            options.mode(0o600);
            options.open(path).map_err(|error| error.to_string())?;
        }
        Err(error) => return Err(error.to_string()),
    }
    Ok(())
}

impl LocalJournal {
    pub(crate) fn open(vault_root: &Path) -> Result<Self, String> {
        let root = fs::canonicalize(vault_root).map_err(|error| error.to_string())?;
        let scriptor = root.join(".scriptor");
        create_private_directory(&scriptor, false)?;
        let journal_directory = scriptor.join("collaboration");
        create_private_directory(&journal_directory, true)?;
        let path = journal_directory.join("local-updates.sqlite");
        create_private_database(&path)?;
        let connection = Connection::open(&path).map_err(|error| error.to_string())?;
        connection
            .busy_timeout(Duration::from_secs(5))
            .map_err(|error| error.to_string())?;
        connection
            .pragma_update(None, "journal_mode", "WAL")
            .map_err(|error| error.to_string())?;
        connection
            .pragma_update(None, "synchronous", "FULL")
            .map_err(|error| error.to_string())?;
        connection
            .pragma_update(None, "foreign_keys", "ON")
            .map_err(|error| error.to_string())?;
        let mode: String = connection
            .pragma_query_value(None, "journal_mode", |row| row.get(0))
            .map_err(|error| error.to_string())?;
        if !mode.eq_ignore_ascii_case("wal") {
            return Err("Collaboration journal requires SQLite WAL durability".into());
        }
        let integrity: String = connection
            .query_row("PRAGMA integrity_check", [], |row| row.get(0))
            .map_err(|error| error.to_string())?;
        if integrity != "ok" {
            return Err("Collaboration journal corruption; refusing to reset history".into());
        }
        connection
            .execute_batch(
                "CREATE TABLE IF NOT EXISTS documents (
                    vault_id TEXT NOT NULL, room_id TEXT NOT NULL, document_id TEXT NOT NULL,
                    epoch INTEGER NOT NULL, note_path TEXT NOT NULL, base_hash TEXT NOT NULL,
                    PRIMARY KEY(vault_id,room_id,document_id,epoch)
                );
                CREATE TABLE IF NOT EXISTS pending_updates (
                    vault_id TEXT NOT NULL, room_id TEXT NOT NULL, document_id TEXT NOT NULL,
                    epoch INTEGER NOT NULL, peer_id TEXT NOT NULL,
                    message_id TEXT NOT NULL, client_seq INTEGER NOT NULL,
                    payload BLOB NOT NULL,
                    PRIMARY KEY(vault_id,room_id,document_id,epoch,peer_id,message_id),
                    UNIQUE(vault_id,room_id,document_id,epoch,peer_id,client_seq),
                    FOREIGN KEY(vault_id,room_id,document_id,epoch)
                        REFERENCES documents(vault_id,room_id,document_id,epoch)
                );",
            )
            .map_err(|error| error.to_string())?;
        Ok(Self {
            connection,
            #[cfg(test)]
            path,
        })
    }

    /// Records a bound document and returns an explicit external-file conflict
    /// indicator, without clearing an earlier outbox on restart.
    pub(crate) fn begin(
        &mut self,
        scope: &JournalScope,
        current_content_hash: &str,
    ) -> Result<JournalBegin, String> {
        scope.validate()?;
        if !valid_hash(current_content_hash) {
            return Err("Invalid collaboration source revision hash".into());
        }
        let tx = self
            .connection
            .transaction_with_behavior(TransactionBehavior::Immediate)
            .map_err(|error| error.to_string())?;
        tx.execute(
            "INSERT OR IGNORE INTO documents VALUES (?1,?2,?3,?4,?5,?6)",
            params![
                scope.vault_id,
                scope.room_id,
                scope.document_id,
                scope.epoch as i64,
                scope.note_path,
                current_content_hash
            ],
        )
        .map_err(|error| error.to_string())?;
        let (note_path, baseline_hash): (String, String) = tx
            .query_row(
                "SELECT note_path,base_hash FROM documents
                 WHERE vault_id=?1 AND room_id=?2 AND document_id=?3 AND epoch=?4",
                params![
                    scope.vault_id,
                    scope.room_id,
                    scope.document_id,
                    scope.epoch as i64
                ],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .map_err(|error| error.to_string())?;
        if note_path != scope.note_path {
            return Err("Collaboration document identity is already bound to another path".into());
        }
        let pending_count: i64 = tx
            .query_row(
                "SELECT COUNT(*) FROM pending_updates WHERE vault_id=?1 AND
                    room_id=?2 AND document_id=?3 AND epoch=?4 AND peer_id=?5",
                params![
                    scope.vault_id,
                    scope.room_id,
                    scope.document_id,
                    scope.epoch as i64,
                    scope.peer_id
                ],
                |row| row.get(0),
            )
            .map_err(|error| error.to_string())?;
        tx.commit().map_err(|error| error.to_string())?;
        Ok(JournalBegin {
            file_diverged: baseline_hash != current_content_hash,
            baseline_hash,
            pending_count,
        })
    }

    pub(crate) fn append(
        &mut self,
        scope: &JournalScope,
        current_content_hash: &str,
        message_id: &str,
        client_seq: u64,
        payload: &[u8],
    ) -> Result<JournalAppend, String> {
        scope.validate()?;
        if !valid_hash(current_content_hash)
            || !valid_id(message_id)
            || client_seq == 0
            || client_seq > i64::MAX as u64
            || payload.is_empty()
            || payload.len() > MAX_UPDATE_BYTES
        {
            return Err("Invalid local collaboration update".into());
        }
        let tx = self
            .connection
            .transaction_with_behavior(TransactionBehavior::Immediate)
            .map_err(|error| error.to_string())?;
        let existing_path: Option<(String, String)> = tx
            .query_row(
                "SELECT note_path,base_hash FROM documents WHERE vault_id=?1 AND
                    room_id=?2 AND document_id=?3 AND epoch=?4",
                params![
                    scope.vault_id,
                    scope.room_id,
                    scope.document_id,
                    scope.epoch as i64
                ],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .optional()
            .map_err(|error| error.to_string())?;
        let Some((path, baseline)) = existing_path else {
            return Err("Collaboration document must be approved before editing".into());
        };
        if path != scope.note_path || baseline != current_content_hash {
            return Err("Collaboration source changed; recover the pending local edits".into());
        }
        let existing: Option<(i64, Vec<u8>)> = tx
            .query_row(
                "SELECT client_seq,payload FROM pending_updates WHERE vault_id=?1 AND
                    room_id=?2 AND document_id=?3 AND epoch=?4 AND peer_id=?5 AND message_id=?6",
                params![
                    scope.vault_id,
                    scope.room_id,
                    scope.document_id,
                    scope.epoch as i64,
                    scope.peer_id,
                    message_id
                ],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .optional()
            .map_err(|error| error.to_string())?;
        if let Some((sequence, existing_payload)) = existing {
            if sequence != client_seq as i64 || existing_payload != payload {
                return Err("Repeated collaboration identity contains different content".into());
            }
            tx.commit().map_err(|error| error.to_string())?;
            return Ok(JournalAppend {
                duplicate: true,
                locally_durable: true,
            });
        }
        let pending_bytes: i64 = tx
            .query_row(
                "SELECT COALESCE(SUM(LENGTH(payload)),0) FROM pending_updates WHERE
                    vault_id=?1 AND room_id=?2 AND document_id=?3 AND epoch=?4",
                params![
                    scope.vault_id,
                    scope.room_id,
                    scope.document_id,
                    scope.epoch as i64
                ],
                |row| row.get(0),
            )
            .map_err(|error| error.to_string())?;
        if pending_bytes > MAX_PENDING_BYTES - payload.len() as i64 {
            return Err(
                "Collaboration journal capacity reached; local updates were preserved".into(),
            );
        }
        tx.execute(
            "INSERT INTO pending_updates VALUES (?1,?2,?3,?4,?5,?6,?7,?8)",
            params![
                scope.vault_id,
                scope.room_id,
                scope.document_id,
                scope.epoch as i64,
                scope.peer_id,
                message_id,
                client_seq as i64,
                payload
            ],
        )
        .map_err(|error| format!("Duplicate collaboration sequence or database error: {error}"))?;
        tx.commit().map_err(|error| error.to_string())?;
        Ok(JournalAppend {
            duplicate: false,
            locally_durable: true,
        })
    }

    pub(crate) fn projected_baseline(&self, scope: &JournalScope) -> Result<String, String> {
        scope.validate()?;
        self.connection
            .query_row(
                "SELECT base_hash FROM documents WHERE vault_id=?1 AND room_id=?2
                 AND document_id=?3 AND epoch=?4 AND note_path=?5",
                params![
                    scope.vault_id,
                    scope.room_id,
                    scope.document_id,
                    scope.epoch as i64,
                    scope.note_path
                ],
                |row| row.get(0),
            )
            .map_err(|_| "Collaboration projection has no approved baseline".to_string())
    }

    /**
     * Move the materialized file baseline forward only after a vault-CAS write
     * succeeded. The FULL/WAL journal and its unsent CRDT updates are retained.
     *
     * A rejected stale hash is an external-content conflict; never reset the
     * history or treat it as a successful file projection.
     */
    pub(crate) fn advance_projected_baseline(
        &mut self,
        scope: &JournalScope,
        expected_hash: &str,
        new_hash: &str,
    ) -> Result<bool, String> {
        scope.validate()?;
        if !valid_hash(expected_hash) || !valid_hash(new_hash) {
            return Err("Invalid collaborative projection hash".into());
        }
        let tx = self
            .connection
            .transaction_with_behavior(TransactionBehavior::Immediate)
            .map_err(|error| error.to_string())?;
        let affected = tx
            .execute(
                "UPDATE documents SET base_hash=?1 WHERE vault_id=?2 AND room_id=?3
                 AND document_id=?4 AND epoch=?5 AND note_path=?6 AND base_hash=?7",
                params![
                    new_hash,
                    scope.vault_id,
                    scope.room_id,
                    scope.document_id,
                    scope.epoch as i64,
                    scope.note_path,
                    expected_hash,
                ],
            )
            .map_err(|error| error.to_string())?;
        tx.commit().map_err(|error| error.to_string())?;
        Ok(affected == 1)
    }

    pub(crate) fn pending(
        &self,
        scope: &JournalScope,
        after_sequence: u64,
    ) -> Result<Vec<PendingOperation>, String> {
        scope.validate()?;
        if after_sequence > i64::MAX as u64 {
            return Err("Invalid collaboration replay cursor".into());
        }
        let mut statement = self
            .connection
            .prepare(
                "SELECT message_id,client_seq,payload FROM pending_updates WHERE
                    vault_id=?1 AND room_id=?2 AND document_id=?3 AND epoch=?4 AND
                    peer_id=?5 AND client_seq>?6 ORDER BY client_seq ASC LIMIT 64",
            )
            .map_err(|error| error.to_string())?;
        let rows = statement
            .query_map(
                params![
                    scope.vault_id,
                    scope.room_id,
                    scope.document_id,
                    scope.epoch as i64,
                    scope.peer_id,
                    after_sequence as i64
                ],
                |row| {
                    Ok(PendingOperation {
                        message_id: row.get(0)?,
                        client_seq: row.get(1)?,
                        payload: row.get(2)?,
                    })
                },
            )
            .map_err(|error| error.to_string())?;
        let mut result = Vec::new();
        let mut bytes = 0;
        for row in rows {
            let update = row.map_err(|error| error.to_string())?;
            if bytes + update.payload.len() > PAGE_BYTES {
                break;
            }
            bytes += update.payload.len();
            result.push(update);
            if result.len() >= MAX_PAGE_ROWS {
                break;
            }
        }
        Ok(result)
    }
}

fn valid_id(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 160
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_'))
}

fn valid_hash(value: &str) -> bool {
    value.len() == 64 && value.bytes().all(|byte| byte.is_ascii_hexdigit())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    fn scope() -> JournalScope {
        JournalScope {
            vault_id: "vault_A".into(),
            room_id: "room_B".into(),
            document_id: "doc_C".into(),
            epoch: 1,
            peer_id: "peer_D".into(),
            note_path: "notes/demo.md".into(),
        }
    }

    fn hash() -> &'static str {
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    }

    #[test]
    fn restart_recovers_only_the_approved_scoped_pending_updates() {
        let temporary = tempdir().unwrap();
        let s = scope();
        let mut journal = LocalJournal::open(temporary.path()).unwrap();
        assert_eq!(journal.begin(&s, hash()).unwrap().pending_count, 0);
        assert_eq!(
            journal.append(&s, hash(), "msg_1", 1, &[1, 2, 3]).unwrap(),
            JournalAppend {
                duplicate: false,
                locally_durable: true
            }
        );
        drop(journal);
        let mut restored = LocalJournal::open(temporary.path()).unwrap();
        assert_eq!(restored.begin(&s, hash()).unwrap().pending_count, 1);
        assert_eq!(
            restored.pending(&s, 0).unwrap(),
            vec![PendingOperation {
                message_id: "msg_1".into(),
                client_seq: 1,
                payload: vec![1, 2, 3]
            }]
        );
        let mut different = s.clone();
        different.room_id = "other_room".into();
        assert!(restored.pending(&different, 0).unwrap().is_empty());
        different = s.clone();
        different.peer_id = "other_peer".into();
        assert!(restored.pending(&different, 0).unwrap().is_empty());
    }

    #[test]
    fn retries_are_idempotent_but_reused_sequence_or_content_are_rejected() {
        let temporary = tempdir().unwrap();
        let s = scope();
        let mut journal = LocalJournal::open(temporary.path()).unwrap();
        journal.begin(&s, hash()).unwrap();
        journal.append(&s, hash(), "first", 1, &[1]).unwrap();
        assert!(
            journal
                .append(&s, hash(), "first", 1, &[1])
                .unwrap()
                .duplicate
        );
        assert!(journal.append(&s, hash(), "first", 1, &[2]).is_err());
        assert!(journal.append(&s, hash(), "second", 1, &[1]).is_err());
        assert_eq!(journal.pending(&s, 0).unwrap().len(), 1);
    }

    #[test]
    fn outdated_file_baselines_do_not_clear_a_recoverable_outbox() {
        let temporary = tempdir().unwrap();
        let s = scope();
        let mut journal = LocalJournal::open(temporary.path()).unwrap();
        journal.begin(&s, hash()).unwrap();
        journal.append(&s, hash(), "first", 1, &[1]).unwrap();
        let changed = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
        let receipt = journal.begin(&s, changed).unwrap();
        assert!(receipt.file_diverged);
        assert_eq!(receipt.pending_count, 1);
        assert!(journal.append(&s, changed, "second", 2, &[2]).is_err());
        assert_eq!(journal.pending(&s, 0).unwrap().len(), 1);
    }

    #[test]
    fn projection_baseline_advances_by_cas_without_losing_pending_operations() {
        let temporary = tempdir().unwrap();
        let scope = scope();
        let mut journal = LocalJournal::open(temporary.path()).unwrap();
        journal.begin(&scope, hash()).unwrap();
        journal
            .append(&scope, hash(), "op_one", 1, &[1, 2])
            .unwrap();
        let next = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
        assert!(
            journal
                .advance_projected_baseline(&scope, hash(), next)
                .unwrap()
        );
        assert!(
            !journal
                .advance_projected_baseline(&scope, hash(), next)
                .unwrap()
        );
        assert!(journal.append(&scope, hash(), "op_two", 2, &[3]).is_err());
        assert!(journal.append(&scope, next, "op_two", 2, &[3]).is_ok());
        assert_eq!(journal.pending(&scope, 0).unwrap().len(), 2);
        drop(journal);
        let mut reopened = LocalJournal::open(temporary.path()).unwrap();
        assert!(!reopened.begin(&scope, next).unwrap().file_diverged);
        assert_eq!(reopened.pending(&scope, 0).unwrap().len(), 2);
    }

    #[test]
    fn refuses_cross_path_rebinding_and_unsafe_identities() {
        let temporary = tempdir().unwrap();
        let s = scope();
        let mut journal = LocalJournal::open(temporary.path()).unwrap();
        journal.begin(&s, hash()).unwrap();
        let mut changed = s.clone();
        changed.note_path = "notes/other.md".into();
        assert!(journal.begin(&changed, hash()).is_err());
        changed = s.clone();
        changed.epoch = 2;
        assert!(!journal.begin(&changed, hash()).unwrap().file_diverged);
        changed = s.clone();
        changed.note_path = "../escape.md".into();
        assert!(journal.begin(&changed, hash()).is_err());
        changed = s.clone();
        changed.room_id = "bad/id".into();
        assert!(journal.begin(&changed, hash()).is_err());
    }

    #[test]
    fn bad_updates_are_rejected_without_discarding_prior_content() {
        let temporary = tempdir().unwrap();
        let s = scope();
        let mut journal = LocalJournal::open(temporary.path()).unwrap();
        journal.begin(&s, hash()).unwrap();
        journal.append(&s, hash(), "first", 1, &[1]).unwrap();
        assert!(journal.append(&s, hash(), "bad", 2, &[]).is_err());
        assert!(
            journal
                .append(&s, hash(), "big", 2, &vec![7; MAX_UPDATE_BYTES + 1])
                .is_err()
        );
        assert!(journal.append(&s, hash(), "../bad", 2, &[1]).is_err());
        assert_eq!(journal.pending(&s, 0).unwrap().len(), 1);
    }

    #[test]
    fn offset_replay_never_leaks_another_peer_or_room() {
        let temporary = tempdir().unwrap();
        let s = scope();
        let mut journal = LocalJournal::open(temporary.path()).unwrap();
        journal.begin(&s, hash()).unwrap();
        for index in 1..=70 {
            journal
                .append(&s, hash(), &format!("msg_{index}"), index, &[7])
                .unwrap();
        }
        assert_eq!(journal.pending(&s, 0).unwrap().len(), MAX_PAGE_ROWS);
        assert_eq!(journal.pending(&s, 64).unwrap().len(), 6);
        assert_eq!(journal.pending(&s, 70).unwrap().len(), 0);
    }

    #[test]
    fn refuses_corrupt_or_linked_persistence_files() {
        let temporary = tempdir().unwrap();
        let journal = LocalJournal::open(temporary.path()).unwrap();
        let path = journal.path.clone();
        drop(journal);
        fs::write(&path, b"not a SQLite journal").unwrap();
        assert!(LocalJournal::open(temporary.path()).is_err());
        #[cfg(unix)]
        {
            fs::remove_file(&path).unwrap();
            std::os::unix::fs::symlink(temporary.path().join("foreign"), &path).unwrap();
            assert!(LocalJournal::open(temporary.path()).is_err());
        }
    }

    #[cfg(unix)]
    #[test]
    fn private_directory_is_not_silently_relaxed() {
        let temporary = tempdir().unwrap();
        let journal = LocalJournal::open(temporary.path()).unwrap();
        drop(journal);
        let directory = temporary.path().join(".scriptor/collaboration");
        fs::set_permissions(&directory, fs::Permissions::from_mode(0o755)).unwrap();
        assert!(LocalJournal::open(temporary.path()).is_err());
    }
}
