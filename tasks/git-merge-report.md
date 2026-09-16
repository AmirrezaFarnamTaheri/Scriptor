# Git Merge-Commit Exact Graph Reproduction Report (S-08, P1-05)

## Executive Summary

During the repository audit, an investigation was opened into Git commit construction under merge conflict resolution in `crates/native-git/src/status.rs::git_commit_selected`.

The defect was **Confirmed**:
1. **Single-Parent Flattening**: In previous versions, `git_commit_selected` invoked `git commit-tree &tree -p &head -m message`, passing only `HEAD` as the parent. When committing the resolution of a merge conflict, the second parent (specified in `.git/MERGE_HEAD`) was ignored. This produced a single-parent commit, severing the merged branch from the Git history graph.
2. **Dangling Merge State**: Git state files (`.git/MERGE_HEAD`, `MERGE_MSG`, `MERGE_MODE`, `AUTO_MERGE`) were never cleaned up after committing the resolution, leaving the working tree in a dangling merge state.
3. **Unchecked Partial Commits**: In standard Git, partial commits during a merge are rejected (`fatal: cannot do a partial commit during a merge`). Scriptor previously allowed selecting a subset of conflicted/changed files, which would commit partial changes while leaving the merge unresolved.
4. **Merge Diff-Tree Blank Outputs**: `git diff-tree -r --root <commit>` emits zero file outputs for multi-parent commits unless `-m` or `-c` is passed, causing `files_committed` to return empty lists.

---

## Reproduction & Verification Harness

An automated reproduction suite was implemented in `scripts/validation/git-merge-repro.mjs`:
- Verified linear fast-forward merge behavior.
- Verified 3-way non-fast-forward merge commit parent topology (`%P` contains `HEAD` and `MERGE_HEAD`).
- Verified Git CLI constraints when `.git/MERGE_HEAD` exists: partial commits are forbidden.

---

## Architectural Remediation in `crates/native-git/src/status.rs`

1. **`read_merge_heads`**: Dynamically queries `git rev-parse --git-path MERGE_HEAD` and extracts all parent hashes (supporting standard 2-parent and octopus merges).
2. **`clean_merge_state`**: Safely removes `MERGE_HEAD`, `MERGE_MSG`, `MERGE_MODE`, and `AUTO_MERGE` after `update-ref` and index reconciliation succeed.
3. **Merge Conflict Invariant**: When `is_merging` is true:
   - Commits are rejected if `status.has_conflicts` is true (`cannot commit while merge conflicts are unresolved`).
   - Commits are rejected if any changed file is not selected (`cannot do a partial commit during a merge`).
4. **Sequencer Invariant**: Rejects commits when `CHERRY_PICK_HEAD` or `REVERT_HEAD` is present.
5. **Multi-Parent `commit-tree`**: Dynamically appends `-p <head>` and `-p <merge_head>` for all merge heads to `commit-tree`.
6. **Multi-Parent `diff-tree -m`**: Added `-m` flag to `diff-tree` and deduplicated `files_committed` so merge resolutions report their affected files accurately.

---

## Automated Test Coverage

Three comprehensive Rust unit tests were added to `crates/native-git/src/status.rs`:
- `selected_commit_during_merge_creates_multi_parent_commit_and_cleans_merge_head`: Injects conflicting edits between `main` and `feature`, triggers a merge conflict, resolves the conflict, calls `git_commit_selected`, and asserts that:
  - `git log -1 --format=%P` contains exactly 2 parent hashes.
  - `.git/MERGE_HEAD` is removed.
  - `files_committed` reports the resolved file.
- `selected_commit_during_merge_rejects_unresolved_conflicts`: Asserts error when committing with active conflict markers.
- `selected_commit_during_merge_rejects_partial_commit`: Asserts error when attempting to commit a subset of files during an active merge.

All 47 unit tests, 3 integration tests, and doc tests pass with 0 failures (`cargo test -p scriptor-native-git`).
