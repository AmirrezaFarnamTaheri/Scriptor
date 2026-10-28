# MAT-005 — Obsidian import submission ownership

**Isolated draft PR based on main:** `feat/mat-005-obsidian-import-single-flight-20261029`. This is a new mutation-owner slice, separate from backup, Canvas, Git and Database Studio PRs. It does not add a new native import implementation or authority.

## Observed source risk (before regression execution)
`src/components/ObsidianImportDialog.tsx` uses a React `isImporting` state as its only submit-exclusion mechanism. Two synchronous form submissions before React re-renders both call `vaultImportObsidian`, which requests sensitive authorization and can perform duplicate native imports. The native import itself is authorized against the selected session, so the proposed guard must not replace native scope validation.

A completed native import also calls `onImported` and sets React state after an overlay is unmounted. If a user switches vaults while the native work is in flight, its old dialog must not announce success or trigger a refresh in the newly active workspace. Native writes already submitted remain native-owned; this change does not pretend they were cancelled or rolled back.

## Tests
- [x] Add three actual-component JSX behavior tests: simultaneous submit; success after unmount; failure after unmount. Only native command and React scheduling are mocked.
- [ ] **RED:** run hosted source suite at exact test-only head. Confirm failures are in the intended assertions rather than missing dependencies/harness setup.
- [ ] **GREEN:** single-flight ref prevents duplicate submissions before UI update; mount ownership suppresses late callbacks and state updates after unmount. Do not weaken the current native vault authorization.
- [ ] Re-run exact-head source, TypeScript, browser E2E, Rust, Windows and visual gates. Validate installed Windows/macOS/Linux import, vault switch and restart separately.
- [ ] Update `docs/VERIFICATION.md` and `CHANGELOG.md` only after implementation, recording actual red/green evidence. Broader MAT-005 stays open.

## Safety boundary
The UI must not interpret a closed dialog as a native cancellation. The native `ImportVault` authorization, source path, vault session and resulting file writes remain authoritative.
