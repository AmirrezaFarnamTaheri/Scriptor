# Scriptor engineering audit and targeted remediation — 2026-10-11

## Evidence scope and provenance

- **Repository:** `AmirrezaFarnamTaheri/Scriptor`.
- **Examined source:** user-supplied `Scriptor-main(5).zip`, version `1.2.8`, compared with GitHub `main` at `e753f83c6ce2704bdbfaed4d6ddecca6791647b3` (2026-10-11 07:51:33 UTC). The source archive has no `.git` metadata; its version and representative files match the live main revision. An entire-tree byte-for-byte comparison against that commit was not performed.
- **Hosted baseline CI:** [run 38122794749](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/38122794749), at `e753f83`. Seven of eight jobs passed. The Browser E2E job failed one of 466 Playwright tests; 465 passed. The failed test was `e2e/report-remediation.spec.ts:39`, triggered by an internal canvas save pathname containing a UUID in `.canvas-footer`.
- **Local execution:** Node 22.16.0, Linux container, source archive without a Git worktree. Global TypeScript was temporarily linked into the unpacked working tree for a source-level VM test harness. `pnpm` could not be provisioned due package-registry DNS errors; Cargo/Rust toolchains and a supported Playwright browser were not installed. No full app build, native Rust test run, packaged desktop smoke, or post-change hosted CI was possible.
- **Change scope:** this pass implements verified high-value canvas state/persistence and UX corrections; it does **not** claim a line-by-line verification of every Scriptor subsystem, live-provider/device compatibility, or general production readiness. Files outside the patch were inventoried or selectively inspected as identified below.
- **GitHub mutations:** none. No commits, pushes, PR creation, merges, release publication, or protected-branch updates were performed. Deliverable is a local unified patch and the report in the source archive.

## A. Executive summary

Scriptor has an extensive multi-language, multi-crate desktop architecture and meaningful existing automated quality gates. The current main revision was **not CI-green**: one canvas E2E regression exposes internal UUID-bearing persistence filenames instead of a human-readable save message. Independently exercising the canvas hook uncovered additional **reproduced** risks: initial hydration and late board reads could replace a more recent local edit; creation could replace the current board before a native save succeeded; creation and switching could continue across stale vault lifecycle boundaries; and a successful write could be reported as failed when a derived board-list refresh failed.

The patch addresses these issues without changing the vault's on-disk Markdown/Canvas formats or native authorization. It adds deterministic source-level failure-injection tests for each state race, aligns UI status assertions, scopes selection to the current board, and records the changes in the changelog/help guide. **Nineteen canvas state/persistence tests** and the broader **245-source-test** suite pass in the local harness; a further **63** infrastructure/release-contract tests pass. Post-patch browser, TypeScript typecheck, Cargo, macOS/Windows/Linux native and deployment checks remain unavailable and are not claimed as passing.

A distinct **unresolved** native correctness issue was found: `apps/desktop/src-tauri/src/commands/canvas.rs` writes a board, then updates derived relation indexes; if indexing fails, the command returns `Err` despite the successful write. The renderer can therefore treat a committed write as a failed save and retry it. This needs a typed partial-success receipt or equivalent clear cross-boundary contract with Rust/TypeScript compatibility and native tests. This patch deliberately does not guess the correct native API contract without a Rust test environment.

## B. Repository coverage ledger

**Inventory counts:** `src/` 570 files; `apps/desktop/` 102 files; `crates/` 245 files across 19 crates; `packages/` 279 files across 13 packages, excluding `packages/test-fixtures/`; `scripts/` 153 files; `e2e/` 131 files; `.github/workflows/` 13 workflows; `docs/` 382 files. The extracted archive also contains approximately 31,000 synthetic fixture files. Synthetic data, vendored/generated assets, and duplicate fixture contents were excluded from individual source review, not from the repository map.

