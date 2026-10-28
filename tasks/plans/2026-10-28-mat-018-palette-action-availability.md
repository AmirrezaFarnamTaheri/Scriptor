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
