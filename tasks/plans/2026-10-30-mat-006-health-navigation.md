# MAT-006 — Feature-panel note navigation approval

**PR:** #233 · **Parent issue:** #185 · **Baseline:** main

## Defect
Health Dashboard used to call `void openNote(path)` then immediately
`setHealthDashboardOpen(false)`. The editor may reject navigation (e.g. a
dirty draft or a blocked leaf transition), while the initiating surface has
already been dismissed. That breaks the existing workspace ownership contract.

## Bounded implementation
- [x] Author failing-first source regression on the actual App handler.
- [x] Use one pure, typed callback for approved navigation; no workspace manager,
      note editor, persistence, or permission broker is added.
- [x] Keep the Health Dashboard visible for a rejected/false/blank navigation.
- [x] Surface thrown source errors in the existing toast channel.
- [x] Add behavioral tests for delayed approval, refusal and exception.
- [ ] Confirm hosted RED from test-only `d3e2a68`.
- [ ] Verify current-head source, TypeScript, browser, Rust, Windows, docs
      and visual gates without reusing older-head evidence.
- [ ] Installed-client: same-note open, dirty close, rejected navigation,
      vault switch, focus restoration, RTL and 200% zoom.
- [ ] Further MAT-006 App/editor lifecycle decomposition and acceptance.

## Boundaries
The existing `useWorkspaceComposition` remains the sole leaf owner. It owns
the native note load and returns the success value; the new helper only decides
whether a feature panel may dismiss after that outcome. False is not interpreted
as rollback; exceptions are not swallowed.
