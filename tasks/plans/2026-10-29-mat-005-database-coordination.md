# MAT-005 / MAT-010 — Database Studio source-editor coordination
**Independent draft PR, based on main.** A bounded mutation-safety change, not implementation of full-vault Database Studio or batch editing.

## Source risk and contract
`DatabaseStudioPanel.editCell` currently uses `runSourceNoteMutation` when supplied, but has a direct `vaultFrontmatterSet` fallback when no coordinator is passed. The native expected hash still protects the stored revision; it cannot see an unflushed draft in the editor. The architectural contract in `docs/ARCHITECTURE.md` requires Database edits to flush that draft through the source-note mutation coordinator first.

## Failing-first test
- [x] Test-only branch executes the **actual JSX DatabaseStudioPanel** with controlled React hooks and native IO.
- [x] Tests require a missing-coordinator panel to disable edit controls and reject direct write attempts; a properly coordinated panel must continue making one guarded native write with the selected path, expected hash and originating vault.
- [ ] Record an **observed hosted failing-first** test; reject a harness/import/setup failure as evidence.
- [x] Minimum production fix authored: remove the direct native write fallback. A missing source editor coordinator disables cell controls while preserving loaded notes and normal coordinated edits; direct programmatic editing also rejects before any mutation.
- [ ] Repeat current-head source, frontend, E2E research workspaces, visual/RTL, Rust/Windows gates; installed-client unsaved draft and vault-switch acceptance are separate.

## Explicit non-goals
No indexer query pagination, 200-candidate/32MiB limit changes, view schema migration, provider writes, direct filesystem permissions, or claim that MAT-005/MAT-009/MAT-010 as a whole is complete.

## Implementation submitted for hosted verification
- The regression tests were authored on the test-only head `8bd17fc` before any product changes. [CI #40776875924](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/40776875924) was queued/in progress when the implementation was prepared; a failing-first **behavioral** result was not yet observed. Do not label this a completed red-green cycle unless the original run establishes the intended failure.
- The production edit removes only the uncoordinated `vaultFrontmatterSet` route. Cell buttons become disabled without `runSourceNoteMutation`, and direct `onEdit` calls reject before any native write. Read-only result navigation and view building continue to work.
- [ ] Exact-head source regression, TypeScript, full browser, visual, Windows/Rust and installed unsaved-draft/vault-transition acceptance remain outstanding.

## Main integration
Current main's native Obsidian note and attachment import safety work is retained. The integration head needs its own hosted gates; historical tests do not certify this commit.
