# MAT-005/MAT-009 — Database Studio result-scope guard

## Problem
Database Studio's view builder and selector can change the filter without clearing the previous view's rows, totals or edit callbacks. A late view query could repopulate old results or authorize an edit from the previous view.

## Tests
Test-only commit `02692a0` adds two real-component cases to `scripts/validation/database-studio-coordinated-edit.test.mjs`: stale rows/columns/edits after a view change, and an old in-flight list settling after a new filter. Hosted RED was not observed on the intermediate commit when this fix was authored.

## Implementation
- Separate view revision from native operation generation.
- Hide output immediately if loaded vault/revision does not match the current view.
- Clear rows and columns when changing view; invalidate pending queries.
- Recheck the view revision before coordinated native metadata edits and before publishing an edited note.
- Preserve existing coordinator, native authorization, hash precondition, 200-candidate/32-MiB bounds.

## Pending
Exact-head source, frontend/browser/Windows, visual and docs gates; installed-client vault switch, slow queries and dirty-editor workflows. This does not implement MAT-009 native pagination/complete aggregation or MAT-010 typed schema migration/batch edits.

## Stale error follow-up
- Test-only `b9ed54c` models the previous view's native query rejecting after a filter switch.
- The query catch and view-change handler now prevent an old error from appearing on a new view; the newer view remains ready for an explicit load. No hosted failing-first execution of this new test was observed before implementation.

## Lint correction

- **CI failure observed:** [CI #40970375883](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/40970375883) failed the fast lint job with `react-hooks/set-state-in-effect`, `react-hooks/refs`, and exhaustive-deps warnings. The fix removes new synchronous state updates from the vault effect, replaces render-time ref reads with a stored immutable view/vault/preset identity, and memoizes visible rows/columns. The query cancellation and stale-edit guards still use the ref only in callbacks/effects, where it is valid.
- **Pending:** new exact-head lint, real component tests, TypeScript, Playwright and native/visual gates; do not reuse prior-head passes.
