# Restore Outcome Classification Implementation Plan

> **For agentic workers:** Use the host's available task-by-task implementation workflow. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make native backup-restore result interpretation independently testable while retaining current editor-safety behavior.

**Architecture:** Add a pure TypeScript disposition mapper next to the existing frontend operation guards. Reuse it in the existing `useVaultBackup` hook; leave the native transaction and callback sequencing unchanged. Do not generalize every operation before verifying the first consumer.

**Tech Stack:** React, TypeScript, Node test runner, Rust/Tauri native restore bridge.

## Global Constraints
- Only rolled-back safely resumes old draft persistence.
- committed-ready is the only status allowed to refresh the restored workspace.
- committed-needs-reopen and recovery-required leave the old draft frozen and demand vault reopening.
- Authorization rejection before invoking native restore is a known safe abort. Any rejected native invocation has unknown commit state even if the transaction actually committed; the old editor draft stays frozen until real vault reopen. The native transaction remains unchanged.

---

### Task 1: Classify the four authoritative restore results

**Files:**
- Create: `src/lib/restoreOutcome.ts`
- Create: `src/lib/restoreOutcome.test.ts`

**Interfaces:**
- Consumes: `VaultRestoreStatus` string union from native result contract.
- Produces: `classifyVaultRestoreStatus(status): VaultRestoreDisposition` with `filesChanged`, `resumeOldDraft`, `refreshWorkspace`, `needsReopen`.

- [x] **Step 1: Add focused failing tests.** One assertion for rolled-back, two for committed-ready/committed-needs-reopen, one for recovery-required.
- [x] **Step 2: Verify relevant failure.** `node --experimental-strip-types --test src/lib/restoreOutcome.test.ts`; red verified locally against a throwing classifier (three test cases fail).
- [x] **Step 3: Implement minimum behavior.** Pure exhaustive status switch, no persistence, no action effects.
- [x] **Step 4: Verify focused pass.** Same command: three passing tests locally.
- [ ] **Step 5: Run affected integration check.** Exact-head GitHub CI and source suites; do not claim a hosted pass until completed.
- [ ] **Step 6: Commit verified deliverable.** Committed to dedicated feature branch after static review; hosted verification remains mandatory for merge.

### Task 2: Reuse classifier in existing restore hook

**Files:**
- Modify: `src/hooks/useVaultBackup.ts`
- Test: `src/lib/restoreOutcome.test.ts` and existing `scripts/validation/backup-scheduler-lifecycle.test.mjs`

**Interfaces:**
- Consumes: `classifyVaultRestoreStatus`.
- Produces: unchanged public `useVaultBackup` API; same native lifecycle events.

- [ ] **Step 1: Add the focused failing integration guard.** Ensure the hook uses classifier rather than independently interpreting status branches; preserve behavior for all statuses.
- [ ] **Step 2: Verify failing guard.** Source-focused test must show missing classifier integration.
- [ ] **Step 3: Replace branching decisions only.** `restoreApplied = disposition.filesChanged`, `disposition.resumeOldDraft`, `disposition.refreshWorkspace`; do not alter exception handling.
- [ ] **Step 4: Rerun focused tests.** All status and integration tests pass.
- [ ] **Step 5: Run CI.** Type check, source tests, browser restore cases, native desktop compile.
- [ ] **Step 6: Commit.** Preserve immutable source history and PR review.

### Task 3: Prevent a rejected native invocation from being mistaken for rollback

**Files:**
- Modify: `src/lib/restoreOutcome.ts`, `src/lib/restoreOutcome.test.ts`.
- Modify: `src/bridge/commands/vault.ts`, `src/hooks/useVaultBackup.ts`.
- Test: `scripts/validation/backup-restore-fault.test.mjs`.
- Modify: `src/components/VaultBackupSettings.tsx`, `CHANGELOG.md`.

**Interfaces:**
- Consumes: `authorizeSensitiveOperation('restore_backup', backupName)`, `invoke<VaultRestoreResult>('vault_restore_backup', args)`, `dispatchVaultLifecycleEvent`.
- Produces: `runVaultRestoreWithOutcomeBoundary`, `VaultRestoreOutcomeUnknownError`, `classifyVaultRestoreFailure`.

- [x] **Step 1: Add focused failing behavioral tests.** Authorization-denied invocation, rejected submitted invoke, synchronous invoke failure, retained terminal reply and post-commit UI failure.
- [x] **Step 2: Observe relevant red.** A pass-through stub returned 3 expected failing assertions: unwrapped submitted rejections and misclassified already committed UI failures.
- [x] **Step 3: Implement minimal native-invoke boundary and freeze behavior.** Only known pre-submission failures can emit safe abort; unknown outcomes leave persistence frozen and announce the need to reopen.
- [x] **Step 4: Run focused green locally.** `node --experimental-strip-types --test src/lib/restoreOutcome.test.ts`: seven tests passed on Node 22.16.0.
- [ ] **Step 5: Run hosted exact-head integration.** Check `pnpm test:source`, frontend type/lint, Rust desktop compilation, backup restore fault contracts and browser recovery.
- [ ] **Step 6: Test installed-client response loss/reopen.** Source or mocked test results cannot prove real process recovery.

## External decisions
None for this bounded slice. Subsequent generalized operation receipts require per-operation policy review, captured in MAT-002.