| Subsystem | Responsibility | This pass | Execution evidence | Scope limitation |
|---|---|---|---|---|
| `src/components/CanvasPanel.tsx`, `src/hooks/useCanvasBoard.ts` | Board lifecycle, selection, persistence and user feedback | Cross-layer inspection; corrected and source-tested | 19 canvas hook tests pass; TS transpile succeeds | Browser E2E postpatch not run |
| `apps/desktop/src-tauri/src/commands/canvas.rs`, `crates/canvas-engine/src/{store,scene}.rs` | Native canvas validation, vault binding, atomic writes, relation indexing | Targeted source and boundary review | Tauri/native source-contract checks; no Rust execution | Partial-success native outcome unresolved |
| `src/`, editor and renderer packages | Editor/workspace, Markdown, preview, UI state | Structural inventory, sink tracing and representative code inspection | 793 TS/CSS files covered by frontend-quality policy; source tests | Not a full per-component behavioral audit, no screenshots |
| `crates/vault/`, native backup/restore commands | Local files, atomic writes, restore state and crash recovery | High-risk source inspection including restore journal phases | Source-level backup fault tests pass | Native crash/power-loss tests not executed |
| `crates/indexer/`, search and graph | SQLite/FTS, derived indexes, backlinks and relations | Architectural path review and representative checks | Search and protocol source-contract tests pass | Database stress/migration tests not run |
| `crates/ipc/`, `crates/daemon/`, CLI/TUI | Authenticated local services, command routing and lifecycle | Interface/boundary inventory | Operation/source checks pass; prior hosted Rust job passed at original SHA | No malformed-frame fuzzing here |
| `crates/system-bridge/`, `crates/export-runner/`, `crates/publish-runner/` | External execution, export/publish and resource controls | Process-entry inspection and existing policy checks | Native-source/CI contract checks; hosted job success at original SHA | Sandbox limits not exercised on target OSs |
| Plugins, MCP, AI, WASM and embeddings | Extensibility, permissions and optional engines | Structural inventory, selected manifests and contracts | 55 brokered, 95 read-only and 55 local-mutation command classifications validated | Independent authorization exploits/fuzzing not executed |
| Google integrations, citation, capture, reader, annotations, collaboration | Connected and local workflows | Selective boundary inspection plus runnable source tests | 245 source tests include Google, reader, editor, collaboration and startup lifecycles | Live provider/OAuth/device tests missing |
| `e2e/`, `scripts/validation/`, `scripts/release/` | E2E, quality gates, release correctness | Full test-file inventory; focused CI failure tracing | 245 source cases + 63 infra cases pass; hosted 465/466 baseline Playwright | Postpatch full browser suite absent |
| `.github/workflows/`, packaging and docs | CI matrices, release automation, contributor docs | Workflow/toolchain inspection and source policies | 13 workflows/85 immutable external action uses pass pin policy | No signed/unsigned installer validation here |
| Localization, accessibility and visuals | Strings, RTL, keyboard, layout and themes | Static policy plus canvas status/select state | 3 runtime locales with 1,102 parity keys each; hosted visual lane passed prepatch | Manual screen-reader, i18n wording, native views not evaluated |

**Status terms:** “pass” above refers to commands actually executed locally or baseline hosted jobs at the explicitly stated original SHA; static policy pass is not a runtime/OS proof. “Inspected” does not mean behavior verified. No subsystem outside the modified canvas path is claimed fully audited.

## C. Architecture, system boundaries, and invariants

The core path reviewed was:

`CanvasPanel` interaction → `useCanvasBoard` state/history/CRDT adapter → `src/bridge/canvas.ts` → Tauri `canvas_save_document` or `canvas_load_document` → active vault and canvas-capability validation → `scriptor_canvas_engine::{save_document,load_document}` → vault `atomic_write` → optional relation-index synchronization → asynchronous response → UI status and board list.

Relevant invariants and outcomes:

1. **No stale read may replace a newer edit.** Loading now snapshots the current document identity before the async fetch. A response is discarded if a local edit replaced that document. Startup board-list hydration also guards against an edit made before the list resolves, including the error fallback path.
2. **Switching/creation cannot bypass unsaved-work protection.** Both flush pending writes first; both now capture the lifecycle and current document *before* awaiting that flush, rejecting an operation if the vault/document changed in the meantime. Native save of a new board finishes before that board becomes selected.
3. **Persisted state is separate from derived-list state.** A successful native canvas-save response remains successful even when subsequently refreshing `canvasListDocuments` fails. The UI reports a precise warning instead of attempting a redundant retry.
4. **Selection has an owner.** `CanvasPanel` ties selected block IDs to `document.id`; another board cannot inherit that selection or the actions it enables.
5. **Native authorization remains authoritative.** `canvas_save_document` validates both `expected_vault_id` and the document's `vault_id` against the active session, and the canvas capability is checked. Renderer guards are for UX/data-race safety, not substitutes for native authorization.

