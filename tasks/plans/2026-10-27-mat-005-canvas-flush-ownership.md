# MAT-005 — Canvas explicit-flush response ownership

**Independent branch from main:** `feat/mat-005-canvas-flush-ownership-20261027`. This is a narrow MAT-005 owner-specific slice, independent of PR #206's backup-inventory ordering; neither change grants new filesystem or provider authority.

## Confirmed source risk
`src/hooks/useCanvasBoard.ts` serializes saves and guards ordinary debounced writes by lifecycle/save generation. However the explicit `flushPendingSave()` path invokes `enqueueSave(pending, () => true)` for pending and retry payloads. A reply from an older revision or another vault can therefore run `setStatus('Canvas saved.')`, `setActiveBoardId`, or board-list refresh against the newer UI, even though the native save itself remained scoped to the originating vault.

## Regression and acceptance
- [x] Added real `useCanvasBoard` behavioral tests through the repository's existing TypeScript-transpiled hook harness. They hold a native save pending and resolve it after a vault switch or a newer local edit; the native write may succeed, but the superseded UI must not report that the new state is saved.
- [x] **Red observed:** run the focused hosted source suite on the test-only commit; preserve observed failing assertion, not merely a guessed outcome.
- [x] **Green implementation committed:** capture original lifecycle/document identity in explicit flush, and pass a current-owner guard to `enqueueSave` for pending/retry writes. Do not cancel or relabel an already committed native write.
- [ ] Re-run exact-head source, TypeScript, browser Canvas flows, Windows and desktop gates. The mocks do not certify installed-client crash/recovery behavior.
- [ ] Keep the parent MAT-005 checklist unchecked until other mutation owners and the installed product pass.

## Scope boundary
Do not modify the Canvas file format, native command, expected-vault serialization, save ordering, retries, or the review approval model. Only ownership of renderer-observed save completion status/selection is in scope.

## Hosted red proof and implementation
- [x] Test-only head `b3ebaeb`, [CI #40556426344](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/40556426344): actual `canvas-persistence-flush.test.mjs` failures **182 and 183**, each expected `New board ready.` but observed `Canvas saved.` after the older save completed.
- [x] Explicit flush captures its originating lifecycle and document reference. Every pending/retry `enqueueSave` uses the same freshness guard to suppress stale status, board-selection, and derived-list updates, without undoing a durable native save.
- [ ] Hosted source regression, TypeScript, browser, Rust/desktop, visuals and installed-client vault transitions require new exact-head proof.
