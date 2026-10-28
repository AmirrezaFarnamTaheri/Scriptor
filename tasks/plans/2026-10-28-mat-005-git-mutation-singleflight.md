# MAT-005 — Git workspace mutation single-flight

**Draft PR:** #210. Independent of the Canvas and backup-inventory MAT-005 branches; based on `main`.

## Defect and behavioral contract

The workspace Git hook exposes a React-rendered busy state but does not synchronously exclude repeated commit, pull or push commands. Two callbacks in the same render turn can both invoke native Git. The busy state was also filtered by the selected vault ID, so a native operation that remained pending after switching vaults appeared idle in the newly selected vault.

One native Git mutation may run at a time through this UI owner. Both the synchronous refusal of a duplicate and the busy indicator stay active until the original request completes or fails. Existing native GitQueue, scoped native permissions and status-controller freshness remain authoritative.

## Verification ledger

- [x] Real-hook behavioral regression committed first (`6182df8`); mock only React scheduling and native Git boundaries.
- [x] Hosted RED observed in CI #40585634586: two commits instead of one, and false idle state during an in-flight pull after vault navigation.
- [x] Correct the test VM realm's `Error` constructor so its existing failure-path assertion evaluates the actual error message, not `Error.toString()` across realms.
- [x] Implement minimum ref-owned single-flight gate shared by commit, pull and push.
- [x] Earlier green baseline verified on `186a3b3` (CI #40586771173; Visual #40586771362).
- [x] New RED candidates committed on `32f525d`: old-pull cross-vault refresh, old-commit status refresh, and ABA navigation regression.
- [x] Observed RED at [CI #40675186002](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/40675186002), test-only head `f8ba9be6`: stale pull cross-vault refresh, stale commit status refresh, and A→B→A reuse all failed for expected reasons.
- [x] Added a vault generation guard to skip stale refresh effects without weakening the assertions or changing native write success.
- [ ] Verify exact-head GREEN source, Rust, Windows, browser and visual results.
- [ ] Hosted exact-head source regressions, TypeScript, browser, Rust, Windows and visual workflows.
- [ ] Installed-client acceptance for same-render double submission, vault switch while pending, denied native write, and later explicit retry.
- [ ] Broad MAT-005 mutation owner review; no graduation or merge claim yet.

## Safety boundaries

No new command, API key, storage format, parallel status cache, permission broker or optimistic rollback. A failed request does not prove rollback; native error and activity paths remain unchanged. Keep the PR draft while installed-client gates and wider MAT backlog remain open.

## Additional MAT-005 finding — delayed Git error ownership

- [x] The `useWorkspaceGit` hook receives a **workspace-wide** `setError`. Unlike success-side refreshes, the three native Git mutation catch paths had no vault lifecycle guard; a failed old-vault operation could overwrite the current vault's message.
- [x] Four real-hook behavioral cases were authored first as detached test commit `397cc6a`: delayed failures after vault switch for commit/pull/push, plus A→B→A. Keep audit activity and release the mutation single-flight gate.
- [x] Reuse the existing `isCurrentVaultLifecycle(targetVaultId, lifecycle)` for `setError(detail)` in all three catch paths; no change to native GitQueue, transport, authorization, retries or activity logging.
- [ ] **Failing-first hosted execution has not been observed** on the detached test-only commit. Require current-head source, frontend, Rust, Browser E2E, Windows/visual, CodeRabbit and installed-client acceptance. MAT-005 remains unchecked.
