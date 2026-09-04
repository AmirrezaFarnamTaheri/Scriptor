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

use std::collections::{BTreeMap, HashMap};
use std::io::Read;
use std::path::Path;

use globset::{Glob, GlobSetBuilder};
use scriptor_vault::{
    MAX_INDEXED_NOTE_BYTES, RelativeVaultPath, ScannedEntryKind, VaultRoot, content_hash_bytes,
    scan_vault,
};
use serde::{Deserialize, Serialize};

use crate::bounded_io::{BoundedRead, read_bounded};
use crate::error::PublishError;

// ── Sealed-content marker (I-3) ───────────────────────────────────────────────

/// ASCII prefix that marks a sealed / encrypted span inside a note body.
/// The indexer, export-runner, and this runner all use this sentinel.
pub(crate) const SEALED_PREFIX: &str = "%%scriptor-sealed:";
const FRONTMATTER_PROBE_BYTES: usize = 64 * 1024;

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
            exclude_globs: vec![".tmp/**".into(), "**/.tmp/**".into()],
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
    pub entries: BTreeMap<String, String>,
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
    let mut orphaned: Vec<String> = prior_state
        .entries
        .keys()
        .filter(|k| !found.contains_key(*k))
        .cloned()
        .collect();
    orphaned.sort();

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
    let root = VaultRoot::open(vault_root)?;
    let mut out = Vec::new();

    // Reuse the vault kernel's bounded, symlink-aware metadata scan instead of
    // maintaining a second, weaker filesystem walker here. It excludes the
    // internal `.scriptor` tree and surfaces enumeration failures.
    for entry in scan_vault(&root)? {
        if entry.kind != ScannedEntryKind::Note {
            continue;
        }
        let rel = RelativeVaultPath::parse(&entry.path)?;
        let rel_str = rel.as_str();

        if let Some(include) = include_set
            && !include.is_match(rel_str)
        {
            continue;
        }
        if exclude_set.is_match(rel_str) {
            continue;
        }

        let absolute = root.resolve_relative(&rel)?;
        if entry.size_bytes > MAX_INDEXED_NOTE_BYTES
            && reject_or_skip_oversized_note(&absolute, rel_str, entry.size_bytes, options)?
        {
            continue;
        }

        let bytes = match read_bounded(&absolute, rel_str, MAX_INDEXED_NOTE_BYTES)? {
            BoundedRead::Bytes(bytes) => bytes,
            BoundedRead::TooLarge { observed_bytes } => {
                if reject_or_skip_oversized_note(&absolute, rel_str, observed_bytes, options)? {
                    continue;
                }
                return Err(PublishError::NoteTooLarge {
                    path: rel_str.to_string(),
                    size_bytes: observed_bytes,
                    limit_bytes: MAX_INDEXED_NOTE_BYTES,
                });
            }
        };

        // Apply the opt-in gate before sealed-content enforcement so a private,
        // non-published sealed note cannot deny publication of unrelated notes.
        let frontmatter_probe = &bytes[..bytes.len().min(FRONTMATTER_PROBE_BYTES)];
        if options.require_frontmatter_opt_in
            && !frontmatter_has_publish_true(&String::from_utf8_lossy(frontmatter_probe))
        {
            continue;
        }

        if memchr::memmem::find(&bytes, SEALED_PREFIX.as_bytes()).is_some() {
            return Err(PublishError::SealedContent {
                path: rel_str.to_string(),
            });
        }

        out.push(PublishCandidate {
            rel_path: rel_str.to_string(),
            content_hash: content_hash_bytes(&bytes),
        });
    }

    Ok(out)
}

fn reject_or_skip_oversized_note(
    path: &Path,
    rel: &str,
    size_bytes: u64,
    options: &PublishPlanOptions,
) -> Result<bool, PublishError> {
    // Keep the size bound: oversized notes are never fully read. Skip only
    // when the bounded probe proves the note has complete frontmatter without
    // opt-in. An unterminated probe is indeterminate, so fail closed with
    // NoteTooLarge instead of silently orphaning a potentially public note.
    if options.require_frontmatter_opt_in {
        let probe = read_prefix_lossy(path, FRONTMATTER_PROBE_BYTES, rel)?;
        if matches!(frontmatter_probe_publish_true(&probe), Some(false)) {
            return Ok(true);
        }
    }

    Err(PublishError::NoteTooLarge {
        path: rel.to_string(),
        size_bytes,
        limit_bytes: MAX_INDEXED_NOTE_BYTES,
    })
}

fn read_prefix_lossy(path: &Path, limit: usize, rel: &str) -> Result<String, PublishError> {
    let file = std::fs::File::open(path).map_err(|source| PublishError::Io {
        path: rel.to_string(),
        source,
    })?;
    let mut buffer = Vec::new();
    file.take(limit as u64)
        .read_to_end(&mut buffer)
        .map_err(|source| PublishError::Io {
            path: rel.to_string(),
            source,
        })?;
    Ok(String::from_utf8_lossy(&buffer).into_owned())
}

// ── Frontmatter gate ──────────────────────────────────────────────────────────

/// Returns whether a bounded prefix conclusively contains a publish opt-in.
/// `None` means the prefix began frontmatter but did not include its terminator,
/// so the caller cannot safely classify the note as private.
fn frontmatter_probe_publish_true(text: &str) -> Option<bool> {
    let mut lines = text.lines();
    if lines.next().map(str::trim) != Some("---") {
        return Some(false);
    }

    let mut publish_true = false;
    for line in lines {
        let line = line.trim_end_matches('\r');
        let trimmed = line.trim();
        if trimmed == "---" || trimmed == "..." {
            return Some(publish_true);
        }
        if line == "publish: true" {
            publish_true = true;
        }
    }

    None
}

