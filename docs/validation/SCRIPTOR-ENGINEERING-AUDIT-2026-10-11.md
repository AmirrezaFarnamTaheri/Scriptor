# Canvas engineering review — 2026-10-11

This is the technical analysis of the Canvas workflow at Scriptor 1.2.8, based on source derived from `e753f83c6ce2704bdbfaed4d6ddecca6791647b3`. Outcomes, test counts, commit lineage, environment constraints, open verification items, and PR consolidation status have one source of truth: [docs/VERIFICATION.md](../VERIFICATION.md#pr-160-remediation-evidence--october-11-2026). A snapshot report is not a release certificate.

## Ownership and mutation path

`CanvasPanel` actions pass through `useCanvasBoard` state/history/CRDT to `src/bridge/canvas.ts`, Tauri Canvas commands, active-vault/capability validation and `scriptor_canvas_engine` atomic document writes. Relationship-index synchronization and board-list refresh are **derived operations**, not the authoritative board write. UI state is less trusted than native vault and capability checks.

## Failure mechanics and correction

| ID | Area | Root cause and data-integrity consequence | Corrective mechanism |
|---|---|---|---|
| CAN-01 | `useCanvasBoard.loadBoard` | A delayed native load could replace edits made while the read was outstanding | Reject a load response when document identity changed before it returned |
| CAN-02 | Initial board hydration | A mount-time list/load or fallback could overwrite an intervening local edit | Guard both hydration success and error/fallback against the initial document identity |
| CAN-03 | `createBoard` | Selecting a new board before native save returned could displace the current board even when saving failed | Complete persistence first; then verify originating lifecycle/document before selection |
| CAN-04 | Save state | Auxiliary `canvasListDocuments` failure was caught as though the authoritative board write failed | Separate committed-write outcome from derived board-list refresh and report the warning accurately |
| CAN-05 | Switch/create lifecycle | Vault/document could change during pending flush, allowing stale continuation | Bind each operation to document and lifecycle before awaiting flush, reject stale continuation |
| CAN-06 | Canvas footer | Save confirmation exposed internal `.scriptor/canvas/canvas-<UUID>.json`, conflicting with readable status contract | Report `Canvas saved.` without internal identifiers; align the E2E/guide expectations |
| CAN-07 | Board selection | Selection persisted after board identity changed | Associate selected card IDs with current document ID |
| CAN-08 | Native save/index boundary | A durable board write followed by `sync_relations` failure is returned as generic `Err`, encouraging incorrect retries | **Not repaired:** needs typed committed-write receipt and native failure-injection verification |

The original source-level harness controlled asynchronous native call completion to reproduce stale hydration, stale reads, failed creation and failed derived-list refresh. See the verification record for results and limits rather than interpreting this table as exhaustive runtime proof.

## Critical invariants

1. Async board reads and mount hydration cannot replace edits produced after their request began.
2. Board switching and creation flush pending saves and must not cross a changed vault or document lifecycle.
3. Board creation activates its new document only after committed persistence; a failed create preserves the previous document.
4. A successful committed board write remains successful even when a derived board-list refresh fails.
5. Selection has a board owner; prior-board selections must not authorize actions on a different board.
6. Native capability and expected-vault checks remain the authoritative permission boundary; renderer guards prevent UX races, not unauthorized access.

## Native partial-success boundary

`apps/desktop/src-tauri/src/commands/canvas.rs` invokes native Canvas persistence and then relation-index synchronization. The command's unstructured `Result<String, String>` cannot tell the renderer whether an error happened **before** or **after** durable persistence. When the relation index fails after writing, the renderer may show a false failure and replay a committed save. A robust fix needs a typed write receipt with committed path/revision and separately classified index warnings, including stable Rust↔TypeScript contract generation and native fault-injection tests. Do not infer durability by parsing error strings.

## Other inspection leads (not confirmed defects)

Cross-process lifecycle ownership, process-budget enforcement for optional export tools, IPC reconnect/resynchronization, backup restore under abrupt power loss, live OAuth scopes, and native editor large-document fidelity merit separately scoped evaluations. Existing sanitizer, vault, process and release-policy implementations were source-inspected but this review does not claim complete exploit-fuzzing coverage.

See [the authoritative verification record](../VERIFICATION.md#pr-160-remediation-evidence--october-11-2026) for exact commits, successful checks, the remaining manual matrix, and conditions for release.
