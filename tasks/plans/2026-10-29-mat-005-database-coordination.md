# MAT-005 / MAT-010 — Database Studio source-editor coordination
**Independent draft PR, based on main.** A bounded mutation-safety change, not implementation of full-vault Database Studio or batch editing.

## Source risk and contract
`DatabaseStudioPanel.editCell` currently uses `runSourceNoteMutation` when supplied, but has a direct `vaultFrontmatterSet` fallback when no coordinator is passed. The native expected hash still protects the stored revision; it cannot see an unflushed draft in the editor. The architectural contract in `docs/ARCHITECTURE.md` requires Database edits to flush that draft through the source-note mutation coordinator first.

## Failing-first test
- [x] Test-only branch executes the **actual JSX DatabaseStudioPanel** with controlled React hooks and native IO.
- [x] Tests require a missing-coordinator panel to disable edit controls and reject direct write attempts; a properly coordinated panel must continue making one guarded native write with the selected path, expected hash and originating vault.
- [ ] Record an **observed hosted failing-first** test; reject a harness/import/setup failure as evidence.
- [ ] Minimum production fix: eliminate the direct native fallback and fail closed, while preserving a read-only loaded view and existing source editor coordinated writes.
- [ ] Repeat current-head source, frontend, E2E research workspaces, visual/RTL, Rust/Windows gates; installed-client unsaved draft and vault-switch acceptance are separate.

## Explicit non-goals
No indexer query pagination, 200-candidate/32MiB limit changes, view schema migration, provider writes, direct filesystem permissions, or claim that MAT-005/MAT-009/MAT-010 as a whole is complete.
