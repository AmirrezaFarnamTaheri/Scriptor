# MAT-008 — Desktop Git commit expected-vault binding

**Parent:** issue #188. **Branch:** `feat/mat-008-git-commit-vault-identity-20261028`, based on `main`. Independent of MAT-005 #210.

## Defect

The desktop Git bridge omitted the invoking vault identity. Native `git_commit_cmd` resolved the active session only when the Tauri invoke ran, then submitted to that session's GitQueue. The existing session lease prevents mid-command swaps but not a previously issued renderer request arriving after a vault selection change.

## Ledger

- [x] Test-only real bridge regressions (`06a3a4e`) before implementation.
- [x] Hosted RED: [CI #40595869204](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/40595869204), 683 passed and two specifically failing new tests (absent `expectedVaultId`, missing-identity refusal).
- [x] Require a nonempty initiating vault ID in the typed bridge and pass it from `useWorkspaceGit`.
- [x] Native expected-vault check while holding active-session lease, before GitQueue acquisition and write, with positive/negative Rust tests.
- [x] Browser native mock enforces exact fixture vault; operation catalog and generated authorization inventory record expected-vault local mutation.
- [ ] Hosted GREEN at implementation head: source/TypeScript/Rust/Windows/Browser E2E/visual/docs.
- [ ] Installed-client delayed-invoke/vault-change, refusal, clean retry, restart/response-loss proof.
- [ ] Separate daemon, CLI, TUI and MCP cross-entrypoint contract audit and acceptance.

## Constraints

No new broker, command authorization class, storage format or native Git engine. Reuse `validate_expected_vault`, active-session locking and GitQueue. A failed transport reply does not prove rollback; do not claim the broader MAT-008 task complete.
