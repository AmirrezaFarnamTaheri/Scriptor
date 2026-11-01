# MAT maturation — integration slice

**Source branch:** `feat/mat-integrated-core-maturation-20261101`
**Base:** `e773193f45295d24a5e61e231e0bdaedb61e0348`
**Status:** implementation for review; neither issue acceptance nor installed-client certification.

## Observable product changes
- MAT-002: typed renderer-observed operation outcomes and adapter for existing native restore receipts. Lost native replies and invalid native responses are distinct indeterminate outcomes; confirmed post-commit refresh failures require an authoritative native committed status. Authorization and filesystem writes stay in native owners.
- MAT-003/004: Backup settings includes a read-only Recovery Center overview. It shows verified vs unverified backups, native current-vault note history counts (vault/path-owned read-only requests), and last restore certainty. Uninspected Canvas/conflict sources are unverified. Destructive actions continue through existing native confirmation paths.
- MAT-005/008: a source-parity audit matrix is checked against the Rust desktop-only command catalog. It is a test and work list, **not a runtime authorization source**; pending PR #245 contains the separate defense-in-depth daemon dispatch guard. The editor mutation coordinator also rejects a previously reviewed mutation if the vault, note, navigation generation or draft revision changes while flushing a draft.
- MAT-009: indexed-view queries now support bounded keyset pages (up to 201 including lookahead), with deterministic path ordering and next/previous page navigation. The renderer retains a 200-note, 32 MiB per-page budget and never claims page-local metadata/aggregates are full-vault results. Native frontmatter projection, stable snapshot cursors, verified global totals, and 25k-note performance evidence **remain to be implemented**.
- MAT-007/011/012: a read-only research-evidence review models source IDs, reviewed revisions, passage offsets, bibliography and manuscript citation integrity. Capture UI distinguishes acknowledged note creation from failed indexing and names unverified next research steps. This does not persist a provenance graph or silently rewrite Markdown.

## Expected verification
- Local Node 22 strip-types unit tests and the Rust-catalog/source-wiring contracts.
- Exact-head CI (Rust, Clippy, Node, frontend, E2E, visual, Windows smoke).
- Installed Windows/macOS/Linux: vault A→B same-path, denial and retry, crash/reopen recovery journal, corrupt source, 200% zoom, keyboard + screen reader, 320px and RTL.
- The deterministic 25k-row SQLite index pagination regression is checked by Rust CI; separate 25k-file filesystem, frontend timing, snapshot-cursor and full-vault aggregate proof remain required before MAT-009 completeness claims.
- Real citation/source rename/export and consented provider journeys before MAT-011/012 graduation.

## Hosted browser regression evidence and follow-up

- At `acbe64811d8657b97b86b71f135bdf8ed88d23af`, [CI #41312273984](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/41312273984) passed contracts/lint, frontend, Rust, container, supply chain and Windows release gates, but **Browser E2E failed: 515 passed, 6 failed**. The separate visual, desktop compile, and localization workflows passed.
- Two backup pagination assertions counted the four Recovery Center diagnostic rows as saved backups. E2E now explicitly scopes counts to `#vault-backup-list .backup-entry`, without hiding or removing read-only recovery evidence.
- Three Database Studio workflows failed because the research browser fixture returned unsorted paths, violating the new strict UTF-8 indexed cursor ordering. The fixture now honors native-compatible path ordering and bounded exclusive cursor pages. The new pure pagination test was observed RED (missing helper) and GREEN (4/4 locally on Node 22); GitHub blob hashes `77916b57220df0124e1f89c0657822b6bb185cc0` and `9b3a698b891569b5b42828369ef7fb281cdec978` match the tested files.
- Capture review had an obsolete assertion for `Saved reviewed capture`; the observed UI correctly says `Saved and indexed reviewed capture`. E2E now checks the explicit indexed receipt and retains its native write identity assertions.
- These changes were applied **after** the failed run. An exact-head successful browser rerun is still required; neither MAT-009 nor other maturity workstreams are accepted.

## Safety boundaries
No new independent permission service, storage authority, native command, auto retry, remote provider call, release tag or support-status change. This branch must not be merged as completion of the parent issues.