**Unresolved contract split:** `canvas_save_document` performs native atomic persistence before `sync_relations`; the latter can return an error. The current result type is `Result<String,String>`, which cannot distinguish “write failed” from “write succeeded but indexing failed.” A structured committed-write receipt with a separate index-warning field is preferable to brittle string-matching; it requires native tests and coordinated bridge/contract changes.

Other architectural concerns found only as **inspection leads**, not confirmed defects in this pass: lifecycle ownership across daemon/renderer interfaces, process-budget enforcement on every optional export tool, and exact consistency of authenticated IPC reconnect/resync guarantees.

## D. Findings and remediation status

| ID | Severity | Area / evidence | Reproduced behavior and violated invariant | Root cause / correction | Verification and status |
|---|---|---|---|---|---|
| CAN-01 | P1 | `useCanvasBoard.ts`: `loadBoard` | Delayed native read overwrote a document changed while loading | Missing document-identity condition after `await`; reject stale response | Red-before/green-after hook test; **corrected locally** |
| CAN-02 | P1 | `useCanvasBoard.ts`: mount hydration/fallback | Edits made during initial board listing could be replaced by initial load or fallback | Mount query didn't bind to pre-hydration document; guard success/error paths | Two additional injected-latency/error tests; **corrected locally** |
| CAN-03 | P1 | `useCanvasBoard.ts`: `createBoard` | Native creation failure could leave an unsaved newly selected board and displace prior context; a late success could overwrite intervening edits | Board selection happened before native durability/without stale-response guard; save first, then verify lifecycle/document | Two red-before/green-after tests; **corrected locally** |
| CAN-04 | P2 | `useCanvasBoard.ts`: `enqueueSave` | Board written successfully but auxiliary list failure caused false “Save failed” and a retry | List refresh shared the write's catch block; isolate failure handling | Red-before/green-after test; **corrected locally** for `canvasListDocuments` failures |
| CAN-05 | P1 | `useCanvasBoard.ts`: switch/create | Vault change while waiting on prior saves could continue a stale operation | Snapshot taken after the awaited flush or absent; pre-flush lifecycle/document token now checked | Red-before/green-after create test, switch test; **corrected locally** |
| CAN-06 | P2 (CI blocker) | `report-remediation.spec.ts:39–49`, `useCanvasBoard.ts` status, `e2e/canvas.spec.ts` | Saving showed `.scriptor/canvas/canvas-<UUID>.json`; current main CI had 465/466 E2E pass | Internal file path shown in user status, conflicting test assertions; display `Canvas saved.`, update old assertion/help | Source review and amended Playwright assertions; **corrected locally; browser rerun pending** |
| CAN-07 | P2 | `CanvasPanel.tsx`: selection | Selection IDs from previous board remained active/announced after board replacement | Selection lived for panel lifetime; bind selection to board ID | Added E2E regression; **corrected locally; browser rerun pending** |
| CAN-08 | P2 | `apps/desktop/src-tauri/src/commands/canvas.rs`: `canvas_save_document`, `sync_relations` | A board may be written but native index failure returns `Err`, which renderer mistakes for write failure | Persist/derived-index outcomes collapsed into one error channel | **Open:** introduce typed partial-success receipt and Rust integration tests |

Evidence type: CAN-01 through CAN-05 were reproduced in a hook harness with deferred promises and controlled native commands, initially failing before their fixes. CAN-06 is directly proved by GitHub Actions Playwright logs at the original main SHA. CAN-07 is source-confirmed, with a new end-to-end assertion authored but not executed. CAN-08 is a logically complete cross-boundary execution trace; its actual occurrence under induced index failure has not been exercised natively. The patch does not claim that any issue was actively exploited or that an unrelated subsystem is defective.

## E. Implementation summary

