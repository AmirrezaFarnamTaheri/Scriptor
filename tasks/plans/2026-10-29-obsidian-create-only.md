# MAT-005 — preserve destination notes during Obsidian import

**Review branch:** `fix/obsidian-import-create-only-20261029`; draft [PR #228](https://github.com/AmirrezaFarnamTaheri/Scriptor/pull/228).

## Failure mechanism

`import_note` called `save_note(vault_id, root, &target, &markdown, None)`, which invokes the vault writer without an expected-content-hash precondition. The writer explicitly treats `None` as unconditional save, including when the destination already exists. An import or repeated import could replace existing Markdown and user edits at an identical path. Recovery backups do not justify an implicit destructive import.

## Evidence and test contract

- Test-only commit `d8aa3c9` adds real Rust filesystem cases for a collision plus fresh note in one import, and a repeat import following an edit.
- The added cases must fail on the old unconditional writer and pass only when the destination note remains byte-for-byte unchanged, the new note is created, and duplicate destinations are counted as skipped.
- [CI #40863276455](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/40863276455) was queued at implementation time; no hosted RED is claimed before observing its failing assertions.

## Implementation

Call the existing `save_note` with `Some(EXPECTED_MISSING_CONTENT_HASH)` inside the existing vault writer's mutation lock. Handle only a missing-sentinel hash mismatch as a non-overwriting collision: increment `skipped_files`, append a path-specific explanation to the existing error details, and do not include the destination in `imported_paths`. Preserve other errors, attachment handling, source content, native authorization and vault identity validation. The same rule protects reruns. Avoid non-atomic path-existence probes and adding new mutation authority.

## Acceptance gates

Require focused and full Rust tests on the implementation commit, `cargo fmt --check`, Clippy with denied warnings, frontend/source tests, browser E2E, desktop/Windows and visual checks, and human installed-client collision/retry tests. A test-only CI result is not the implementation's passing result, and hosted tests do not prove packaged-client behavior. Keep draft; do not merge before final evidence.
