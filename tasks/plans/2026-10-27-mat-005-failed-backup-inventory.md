# MAT-005 follow-up — settle backup inventory after create failure

**Base:** PR #206 `121239f`, stacked child of MAT-005 backup-inventory ordering. This work is a bounded remediation of a lifecycle edge case; it is not completion of MAT-005.

## Source-grounded failure hypothesis

`useVaultBackup.beginOperation()` invalidates earlier listing requests by incrementing `backupListRequestEpochRef`. In `triggerBackup()`, when authorization denies `create_backup` or native submission fails, the catch records `lastError` but does not restart the inventory listing. If the previously invalidated request was the only one for the active destination, the list may remain at `Loading backups…` indefinitely even though the mutation has ended.

## Acceptance

- [x] Read the originating hook, native bridge authorization, existing MAT-005 ordering guard, and Backup settings loading/alert rendering.
- [x] Author a Playwright test holding the original list for a new directory, rejecting `authorize_sensitive_operation('create_backup')`, requiring a second read, and verifying loading settles while the denial remains visible. Release the old list last and ensure it cannot override the newer inventory. The fixture must prove no `vault_create_backup` submission or automatic retry.
- [x] Add a narrowly scoped source regression requiring read-only list reconciliation in `triggerBackup`'s failure branch and no duplicate create invocation.
- [x] **RED observed:** on test-only commit `1dcc6f3`, CI #40560278013 ran 741 source tests: 740 passed, and the new MAT-005 read-only reconciliation assertion failed exactly because no replacement read was scheduled. Browser red is not claimed.
- [x] **GREEN implementation authored:** after a failed create, the error remains visible and the existing guarded `listBackups()` reader reconciles the same vault/directory. No native write is retried. Exact-head verification remains pending.
- [ ] Run focused source and browser tests, then exact-head CI/visual/Windows/Rust lanes. Keep the PR draft and stacked until checks are green.
- [ ] Accept packaged-client testing separately. Other MAT-005 mutation owners remain open.

## Safety invariant

Inventory reads are observational. Native authorization and file mutations remain authoritative and are never silently retried; unknown transport outcomes must not be misrepresented as proven no-op.
