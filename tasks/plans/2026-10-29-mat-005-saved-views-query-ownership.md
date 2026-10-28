# MAT-005 — Saved Views query freshness and vault ownership

**Independent draft PR based on main.** No overlap with #206/#208 (backup), #207/#209 (Canvas), #210–#213 (Git), #216 (palette), or #217 (Database Studio cell mutation).

## Source-grounded hazard
`src/components/SavedViewsPanel.tsx` maintains two asynchronous read paths:
- Explicit `runQuery()` has no generation or scope guard. An older manually issued request can settle after a newer filter's debounced effect read and replace the currently displayed results.
- Automatic effect depends on `[canQuery, filterJson]` only. It neither depends on `vaultId` nor clears old results at a vault transition. A mounted Knowledge Workbench keeps showing vault A's result labels after the view switches to vault B with the same filter. A pending old-vault response can arrive even later.

## Tests and gates
- [x] Inspect current main, neighboring MAT PRs, and Saved Views call sites; confirm no matching open PR.
- [x] Author source behavioral regressions against the actual SavedViewsPanel TSX component and controllable mocked native read boundary. Tests cover an old manual query after changing filters, unchanged filters across vault switch, and late previous-vault response.
- [ ] **RED:** obtain hosted `pnpm test:source` failure for the exact test-only commit. Distinguish a real assertion from harness/bootstrap failures.
- [ ] **GREEN:** use a monotonically increasing request owner shared by manual/effect reads, cancel effect scope changes, include vaultId in the effect dependencies, and reset old visible results as owner changes. Query runs remain read-only.
- [ ] Validate current-head test suite, TypeScript, browser Saved Views navigation, visual/mobile/RTL, Rust, Windows, and installed-client vault-change cases; do not mark MAT-005 complete.

## Boundaries
No query DSL or schema migration; no native command, search engine, dependency, credential, persistence, or authorization change. This guards renderer-only result visibility, not native admission.
