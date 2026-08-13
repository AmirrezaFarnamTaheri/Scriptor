//! Three-way merge via [`diffy`] (W1-1, W1-3).
//!
//! # Why diffy instead of `git merge-file`
//! - Pure-Rust → no subprocess, no temp files, no OS shell.
//! - Deterministic output for the same base/ours/theirs triple regardless of
//!   system git version or locale settings.
//! - Exposes conflict hunks as structured data, enabling the `KeepBoth` and
//!   auto-merge policies without re-parsing conflict markers.
//!
//! # Conflict policies (W1-3)
//! | Policy | Behaviour |
//! |---|---|
//! | `Error`    | Return `Err(MergeConflict)` — caller handles |
//! | `Ours`     | Accept the "ours" side of every conflict |
//! | `Theirs`   | Accept the "theirs" side of every conflict |
//! | `KeepBoth` | Write a `name.conflicted.md` sidecar and return it |
//!
//! # Usage
//! ```no_run
//! use scriptor_native_git::merge3::{merge3, ConflictPolicy};
//!
//! # fn main() -> Result<(), scriptor_native_git::GitError> {
//! let result = merge3("base text", "our edit", "their edit", ConflictPolicy::Error, None)?;
//! println!("{}", result.merged);
//! # Ok(())
//! # }
//! ```

use diffy::{ConflictStyle, MergeOptions};
use serde::{Deserialize, Serialize};

use crate::error::GitError;

/// What to do when the three-way merge encounters a conflict.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ConflictPolicy {
    /// Return `Err(GitError::MergeConflict { .. })`.
    #[default]
    Error,
    /// Keep our version of every conflicting hunk (discard theirs).
    Ours,
    /// Keep their version of every conflicting hunk (discard ours).
    Theirs,
    /// Merge where possible; for conflicts write a `*.conflicted.md` sidecar
    /// path alongside the original and return `MergeOutput::has_conflicts = true`.
    KeepBoth,
}

/// Outcome of a three-way merge.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MergeOutput {
    /// The merged text. If `has_conflicts` is true this contains conflict
    /// markers; otherwise it is clean.
    pub merged: String,
    /// True when at least one conflict hunk was encountered. Always `false`
    /// when `policy` is `Ours` or `Theirs` (conflicts are resolved eagerly).
    pub has_conflicts: bool,
    /// When `policy == KeepBoth`, the recommended sidecar filename.
    /// Callers must write this file themselves.
    pub sidecar_path: Option<String>,
}

/// Perform a three-way merge of `base`, `ours`, and `theirs`.
///
/// The `original_path` is used only to derive the `sidecar_path` when
/// `policy == KeepBoth`; it is not read from or written to disk.
pub fn merge3(
    base: &str,
    ours: &str,
    theirs: &str,
    policy: ConflictPolicy,
    original_path: Option<&str>,
) -> Result<MergeOutput, GitError> {
    // Attempt a standard merge first (Diff3 style shows all three sides in
    // conflict regions, which makes the `Ours`/`Theirs` resolution below
    // straightforward to parse).
    let mut options = MergeOptions::new();
    options.set_conflict_style(ConflictStyle::Diff3);

    match options.merge(base, ours, theirs) {
        Ok(clean) => Ok(MergeOutput {
            merged: clean,
            has_conflicts: false,
            sidecar_path: None,
        }),
        Err(conflicted) => {
            let conflict_text = conflicted;
            match policy {
                ConflictPolicy::Error => Err(GitError::MergeConflict { conflict_text }),

                ConflictPolicy::Ours => Ok(MergeOutput {
                    merged: resolve_conflict_markers(&conflict_text, Side::Ours),
                    has_conflicts: false,
                    sidecar_path: None,
                }),

                ConflictPolicy::Theirs => Ok(MergeOutput {
                    merged: resolve_conflict_markers(&conflict_text, Side::Theirs),
                    has_conflicts: false,
                    sidecar_path: None,
                }),

                ConflictPolicy::KeepBoth => {
                    let sidecar = original_path.map(keep_both_sidecar_name);
                    Ok(MergeOutput {
                        merged: conflict_text,
                        has_conflicts: true,
                        sidecar_path: sidecar,
                    })
                }
            }
        }
    }
}

