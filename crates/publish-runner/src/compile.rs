//! Publish application: apply a reviewed, frontmatter-gated publish plan to a
//! local output directory.
//!
//! The renderer or CLI may select a subset of a plan, but it is never treated
//! as the authority for what is publishable. `publish_apply` recomputes the
//! current plan, validates every selected path against that server-side plan,
//! and checks the reviewed content hash again immediately before writing.

use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};

use scriptor_vault::{MAX_INDEXED_NOTE_BYTES, RelativeVaultPath, VaultRoot, atomic_write, content_hash_bytes};
use serde::{Deserialize, Serialize};

use crate::error::PublishError;
use crate::plan::{
    BucketState, PublishCandidate, PublishPlanOptions, SEALED_PREFIX, frontmatter_has_publish_true,
    plan_publish,
};

/// Which site generator scaffold the output directory should be initialised with.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum SiteTemplate {
    AstroStarlight,
    PlainDirectory,
}

/// A path-safe local publish sink.
///
/// `output_root` is canonicalized when the sink is created. Every write/delete
/// then passes through `RelativeVaultPath` and `VaultRoot::resolve_relative`,
/// which rejects absolute paths, parent traversal, and symlink escapes.
pub struct LocalDirSink {
    output_root: VaultRoot,
}

impl LocalDirSink {
    pub fn new(output_root: impl Into<PathBuf>) -> Result<Self, PublishError> {
        let output_root = output_root.into();
        std::fs::create_dir_all(&output_root).map_err(|source| PublishError::Io {
            path: output_root.display().to_string(),
            source,
        })?;
        Ok(Self {
            output_root: VaultRoot::open(output_root)?,
        })
    }

    pub fn root(&self) -> &Path {
        self.output_root.root()
    }

    fn resolve_managed_path(&self, rel_path: &str) -> Result<PathBuf, PublishError> {
        let relative = RelativeVaultPath::parse(rel_path)?;
        let mut lexical = self.output_root.root().to_path_buf();
        for component in relative.as_str().split('/') {
            lexical.push(component);
            if let Ok(metadata) = std::fs::symlink_metadata(&lexical)
                && metadata.file_type().is_symlink()
            {
                return Err(PublishError::InvalidSelection {
                    path: rel_path.to_string(),
                    reason: "managed publish paths may not traverse symbolic links".into(),
                });
            }
        }
        Ok(self.output_root.resolve_relative(&relative)?)
    }

    pub fn exists(&self, rel_path: &str) -> Result<bool, PublishError> {
        Ok(self.resolve_managed_path(rel_path)?.exists())
    }

    /// Return the current hash of a managed output file without following
    /// symlinks. `None` means the expected managed file is missing.
    pub fn content_hash(&self, rel_path: &str) -> Result<Option<String>, PublishError> {
        let path = self.resolve_managed_path(rel_path)?;
        if !path.exists() {
            return Ok(None);
        }
        let metadata = std::fs::symlink_metadata(&path).map_err(|source| PublishError::Io {
            path: rel_path.to_string(),
            source,
        })?;
        if !metadata.file_type().is_file() {
            return Err(PublishError::InvalidSelection {
                path: rel_path.to_string(),
                reason: "managed publish output is not a regular file".into(),
            });
        }
        if metadata.len() > MAX_INDEXED_NOTE_BYTES {
            return Err(PublishError::InvalidSelection {
                path: rel_path.to_string(),
                reason: format!("managed publish output exceeds {MAX_INDEXED_NOTE_BYTES} bytes"),
            });
        }
        let bytes = std::fs::read(&path).map_err(|source| PublishError::Io {
            path: rel_path.to_string(),
            source,
        })?;
        Ok(Some(content_hash_bytes(&bytes)))
    }

