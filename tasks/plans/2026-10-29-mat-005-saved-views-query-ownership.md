# MAT-005 — Saved Views query freshness and vault ownership

**Independent draft PR based on main.** No overlap with #206/#208 (backup), #207/#209 (Canvas), #210–#213 (Git), #216 (palette), or #217 (Database Studio cell mutation).

## Source-grounded hazard
`src/components/SavedViewsPanel.tsx` maintains two asynchronous read paths:
- Explicit `runQuery()` has no generation or scope guard. An older manually issued request can settle after a newer filter's debounced effect read and replace the currently displayed results.
- Automatic effect depends on `[canQuery, filterJson]` only. It neither depends on `vaultId` nor clears old results at a vault transition. A mounted Knowledge Workbench keeps showing vault A's result labels after the view switches to vault B with the same filter. A pending old-vault response can arrive even later.

## Tests and gates
- [x] Inspect current main, neighboring MAT PRs, and Saved Views call sites; confirm no matching open PR.
- [x] Author source behavioral regressions against the actual SavedViewsPanel TSX component and controllable mocked native read boundary. Tests cover an old manual query after changing filters, unchanged filters across vault switch, and late previous-vault response.
- [x] **RED (observed):** the test-only head failed three real Saved Views behavioral assertions in CI #40779293100. Counts, exact failure modes and environment are recorded in [the verification ledger](../../docs/VERIFICATION.md#mat-005-saved-views-query-ownership--october-29-2026).
- [x] **GREEN implementation:** explicit and debounced queries share one request epoch; vault/filter identity masks old rows synchronously during render; effect cleanup invalidates outstanding reads; no native query or authorization changes.
- [ ] Validate current-head test suite, TypeScript, browser Saved Views navigation, visual/mobile/RTL, Rust, Windows, and installed-client vault-change cases; do not mark MAT-005 complete.

## Boundaries
No query DSL or schema migration; no native command, search engine, dependency, credential, persistence, or authorization change. This guards renderer-only result visibility, not native admission.

## Current-head verification
- [ ] Confirm the three previously failing source tests now pass, and the broader source suite remains green on the new commit.
- [ ] Verify TypeScript, browser, Rust, Windows, visual and narrow/RTL product gates on the new commit; installed-client vault transitions remain separate.
- [ ] Keep MAT-005 unchecked until other mutation and read owners meet acceptance.

## Test-harness fidelity follow-up
- [x] The existing mock previously recreated `useCallback` on every render. Since the fixed component intentionally includes its memoized callback in effect dependencies, this would spuriously restart the effect on unrelated rerenders and invalidate the latest result. Updated the mock to preserve `useCallback` and `useMemo` values when dependency identities are equal, matching React's contract.
- [x] All three behavioral assertions remain unchanged. No production code changes in this follow-up.
- [ ] Confirm exact-head hosted source suite and browser gates on this new commit; do not infer green from a harness change.
