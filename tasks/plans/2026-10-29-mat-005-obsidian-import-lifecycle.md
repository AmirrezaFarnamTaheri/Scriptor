# MAT-005 — Obsidian import submission ownership

**Isolated draft PR based on main:** `feat/mat-005-obsidian-import-single-flight-20261029`. This is a new mutation-owner slice, separate from backup, Canvas, Git and Database Studio PRs. It does not add a new native import implementation or authority.

## Observed source risk (before regression execution)
`src/components/ObsidianImportDialog.tsx` uses a React `isImporting` state as its only submit-exclusion mechanism. Two synchronous form submissions before React re-renders both call `vaultImportObsidian`, which requests sensitive authorization and can perform duplicate native imports. The native import itself is authorized against the selected session, so the proposed guard must not replace native scope validation.

A completed native import also calls `onImported` and sets React state after an overlay is unmounted. If a user switches vaults while the native work is in flight, its old dialog must not announce success or trigger a refresh in the newly active workspace. Native writes already submitted remain native-owned; this change does not pretend they were cancelled or rolled back.

## Tests
- [x] Add three actual-component JSX behavior tests: simultaneous submit; success after unmount; failure after unmount. Only native command and React scheduling are mocked.
- [ ] **RED:** source suite on test-only `69a8c3a` ([CI #40783884097](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/40783884097)) was queued at implementation time; no observed red assertion yet. Do not present this as a verified TDD red-green cycle.
- [x] **Implementation authored (green pending):** synchronous single-flight ref prevents duplicate submissions before UI rerender; a mount lifecycle token suppresses late callbacks and state updates after unmount. Native vault authorization remains untouched.
- [ ] Re-run exact-head source, TypeScript, browser E2E, Rust, Windows and visual gates. Validate installed Windows/macOS/Linux import, vault switch and restart separately.
- [x] Update `docs/VERIFICATION.md` and `CHANGELOG.md` after implementation. Record the real status: test-only run queued, expected regression not observed, exact-head green still pending. Broader MAT-005 stays open.

## Safety boundary
The UI must not interpret a closed dialog as a native cancellation. The native `ImportVault` authorization, source path, vault session and resulting file writes remain authoritative.

## Failure/retry contract
- [x] Added a failure-then-explicit-retry behavioral test to prove synchronous exclusion is released after native denial, without silently retrying the mutation.
- [ ] Full exact-head hosted source/TypeScript/browser/Rust/desktop/visual gates and installed-client vault-switch/restart acceptance are required.

## Active-vault overlay ownership
- [x] The parent `CapabilityWorkflowOverlays` already receives `vaultId` via `composition.managerProps`, but used an unkeyed Obsidian dialog across vault transitions. Key the dialog by that identity so the previous owner's effect cleanup invalidates late native completion feedback before the new vault's dialog is mounted.
- [x] Added a cross-surface source regression checking the vault ID propagation and React remount key. The existing behavior tests cover the old dialog's post-unmount completion. This source check alone is not full browser-vault-switch proof.
- [ ] Verify exact-head browser and native authorization acceptance. The existing native `ImportVault` check consumes an authorization token scoped to the active session; this UI change does not replace it.

## CodeRabbit follow-up — tests first (review of `3c534d7`)
- [x] Authored a two-dialog same-vault remount race with the real JSX component and one shared import claim owner. The second Import submit must not reach the mocked native `vaultImportObsidian` while the original call is in flight, and retry only becomes available after native settlement.
- [x] Authored a commit-before-passive-cleanup race using distinct harness layout/passive effect queues. The old native result must not publish callback or React state after the dialog is removed at commit, even if its passive cleanup is delayed.
- [ ] Run the test-only head and record exact failing assertions **before** changing production code.
- [ ] Use a vault-scoped claim owned above the conditional dialog and invalidate the lifecycle during layout cleanup. Re-run the same tests and full exact-head CI, desktop/browser/visual; do not infer installed-client acceptance.

## CodeRabbit remediation implementation (verification pending)
- [x] The `CapabilityWorkflowOverlays` owner now retains a `Set<string>` for in-flight vault IDs beyond dialog closure, keyed to the active vault and passed to `ObsidianImportDialog`. A blocked same-vault submit explains that the original native import may still be running.
- [x] The originating dialog releases its claim only in the native promise `finally`; an unmount never releases it early or implies cancellation. Vault B has its own independent key while vault A remains native-owned.
- [x] Replace passive `useEffect` lifecycle cleanup with commit-phase `useLayoutEffect` cleanup; the test harness now separates layout and passive queues.
- [ ] Run failing-first red on the test-only head; then publish this implementation and verify all current-head gates. Do not claim an observed red until the decisive assertions are in hosted logs.

## Owner implementation / source-contract reconciliation
- [x] Aligned `CapabilityWorkflowOverlays` with the existing owner contract in `obsidian-import-lifecycle.test.mjs`: a non-reactive `useRef<Set<string>>(new Set())` persists claims across conditional dialog remounts, and the dialog receives `.current`. This is a behavior-preserving owner refactor from a lazily created `useState` Set, not a change to the native import or authorization contract.
- [ ] Do not label the source-regex mismatch as a *behavioral* RED; no exact-head failing regression run for this shape disagreement was observed before the fix. The real JSX harness still checks native import single-flight, close/reopen, unmount and commit-phase cleanup.
- [ ] Require new exact-head source / browser / TS / native / visual checks and installed-client acceptance before the PR can leave draft.

## Browse dialog stale native selection (test first)
- [x] Audited `handleBrowse`: after awaiting the native folder chooser it unconditionally sets source, clears status, and calls `vaultDetectObsidian`. Closing the import overlay while the system picker is pending can therefore initiate a read and update destroyed React state after the chooser resolves.
- [x] Added an actual-JSX behavioral regression to the existing harness: hold the native `open()` promise, unmount before resolving it, then require no `vaultDetectObsidian` call and no state update after unmount. Only the plugin-dialog and vault-command boundaries are mocked.
- [ ] Observe the focused test fail against the test-only head for this intended behavior; distinguish harness/import errors from actual stale side effects.
- [ ] Pass the originating layout lifecycle into the Browse completion guard without affecting native import ownership, successful folder selection or explicit validation.
- [ ] Re-run current-head source, TypeScript, browser, Rust and visual checks; installed-client dialog and vault-switch cases remain separate.

## Delayed Browse handling — production guard
- [x] `handleBrowse` now captures the originating layout lifecycle; it exits after asynchronous plugin-module loading or folder-picker resolution if the dialog was removed. The existing `validateSource` call remains unchanged for an active dialog, and its generation guard still controls late validation replies.
- [x] A real-JSX test was added in the preceding commit `54655e6`; the test-only CI was still queued when this guard was authored. **No hosted failing-first assertion was observed**, so do not classify it as a verified red-green cycle.
- [ ] Reverify exact-head source, TypeScript, browser, Rust, visual and installed-client chooser-close behavior. This is renderer UI containment, not cancellation of a native chooser or native import.
