# MAT-005 — Canvas board-list response ordering

**Base:** PR #206, independently stacked on MAT-005 backup-inventory ordering. This is a bounded Canvas mutation-lifecycle slice, not the whole MAT-005 contract.

## Source-grounded defect

`useCanvasBoard.refreshBoardList()` checks only the caller-provided lifecycle predicate. Two list reads in the **same vault** can overlap: initial mount hydration may still be resolving when a successful Canvas save requests a newer list. The newer list updates the UI first, and a later older read can replace it because the original lifecycle remains valid. Existing document identity guards protect the editing surface but do not protect the board inventory.

## Acceptance

- [x] Inspect the existing real-hook harness, persistence queue, lifecycle guard, and board list rendering.
- [x] Add failing-first behavioral regression using actual `useCanvasBoard` via the TypeScript-transpiled hook harness, not a source regex. Hold initial list, commit a Canvas edit, return the post-save list first, then release stale mount list; the fresh board must remain listed and the edited document unchanged.
- [ ] **RED:** execute source-suite test on the test-only head; capture non-zero exit and decisive assertion.
- [ ] **GREEN:** guard same-vault board-list publication by a monotonic read generation. Keep native ownership and existing document/saving guards; never suppress the returned result or invent a successful native write.
- [ ] Run the focused source suite and exact-head CI/visual/browser/platform checks; keep draft until proven.
- [ ] Continue auditing other MAT-005 mutation owners and installed recovery tests.

## Invariant

Read ordering governs derived UI inventory only. Native Canvas files and Markdown vault state remain authoritative; no new retries, permissions, storage, or implicit mutation.
