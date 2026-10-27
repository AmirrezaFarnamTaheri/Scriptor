# MAT-005 — Backup inventory request ordering

**Parent:** MAT-003 PR #205; primary owner `src/hooks/useVaultBackup.ts`. This PR is the first mutation-lifecycle audit slice, not MAT-005 completion.

## Reproduced risk

The effect-driven `vaultListBackups` and the explicit `listBackups` callback can overlap for the same vault and backup directory. The current ownership check verifies only (vaultId, directory). A delayed older response may replace a newer inventory, resurrecting deleted backup labels or hiding a fresh backup.

## Steps and evidence
- [x] Inspect current hook and existing native-owned backup listing contract.
- [x] Add an E2E fixture that holds the first list request for directory A, navigates A→B→A, returns a newer list for A, then releases the old A response.
- [x] Add a focused source-contract test requiring ordering for both effect and explicit refresh paths.
- [ ] **RED:** execute `pnpm test:source` and focused `pnpm exec playwright test e2e/backup-list-race.spec.ts` against test-only head; capture decisive failure. Hosted check is not yet observed.
- [ ] **GREEN:** add a monotonic request-epoch guard to both list sites, invalidating older results on manual backup/list mutation; preserve existing native access checks, authorization, quarantine, and error states.
- [ ] Verify last-response-wins for success and failure; run current-head hosted source/TS/browser/Rust checks, and package/UI tests where necessary.
- [ ] Continue the rest of MAT-005 owners (editor/Canvas/database/tasks/imports/rename/providers) in separately reviewable changes.

## No new authority
The request token is renderer-only; native vault selection, backup scope and permission checks remain authoritative. No new storage, API, dependency, filesystem write or automatic destructive behavior.
