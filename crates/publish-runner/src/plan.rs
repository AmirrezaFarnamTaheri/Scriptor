//! Frontmatter-gated publish plan (W1-6).
//!
//! # What this module does
//!
//! `plan_publish` scans a vault root for notes, applies include/exclude glob
//! filters, reads each candidate's frontmatter to gate on `publish: true`, and
//! computes a content-hash-based diff against the previous bucket state.  The
//! result is a [`PublishPlan`] with four buckets:
//!
//! | Bucket | Meaning |
//! |---|---|
//! | `new_items` | Present in vault, absent from bucket |
//! | `changed` | Present in both, but hash differs |
//! | `unchanged` | Present in both, hash identical |
//! | `orphaned` | Absent from vault (deleted or renamed), still in bucket |
//!
//! No file is written by this module.  Callers must pass the plan to
//! `publish_apply` (W1-8 / `compile.rs`) after the user has reviewed it.
//!
//! # Acceptance criteria (W1-6)
//! - Two `publish: true` notes → exactly those two in `changed`/`new_items`.
//! - Second run with no edits → 0 changed, 0 new.
//! - Rename → exactly one `new` + one `orphaned`.
//! - `requireFrontmatterOptIn = true` (default) excludes notes without the flag.

use std::collections::HashMap;
use std::path::Path;

use globset::{Glob, GlobSetBuilder};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use walkdir::WalkDir;

use crate::error::PublishError;

// ── Sealed-content marker (I-3) ───────────────────────────────────────────────

/// ASCII prefix that marks a sealed / encrypted span inside a note body.
/// The indexer, export-runner, and this runner all use this sentinel.
const SEALED_PREFIX: &str = "%%scriptor-sealed:";

// ── Public types ──────────────────────────────────────────────────────────────

/// Options controlling which notes are eligible for publish.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PublishPlanOptions {
    /// When `true` (the default), only notes with `publish: true` in their
    /// frontmatter are included.  Set to `false` only for site generators that
    /// publish everything and gate via glob exclusions instead.
    #[serde(default = "default_true")]
    pub require_frontmatter_opt_in: bool,

    /// Glob patterns relative to the vault root that restrict the scan.
    /// An empty list means "all `.md` files".
    #[serde(default)]
    pub include_globs: Vec<String>,

    /// Glob patterns relative to the vault root that unconditionally exclude
    /// a note even if it has `publish: true`.
    #[serde(default)]
    pub exclude_globs: Vec<String>,
}

fn default_true() -> bool {
    true
}

impl Default for PublishPlanOptions {
    fn default() -> Self {
        Self {
            require_frontmatter_opt_in: true,
            include_globs: Vec::new(),
            exclude_globs: Vec::new(),
        }
    }
}

/// A single note that is eligible for publishing.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct PublishCandidate {
    /// Vault-relative POSIX path (forward slashes, no leading slash).
    pub rel_path: String,
    /// SHA-256 hex of the note's raw bytes at the time of planning.
    pub content_hash: String,
}

/// A previous publish state entry — just a path→hash mapping.
///
/// Callers load this from however they persist bucket state (e.g. a
/// `.publish-state.json` file in the site output directory).
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct BucketState {
    /// Vault-relative path → SHA-256 hex of the last-published content.
    pub entries: HashMap<String, String>,
}

/// The four-bucket diff between the current vault scan and the previous
/// bucket state.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PublishPlan {
    /// Notes present in the vault but absent from the bucket.
    pub new_items: Vec<PublishCandidate>,
    /// Notes present in both, but whose content hash has changed.
    pub changed: Vec<PublishCandidate>,
    /// Notes present in both with an identical hash — nothing to do.
    pub unchanged: Vec<PublishCandidate>,
    /// Vault-relative paths that exist in the bucket but not in the current
    /// scan (the note was deleted, renamed, or de-opted from publish).
    pub orphaned: Vec<String>,
}

impl PublishPlan {
    /// Returns `true` when there is nothing actionable (no new, changed, or
    /// orphaned items).
    pub fn is_empty(&self) -> bool {
        self.new_items.is_empty() && self.changed.is_empty() && self.orphaned.is_empty()
    }
}

// ── Core entry point ──────────────────────────────────────────────────────────