| Modified file | What changed |
|---|---|
| `src/hooks/useCanvasBoard.ts` | Split save success from derived-list refresh; human-readable save confirmation; stale-load protection and mount hydration guard; durable create-before-select; serialized flush/creation lifecycle checks; in-progress creation guard |
| `src/components/CanvasPanel.tsx` | Selection owner tracks the active board, no duplicate selection status in footer, disabled New board during outstanding create |
| `e2e/canvas.spec.ts` | Expect a human-readable save result; add test for clearing prior-board selection after creation |
| `scripts/validation/canvas-persistence-flush.test.mjs` | Add 10 source-level tests with deferred native operations, a fault-injection read/write harness and assertions about edits, hydration, vault switching and duplicate creation |
| `src/lib/help/guides-knowledge.ts` | Align Canvas guidance with the actual user-visible status and header rather than internal save paths |
| `CHANGELOG.md` | Record corrections and validation link |
| `docs/validation/SCRIPTOR-ENGINEERING-AUDIT-2026-10-11.md` | This provenance and limitations report |

No changes were made to Rust commands, SQLite schema, IPC wire frames, vault file formats, privileged plugin permissions, release scripts, or external integrations.

## F. Verification matrix

| Evidence | Original/baseline | After local patch | Classification / limitations |
|---|---|---|---|
| Canvas hook state/persistence regression suite | Original 9 pass; additional regression cases reproduced 6 distinct failure modes | **19/19 pass** | Executed Node source/VM harness, not full Tauri native |
| `node --experimental-strip-types --test scripts/validation/*.test.mjs` (via `NODE_OPTIONS`) | Not captured before change | **245/245 pass** | Executed locally; includes canvas, editor, vault, recovery, integrations and contracts |
| Node `scripts/contracts`, `scripts/benchmarks`, `scripts/release`, `scripts/packaging` test files | Not captured | **63/63 pass** | Executed locally |
| Frontend static policy | Baseline not captured | **Pass: 793 TS/CSS sources** | Executed `scripts/validation/frontend-quality.mjs`, not ESLint or TypeScript typecheck |
| Documentation contracts | Baseline not captured | **Pass: 15 required documents** | Executed `scripts/validation/docs-contracts.mjs` |
| Tauri command contracts | Baseline not captured | **Pass: 195 bridged / 205 registered handlers** | Static consistency checks, not per-command security execution |
| Authorization inventory | Baseline not captured | **Pass: 55 brokered / 95 read-only / 55 local-mutation** | Static classification, not exhaustive capability fuzzing |
| GitHub Action pin policy | Baseline not captured | **Pass: 13 workflows, 85 external uses** | Action identity/immutable pin static check |
| Localization key parity | Baseline not captured | **Pass: 3 locales, 1,102 keys each** | Key presence; does not prove translations or all six docs locales are good |
| Rust manifest/lock workspace consistency | Baseline not captured | **Pass: 21 packages** | Static manifests/lock consistency; full Cargo check unavailable |
| RustSec exception ledger | Baseline not captured | **Pass: 12 exceptions** | Ledger policy only; not a clean dependency advisory report |
| CSS custom-property policy | Baseline not captured | **Pass: 72 CSS files** | Static CSS policy, not screenshot/manual contrast testing |
| Changed TypeScript/TSX transpilation | Not captured | **Pass for 4 changed TS/TSX files** | Transpile syntax, not type check |
| Original `main` CI | **Failed:** 7 of 8 jobs passed; E2E **465 pass / 1 fail** | **Not run postpatch** | Hosted record belongs only to original commit |
| `pnpm install`, `pnpm lint`, `pnpm build`, full Playwright | Not run locally | **Blocked** | Registry DNS/no installed toolchain/browser; no pass inferred |
| Cargo tests/clippy/fmt, platform installers, live services | Not run locally | **Blocked / not evaluated** | Rust missing, no Windows/macOS hosts or OAuth device accounts |

The isolated renderer validation runners also passed for safe external URLs (15 checks), merge (10), citations (10), headless (1) and Canvas (8). Some unrelated runner entrypoints require the absent installed workspace packages; these are environment blockers, not failed product assertions.

## G. Before/after measurements

