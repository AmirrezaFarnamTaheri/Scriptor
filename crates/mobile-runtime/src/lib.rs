//! In-process, filesystem-authoritative mobile kernel. No daemon or child process.
use scriptor_vault::{
    NoteDocument, NoteHistoryEntry, NoteMetadata, RelativeVaultPath, SaveNoteOutput, VaultError,
    VaultSession,
};
use serde::Serialize;
use std::{
    fs,
    io::Read,
    path::Path,
    sync::{
        Mutex,
        atomic::{AtomicBool, AtomicU64, Ordering},
    },
};
use walkdir::WalkDir;

pub const MAX_NOTE_BYTES: u64 = 2 * 1024 * 1024;
const MAX_SCAN_ENTRIES: usize = 25_000;
const MAX_SEARCH_BYTES: u64 = 32 * 1024 * 1024;
const MAX_RESULTS: usize = 100;

#[derive(Debug, thiserror::Error)]
pub enum RuntimeError {
    #[error("the application is in the background")]
    Inactive,
    #[error("the operation was cancelled; refresh the session")]
    Cancelled,
    #[error("mobile storage limit exceeded: {0}")]
    Limit(&'static str),
    #[error("invalid mobile note path or expected content hash")]
    InvalidInput,
    #[error("mobile runtime lock unavailable")]
    Unavailable,
    #[error(transparent)]
    Vault(#[from] VaultError),
    #[error(transparent)]
    Io(#[from] std::io::Error),
}

#[derive(Debug, Serialize)]
pub struct SearchPage {
    pub notes: Vec<NoteMetadata>,
    pub truncated: bool,
}

/// Platform-neutral seam: adapters do not depend on socket/RPC framing.
pub trait EngineRuntime: Send + Sync {
    fn scope(&self) -> u64;
    fn set_foreground(&self, foreground: bool);
    fn cancel(&self);
    fn read(&self, scope: u64, path: &str) -> Result<NoteDocument, RuntimeError>;
    fn save(
        &self,
        scope: u64,
        path: &str,
        markdown: &str,
        expected_hash: &str,
    ) -> Result<SaveNoteOutput, RuntimeError>;
    fn search(&self, scope: u64, query: &str) -> Result<SearchPage, RuntimeError>;
}

pub struct MobileRuntime {
    session: Mutex<VaultSession>,
    foreground: AtomicBool,
    generation: AtomicU64,
}

impl MobileRuntime {
    /// The platform adapter supplies only its own app-private documents directory.
    pub fn open(root: impl AsRef<Path>) -> Result<Self, RuntimeError> {
        fs::create_dir_all(root.as_ref())?;
        Ok(Self {
            session: Mutex::new(scriptor_vault::open_vault(root)?),
            foreground: AtomicBool::new(true),
            generation: AtomicU64::new(1),
        })
    }

    fn check(&self, scope: u64) -> Result<(), RuntimeError> {
        if !self.foreground.load(Ordering::Acquire) {
            return Err(RuntimeError::Inactive);
        }
        if scope != self.scope() {
            return Err(RuntimeError::Cancelled);
        }
        Ok(())
    }

    fn path(path: &str) -> Result<RelativeVaultPath, RuntimeError> {
        if path.len() > 1024
            || !path.to_ascii_lowercase().ends_with(".md")
            || path.split(['/', '\\']).any(|s| {
                matches!(
                    s,
                    ".scriptor" | ".git" | ".trash" | ".obsidian" | "node_modules"
                )
            })
        {
            return Err(RuntimeError::InvalidInput);
        }
        Ok(RelativeVaultPath::parse(path)?)
    }

    fn read_scoped(
        session: &VaultSession,
        path: &RelativeVaultPath,
    ) -> Result<NoteDocument, RuntimeError> {
        let absolute = session.root.resolve_relative(path)?;
        let file = fs::File::open(absolute)?;
        let metadata = file.metadata()?;
        if metadata.len() > MAX_NOTE_BYTES {
            return Err(RuntimeError::Limit("note is larger than 2 MiB"));
        }
        let mut bytes = Vec::new();
        file.take(MAX_NOTE_BYTES + 1).read_to_end(&mut bytes)?;
        if bytes.len() as u64 > MAX_NOTE_BYTES {
            return Err(RuntimeError::Limit("note grew beyond 2 MiB while reading"));
        }
        let markdown = String::from_utf8(bytes)
            .map_err(|error| std::io::Error::new(std::io::ErrorKind::InvalidData, error))?;
        let modified: chrono::DateTime<chrono::Utc> = metadata.modified()?.into();
        Ok(NoteDocument {
            metadata: scriptor_vault::metadata_from_markdown(
                &session.descriptor.id,
                path,
                &markdown,
                modified.to_rfc3339(),
            ),
            markdown,
        })
    }

    pub fn history(&self, scope: u64, path: &str) -> Result<Vec<NoteHistoryEntry>, RuntimeError> {
        let path = Self::path(path)?;
        let session = self.session.lock().map_err(|_| RuntimeError::Unavailable)?;
        self.check(scope)?;
        Ok(scriptor_vault::list_note_history(
            &session.root,
            path.as_str(),
        )?)
    }

    pub fn revision(&self, scope: u64, path: &str, id: &str) -> Result<String, RuntimeError> {
        let path = Self::path(path)?;
        let session = self.session.lock().map_err(|_| RuntimeError::Unavailable)?;
        self.check(scope)?;
        let text = scriptor_vault::read_note_history_revision(&session.root, path.as_str(), id)?;
        if text.len() as u64 > MAX_NOTE_BYTES {
            return Err(RuntimeError::Limit("revision is larger than 2 MiB"));
        }
        Ok(text)
    }

    pub fn restore(
        &self,
        scope: u64,
        path: &str,
        id: &str,
        expected_hash: &str,
    ) -> Result<SaveNoteOutput, RuntimeError> {
        let revision = self.revision(scope, path, id)?;
        self.save(scope, path, &revision, expected_hash)
    }
}

impl EngineRuntime for MobileRuntime {
    fn scope(&self) -> u64 {
        self.generation.load(Ordering::Acquire)
    }
    fn cancel(&self) {
        self.generation.fetch_add(1, Ordering::AcqRel);
    }
    fn set_foreground(&self, foreground: bool) {
        if self.foreground.swap(foreground, Ordering::AcqRel) != foreground {
            self.cancel();
        }
    }
    fn read(&self, scope: u64, path: &str) -> Result<NoteDocument, RuntimeError> {
        let path = Self::path(path)?;
        let session = self.session.lock().map_err(|_| RuntimeError::Unavailable)?;
        self.check(scope)?;
        Self::read_scoped(&session, &path)
    }
    fn save(
        &self,
        scope: u64,
        path: &str,
        markdown: &str,
        expected_hash: &str,
    ) -> Result<SaveNoteOutput, RuntimeError> {
        let path = Self::path(path)?;
        if expected_hash.trim().is_empty() {
            return Err(RuntimeError::InvalidInput);
        }
        if markdown.len() as u64 > MAX_NOTE_BYTES {
            return Err(RuntimeError::Limit("note is larger than 2 MiB"));
        }
        let session = self.session.lock().map_err(|_| RuntimeError::Unavailable)?;
        self.check(scope)?;
        // Once a mutation begins it finishes atomically; cancellation never interrupts promotion.
        Ok(scriptor_vault::save_note(
            &session.descriptor.id,
            &session.root,
            &path,
            markdown,
            Some(expected_hash),
        )?)
    }
    fn search(&self, scope: u64, query: &str) -> Result<SearchPage, RuntimeError> {
        if query.len() > 512 {
            return Err(RuntimeError::InvalidInput);
        }
        let session = self.session.lock().map_err(|_| RuntimeError::Unavailable)?;
        self.check(scope)?;
        let query = query.to_lowercase();
        let mut notes = Vec::new();
        let mut total_bytes = 0;
        let mut visited = 0;
        let mut truncated = false;
        let entries = WalkDir::new(session.root.root())
            .follow_links(false)
            .sort_by_file_name()
            .into_iter()
            .filter_entry(|entry| {
                entry.depth() == 0
                    || !matches!(
                        entry.file_name().to_str(),
                        Some(".scriptor" | ".git" | ".trash" | ".obsidian" | "node_modules")
                    )
            });
        for entry in entries {
            self.check(scope)?;
            visited += 1;
            if visited > MAX_SCAN_ENTRIES {
                truncated = true;
                break;
            }
            let entry = entry.map_err(std::io::Error::other)?;
            if !entry.file_type().is_file()
                || entry
                    .path()
                    .extension()
                    .and_then(|e| e.to_str())
                    .is_none_or(|e| !e.eq_ignore_ascii_case("md"))
            {
                continue;
            }
            let path = session.root.relative_path(entry.path())?;
            let size = fs::metadata(entry.path())?.len();
            if size > MAX_NOTE_BYTES {
                truncated = true;
                continue;
            }
            total_bytes += size;
            if total_bytes > MAX_SEARCH_BYTES {
                truncated = true;
                break;
            }
            let note = Self::read_scoped(&session, &path)?;
            if query.is_empty()
                || note.markdown.to_lowercase().contains(&query)
                || path.as_str().to_lowercase().contains(&query)
            {
                if notes.len() == MAX_RESULTS {
                    truncated = true;
                    break;
                }
                notes.push(note.metadata);
            }
        }
        self.check(scope)?;
        Ok(SearchPage { notes, truncated })
    }
}
