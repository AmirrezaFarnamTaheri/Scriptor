# MAT-018 - Command palette action availability (initial slice)

**Branch:** feat/mat-018-palette-action-availability-20261028. **Scope:** remove commands with absent callbacks or missing active resources from the user-facing palette; do not fabricate permission or provider readiness. This is the first MAT-018 slice, not completion.

## Current defect

buildPaletteCommands adds multiple commands with optional chaining such as openKnowledgeWorkbench, setPortalOpen, setNoteHistoryOpen even when launchers are not provided. Running them closes CommandPalette without any effect. A zero-count Reopen closed tab and Mark active note organized with no active note also advertise unavailable actions. This conflicts with discoverability, effective keyboard use, and consistency between offered commands and real capabilities.

## Test-first sequence

- [x] Read the command builder, registry, palette and existing source tests. Preserve available commands and their existing callbacks.
- [x] Author focused behavior tests: absent owner means command absent, a missing active note cannot be organized, and zero closed tabs cannot be reopened. Available owners still execute the right callback.
- [ ] RED: observe the exact missing-prerequisite failures in hosted pnpm test:source; distinguish a real assertion from setup/type errors.
- [ ] GREEN: gate only affected AppCommandDefinition registrations using existing owner callbacks/resource counts, without adding duplicate availability state or permissions.
- [ ] Exact-head source/TypeScript/browser/visual/accessibility checks. Keyboard command palette at narrow/RTL/200% zoom and user study are independent gates.

## Limits and follow-ups

Omission of truly unavailable handlers is preferable to an inert selectable option in this narrow slice. A shared, localized unavailable-reason model for real-but-blocked operations, contextual Help and non-palette launchers remains separate MAT-018 work. All native permission checks remain authoritative. No new UI persistence, file mutation, provider write or granted authority.
