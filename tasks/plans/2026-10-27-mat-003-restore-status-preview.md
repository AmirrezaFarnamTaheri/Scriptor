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
- [x] **Step 2: Verify red.** An isolated harness demonstrated the absent-presenter failures; counts and environment are recorded in [the verification ledger](../../docs/VERIFICATION.md#mat-001mat-003-recovery-work--october-27-2026).
- [x] **Step 3: Implement minimum mapping.** Return plain-language status and recovery guidance, with no extra transaction policy.
- [x] **Step 4: Verify focused green.** The isolated presenter tests passed; the command, outcome and full-checkout limitation are in [the verification ledger](../../docs/VERIFICATION.md#mat-001mat-003-recovery-work--october-27-2026).
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

### Task 3: Navigate safely to the selected note's existing revision history

**Files:**
- Create: `src/lib/workspace/recoveryHistoryAvailability.ts`, `src/lib/workspace/recoveryHistoryAvailability.test.ts`
- Modify: `src/components/VaultBackupSettings.tsx`, `src/components/SettingsPanel.tsx`, `src/App.tsx`
- Test: `e2e/backup-history-navigation.spec.ts`

**Interfaces:**
- Consumes: vault ID, active note path, restore recovery hold, Settings unsaved-config state
- Produces: a navigation-only entry to existing `NoteHistoryPanel`, not a restore command

- [x] **Behavioral red:** six targeted Node tests against the absent navigation availability policy; five expected assertions failed, one passed.
- [x] **Behavioral green:** implemented vault/recovery/unsaved-settings/current-note guard; see the [isolated-run evidence](../../docs/VERIFICATION.md#mat-001mat-003-recovery-work--october-27-2026).
- [x] **UI wiring:** Backup Settings button opens the existing note history panel and closes Settings only when the guard allows it.
- [ ] **Current-head acceptance:** run `node --experimental-strip-types --test src/lib/workspace/recoveryHistoryAvailability.test.ts`, `pnpm test:source`, `pnpm check:contracts`, `pnpm lint`, and `pnpm exec playwright test e2e/backup-history-navigation.spec.ts`; inspect browser screenshot/RTL/zoom behavior.
- [ ] **Installed-client acceptance:** verify safe history navigation and return focus in Windows/macOS/Linux packages.

This is one more read-only entrypoint, not the complete MAT-003 inventory of Canvas, external conflict, note history and interrupted journals. MAT-003 remains unchecked.

## Product behavior and limitations

The summary is temporary and per vault/backup destination, is intentionally absent before any restore attempt, and is not stored on disk. Other recovery sources remain in their existing owning surfaces. No new `Recovery Center` navigation route or authorization model is introduced in this slice.

### Task 4: Scope destructive backup confirmations (MAT-005 audit finding)

**Files:** `src/lib/workspace/backupActionScope.ts`, `backupActionScope.test.ts`, `VaultBackupSettings.tsx`, `SettingsPanel.tsx`, and the backup source-contract tests.

- [x] Confirmed that pending Restore/Delete approvals were keyed only by name, whereas backup listings and invocation are scoped by vault and destination.
- [x] Reproduced red: the isolated test runner failed because the scope guard did not exist.
- [x] Added vault/folder/name/action identity. A stale approval is hidden and checked again before invoking. Editing the backup location clears pending approval; vault changes remount Backup settings.
- [x] Focused isolated scope tests passed and source assertions were added; see [the verification ledger](../../docs/VERIFICATION.md#mat-001mat-003-recovery-work--october-27-2026).
- [ ] Required hosted exact-head CI, browser scope-switch testing, and installed-client evidence. This is a bounded MAT-005 lifecycle hardening slice, not MAT-005 completion.

### Hosted CI correction for scoped confirmations
- [x] Observed failed hosted source and TypeScript gates on `c89698d`; diagnostic details and counts are recorded in [the verification ledger](../../docs/VERIFICATION.md#mat-001mat-003-recovery-work--october-27-2026).
- [x] Fix the JSX render guard to narrow `pendingAction` before reading its properties; update the source contract to assert scoped approvals and the guard rather than reinstating the unsafe state shape.
- [ ] Recheck current commit's source suite, TypeScript frontend build, browser E2E, Rust/desktop and visual gates. Prior green runs cannot certify a newer head.

### Browser regression: same-named backups in different folders
- [x] Authored Playwright fixture that returns the *same* backup name for three destinations, opens Restore/Delete confirmation, changes destination each time, and asserts both stale approvals disappear without native mutation. A new explicit Delete confirmation must target only the final folder.
- [ ] This authored browser test requires execution on hosted Browser E2E; local Node helper tests are not a substitute. No installed-client claim until the native backup-path and vault-switch cases are exercised on real packages.

### Task 5: Discover older retained backups instead of silently truncating restore choices
- [ ] RED: The current Backup settings renders `backups.slice(0, 10)` without any means of accessing entries 11+. A browser fixture was added that lists twelve valid retained backups and requires a keyboard-accessible, bounded Show Older control. Run it against the pre-fix head and record the decisive failure.
- [ ] GREEN: Reveal additional results ten at a time, offer a collapse action, and clear pending destructive confirmation when a page or destination changes. Keep the existing native sorted listing and restore authority.
- [ ] Hosted current-head browser execution, source tests, TypeScript and visual/RTL review; installed-client validation still required.

### Older backup pagination implementation
- [x] GREEN implementation: list the first 10 entries and reveal successive groups of up to 10; render no arbitrary terminal 10-item cap. Reset disclosure on backup location change, remount by vault identity, and clear pending destructive approval on every page change.
- [x] Source-contract regression added; the browser test was committed separately before implementation. Its expected red was grounded in the former `backups.slice(0, 10)` but **not observed in hosted execution before this green commit**, because CI was still queued.
- [ ] Check browser behavior and all current-head gates before claiming verified. Native sort remains authoritative; no filesystem, authorization or restore behavior changed.

### Task 6: Fail-closed Restore control for unverified backup entries (MAT-003/005)
- [x] Native `entry_from_dir` sets `verified = read_and_verify_manifest(...).is_ok()`; native Restore invokes that validation before replacing files. The renderer previously exposed Restore even when `verified=false`, causing predictable rejection after submission and conservative quarantine.
- [x] Explain invalid backup entries, keep reviewed Delete available for cleanup, and disable Restore unless the native listing verified the copy. Existing vault recovery holds remain authoritative.
- [x] Authored one browser fixture for mixed valid/invalid backups and a source-contract assertion. No failing-first **hosted** run is recorded; not real corrupted-disk or installed-app proof.
- [ ] Check exact-head source/TypeScript, browser, native and packaged recovery evidence before declaring completion.

### Task 7: Preserve keyboard focus during backup disclosure (MAT-003/020)
- [x] Add Playwright assertions to the existing twelve-backup fixture: keyboard focus must remain on the disclosure control after both expansion and collapse. With two mutually exclusive buttons, changing the label previously unmounted the focused button.
- [x] Use one stable button with a changing accessible label, bounded ten-at-a-time count, `aria-controls` and `aria-expanded`. Continue clearing destructive confirmation when visibility changes.
- [ ] Failing-first browser execution was not observed (authored test precedes this implementation in Git history); verify exact head via hosted Browser E2E, visual/RTL checks and keyboard interaction in installed client.

### CodeRabbit follow-up — disclosure labels and central evidence
- [x] Added a singular accessible label for one hidden backup, retaining the plural label for multiple copies and the stable focusable control.
- [x] Added an eleven-backup Playwright fixture checking singular label, expansion and keyboard focus. The test requires hosted execution on this new head.
- [x] Moved specific historical test/run results into [the central verification record](../../docs/VERIFICATION.md#mat-001mat-003-recovery-work--october-27-2026); the plan retains checklist status and execution gates.
- [ ] Verify the new head and installed-client behavior. MAT-003 is not completed by these changes.