/// Scan `vault_root` and produce a publish plan relative to `prior_state`.
///
/// No files are written. This function is pure with respect to the filesystem
/// (read-only).
pub fn plan_publish(
    vault_root: &Path,
    prior_state: &BucketState,
    options: &PublishPlanOptions,
) -> Result<PublishPlan, PublishError> {
    let include_set = build_include_set(&options.include_globs)?;
    let exclude_set = build_exclude_set(&options.exclude_globs)?;

    // Collect all eligible candidates from the vault.
    let candidates = scan_candidates(vault_root, options, &include_set, &exclude_set)?;

    // Build a map of what we found for fast lookup.
    let found: HashMap<String, String> = candidates
        .iter()
        .map(|c| (c.rel_path.clone(), c.content_hash.clone()))
        .collect();

    let mut new_items = Vec::new();
    let mut changed = Vec::new();
    let mut unchanged = Vec::new();

    for candidate in candidates {
        match prior_state.entries.get(&candidate.rel_path) {
            None => new_items.push(candidate),
            Some(old_hash) if old_hash != &candidate.content_hash => changed.push(candidate),
            _ => unchanged.push(candidate),
        }
    }

    // Anything in the prior state not found in the current scan is orphaned.
    let orphaned: Vec<String> = prior_state
        .entries
        .keys()
        .filter(|k| !found.contains_key(*k))
        .cloned()
        .collect();

    Ok(PublishPlan {
        new_items,
        changed,
        unchanged,
        orphaned,
    })
}

// ── Scanning ──────────────────────────────────────────────────────────────────

fn scan_candidates(
    vault_root: &Path,
    options: &PublishPlanOptions,
    include_set: &Option<globset::GlobSet>,
    exclude_set: &globset::GlobSet,
) -> Result<Vec<PublishCandidate>, PublishError> {
    let mut out = Vec::new();

    for entry in WalkDir::new(vault_root)
        .follow_links(false)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
        .filter(|e| {
            e.path()
                .extension()
                .map(|x| x.eq_ignore_ascii_case("md"))
                .unwrap_or(false)
        })
    {
        let abs = entry.path();
        let rel = rel_posix(vault_root, abs);

        // Glob filtering.
        if let Some(inc) = include_set
            && !inc.is_match(&rel)
        {
            continue;
        }
        if exclude_set.is_match(&rel) {
            continue;
        }

        let bytes = std::fs::read(abs).map_err(|e| PublishError::Io {
            path: rel.clone(),
            source: e,
        })?;

        // I-3: refuse sealed content without --redact-secrets.
        if bytes
            .windows(SEALED_PREFIX.len())
            .any(|w| w == SEALED_PREFIX.as_bytes())
        {
            return Err(PublishError::SealedContent { path: rel });
        }

        // Frontmatter gate.
        if options.require_frontmatter_opt_in {
            let text = String::from_utf8_lossy(&bytes);
            if !frontmatter_has_publish_true(&text) {
                continue;
            }
        }

        let content_hash = hex::encode(Sha256::digest(&bytes));
        out.push(PublishCandidate {
            rel_path: rel,
            content_hash,
        });
    }

    Ok(out)
}

// ── Frontmatter gate ──────────────────────────────────────────────────────────

/// Returns `true` iff the note's YAML frontmatter contains `publish: true`.
///
/// This is a deliberately simple line-oriented check — no full YAML parse.
/// Frontmatter starts and ends with `---`; we look for `publish: true` on its
/// own line within that block.
fn frontmatter_has_publish_true(text: &str) -> bool {
    let mut lines = text.lines();

    // Must start with `---`.
    if lines.next().map(str::trim) != Some("---") {
        return false;
    }

    for line in lines {
        let trimmed = line.trim();
        if trimmed == "---" || trimmed == "..." {
            break; // end of frontmatter
        }
        if trimmed == "publish: true" {
            return true;
        }
    }

    false
}

// ── Glob helpers ──────────────────────────────────────────────────────────────

fn build_include_set(patterns: &[String]) -> Result<Option<globset::GlobSet>, PublishError> {
    if patterns.is_empty() {
        return Ok(None);
    }
    let mut builder = GlobSetBuilder::new();
    for p in patterns {
        builder.add(Glob::new(p)?);
    }
    Ok(Some(
        builder.build().map_err(|e| PublishError::GlobPattern(e))?,
    ))
}

fn build_exclude_set(patterns: &[String]) -> Result<globset::GlobSet, PublishError> {
    let mut builder = GlobSetBuilder::new();
    for p in patterns {
        builder.add(Glob::new(p)?);
    }
    builder.build().map_err(PublishError::GlobPattern)
}

