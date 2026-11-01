# MAT maturation — integration slice

**Source branch:** `feat/mat-integrated-core-maturation-20261101`
**Base:** `e773193f45295d24a5e61e231e0bdaedb61e0348`
**Status:** implementation for review; neither issue acceptance nor installed-client certification.

## Observable product changes
- MAT-002: typed renderer-observed operation outcomes and adapter for existing native restore receipts. Unknown native replies are indeterminate; explicit native status alone permits commit/no-change classifications. Authorization and filesystem writes stay in native owners.
- MAT-003/004: Backup settings includes a read-only Recovery Center overview. It shows verified vs unverified backups, current selected-note history availability, and last restore certainty. Uninspected Canvas/conflict sources are unverified. Destructive actions continue through existing native confirmation paths.
- MAT-005/008: a source-parity audit matrix is checked against the Rust desktop-only command catalog. It is a test and work list, **not a runtime authorization source**; pending PR #245 contains the separate defense-in-depth daemon dispatch guard.
- MAT-009: Database Studio no longer suggests bounded UI candidate arrays establish full-vault counts. Native indexed projection and cursor pagination **remain to be implemented**; existing 200-note and 32 MiB budgets are retained.
- MAT-007/011/012: a read-only research-evidence review models source IDs, reviewed revisions, passage offsets, bibliography and manuscript citation integrity. Capture UI distinguishes acknowledged note creation from failed indexing and names unverified next research steps. This does not persist a provenance graph or silently rewrite Markdown.

## Expected verification
- Local Node 22 strip-types unit tests and the Rust-catalog/source-wiring contracts.
- Exact-head CI (Rust, Clippy, Node, frontend, E2E, visual, Windows smoke).
- Installed Windows/macOS/Linux: vault A→B same-path, denial and retry, crash/reopen recovery journal, corrupt source, 200% zoom, keyboard + screen reader, 320px and RTL.
- 25k-note performance tests and native full-vault result proof before MAT-009 completeness claims.
- Real citation/source rename/export and consented provider journeys before MAT-011/012 graduation.

## Safety boundaries
No new independent permission service, storage authority, native command, auto retry, remote provider call, release tag or support-status change. This branch must not be merged as completion of the parent issues.
