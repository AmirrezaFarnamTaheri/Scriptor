# Restore Operation Receipts Implementation Plan

> **For agentic workers:** Implement tasks in isolated reviewable commits; checklist steps represent verified work, not future completion claims.

**Goal:** Record an accurate, read-only, vault-scoped backup-restore outcome envelope without changing the native restore authority.

**Architecture:** The existing `classifyVaultRestoreStatus` remains the single source of terminal-result semantics. A pure `src/lib/workspace/operationReceipt.ts` adapter exposes proof, effects, retry safety and recovery requirements without manufacturing changed paths or revision hashes. `useVaultBackup` records the last attempt for the originating vault and backup location; no new transaction persistence or commands are introduced.

**Tech Stack:** TypeScript, React, Node 22 built-in test runner, existing Tauri invoke bridge.

## Global Constraints
- Native statuses, transaction journal, authorization, expected-content hashes and restore lifecycle events remain authoritative.
- A rejected invocation after submission is **unknown**, not rolled back; an explicit authorization rejection before submission is **not submitted**.
- Renderer-generated operation IDs are correlation hints, not native receipts; no implicit repeat of destructive actions.
- Null paths and revisions mean **not reported by the native restore contract**.
- Do not mark MAT-002 complete until other mutation owners, restart tests and hosted verification are added.

---

### Task 1: Define observable outcomes without duplicating native status policy

**Files:** Create `src/lib/workspace/operationReceipt.ts` and `operationReceipt.test.ts`.

**Interfaces:**
- Consumes: `VaultRestoreStatus`, `classifyVaultRestoreStatus`.
- Produces: `buildRestoreOperationReceipt(input): OperationReceipt` and `visibleOperationReceipt(receipt,vaultId,backupPath)`.

- [x] **Step 1: Add failing tests:** rolled back, committed, needs reopen, reply missing, pre-submit rejection, cross-vault visibility, post-commit UI failure.
- [x] **Step 2: Verify red:** initial focused run: six failing tests against missing receipt behavior. Separate refresh-failure case failed before support was added.
- [x] **Step 3: Implement:** derive effects from native classifier; require reopen for unknown or failed post-commit refresh; never invent paths or revisions.
- [x] **Step 4: Verify green:** `node --experimental-strip-types --test src/lib/workspace/operationReceipt.test.ts` passed 7/7 in a standalone Node harness with classifier behavior reproduced from the current PR. This does not replace execution against the repository checkout.
- [ ] **Step 5: Verify integrated CI:** complete current-head source tests, desktop compilation and visual checks.
- [ ] **Step 6: Commit verified task:** commit on the stacked MAT-002 branch; do not infer a CI pass from local tests.

### Task 2: Expose receipts from the existing restore hook

**Files:** Modify `src/hooks/useVaultBackup.ts`, `scripts/validation/backup-restore-fault.test.mjs` and `CHANGELOG.md`.

**Interfaces:**
- Consumes: `buildRestoreOperationReceipt` and `visibleOperationReceipt`.
- Produces: `lastRestoreReceipt` alongside the existing hook values; no new public native command.

- [ ] **Step 1: Assert wiring:** source-level test requires a scope-filtered receipt and every failure-evidence path.
- [ ] **Step 2: Observe red:** verify missing hook integration on the upstream PR head.
- [ ] **Step 3: Integrate:** use a renderer operation ID for an attempt; retain the native status on a known result; distinguish not-submitted from response-missing and refresh failure.
- [ ] **Step 4: Run focused tests:** both receipt and restore-fault suites pass against an actual checkout.
- [ ] **Step 5: Run hosted CI:** verify source tests, lint, desktop compilation, and last-head visual results.
- [ ] **Step 6: Commit:** push independently reviewable change, then update verification evidence.

## Remaining MAT-002 scope
- Extend optional receipts to Canvas, database edits, Git, tasks and imports using each feature's native evidence (never optimistic assumptions).
- Add confirmed vs partial vs indeterminate outcome tests, cancellation, restart, and wrong-vault operation replay.
- Promote a consumer-facing recovery inventory only under MAT-003 after these contracts have exact-head verification.

## Product decisions retained
No automatic retry or overwrite; uncertainty requires native vault reopen. Receipt IDs are renderer-generated and cannot be treated as evidence of native audit correlation.