// ── Conflict marker resolution ────────────────────────────────────────────────

/// Which side to keep when resolving conflict markers.
#[derive(Clone, Copy, PartialEq, Eq)]
enum Side {
    Ours,
    Theirs,
}

/// Parse Diff3-style conflict markers and keep only the chosen `side`.
///
/// Diff3 conflict blocks look like:
/// ```text
/// <<<<<<< ours
/// our lines
/// ||||||| ancestor
/// ancestor lines
/// =======
/// their lines
/// >>>>>>> theirs
/// ```
///
/// We keep the lines between `<<<<<<<` and `|||||||` for `Ours`,
/// and lines between `=======` and `>>>>>>>` for `Theirs`.
fn resolve_conflict_markers(text: &str, side: Side) -> String {
    enum State {
        Normal,
        InOurs,
        InAncestor,
        InTheirs,
    }

    let mut out = String::with_capacity(text.len());
    let mut state = State::Normal;

    for line in text.lines() {
        let trimmed = line.trim_end();
        match state {
            State::Normal => {
                if trimmed.starts_with("<<<<<<<") {
                    state = State::InOurs;
                    // Don't emit the marker line itself.
                } else {
                    out.push_str(line);
                    out.push('\n');
                }
            }
            State::InOurs => {
                if trimmed.starts_with("|||||||") {
                    state = State::InAncestor;
                } else if trimmed.starts_with("=======") {
                    // Diff3 blocks may omit the ||| section.
                    state = State::InTheirs;
                } else if side == Side::Ours {
                    out.push_str(line);
                    out.push('\n');
                }
            }
            State::InAncestor => {
                if trimmed.starts_with("=======") {
                    state = State::InTheirs;
                }
                // Ancestor lines are never kept.
            }
            State::InTheirs => {
                if trimmed.starts_with(">>>>>>>") {
                    state = State::Normal;
                } else if side == Side::Theirs {
                    out.push_str(line);
                    out.push('\n');
                }
            }
        }
    }

    out
}

// ── Sidecar name ──────────────────────────────────────────────────────────────