    pub fn write(&self, rel_path: &str, source_bytes: &[u8]) -> Result<(), PublishError> {
        let relative = RelativeVaultPath::parse(rel_path)?;
        let dest = self.resolve_managed_path(relative.as_str())?;
        if let Some(parent) = dest.parent() {
            std::fs::create_dir_all(parent).map_err(|source| PublishError::Io {
                path: parent.display().to_string(),
                source,
            })?;
            // Re-resolve after creating parents so a concurrently introduced
            // symlink cannot redirect the write outside the sink root.
            let dest = self.resolve_managed_path(relative.as_str())?;
            atomic_write(&dest, source_bytes)?;
        } else {
            return Err(PublishError::InvalidSelection {
                path: rel_path.to_string(),
                reason: "destination has no parent directory".into(),
            });
        }
        Ok(())
    }

    pub fn delete(&self, rel_path: &str) -> Result<(), PublishError> {
        let relative = RelativeVaultPath::parse(rel_path)?;
        let dest = self.resolve_managed_path(relative.as_str())?;
        if dest.exists() {
            let metadata = std::fs::symlink_metadata(&dest).map_err(|source| PublishError::Io {
                path: rel_path.to_string(),
                source,
            })?;
            if !metadata.file_type().is_file() {
                return Err(PublishError::InvalidSelection {
                    path: rel_path.to_string(),
                    reason: "managed publish deletion target is not a regular file".into(),
                });
            }
            std::fs::remove_file(&dest).map_err(|source| PublishError::Io {
                path: rel_path.to_string(),
                source,
            })?;
        }
        Ok(())
    }
}

/// The exact plan entries approved by the user.
///
/// `content_hash` is an optimistic-concurrency version, not an authority token.
/// The apply phase independently recomputes eligibility and requires the fresh
/// server-side candidate to match this hash.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PublishApplyInput {
    pub to_write: Vec<PublishCandidate>,
    pub to_delete: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PublishApplyOutput {
    pub written: Vec<String>,
    pub deleted: Vec<String>,
    pub new_state: BucketState,
}

