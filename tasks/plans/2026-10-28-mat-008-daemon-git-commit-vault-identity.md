# MAT-008 — Daemon Git commit vault identity

**Branch:** `feat/mat-008-daemon-git-commit-vault-identity-20261028`  
**Draft PR:** #212  
**Issue:** #188

## Regression and scope

A Git commit request via the normal daemon command gateway or authenticated IPC outside-lock path must contain a nonblank initiating `expected_vault_id` matching the currently active daemon session. A mismatch must return an identity error **before** creating the queue, enqueueing, or writing. It must not fall back to the daemon's subsequently selected vault.

The daemon state mutex serializes identification with snapshotting the GitQueue for the current vault. The queue is still used outside the mutex, preserving bounded native work and the existing per-repository worker. Do not introduce another authorization broker. Desktop Tauri commit enforcement is owned by #211; renderer duplicate invocation is owned by #210.

## TDD ledger

- [x] Test-only branch has real Rust daemon command/transport tests for stale and absent IDs.
- [x] Observed RED in [CI #40657380487](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/40657380487): both test functions reached GitQueue and failed `not a git repository` instead of rejecting identity.
- [x] Added a single shared `require_git_commit_vault_identity` guard and wired both daemon command paths before queue creation.
- [x] Added a positive test for a matching originating ID without requiring a real Git repository.
- [x] Extracted existing command-gateway Rust tests into a child module to stay below the 950-line source-size ratchet; no increase to the budget.
- [ ] Verify Rust source, formatting, Clippy, Rust tests, Windows, browser, and visual gates on the implementation's exact head.
- [ ] Verify an actual authenticated daemon IPC session with a delayed old-vault request, restart, and response-loss behavior.
- [ ] Audit remaining CLI/TUI/MCP operations separately; this PR does not complete MAT-008.

Native GitQueue, command outputs, operation results, and existing permissions remain unchanged. A response loss does not prove rollback.
