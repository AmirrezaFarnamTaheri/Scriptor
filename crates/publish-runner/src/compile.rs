//! Publish application: write approved plan items to a local output directory.
//!
//! # Design (W1-8)
//!
//! The unconditional copy loop in the old `vault_publish_starlight` is replaced
//! by a deliberate two-phase flow:
//!
//! 1. **Plan phase** (`crate::plan::plan_publish`) — read-only; computes
//!    what would change and returns it for user review.
//! 2. **Apply phase** (`publish_apply`) — executes *only* the items the user
//!    explicitly approved; writes through `LocalDirSink`.
//!
//! This module owns the apply phase. The plan is always the caller's
//! responsibility; nothing here discovers notes autonomously.
//!
//! # Acceptance (W1-8)
//! - `rg "copy_dir_all" crates/vault/src/commands/publish.rs` returns nothing
//!   (the old file no longer exists; routing is here).
//! - Astro scaffold survives as a [`SiteTemplate`] variant.
//! - I-3 is re-checked at apply time: an approved item that meanwhile acquired
//!   a sealed span is hard-rejected.

use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::error::PublishError;
use crate::plan::{BucketState, PublishCandidate};

// ── SiteTemplate ──────────────────────────────────────────────────────────────

/// Which site generator scaffold the output directory should be initialised with
/// (or `None` for plain file copy).
///
/// The plan maintains Astro as a first-class variant; the old
/// `vault_publish_starlight` hard-coded it.  New scaffold variants can be added
/// here without touching the apply logic.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum SiteTemplate {
    /// Astro + Starlight (the existing scaffold).
    AstroStarlight,
    /// Plain directory — no scaffold, just the note files.
    PlainDirectory,
}

// ── Output sink ───────────────────────────────────────────────────────────────

/// A sink that writes approved publish candidates into a local directory.
///
/// The only currently implemented sink is a local directory; future variants
/// (S3, GitHub Pages via git push, etc.) would implement the same interface
/// through an enum or trait object.
pub struct LocalDirSink {
    output_root: PathBuf,
}

impl LocalDirSink {
    pub fn new(output_root: impl Into<PathBuf>) -> Self {
        Self {
            output_root: output_root.into(),
        }
    }

    /// Copy `source_bytes` to `<output_root>/<rel_path>`, creating parent
    /// directories as needed.
    pub fn write(&self, rel_path: &str, source_bytes: &[u8]) -> Result<(), PublishError> {
        let dest = self
            .output_root
            .join(rel_path.replace('/', std::path::MAIN_SEPARATOR_STR));
        if let Some(parent) = dest.parent() {
            std::fs::create_dir_all(parent).map_err(|e| PublishError::Io {
                path: parent.to_string_lossy().into_owned(),
                source: e,
            })?;
        }
        // Atomic write via tempfile-then-rename within the same directory.
        let tmp = dest.with_extension("tmp");
        std::fs::write(&tmp, source_bytes).map_err(|e| PublishError::Io {
            path: tmp.to_string_lossy().into_owned(),
            source: e,
        })?;
        std::fs::rename(&tmp, &dest).map_err(|e| PublishError::Io {
            path: dest.to_string_lossy().into_owned(),
            source: e,
        })?;
        Ok(())
    }

    /// Remove a file from the output directory (for orphan deletion).
    pub fn delete(&self, rel_path: &str) -> Result<(), PublishError> {
        let dest = self
            .output_root
            .join(rel_path.replace('/', std::path::MAIN_SEPARATOR_STR));
        if dest.exists() {
            std::fs::remove_file(&dest).map_err(|e| PublishError::Io {
                path: dest.to_string_lossy().into_owned(),
                source: e,
            })?;
        }
        Ok(())
    }
}

// ── Apply input ───────────────────────────────────────────────────────────────

/// The items the user has approved to publish.
///
/// The caller is responsible for confirming each bucket with the user before
/// constructing this struct.  `publish_apply` does not discover notes itself.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PublishApplyInput {
    /// Items to write (from `new_items` + `changed` buckets).
    pub to_write: Vec<PublishCandidate>,
    /// Vault-relative paths the user approved to delete from the output dir.
    pub to_delete: Vec<String>,
}

/// Result of a publish apply operation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PublishApplyOutput {
    pub written: Vec<String>,
    pub deleted: Vec<String>,
    /// Updated bucket state, ready to be persisted by the caller.
    pub new_state: BucketState,
}

// ── Sealed-content sentinel (I-3, re-checked at apply time) ──────────────────

const SEALED_PREFIX: &str = "%%scriptor-sealed:";

// ── Core apply function ───────────────────────────────────────────────────────

