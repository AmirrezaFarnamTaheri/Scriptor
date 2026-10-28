# MAT-018 - Command palette action availability (initial slice)

**Branch:** feat/mat-018-palette-action-availability-20261028. **Scope:** remove commands with absent callbacks or missing active resources from the user-facing palette; do not fabricate permission or provider readiness. This is the first MAT-018 slice, not completion.

## Current defect

buildPaletteCommands adds multiple commands with optional chaining such as openKnowledgeWorkbench, setPortalOpen, setNoteHistoryOpen even when launchers are not provided. Running them closes CommandPalette without any effect. A zero-count Reopen closed tab and Mark active note organized with no active note also advertise unavailable actions. This conflicts with discoverability, effective keyboard use, and consistency between offered commands and real capabilities.

## Test-first sequence

- [x] Read the command builder, registry, palette and existing source tests. Preserve available commands and their existing callbacks.
- [x] Author focused behavior tests: absent owner means command absent, a missing active note cannot be organized, and zero closed tabs cannot be reopened. Available owners still execute the right callback.
- [x] RED: [CI #40677971239](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/40677971239), head `d12f1a5`, source regression failed with exactly two intended assertions: missing knowledge-workbench handler still advertised, and empty closed-tab history still advertised.
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
- [x] The test-only head `8ab1b67` includes two real-component behavioral cases: suppress unavailable note results and preserve click-through when a handler exists.
- [ ] **Failing-first hosted result not observed:** [CI #40763493567](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/40763493567) was queued at implementation time. Do not call this a completed TDD red/green cycle without that evidence; see [`docs/VERIFICATION.md`](../../docs/VERIFICATION.md).
- [ ] Verify exact-head source and browser CI, visual/a11y matrix, and installed-client acceptance; do not mark MAT-018 complete.
