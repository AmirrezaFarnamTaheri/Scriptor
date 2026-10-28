# MAT-018 - Command palette action availability (initial slice)

**Branch:** feat/mat-018-palette-action-availability-20261028. **Scope:** remove commands with absent callbacks or missing active resources from the user-facing palette; do not fabricate permission or provider readiness. This is the first MAT-018 slice, not completion.

## Current defect

buildPaletteCommands adds multiple commands with optional chaining such as openKnowledgeWorkbench, setPortalOpen, setNoteHistoryOpen even when launchers are not provided. Running them closes CommandPalette without any effect. A zero-count Reopen closed tab and Mark active note organized with no active note also advertise unavailable actions. This conflicts with discoverability, effective keyboard use, and consistency between offered commands and real capabilities.

## Test-first sequence

- [x] Read the command builder, registry, palette and existing source tests. Preserve available commands and their existing callbacks.
- [x] Author focused behavior tests: absent owner means command absent, a missing active note cannot be organized, and zero closed tabs cannot be reopened. Available owners still execute the right callback.
- [x] RED: Confirmed the advertised no-op command failures; the exact test-only run, counts, and classification live in the [central MAT-018 verification record](../../docs/VERIFICATION.md#mat-018-command-palette-availability--pending-exact-head-acceptance).
- [x] Implement the minimum registration guards directly in the builder, using the existing owner callbacks, active note and closed-tab count (no second availability cache).
- [ ] GREEN: require the same source regression suite to pass on the implementation head; hosted results pending.
- [ ] Exact-head source/TypeScript/browser/visual/accessibility checks. Keyboard command palette at narrow/RTL/200% zoom and user study are independent gates.

## Limits and follow-ups

Omission of truly unavailable handlers is preferable to an inert selectable option in this narrow slice. A shared, localized unavailable-reason model for real-but-blocked operations, contextual Help and non-palette launchers remains separate MAT-018 work. All native permission checks remain authoritative. No new UI persistence, file mutation, provider write or granted authority.

## Next no-op regression: note result opener presence

- [x] Identified an additional MAT-018 availability gap: the palette's `searchNotes` results are rendered as selectable note options even if `onOpenNote` is absent; selecting one only closes the palette.
- [x] Added a test-only, real-component TypeScript/JSX harness `scripts/validation/command-palette-note-availability.test.mjs`, checking both missing-handler suppression and positive note opening. React scheduling, i18n and search are stubbed; the component and its actual command-selection callback are executed.
- [ ] Observe a hosted RED on the test-only head. Do not count missing imports, harness defects or skipped tests as behavioral RED.
- [ ] Use the smallest eligibility guard so note search has a launch owner; keep existing query cancellation and actual click behavior. Repeat focused and exact-head CI/visual tests.
- [ ] This is one no-op availability case, not the complete MAT-018 shared-capability or contextual-help contract.

## Note search availability follow-up — production guard

- [x] Added the existing `onOpenNote` callback to note-result eligibility and the query effect; note matches no longer appear as selectable no-ops, and native note search does not run without an opener. The searchable commands and Help remain available.
- [x] The real-component tests cover both unavailable note-result suppression and positive click-through. See the [central verification record](../../docs/VERIFICATION.md#mat-018-command-palette-availability--pending-exact-head-acceptance) for test-only head and evidence.
- [ ] The second note-search slice lacks an observed failing-first hosted result. Do not count it as a verified red/green cycle; see the [central verification record](../../docs/VERIFICATION.md#mat-018-command-palette-availability--pending-exact-head-acceptance).
- [ ] Verify exact-head source and browser CI, visual/a11y matrix, and installed-client acceptance; do not mark MAT-018 complete.

## Focus vault search — follow-on action availability regression

The command currently invokes `document.querySelector('.vault-search input')?.focus()` synchronously. `CommandPalette.runSelected()` calls `command.run()` **before** closing the modal, while `useFocusTrap` reclaims focus from targets outside the open dialog. With the vault sidebar collapsed, the selector is also hidden. Both cases advertise an action without successfully moving focus.

- [x] Add two Playwright scenarios through the real command palette: ordinary use must leave the dialog closed and focus the vault-search input; use after hiding the vault sidebar must reveal it and focus the input.
- [ ] RED: observe these failures on a **test-only** exact-head Browser E2E run, record the decisive assertion, and distinguish fixture/setup errors from missing behavior.
- [x] GREEN implementation authored: choose Vault sidebar, reveal a collapsed sidebar through the existing owner, and defer focus until after palette dismissal. Hide the command when the sidebar is collapsed but cannot be reopened. No second focus broker or changed shortcut.
- [ ] Verify current-head source/TypeScript, E2E, keyboard, narrow/RTL/200%-zoom and installed-client focus.
- [ ] This is a MAT-018 action-availability slice, not complete capability/Help alignment.

**Evidence classification:** The behavioral red was not observed before implementation, even though the tests precede the fix in Git history. The test-only run, new-head verification status, and remaining keyboard/packaged acceptance gates are recorded only in the [central MAT-018 verification ledger](../../docs/VERIFICATION.md#mat-018-command-palette-availability--pending-exact-head-acceptance).

## Collapsed-sidebar focus follow-up
- [x] Diagnosed the existing browser failure against the desktop rail visibility contract; observed-red provenance, exact assertions and verification limits are in [the central MAT-018 record](../../docs/VERIFICATION.md#mat-018-command-palette-availability--pending-exact-head-acceptance).
- [x] Collapsed desktop Vault rail now uses `visibility:hidden` so its search controls cannot remain keyboard-focusable while the rail is concealed. Mobile Vault navigation continues to show its pane despite persisted desktop collapse.
- [x] Kept the original Playwright assertion and added collapsed-state, restoration and mobile-pane checks.
- [ ] Full exact-head Browser E2E, workflow screenshots, 200% zoom/RTL and installed-client keyboard acceptance.

## CodeRabbit note-search effect coverage
- [x] The component harness now commits its real React effect callbacks with controllable timers. A missing note opener must not schedule or call the native-backed search; an available opener preserves query scheduling and selectable result dispatch.
- [x] This addresses the latest CodeRabbit coverage nitpick without changing CommandPalette production code or weakening the existing no-op suppression test.
- [ ] Exact-head source and browser checks required. This test-hardening is **not** an observed new failing-first application regression; evidence limitations remain in [the MAT-018 verification record](../../docs/VERIFICATION.md#mat-018-command-palette-availability--pending-exact-head-acceptance).

## CodeRabbit accessibility follow-up — failing-first browser tests
- [x] Add real Playwright reproduction: select Inspector in the mobile navigation, activate palette `Focus vault search`, and require switching to the mobile Vault pane before focusing the visible field.
- [x] Add real Playwright reproduction: collapse desktop Vault sidebar, press the configured global `F` shortcut outside an editor, and require the rail to expand before search receives focus.
- [ ] Record hosted red on the test-only head. A failed setup/harness condition is not a behavioral red.
- [ ] Fix the existing owners: pass the mobile-pane selector into the palette command and expand/focus in `useAppKeyboardShortcuts` for the global route; preserve the existing no-op availability guard and native boundaries.
- [ ] Verify exact-head browser, source, TypeScript, visual and installed-client mobile/200%-zoom keyboard behavior. Keep MAT-018 open.

## CodeRabbit focus-search implementation (not yet hosted green)
- [x] The palette `focus-search` action now chooses the mobile Vault pane as well as Vault sidebar before requesting deferred focus.
- [x] The global `F` shortcut follows the same existing owner: change Inbox to Vault, select mobile Vault, reveal collapsed desktop rail, and request focus on the next animation frame.
- [x] App passes the live mobile-pane setter and desktop collapsed state to the respective command/shortcut owners; no new command registry or permission authority.
- [ ] Both new real-browser assertions need exact-head RED then GREEN evidence, plus keyboard/zoom/RTL and installed-client acceptance. Existing CodeRabbit threads remain open until verified.