/// Apply an approved [`PublishApplyInput`] to a [`LocalDirSink`].
///
/// # I-3 interlock
/// Each note is re-read at apply time.  If it has acquired a sealed span since
/// the plan was computed the write is hard-rejected.  This prevents a TOCTOU
/// window where a note is sealed between planning and applying.
///
/// # Atomicity
/// Each file write is atomic (temp-then-rename).  Partial applies leave only
/// fully-written or untouched files in the output directory.
pub fn publish_apply(
    vault_root: &Path,
    input: &PublishApplyInput,
    sink: &LocalDirSink,
    prior_state: &BucketState,
) -> Result<PublishApplyOutput, PublishError> {
    let mut written = Vec::new();
    let mut new_state = prior_state.clone();

    for candidate in &input.to_write {
        let abs = vault_root.join(
            candidate
                .rel_path
                .replace('/', std::path::MAIN_SEPARATOR_STR),
        );
        let bytes = std::fs::read(&abs).map_err(|e| PublishError::Io {
            path: candidate.rel_path.clone(),
            source: e,
        })?;

        // I-3 re-check at apply time.
        if bytes
            .windows(SEALED_PREFIX.len())
            .any(|w| w == SEALED_PREFIX.as_bytes())
        {
            return Err(PublishError::SealedContent {
                path: candidate.rel_path.clone(),
            });
        }

        sink.write(&candidate.rel_path, &bytes)?;
        new_state
            .entries
            .insert(candidate.rel_path.clone(), candidate.content_hash.clone());
        written.push(candidate.rel_path.clone());
    }

    let mut deleted = Vec::new();
    for rel in &input.to_delete {
        sink.delete(rel)?;
        new_state.entries.remove(rel);
        deleted.push(rel.clone());
    }

    Ok(PublishApplyOutput {
        written,
        deleted,
        new_state,
    })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    fn vault_note(dir: &Path, rel: &str, content: &str) {
        let path = dir.join(rel.replace('/', std::path::MAIN_SEPARATOR_STR));
        if let Some(p) = path.parent() {
            fs::create_dir_all(p).unwrap();
        }
        fs::write(path, content).unwrap();
    }

    #[test]
    fn apply_writes_approved_items_to_output() {
        let vault = TempDir::new().unwrap();
        let out_dir = TempDir::new().unwrap();

        vault_note(
            vault.path(),
            "hello.md",
            "---\npublish: true\n---\nHello!\n",
        );

        let candidate = PublishCandidate {
            rel_path: "hello.md".into(),
            content_hash: "abc".into(),
        };
        let input = PublishApplyInput {
            to_write: vec![candidate],
            to_delete: vec![],
        };
        let sink = LocalDirSink::new(out_dir.path());
        let result = publish_apply(vault.path(), &input, &sink, &BucketState::default()).unwrap();

        assert_eq!(result.written, vec!["hello.md"]);
        assert!(out_dir.path().join("hello.md").exists());
    }

    #[test]
    fn apply_deletes_orphans_from_output() {
        let vault = TempDir::new().unwrap();
        let out_dir = TempDir::new().unwrap();

        // Pre-create the file in the output directory as if it was previously published.
        fs::write(out_dir.path().join("old.md"), b"old content").unwrap();

        let mut prior = BucketState::default();
        prior.entries.insert("old.md".into(), "oldhash".into());

        let input = PublishApplyInput {
            to_write: vec![],
            to_delete: vec!["old.md".into()],
        };
        let sink = LocalDirSink::new(out_dir.path());
        let result = publish_apply(vault.path(), &input, &sink, &prior).unwrap();

        assert_eq!(result.deleted, vec!["old.md"]);
        assert!(!out_dir.path().join("old.md").exists());
        assert!(!result.new_state.entries.contains_key("old.md"));
    }

    #[test]
    fn apply_hard_fails_on_sealed_content() {
        let vault = TempDir::new().unwrap();
        let out_dir = TempDir::new().unwrap();

        // Note acquired sealed content since the plan was made.
        let sealed_body = format!("---\npublish: true\n---\n{SEALED_PREFIX}abc==%%\n");
        vault_note(vault.path(), "secret.md", &sealed_body);

        let input = PublishApplyInput {
            to_write: vec![PublishCandidate {
                rel_path: "secret.md".into(),
                content_hash: "stale".into(),
            }],
            to_delete: vec![],
        };
        let sink = LocalDirSink::new(out_dir.path());
        let err = publish_apply(vault.path(), &input, &sink, &BucketState::default())
            .expect_err("must hard-fail on sealed content");
        assert!(matches!(err, PublishError::SealedContent { .. }), "{err}");
    }
}