**No valid performance before/after measurements were collected.** The increased regression-test count and passing policy scans must not be represented as faster startup, lower typing latency, improved memory use, lower CPU, smaller bundles or increased throughput. The existing hosted Windows performance smoke and independent visual workflow passed at the **original** SHA; no postpatch performance assertion is made.

## H. Security and data integrity

- **Confirmed fixes:** prevent Canvas async reads/new-board activation from overwriting an intervening edit, prevent stale create/switch operations crossing vault lifecycle checks, and separate committed persistence from derived-list refresh failure.
- **Native enforcement observed:** canvas permission/capability check, expected vault identity check for saves, document vault identity check for saves and `scriptor_vault::atomic_write` at board storage. These were source inspected but not executed here.
- **Backup and restore:** native source includes journal states, durable flushes and recovery error cases; source-level fault tests passed. Actual power-loss/process-kill recovery remains unverified in this run.
- **Preview and embeds:** identified HTML injection sinks and inspected their canonical sanitizer flow (`packages/renderer/src/pipeline.ts`, `embed-client.ts`, MarkdownPreview, visual block renderer). No exploit was demonstrated; this was not an exhaustive malicious-HTML fuzz test.
- **External process security:** sampled `crates/system-bridge/src/process.rs` and direct export subprocess call sites. Sandbox, resource and process-tree limits require target-platform execution; no assurance claim is made from source inspection alone.
- **Supply chain:** all observed action uses satisfy the immutable pin policy. Twelve RustSec exception-ledger entries satisfy repository policy, which does not mean there are zero advisories. Original CI's supply-chain job passed; postpatch advisory scan not rerun.
- **Residual native canvas risk:** `canvas_save_document` returns an error after successful persistence when derived indexing fails (CAN-08). Address by returning separate committed-write success and index warnings, with forced-index-failure tests and UI treatment.

## I. UI, workflow and accessibility

- User-visible canvas save feedback no longer exposes UUID-bearing internal storage paths, preventing debug identifiers from competing with selection status.
- Canvas selection is board-owned; the E2E test verifies the previous selection disappears on new board creation.
- Board creation remains disabled during its pending native save and failed creation preserves the previous document and edit context.
- Existing panels, styling, visuals, focus traps and keyboard gestures are otherwise preserved. No visual redesign was attempted without a rendered-screen baseline.
- Full responsive/RTL/zoomed screenshots and screen-reader review for the patched build are **pending**, not simulated.

## J. Outstanding work and explicit blockers

| Priority | Item | Why it remains | Prerequisites / recommended action | Acceptance evidence |
|---|---|---|---|---|
| **P1 release blocker** | Postpatch CI and full E2E | No commit/push authorized; local package/browser installation unavailable | Apply patch on branch; provision locked deps; run full hosted matrix, including exact failing test and added Canvas E2E | All checks pass on exact patched SHA; screenshot report and logs retained |
| **P2** | CAN-08 write-vs-index outcome contract | Requires coordinated Rust and frontend API change | Introduce typed save receipt with path + optional relation index warning; avoid text parsing; test forced derived-index failure | Native save durable, frontend neither falsely retries nor hides indexing warning |
| **P1 verification gap** | Real vault crash/power-loss resilience | Rust/OS not available | Kill/fault injection at each restore journal transition; exercise Windows/macOS/Linux | Recovery tests preserve content/rollback proof and forbid unreconciled sessions |
| **P1 verification gap** | Sensitive command authorization matrix | Static classification does not cover direct invocation attacks | Exercise all 195 bridged commands with denied/expired/wrong-vault/oversized inputs and independent native clients | No unauthorized side effects, bounded outputs |
| **P1 verification gap** | Live Google/provider and packaged OAuth | E2E tests rely on fixtures/mocks | Controlled provider/device test accounts and packaged desktop builds | Document verified scopes, token lifecycle and failure recovery |
| **P2 verification gap** | Process resource limits and plugin isolation | Only inspected portions of process launcher | Run timeout/memory/CPU/process-tree tests on supported OSs | Demonstrated enforced bounds, cleanup and denial behaviors |
| **P2 verification gap** | Editor/Markdown fidelity | No full native interactive test on modified build | Large-doc, IME, RTL, math/table/footnote/source-preview round trips | Content preserved byte-for-byte except intentional edits |
| **P2 verification gap** | Manual a11y and responsive quality | Browser/desktop runtime unavailable | Keyboard, assistive technology, narrow/zoom/RTL themes with screenshots | No new keyboard, focus, contrast or overflow regressions |
| **P2 verification gap** | Performance trends and stress scale | No valid paired benchmark run | Same-host before/after startup, 1k/5k/25k note, editor/input, memory | Recorded comparable distributions and no regressions |
| **P3** | Review whole remaining codebase at function level | This pass inventories but does not individually verify thousands of source/fixture files | Separate reviewable, subsystem-specific follow-ups | Per-subsystem trace, repro, fix, tests and limits in coverage ledger |

