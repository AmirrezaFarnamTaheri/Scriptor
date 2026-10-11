# Native boundary review — 2026-10-04

This focused review covers native security, data integrity, and lifecycle behavior for the final cross-product polish checkpoint. It does not claim that every native module or provider integration has been exhaustively verified. The shared working tree also contains independently owned renderer, visual, health-repair, and backup changes.

## Coverage

CodeGraph was used to inspect callers and boundary relationships before targeted source review. Coverage includes source-file save/recovery, shared vault filesystem helpers, bounded code-cell sessions, Overleaf synchronization, immutable Drive/Docs collaboration revisions, publication processes, resource approval/staging/quarantine, desktop and daemon export adapters, and reader input paths. Runtime, Overleaf, collaboration, and publishing command modules were read completely. Resource discovery and reader review concentrated on the affected input, hashing, copying, and preview boundaries rather than every unrelated function.

The product, design, architecture, and capability-maturity requirements were read. Source/sync/runtime/publishing capabilities retain their existing maturity classifications. No local tests, builds, installs, application servers, or browser workloads were run. Scoped Rust formatting used read-only formatter output and explicit patches.

## Confirmed defects addressed

| Area | Defect and correction | Regression evidence authored |
| --- | --- | --- |
| Source recovery | Default directory/file permissions could expose a private file's preimage through recovery files and JSON receipts. Exclusive recovery directories and files now use owner-only Unix permissions. | `private_source_recovery_keeps_preimages_and_receipts_private` |
| Runtime mailboxes | Newly created runtime mailbox directories inherited default Unix permissions before cell requests/results were written. New missing directories now use the shared private-directory primitive. | `runtime_mailbox_is_private_before_sensitive_cell_files_are_written` |
| Vault locks | A linked `.scriptor` directory or linked lock sidecar could redirect lock creation/use outside the intended vault. Observed symlinks and nonregular lock storage now fail before those side effects. | `mutation_lock_rejects_linked_internal_storage_without_external_side_effects`; `update_lock_rejects_linked_sidecar_without_using_an_external_lock` |
| Export origin | Awaited renderer preprocessing could submit old-vault content to the subsequently selected native vault. Desktop and public daemon export adapters now validate optional originating-vault identity against a held session lease before dispatch. | `export_session_rejects_a_different_origin_before_creating_outputs`; contracts in `headless-vault-race.test.mjs`; renderer-owned export integrity regressions |
| Background export identity | Headless start generated a desktop job UUID while ignoring the daemon's independent job UUID, causing polling to reject the actual job. Start now returns/emits the daemon's ID, and polling rechecks the originating vault before each status dispatch. | Dedicated contract in `headless-vault-race.test.mjs`; native/provider runtime verification remains pending |
| Publication origin | Publication plan/apply accepted paths and hashes without an originating-vault parameter. Both commands now validate identity before resolving output paths or consuming the mutation authorization grant. | `publish-authorization-contracts.test.mjs`; renderer-owned publication lifecycle regressions |
| Reader paths | A URL such as `https://example.test/a.png` could parse as a relative filename on Unix even though Windows rejected it. Shared reader path validation now rejects URLs, drive-prefixed strings, backslashes, and control characters on every platform. | Expanded `raster_and_audio_previews_are_bounded_without_expanding_annotation_types` |
| Collaboration identity | A partial Drive list response could be mistaken for proof of zero/one matching revision. Duplicate-identity queries now request completion metadata, and incomplete/ambiguous responses fail before immutable writes. Docs append uses the same check. | Expanded `immutable_revision_identity_rejects_ambiguous_existing_records` |
| Resource destinations | Rename fallback could merge into an existing destination and subsequently delete unrelated content during failed verification. Moves reject observed existing destinations, and fallback copies exclusively create each owned path. Copying rechecks the approved source before deletion and revalidates the approved destination after staging. | `verified_move_preserves_a_destination_created_after_review`; `copy_never_merges_with_or_overwrites_an_existing_destination` |
| Resource approval coverage | Hashing skipped all hidden content while copying included it, allowing unreviewed hidden changes and size-bound bypasses. Both paths now use the same explicit OS-metadata exclusion policy; other hidden files/directories participate in approval and verification. | `hidden_resource_content_is_hashed_copied_and_rechecked`; `resource_hash_ignores_operating_system_metadata`; `resource_metadata_exclusions_are_explicit_and_preserve_hidden_content` |
| Resource work bounds | Manifest reads were unbounded, file growth could outrun metadata-only bounds, and empty-directory entry counts were not capped. Manifest/hash reads and streaming copies now enforce actual byte bounds; both traversals enforce file, entry, and depth limits and reject nonregular content. | `resource_reads_enforce_the_requested_bound_and_regular_file_type`; `resource_reads_reject_observed_symbolic_links`; `hidden_oversized_content_cannot_bypass_resource_limits`; `copy_enforces_file_byte_and_entry_budgets_without_retaining_partial_outputs` |

Drive can return partial or empty pages before the end of a list, so a matching first-page count alone does not establish identity uniqueness. The implementation fails closed when completion metadata is inconclusive rather than silently treating that page as complete. [Google Drive files.list documentation](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/list).

The shared filesystem primitives also support the parent-owned health-repair privacy correction and its `private_asset_recovery_and_restoration_preserve_confidentiality` regression. The parent separately corrected the backup recovery test's obsolete phase expectation and added subsequent retry/restoration assertions; this lane made no backup behavior change.

## Inspected without a new behavioral patch

- Overleaf: fixed supported Git invocation, bounded process execution, selected-path/blob checks, remote comparison and non-force push, and preservation of unrelated index state. No live Overleaf account operation was performed.
- Publication runner: process broker use, output/error handling, token redaction, and snapshot receipts. The modification in `publishing.rs` is formatting only.
- Runtime lifecycle: session ownership, authorization scope, start/stop transitions, execution bounds, and cleanup. Interpreter execution was not performed locally.

## Verification and limitations

The hosted baseline reported by the parent for `15b94b138` had 128 passing native Linux tests and two failures. The reader failure is addressed here; the backup failure is addressed by the parent. Browser/mobile baseline results belong to the cross-product report and do not prove this uncommitted checkpoint. All newly authored behavioral tests, updated source contracts, compilation, and platform execution are pending the next GitHub worker run.

Source contracts verify command wiring and ordering; they do not replace runtime job-lifecycle or provider integration tests. Unix privacy tests verify POSIX permissions. Windows creation retains inherited ACL behavior and has no new owner-only ACL claim. Path checks reject observed symlinks; they do not constitute descriptor-based protection against an adversarial local process replacing paths between system calls. Existing resource content normalization remains the identity policy, so its hash is not a promise of raw-byte equality. Live Drive/Docs, Overleaf, external publishing, and installed interpreter checks remain separate provider/environment verification.

The optional origin arguments are additive wire changes. Interactive renderer callers pass captured identity; legacy callers that omit it retain compatibility and the existing session/capability checks. No new native command or IPC method was added.
