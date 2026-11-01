# MAT-003 — vault-owned Git conflict inventory (bounded slice)

**Base:** `feat/mat-integrated-core-maturation-20261101` (draft PR #249).  
**Workstream:** [MAT-003 #182](https://github.com/AmirrezaFarnamTaheri/Scriptor/issues/182).  
**Status:** code and tests committed; exact-head CI and installed-client acceptance not yet certified.

## Source of truth and ownership

The Recovery Center now separately inspects the existing native `git_status_cmd` read through `gitStatus(expectedVaultId)`. This native command receives the initiating vault identity; a late response from a prior vault is ignored by the mounted Settings component. It does not infer Git state from remembered UI text.

Only a confirmed Git repository with a consistent, finite, unique set of conflict paths can show a numeric result. Non-Git vaults remain **unverified** rather than zero. Native errors become **unavailable**, pending replies are **loading**, and zero verified conflicts is **empty**. Invalid/duplicate/oversized native results do not become an authoritative zero.

This is a read-only *Git merge conflict* count. It is **not** a count of arbitrary external changes, unsaved editor drafts, Canvas restore checkpoints or recoverable backups. The existing `External file conflicts` and `Canvas recovery` entries remain unverified until their actual recovery owners have authoritative readers. Git status grants no resolution or restore authority.

## Regression coverage

- `src/lib/workspace/gitConflictRecoveryEvidence.test.ts`: four deterministic native-result classification cases. Verified locally on Node 22 with test RED (missing helper) followed by GREEN (4/4).
- `src/lib/workspace/recoveryInventory.test.ts`: Git vs external conflict distinctions, vault identity, loading/error/absent/empty.
- `e2e/backup-restore-receipt.spec.ts`: fixture-based Recovery Center browser test for two Git conflicts, external uncertainty and no Git mutations.
- **Verified source blob hashes:** helper `eaccfa180d764d435e72296410643b9ffa84730f`, helper tests `60596128cfa1685da59c758ba8ae070ae2d0781a` on the standalone Node run.

## Gates still required

Run full `pnpm test:source`, `pnpm lint`, `pnpm build`, browser Playwright, Rust native tests, visual checks, and exact-head GitHub CI. Installed Windows/macOS/Linux testing must include two vaults, permission denial, non-Git vault, wrong-vault late replies and conflict-resolution authorization before MAT-003 can be accepted. This stacked PR must not be merged independently of its reviewed base, and no release or capability graduation is implied.