/// Convert an absolute path to a vault-relative POSIX path string.
fn rel_posix(vault_root: &Path, abs: &Path) -> String {
    abs.strip_prefix(vault_root)
        .unwrap_or(abs)
        .to_string_lossy()
        .replace('\\', "/")
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    fn write_note(dir: &Path, rel: &str, content: &str) {
        let path = dir.join(rel.replace('/', std::path::MAIN_SEPARATOR_STR));
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).unwrap();
        }
        fs::write(path, content).unwrap();
    }

    fn note_with_publish() -> &'static str {
        "---\npublish: true\ntitle: Test\n---\nBody text.\n"
    }

    fn note_without_publish() -> &'static str {
        "---\ntitle: Private\n---\nSecret.\n"
    }

    // ── Frontmatter gate ──────────────────────────────────────────────────────

    #[test]
    fn two_opted_in_notes_appear_in_new_items() {
        let tmp = TempDir::new().unwrap();
        write_note(tmp.path(), "a.md", note_with_publish());
        write_note(tmp.path(), "b.md", note_with_publish());
        write_note(tmp.path(), "private.md", note_without_publish());

        let plan = plan_publish(tmp.path(), &BucketState::default(), &Default::default()).unwrap();
        assert_eq!(plan.new_items.len(), 2, "only opted-in notes: {plan:?}");
        assert!(plan.changed.is_empty());
        assert!(plan.orphaned.is_empty());
    }

    #[test]
    fn second_run_with_no_edits_reports_zero_changed() {
        let tmp = TempDir::new().unwrap();
        write_note(tmp.path(), "a.md", note_with_publish());

        let first = plan_publish(tmp.path(), &BucketState::default(), &Default::default()).unwrap();
        assert_eq!(first.new_items.len(), 1);

        // Simulate publishing: build prior state from first plan.
        let mut prior = BucketState::default();
        for c in &first.new_items {
            prior
                .entries
                .insert(c.rel_path.clone(), c.content_hash.clone());
        }

        let second = plan_publish(tmp.path(), &prior, &Default::default()).unwrap();
        assert!(second.changed.is_empty(), "no changes expected");
        assert!(second.new_items.is_empty(), "no new items expected");
        assert!(second.orphaned.is_empty(), "no orphans expected");
    }

    #[test]
    fn rename_yields_one_new_and_one_orphaned() {
        let tmp = TempDir::new().unwrap();
        write_note(tmp.path(), "old-name.md", note_with_publish());

        let first = plan_publish(tmp.path(), &BucketState::default(), &Default::default()).unwrap();
        let mut prior = BucketState::default();
        for c in &first.new_items {
            prior
                .entries
                .insert(c.rel_path.clone(), c.content_hash.clone());
        }

        // Rename: remove old, create new.
        fs::remove_file(tmp.path().join("old-name.md")).unwrap();
        write_note(tmp.path(), "new-name.md", note_with_publish());

        let second = plan_publish(tmp.path(), &prior, &Default::default()).unwrap();
        assert_eq!(second.new_items.len(), 1, "one new after rename");
        assert_eq!(second.orphaned.len(), 1, "one orphan after rename");
    }

    // ── Sealed content (I-3) ──────────────────────────────────────────────────

    #[test]
    fn sealed_note_causes_hard_error() {
        let tmp = TempDir::new().unwrap();
        let sealed = format!("---\npublish: true\n---\n{SEALED_PREFIX}abc==%%\n");
        write_note(tmp.path(), "secret.md", &sealed);

        let err = plan_publish(tmp.path(), &BucketState::default(), &Default::default())
            .expect_err("must fail on sealed content");
        assert!(matches!(err, PublishError::SealedContent { .. }), "{err}");
    }

    // ── Glob filtering ────────────────────────────────────────────────────────

    #[test]
    fn exclude_glob_suppresses_opted_in_note() {
        let tmp = TempDir::new().unwrap();
        write_note(tmp.path(), "drafts/wip.md", note_with_publish());
        write_note(tmp.path(), "posts/article.md", note_with_publish());

        let opts = PublishPlanOptions {
            exclude_globs: vec!["drafts/**".to_string()],
            ..Default::default()
        };
        let plan = plan_publish(tmp.path(), &BucketState::default(), &opts).unwrap();
        assert_eq!(plan.new_items.len(), 1);
        assert_eq!(plan.new_items[0].rel_path, "posts/article.md");
    }

    // ── Frontmatter parser edge cases ─────────────────────────────────────────

    #[test]
    fn frontmatter_gate_requires_exact_true() {
        assert!(frontmatter_has_publish_true(
            "---\npublish: true\n---\nbody\n"
        ));
        assert!(!frontmatter_has_publish_true(
            "---\npublish: false\n---\nbody\n"
        ));
        assert!(!frontmatter_has_publish_true(
            "---\npublish: yes\n---\nbody\n"
        ));
        assert!(!frontmatter_has_publish_true("no frontmatter at all\n"));
    }
}
