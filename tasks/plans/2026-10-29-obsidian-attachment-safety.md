# MAT-005 — Obsidian attachment import safety

**Stacked** [PR #229](https://github.com/AmirrezaFarnamTaheri/Scriptor/pull/229) on [PR #228](https://github.com/AmirrezaFarnamTaheri/Scriptor/pull/228). Keep the two source-level boundaries separate from renderer lifecycle and native vault-identity work (#219 and #227).

## Observed source risks

- Importing an Obsidian source that contains its destination can cause the walk to visit newly generated attachments and recurse. Reject destination roots within the canonical source root before making files.
- `WalkDir.follow_links(false)` does not traverse symlink directories but returns symlink file entries. The importer's previous extension-only file classifier copied the target bytes for such entries, including outside the selected source.
- The importer resolved only `_attachments`. A nested prefix such as `_attachments/assets` could be a symlink to a directory outside the destination vault; joining and `fs::copy` then wrote there.
- `if dest.exists() { ... }; fs::copy(..., dest)` was a check-then-write race. A second writer could create a destination between those operations, which `fs::copy` then replaced.
- `fs::copy` publishes incomplete destination bytes during a long copy; a failure or process crash can leave a truncated imported asset.

## Test first

Test-only commit [`de6af81`](https://github.com/AmirrezaFarnamTaheri/Scriptor/commit/de6af818f83eebd2599b59ce4c26fda9219623fe) introduces real Unix filesystem tests for a source file symlink and nested destination symlink; neither is covered by a source-regex-only assertion. Do not claim observed RED until a failing assertion is visible on the test-only head. Existing attachment round-trip and repeated import tests remain part of the gate.

## Implementation strategy

- Ignore symbolic links and other non-regular files returned by WalkDir. Recheck the source file type before opening it.
- Parse the full destination as a `RelativeVaultPath`, validate with `VaultRoot::resolve_relative`, create missing parents, then revalidate the full destination path.
- For performance, check if a destination already exists, but **never** treat that check as the concurrency guarantee.
- Copy into a unique create-new staging file and `sync_all`; use `hard_link` to publish atomically without clobber. A scoped cleanup guard deletes staging after every success/error.
- Hold the established vault mutation lock for final publishing and check pending rename transactions; do not hold it during potentially large file copies.
- Treat only an existing final attachment as an import skip. Preserve all non-collision errors in the import report. Do not copy outside the vault.

## Verification and limitations

Require exact implementation-head Rustfmt/Clippy/full Rust tests, source-contract checks, browser E2E, desktop platform compilation and visual acceptance. Confirm installed-client source/destination symlink handling, existing attachment collisions, large-file interrupted copy cleanup, and relevant supported filesystems for hard-link behavior. No installed-client proof or comprehensive race-hardening claim is made from source inspection. A malicious external process replacing directories between path resolution and opening staging remains a threat requiring descriptor-relative filesystem primitives for complete elimination.