/// Apply a reviewed subset of the current publish plan.
///
/// Security and correctness invariants:
/// - selected writes must still be `new` or `changed` in a freshly recomputed
///   plan using the same options;
/// - selected hashes must match both the fresh plan and the immediately re-read
///   source bytes;
/// - `publish: true` and sealed-content gates are rechecked at write time;
/// - deletions must be fresh orphans from the prior managed state;
/// - every source and destination path is traversal/symlink safe.
pub fn publish_apply(
    vault_root: &Path,
    input: &PublishApplyInput,
    sink: &LocalDirSink,
    prior_state: &BucketState,
    options: &PublishPlanOptions,
) -> Result<PublishApplyOutput, PublishError> {
    let root = VaultRoot::open(vault_root)?;
    let fresh_plan = plan_publish(root.root(), prior_state, options)?;
    let actionable: HashMap<&str, &PublishCandidate> = fresh_plan
        .new_items
        .iter()
        .chain(fresh_plan.changed.iter())
        .map(|candidate| (candidate.rel_path.as_str(), candidate))
        .collect();
    let source_unchanged: HashMap<&str, &PublishCandidate> = fresh_plan
        .unchanged
        .iter()
        .map(|candidate| (candidate.rel_path.as_str(), candidate))
        .collect();
    let fresh_orphans: HashSet<&str> = fresh_plan.orphaned.iter().map(String::as_str).collect();

    let mut seen_writes = HashSet::new();
    let mut written = Vec::new();
    let mut new_state = prior_state.clone();

    for reviewed in &input.to_write {
        let relative = RelativeVaultPath::parse(&reviewed.rel_path)?;
        let rel = relative.as_str();
        if !seen_writes.insert(rel.to_string()) {
            return Err(PublishError::DuplicateSelection {
                path: rel.to_string(),
            });
        }
        let current = if let Some(current) = actionable.get(rel) {
            *current
        } else if let Some(current) = source_unchanged.get(rel) {
            // A Starlight plan may surface a source-unchanged note as changed
            // when its previously managed generated output is missing or has
            // been modified. Preserve ownership and allow that reviewed repair
            // only while the output still differs from the last-published hash.
            let expected_output_hash = prior_state.entries.get(rel).ok_or_else(|| {
                PublishError::InvalidSelection {
                    path: rel.to_string(),
                    reason: "unchanged source is not owned by publish state".into(),
                }
            })?;
            if sink.content_hash(rel)?.as_deref() == Some(expected_output_hash.as_str()) {
                return Err(PublishError::InvalidSelection {
                    path: rel.to_string(),
                    reason: "path is unchanged in both source and managed output".into(),
                });
            }
            *current
        } else {
            return Err(PublishError::InvalidSelection {
                path: rel.to_string(),
                reason: "path is not a new, changed, or drifted managed item in the current publish plan".into(),
            });
        };
        if current.content_hash != reviewed.content_hash {
            return Err(PublishError::StalePlan {
                path: rel.to_string(),
                planned_hash: reviewed.content_hash.clone(),
                current_hash: current.content_hash.clone(),
            });
        }
        if !prior_state.entries.contains_key(rel) && sink.exists(rel)? {
            return Err(PublishError::InvalidSelection {
                path: rel.to_string(),
                reason: "destination exists but is not managed by Scriptor publish state".into(),
            });
        }

        let source = root.resolve_relative(&relative)?;
        let bytes = std::fs::read(&source).map_err(|source| PublishError::Io {
            path: rel.to_string(),
            source,
        })?;
        let current_hash = content_hash_bytes(&bytes);
        if current_hash != reviewed.content_hash {
            return Err(PublishError::StalePlan {
                path: rel.to_string(),
                planned_hash: reviewed.content_hash.clone(),
                current_hash,
            });
        }
        if bytes
            .windows(SEALED_PREFIX.len())
            .any(|window| window == SEALED_PREFIX.as_bytes())
        {
            return Err(PublishError::SealedContent {
                path: rel.to_string(),
            });
        }
        if options.require_frontmatter_opt_in
            && !frontmatter_has_publish_true(&String::from_utf8_lossy(&bytes))
        {
            return Err(PublishError::NotOptedIn {
                path: rel.to_string(),
            });
        }

        sink.write(rel, &bytes)?;
        new_state
            .entries
            .insert(rel.to_string(), reviewed.content_hash.clone());
        written.push(rel.to_string());
    }

    let mut seen_deletes = HashSet::new();
    let mut deleted = Vec::new();
    for raw in &input.to_delete {
        let relative = RelativeVaultPath::parse(raw)?;
        let rel = relative.as_str();
        if !seen_deletes.insert(rel.to_string()) {
            return Err(PublishError::DuplicateSelection {
                path: rel.to_string(),
            });
        }
        if !fresh_orphans.contains(rel) || !prior_state.entries.contains_key(rel) {
            return Err(PublishError::InvalidSelection {
                path: rel.to_string(),
                reason: "path is not a managed orphan in the current publish plan".into(),
            });
        }
        sink.delete(rel)?;
        new_state.entries.remove(rel);
        deleted.push(rel.to_string());
    }

    Ok(PublishApplyOutput {
        written,
        deleted,
        new_state,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::plan::plan_publish;
    use std::fs;
    use tempfile::TempDir;

    fn vault_note(dir: &Path, rel: &str, content: &str) {
        let path = dir.join(rel.replace('/', std::path::MAIN_SEPARATOR_STR));
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).unwrap();
        }
        fs::write(path, content).unwrap();
    }

    fn opted_in(body: &str) -> String {
        format!("---\npublish: true\n---\n{body}\n")
    }

    fn reviewed_candidate(vault: &Path, rel: &str) -> PublishCandidate {
        let plan = plan_publish(vault, &BucketState::default(), &Default::default()).unwrap();
        plan.new_items
            .into_iter()
            .find(|candidate| candidate.rel_path == rel)
            .unwrap()
    }

    #[test]
    fn apply_writes_only_fresh_actionable_candidates() {
        let vault = TempDir::new().unwrap();
        let out = TempDir::new().unwrap();
        vault_note(vault.path(), "hello.md", &opted_in("Hello!"));
        let candidate = reviewed_candidate(vault.path(), "hello.md");
        let input = PublishApplyInput {
            to_write: vec![candidate],
            to_delete: vec![],
        };
        let sink = LocalDirSink::new(out.path()).unwrap();

        let result = publish_apply(
            vault.path(),
            &input,
            &sink,
            &BucketState::default(),
            &Default::default(),
        )
        .unwrap();

        assert_eq!(result.written, vec!["hello.md"]);
        assert_eq!(fs::read_to_string(out.path().join("hello.md")).unwrap(), opted_in("Hello!"));
    }

    #[test]
    fn apply_rejects_parent_traversal() {
        let vault = TempDir::new().unwrap();
        let out = TempDir::new().unwrap();
        let sink = LocalDirSink::new(out.path()).unwrap();
        let input = PublishApplyInput {
            to_write: vec![PublishCandidate {
                rel_path: "../secret.md".into(),
                content_hash: "irrelevant".into(),
            }],
            to_delete: vec![],
        };
        assert!(publish_apply(vault.path(), &input, &sink, &Default::default(), &Default::default()).is_err());
    }

    #[test]
    fn apply_rejects_note_changed_after_review() {
        let vault = TempDir::new().unwrap();
        let out = TempDir::new().unwrap();
        vault_note(vault.path(), "note.md", &opted_in("reviewed"));
        let candidate = reviewed_candidate(vault.path(), "note.md");
        vault_note(vault.path(), "note.md", &opted_in("changed after review"));
        let sink = LocalDirSink::new(out.path()).unwrap();
        let input = PublishApplyInput {
            to_write: vec![candidate],
            to_delete: vec![],
        };

        let error = publish_apply(vault.path(), &input, &sink, &Default::default(), &Default::default())
            .expect_err("stale reviewed hashes must fail");
        assert!(matches!(error, PublishError::StalePlan { .. }));
    }

    #[test]
    fn apply_rejects_note_that_is_no_longer_opted_in() {
        let vault = TempDir::new().unwrap();
        let out = TempDir::new().unwrap();
        vault_note(vault.path(), "note.md", &opted_in("reviewed"));
        let candidate = reviewed_candidate(vault.path(), "note.md");
        vault_note(vault.path(), "note.md", "---\npublish: false\n---\nprivate now\n");
        let sink = LocalDirSink::new(out.path()).unwrap();
        let input = PublishApplyInput {
            to_write: vec![candidate],
            to_delete: vec![],
        };

        let error = publish_apply(vault.path(), &input, &sink, &Default::default(), &Default::default())
            .expect_err("de-opted notes must fail");
        assert!(matches!(error, PublishError::InvalidSelection { .. } | PublishError::NotOptedIn { .. }));
    }

    #[test]
    fn apply_deletes_only_fresh_managed_orphans() {
        let vault = TempDir::new().unwrap();
        let out = TempDir::new().unwrap();
        fs::write(out.path().join("old.md"), b"old").unwrap();
        let mut prior = BucketState::default();
        prior.entries.insert("old.md".into(), "oldhash".into());
        let sink = LocalDirSink::new(out.path()).unwrap();
        let input = PublishApplyInput {
            to_write: vec![],
            to_delete: vec!["old.md".into()],
        };

        let result = publish_apply(vault.path(), &input, &sink, &prior, &Default::default()).unwrap();
        assert_eq!(result.deleted, vec!["old.md"]);
        assert!(!out.path().join("old.md").exists());
    }

    #[cfg(unix)]
    #[test]
    fn apply_rejects_managed_symlink_target() {
        use std::os::unix::fs::symlink;

        let vault = TempDir::new().unwrap();
        let out = TempDir::new().unwrap();
        vault_note(vault.path(), "note.md", &opted_in("reviewed"));
        let candidate = reviewed_candidate(vault.path(), "note.md");
        fs::write(out.path().join("real.md"), b"user owned").unwrap();
        symlink(out.path().join("real.md"), out.path().join("note.md")).unwrap();
        let sink = LocalDirSink::new(out.path()).unwrap();
        let input = PublishApplyInput {
            to_write: vec![candidate],
            to_delete: vec![],
        };

        let error = publish_apply(vault.path(), &input, &sink, &Default::default(), &Default::default())
            .expect_err("managed writes must reject symlink targets");
        assert!(matches!(error, PublishError::InvalidSelection { .. }));
        assert_eq!(fs::read_to_string(out.path().join("real.md")).unwrap(), "user owned");
    }

    #[test]
    fn apply_rejects_unmanaged_delete() {
        let vault = TempDir::new().unwrap();
        let out = TempDir::new().unwrap();
        fs::write(out.path().join("user-file.md"), b"keep me").unwrap();
        let sink = LocalDirSink::new(out.path()).unwrap();
        let input = PublishApplyInput {
            to_write: vec![],
            to_delete: vec!["user-file.md".into()],
        };

        assert!(publish_apply(vault.path(), &input, &sink, &Default::default(), &Default::default()).is_err());
        assert!(out.path().join("user-file.md").exists());
    }

    #[test]
    fn apply_rejects_writing_over_unmanaged_destination() {
        let vault = TempDir::new().unwrap();
        let out = TempDir::new().unwrap();
        vault_note(vault.path(), "note.md", &opted_in("opted in"));
        let candidate = reviewed_candidate(vault.path(), "note.md");
        fs::write(out.path().join("note.md"), b"unmanaged existing file").unwrap();
        let sink = LocalDirSink::new(out.path()).unwrap();
        let input = PublishApplyInput {
            to_write: vec![candidate],
            to_delete: vec![],
        };

        let error = publish_apply(
            vault.path(),
            &input,
            &sink,
            &BucketState::default(),
            &Default::default(),
        )
        .expect_err("writing over an unmanaged existing file must be rejected");

        assert!(
            matches!(
                error,
                PublishError::InvalidSelection { ref reason, .. }
                if reason.contains("destination exists but is not managed by Scriptor publish state")
            ),
            "unexpected error: {error:?}"
        );
        assert_eq!(
            fs::read_to_string(out.path().join("note.md")).unwrap(),
            "unmanaged existing file"
        );
    }

    #[test]
    fn apply_source_unchanged_drift_repair_paths() {
        let vault = TempDir::new().unwrap();
        let out = TempDir::new().unwrap();
        let note_content = opted_in("Hello!");
        vault_note(vault.path(), "hello.md", &note_content);
        let note_hash = content_hash_bytes(note_content.as_bytes());

        // 1. When both source and managed output are unchanged, apply is rejected.
        fs::write(out.path().join("hello.md"), &note_content).unwrap();
        let mut prior = BucketState::default();
        prior.entries.insert("hello.md".into(), note_hash.clone());
        let sink = LocalDirSink::new(out.path()).unwrap();
        let candidate = PublishCandidate {
            rel_path: "hello.md".into(),
            content_hash: note_hash.clone(),
        };
        let input = PublishApplyInput {
            to_write: vec![candidate.clone()],
            to_delete: vec![],
        };

        let error = publish_apply(
            vault.path(),
            &input,
            &sink,
            &prior,
            &Default::default(),
        )
        .expect_err("unchanged source and managed output must reject apply");

        assert!(
            matches!(
                error,
                PublishError::InvalidSelection { ref reason, .. }
                if reason.contains("path is unchanged in both source and managed output")
            ),
            "unexpected error: {error:?}"
        );

        // 2. When managed output drifts (is modified), reviewed apply repairs it.
        fs::write(out.path().join("hello.md"), b"drifted output").unwrap();
        let result = publish_apply(
            vault.path(),
            &input,
            &sink,
            &prior,
            &Default::default(),
        )
        .unwrap();

        assert_eq!(result.written, vec!["hello.md"]);
        assert_eq!(
            fs::read_to_string(out.path().join("hello.md")).unwrap(),
            note_content
        );
    }
}