“Verification gap” is not a confirmed new defect. It records absent evidence and must not be converted into a claim of insecure or broken runtime behavior.

## K. Readiness verdict at patch handoff

| Dimension | Status | Explanation |
|---|---|---|
| Local canvas state logic | **Verified with limitations** | 19 deterministic hook tests pass; no actual WebView postpatch |
| General build correctness | **Incomplete** | Changed modules transpile; pnpm/Rust build not available |
| Core Markdown correctness | **Not fully evaluated** | Selected source/validation suites pass, not native round trips |
| Data integrity | **Verified with limitations for corrected Canvas races** | In-memory fault injection, not filesystem power-loss matrix |
| Security | **Incomplete** | Static boundary inspection, not exhaustive native tests/fuzzing |
| Desktop reliability | **Not evaluated postpatch** | Original desktop workflow passed only at baseline SHA |
| Feature completeness | **Not fully evaluated** | Functional feature inventory not equivalent to live service verification |
| UI/UX quality | **Partially corrected, pending rendered review** | Readable status and board selection; no postpatch screenshot |
| Accessibility | **Incomplete** | Static policies pass, manual assisted testing absent |
| Performance | **Not evaluated postpatch** | No paired benchmarks |
| CI health | **Failed at baseline / postpatch pending** | 465 E2E tests passed and one failed on main; fix requires hosted rerun |
| Release readiness | **Blocked** | No postpatch gate nor cross-platform installer proof |
| Documentation | **Updated and statically validated** | Changelog, help and this dated record; translation review outstanding |

### Recommended verification handoff

1. Inspect and apply the supplied unified patch on a clean branch at `e753f83c6ce2704bdbfaed4d6ddecca6791647b3` (verify ancestry before applying). Do not cherry-pick blindly if main has advanced.
2. Run frozen-lockfile installation, full lint/typecheck, Cargo workspace checks, `pnpm check:release`, `pnpm test:e2e`, `pnpm test:visual`, and packaged desktop smoke on the patched SHA. Resolve new issues without disabling existing checks or reducing test assertions.
3. Confirm the previously failing `e2e/report-remediation.spec.ts` passes, run the new board-selection test, and validate native Canvas new-board/save behavior under a writable and read-only vault.
4. Track CAN-08 as an explicit follow-up until the save/indexer partial-success contract has a native regression test and an unambiguous renderer outcome.

**No claim is made that all conceivable Scriptor defects have been resolved.** The demonstrated improvement is bounded to the listed Canvas state and persistence paths, backed by local regression results; the broader repository and release confidence must be established with separate exact-commit evidence.

## PR consolidation review (2026-10-11)

This branch also integrates the independently reviewed provider URL/Markdown fix from #159, npm dependency updates from #157, Rust minor updates from #158, and the Wasmtime 49.0.2 update from #154. The Rust lockfile combines both resolutions, retains compatible current versions, and was statically checked for missing and ambiguous dependency references. No local Cargo resolver or build verification is claimed. Hosted exact-head validation of this combined dependency graph remains mandatory.

Review follow-ups: provider-controlled event summaries and locations are escaped into literal single-line Markdown in addition to canonical URL destinations; CodeMirror link contrast is adjusted for light-palette/dark-appearance combinations with an explicit browser regression. The npm dependency PR's prior 2.55:1 contrast failure and the baseline canvas save-status failure are addressed in source, subject to hosted browser proof. The native canvas save/index partial-success contract remains unresolved.
