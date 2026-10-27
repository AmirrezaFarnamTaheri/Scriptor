# MAT-003: Read-only Last Restore Outcome Preview Implementation Plan

> **For agentic workers:** Use the host's task-by-task implementation workflow and mark a step complete only with recorded evidence.

**Goal:** Let the user distinguish rolled-back, confirmed, unreconciled and unknown restore outcomes in existing Backup settings without introducing new mutation authority.

**Architecture:** Consume the current vault- and backup-location-filtered `lastRestoreReceipt` from `useVaultBackup`. A pure read-only presenter maps evidence to plain-language feedback; the existing Backup settings displays the latest attempt from this session and leaves all native restore, approval, cancellation, and recovery behavior untouched.

**Tech Stack:** TypeScript, React, Node 22 built-in test runner, Playwright, Tauri fixture bridge.

## Global Constraints

- The receipt is renderer-observed; native restore status and journals alone establish whether replacement completed.
- `recovery-required` is unreconciled, not committed; a lost reply must never imply a rollback.
- Never present session-only receipts as permanent recovery history.
- Show no receipt when vault or configured backup location differs from the origin.
- No action in this slice retries, restores, overwrites, or changes vault ownership.
- MAT-003 remains incomplete until the broader backup, note history, Canvas, conflict and interrupted-journal inventory with actual runtime acceptance exists.

---

### Task 1: Translate restore receipts into safe user-visible text

**Files:**
- Create: `src/lib/workspace/restoreReceiptPresentation.ts`
- Test: `src/lib/workspace/restoreReceiptPresentation.test.ts`

**Interfaces:**
- Consumes: `OperationReceipt` from `operationReceipt.ts`
- Produces: `describeRestoreReceipt(receipt): {heading, explanation, tone}`

- [x] **Step 1: Add failing behavioral tests.** Check not submitted, rolled-back, committed-ready, committed-needs-reopen, recovery-required, lost reply and committed files with failed workspace refresh.
- [x] **Step 2: Verify red.** An isolated Node 22 harness based on the exact receipt module reported 7 assertion failures against a blank presenter, expected because no outcome text existed.
- [x] **Step 3: Implement minimum mapping.** Return plain-language status and recovery guidance, with no extra transaction policy.
- [x] **Step 4: Verify focused green.** `node --experimental-strip-types --test src/lib/workspace/restoreReceiptPresentation.test.ts` in the isolated harness: 7 passed, 0 failed. Full repository execution is a separate gate.
- [ ] **Step 5: Run integrated source / type checks.** On exact PR head: `pnpm test:source`, `pnpm check:contracts`, `pnpm lint`.
- [ ] **Step 6: Commit passing implementation.** The commit is reviewable, but full tests remain pending until hosted results are recorded.

### Task 2: Show a scoped last-attempt receipt alongside existing backup inventory

**Files:**
- Modify: `src/components/VaultBackupSettings.tsx`
- Test: `e2e/backup-restore-receipt.spec.ts`
- Update: `tasks/plans/2026-10-27-product-maturation-backlog.md`, `CHANGELOG.md`

**Interfaces:**
- Consumes: `backup.lastRestoreReceipt`, `describeRestoreReceipt`.
- Produces: labeled, keyboard- and screen-reader-discernible read-only session summary.

- [ ] **Step 1: Verify red.** The browser test expects no summary initially and a native-confirmed rolled-back result after an explicit reviewed restore.
- [ ] **Step 2: Integrate.** Render the receipt only when the hook supplies one for the current vault and location; reuse existing status styling.
- [ ] **Step 3: Verify focus and screen-reader semantics.** The summary has an accessible region heading and a passive status announcement; it neither triggers nor enables any action.
- [ ] **Step 4: Run current-head browser and visual verification.** `pnpm exec playwright test e2e/backup-restore-receipt.spec.ts` and supported visual workflows, inspecting actual screenshot artifacts for overflow and accessibility.
- [ ] **Step 5: Check source and platform gates.** No claim of packaged recovery or completed MAT-003 inventory until native proof and release inclusion.

## Product behavior and limitations

The summary is temporary and per vault/backup destination, is intentionally absent before any restore attempt, and is not stored on disk. Other recovery sources remain in their existing owning surfaces. No new `Recovery Center` navigation route or authorization model is introduced in this slice.
