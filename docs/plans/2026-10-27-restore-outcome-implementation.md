# Restore Outcome Classification Implementation Plan

> **For agentic workers:** Use the host's available task-by-task implementation workflow. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make native backup-restore result interpretation independently testable while retaining current editor-safety behavior.

**Architecture:** Add a pure TypeScript disposition mapper next to the existing frontend operation guards. Reuse it in the existing `useVaultBackup` hook; leave the native transaction and callback sequencing unchanged. Do not generalize every operation before verifying the first consumer.

**Tech Stack:** React, TypeScript, Node test runner, Rust/Tauri native restore bridge.

## Global Constraints
- Only rolled-back safely resumes old draft persistence.
- committed-ready is the only status allowed to refresh the restored workspace.
- committed-needs-reopen and recovery-required leave the old draft frozen and demand vault reopening.
- A thrown transport error alone proves no native commit state; this slice does not change transport interpretation or native transactions.

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

## External decisions
None for this bounded slice. Subsequent generalized operation receipts require per-operation policy review, captured in MAT-002.
