# Rust boilerplate assessment

Source: the user-provided `Rust Boilerplate` directory on the desktop. The directory was inspected read-only. A content scan covered 321 files (314 Rust files; 8,732,734 bytes); deeper review focused on persistence, refresh, process supervision, Google integration, Markdown checkpoints, and file boundaries.

The [per-file inventory](rust-boilerplate-inventory.json) records every scanned relative path, content hash, size, category and targeted-review marker. This makes coverage auditable; a complete content screen does not mean every excerpt received a correctness review. Categories are screening aids, not a suitability or license determination. Fourteen source files received targeted review.

The collection is a set of excerpts from several systems, rather than a buildable template: it has repeated numbered module names, external crate references, unrelated graphics/compression code, and no common Cargo manifest. Patterns can be adapted to Scriptor's existing crates; copying whole modules would import unstated dependencies and assumptions.

| Source | Useful idea | Application in Scriptor |
|---|---|---|
| `google_drive.rs`, `google_docs.rs` | Bound pages independently from item count; preserve provider identities and cursors; separate metadata enumeration from content fetch | Use these constraints when extending collaboration transport. The excerpt uses Composio; Scriptor retains its native OAuth/Drive transport. |
| `oidc_refresher.rs`, its tests, `external_refresher.rs` | Scope retry budgets to credential generations; distinguish failed connectivity from credential revocation; serialize refresh races | Retain the operating-system keychain and review refresh handling with generation-specific regression cases before adding unattended polling. |
| `persist.rs`, `persist_tests.rs` | Durable host-owned state with explicit source namespace and stable document identity; propagate persistence failures | Keep vault provenance and persisted view identities explicit. Asset replacement now propagates failure to inspect existing content, rather than treating that failure as absence. |
| `native_store.rs`, `supervise.rs` | Owner-bound sessions; restart-idempotent state; drain bounded logs before terminal status; explicit cancellation | Persistent console work must extend the existing process broker with ownership and lifecycle tests. Copying its SSH/cloud job commands would bypass Scriptor's broker. |
| `checkpoint.rs` | Cache only stable top-level Markdown boundaries; preserve source offsets separately from rendered output | Relevant to future incremental rendering; existing complete-document renderer stays authoritative. No checkpoint implementation is copied. |
| `bash.rs` | Windows shell selection should distinguish Git Bash from the WSL launcher; avoid drive-colon interpretation in Unix tools | Keep shell selection explicit in brokered workflows and verification. Mobile packaging uses explicit installed toolchain paths and restores environment variables afterward. |
| `file_io.rs`, `utf8_util.rs`, `error.rs` | Boundary/error semantics must match the host, not merely the example | Scriptor keeps vault confinement and Unicode-safe standard operations. A helper that exits the process on missing credentials cannot be used inside the desktop library. |

## Implemented adaptations

- Guarded frontmatter writes preserve the revision loaded by the table, reject multi-line cell injection, and retain note bodies. Behavioral tests cover stale rejection and successful retry from a fresh revision.
- Reviewed bibliography imports can request a missing destination and bind the expected vault. An unreadable existing asset is an error; it is never silently replaced.
- Android debug packaging has an optional project-owned signing key, single-worker memory limits, verified native-library destination, and restored process environment. It does not modify the global debug keystore.
- Reader annotation queues bind writes to the originating vault and retain a stable queue across callback changes. Failed flushes release the close gate so the user can retry. Annotation storage validates its parent path and rejects non-file destinations; unrelated inspection failures cannot trigger corrupt-store quarantine.
- Collaboration first shares use an unknown ancestor represented by empty content. An incoming first share can therefore apply to an empty local note, while differing existing local content remains available in an explicit conflict. Reviewed merges pass through the editor save coordinator and content-hash comparison before writing.

These are new implementations within Scriptor's architecture. No source file, credential material, telemetry uploader, cloud job launcher, or unrelated compression/graphics implementation was copied from the collection. Further sync/runtime adaptations remain subject to behavioral tests and the existing capability contracts.

## Complete reinvestigation on 2026-10-01

The [second inventory](rust-boilerplate-reinvestigation.json) records a fresh complete content screen of all 321 files, with import roots, function counts, tests and boundary signals. Tests appear in 134 files, `unsafe` markers in 20 and license markers in eight; these are screening observations, not a vulnerability or license verdict. The initial fourteen-file targeted review is supplemented by the following method-level inspections.

| Additional source | Assessment | Disposition |
|---|---|---|
| `auth_backend_contract_tests.rs` | Distinguishes explicit top-level permanent OAuth codes from malformed, nested, throttled and server failures; concurrent refresh tests recheck state inside the lock | Adapted response classification to native Google refresh, with a failing regression before correction; bounded token reads and checked expiry arithmetic added. Existing refresh locking retained. |
| `auth_provider.rs`, `auth_provider_tests.rs` | Explicit program/argument execution, timeout ceilings, capped output and cache keys including provider configuration | Useful runtime lifecycle test ideas. Its shell fallback and first-party credential environment injection are not adopted; all Scriptor processes stay brokered. |
| `compute.rs` snapshot methods | Hash-verified immutable snapshots, streamed hashing, private storage and concurrent destination checks | Apply the immutable snapshot principle when closing deployment staging races. Do not copy its cloud launcher, shell snapshot script or deletion of existing invalid destinations. |
| `file_serve.rs` range/response methods | Handles suffix ranges, empty/unsatisfiable ranges, bounded lengths, `nosniff` and sandboxing of active document formats | Useful contracts for broader media previews. Scriptor currently serves bundled reader assets, so byte-range equivalence is not claimed. |
| `open_code_highlighter.rs` streaming state methods | Memoizes stable completed lines and clones tentative tail state; explicitly documents quadratic output rebuilding | Stable/tentative boundary is useful; no claim that this excerpt solves end-to-end rendering complexity. |
| `config.rs` credential methods | Uses a private-file credential store but treats unreadable or malformed files as absence | Rejected for Scriptor: retain the OS keychain and distinguish missing state from inspection failures. Do not import external service endpoints or contact identities. |

Native Google command unit tests pass (24), including temporary-error retention, permanent-code handling, response bounds, token validation and overflow/zero-lifetime rejection. This is local verification; live provider credentials were not used. The complete report reread and outstanding adoption work are tracked in [the acceptance addendum](../validation/REVIEW-REREAD-2026-10-01.md).