/// Produce the sidecar filename for `ConflictPolicy::KeepBoth`.
///
/// `notes/meeting.md` → `notes/meeting.conflicted.md`
fn keep_both_sidecar_name(original_path: &str) -> String {
    match original_path.rsplit_once('.') {
        Some((stem, ext)) => format!("{stem}.conflicted.{ext}"),
        None => format!("{original_path}.conflicted"),
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    // ── Clean merges ──────────────────────────────────────────────────────────

    #[test]
    fn clean_merge_returns_combined_edits() {
        // ours changes line 2; theirs changes line 4 — guaranteed non-overlapping.
        let base = "line 1\nline 2\nline 3\nline 4\n";
        let ours = "line 1\nOUR EDIT\nline 3\nline 4\n";
        let theirs = "line 1\nline 2\nline 3\nTHEIR EDIT\n";

        let out = merge3(base, ours, theirs, ConflictPolicy::Error, None).unwrap();
        assert!(!out.has_conflicts);
        assert!(out.merged.contains("OUR EDIT"), "ours missing");
        assert!(out.merged.contains("THEIR EDIT"), "theirs missing");
    }

    #[test]
    fn identical_content_merges_cleanly() {
        let text = "same\n";
        let out = merge3(text, text, text, ConflictPolicy::Error, None).unwrap();
        assert!(!out.has_conflicts);
        assert_eq!(out.merged, text);
    }

    // ── ConflictPolicy::Error ─────────────────────────────────────────────────

    #[test]
    fn conflict_policy_error_returns_err() {
        let base = "shared line\n";
        let ours = "version A\n";
        let theirs = "version B\n";

        let result = merge3(base, ours, theirs, ConflictPolicy::Error, None);
        assert!(
            matches!(result, Err(GitError::MergeConflict { .. })),
            "expected MergeConflict, got {result:?}"
        );
    }

    // ── ConflictPolicy::Ours ──────────────────────────────────────────────────

    #[test]
    fn conflict_policy_ours_resolves_to_ours() {
        let base = "base\n";
        let ours = "ours\n";
        let theirs = "theirs\n";

        let out = merge3(base, ours, theirs, ConflictPolicy::Ours, None).unwrap();
        assert!(!out.has_conflicts);
        assert!(out.merged.contains("ours"), "expected ours");
        assert!(!out.merged.contains("theirs"), "should not contain theirs");
    }

    // ── ConflictPolicy::Theirs ────────────────────────────────────────────────

    #[test]
    fn conflict_policy_theirs_resolves_to_theirs() {
        let base = "base\n";
        let ours = "ours\n";
        let theirs = "theirs\n";

        let out = merge3(base, ours, theirs, ConflictPolicy::Theirs, None).unwrap();
        assert!(!out.has_conflicts);
        assert!(out.merged.contains("theirs"), "expected theirs");
        assert!(!out.merged.contains("ours"), "should not contain ours");
    }

    // ── ConflictPolicy::KeepBoth ──────────────────────────────────────────────

    #[test]
    fn conflict_policy_keep_both_sets_has_conflicts_and_sidecar() {
        let base = "base\n";
        let ours = "ours\n";
        let theirs = "theirs\n";

        let out = merge3(
            base,
            ours,
            theirs,
            ConflictPolicy::KeepBoth,
            Some("notes/meeting.md"),
        )
        .unwrap();

        assert!(out.has_conflicts, "expected has_conflicts");
        assert_eq!(
            out.sidecar_path.as_deref(),
            Some("notes/meeting.conflicted.md")
        );
    }

    #[test]
    fn keep_both_without_path_has_no_sidecar() {
        let base = "base\n";
        let ours = "ours\n";
        let theirs = "theirs\n";

        let out = merge3(base, ours, theirs, ConflictPolicy::KeepBoth, None).unwrap();
        assert!(out.sidecar_path.is_none());
    }

    // ── Conflict marker parsing ───────────────────────────────────────────────

    #[test]
    fn resolve_markers_ours_keeps_only_ours() {
        let conflict = format!(
            "{} ours\nkeep this\n{} base\nbase line\n{}\ndiscard this\n{} theirs\nafter\n",
            "<".repeat(7),
            "|".repeat(7),
            "=".repeat(7),
            ">".repeat(7),
        );
        let result = resolve_conflict_markers(&conflict, Side::Ours);
        assert!(result.contains("keep this"), "ours present: {result:?}");
        assert!(!result.contains("discard this"), "theirs gone: {result:?}");
        assert!(result.contains("after"), "normal lines kept: {result:?}");
    }

    #[test]
    fn resolve_markers_theirs_keeps_only_theirs() {
        let conflict = format!(
            "{} ours\ndiscard this\n{} base\nbase line\n{}\nkeep this\n{} theirs\nafter\n",
            "<".repeat(7),
            "|".repeat(7),
            "=".repeat(7),
            ">".repeat(7),
        );
        let result = resolve_conflict_markers(&conflict, Side::Theirs);
        assert!(result.contains("keep this"), "theirs present: {result:?}");
        assert!(!result.contains("discard this"), "ours gone: {result:?}");
        assert!(result.contains("after"), "normal lines kept: {result:?}");
    }

    // ── Sidecar name derivation ───────────────────────────────────────────────

    #[test]
    fn sidecar_name_inserts_conflicted_before_extension() {
        assert_eq!(
            keep_both_sidecar_name("notes/meeting.md"),
            "notes/meeting.conflicted.md"
        );
        assert_eq!(keep_both_sidecar_name("plain"), "plain.conflicted");
        assert_eq!(
            keep_both_sidecar_name("file.tar.gz"),
            "file.tar.conflicted.gz"
        );
    }
}