/// Returns `true` iff the note's YAML frontmatter contains `publish: true`.
///
/// This is a deliberately simple line-oriented check — no full YAML parse.
/// Frontmatter starts and ends with `---`; we look for `publish: true` on its
/// own line within that block.
pub(crate) fn frontmatter_has_publish_true(text: &str) -> bool {
    let mut lines = text.lines();

    // Must start with `---`.
    if lines.next().map(str::trim) != Some("---") {
        return false;
    }

    let mut publish_true = false;
    for line in lines {
        let line = line.trim_end_matches('\r');
        let trimmed = line.trim();
        if trimmed == "---" || trimmed == "..." {
            return publish_true; // end of complete frontmatter
        }
        if line == "publish: true" {
            publish_true = true;
        }
    }

    // Unterminated frontmatter is malformed and must never opt a note in.
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
    Ok(Some(builder.build().map_err(PublishError::GlobPattern)?))
}

fn build_exclude_set(patterns: &[String]) -> Result<globset::GlobSet, PublishError> {
    let mut builder = GlobSetBuilder::new();
    for p in patterns {
        builder.add(Glob::new(p)?);
    }
    builder.build().map_err(PublishError::GlobPattern)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::io::Write;
    use tempfile::TempDir;

    fn write_note(dir: &Path, rel: &str, content: &str) {
        let path = dir.join(rel.replace('/', std::path::MAIN_SEPARATOR_STR));
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).unwrap();
        }
        fs::write(path, content).unwrap();
    }

    fn write_oversized_note(dir: &Path, rel: &str, prefix: &str) {
        let path = dir.join(rel.replace('/', std::path::MAIN_SEPARATOR_STR));
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).unwrap();
        }
        let mut file = fs::File::create(path).unwrap();
        file.write_all(prefix.as_bytes()).unwrap();
        file.set_len(MAX_INDEXED_NOTE_BYTES + 1).unwrap();
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
    fn nested_publish_key_does_not_opt_note_in() {
        let tmp = TempDir::new().unwrap();
        write_note(
            tmp.path(),
            "private.md",
            "---\ntitle: Private\ndefaults:\n  publish: true\n---\nsecret\n",
        );
        let plan = plan_publish(tmp.path(), &BucketState::default(), &Default::default()).unwrap();
        assert!(plan.new_items.is_empty());
    }

    #[test]
    fn unterminated_frontmatter_does_not_opt_note_into_publish() {
        let tmp = TempDir::new().unwrap();
        write_note(
            tmp.path(),
            "private.md",
            "---\npublish: true\nprivate content without terminator\n",
        );

        let plan = plan_publish(tmp.path(), &BucketState::default(), &Default::default()).unwrap();
        assert!(plan.new_items.is_empty());
        assert!(plan.changed.is_empty());
    }

    #[test]
    fn oversized_private_note_does_not_block_unrelated_publish() {
        let tmp = TempDir::new().unwrap();
        write_note(tmp.path(), "public.md", note_with_publish());
        write_oversized_note(tmp.path(), "private.md", note_without_publish());

        let plan = plan_publish(tmp.path(), &BucketState::default(), &Default::default()).unwrap();
        assert_eq!(plan.new_items.len(), 1);
        assert_eq!(plan.new_items[0].rel_path, "public.md");
    }

    #[test]
    fn oversized_opted_in_note_still_fails_size_gate() {
        let tmp = TempDir::new().unwrap();
        write_oversized_note(tmp.path(), "large.md", note_with_publish());

        let error = plan_publish(tmp.path(), &BucketState::default(), &Default::default())
            .expect_err("opted-in oversized notes must fail");
        assert!(
            matches!(error, PublishError::NoteTooLarge { .. }),
            "{error}"
        );
    }

    #[test]
    fn oversized_note_with_opt_in_beyond_probe_still_fails_size_gate() {
        let tmp = TempDir::new().unwrap();
        let mut prefix = String::from("---\n");
        prefix.push_str(&"x".repeat(FRONTMATTER_PROBE_BYTES));
        prefix.push_str("\npublish: true\n---\n");
        write_oversized_note(tmp.path(), "late-opt-in.md", &prefix);

        let error = plan_publish(tmp.path(), &BucketState::default(), &Default::default())
            .expect_err("an incomplete frontmatter probe must not be treated as private");
        assert!(
            matches!(error, PublishError::NoteTooLarge { .. }),
            "{error}"
        );
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
        assert!(!frontmatter_has_publish_true(
            "---\npublish: true\nprivate content without terminator\n"
        ));
    }

    #[test]
    fn distinct_invalid_utf8_notes_have_distinct_publish_hashes() {
        let tmp = TempDir::new().unwrap();
        fs::write(
            tmp.path().join("first.md"),
            b"---\npublish: true\n---\nbody\xff",
        )
        .unwrap();
        fs::write(
            tmp.path().join("second.md"),
            b"---\npublish: true\n---\nbody\xfe",
        )
        .unwrap();

        let plan = plan_publish(tmp.path(), &BucketState::default(), &Default::default()).unwrap();
        assert_eq!(plan.new_items.len(), 2);
        assert_ne!(
            plan.new_items[0].content_hash,
            plan.new_items[1].content_hash
        );
    }
}
