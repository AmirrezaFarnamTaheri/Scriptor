# MAT-005 — bind Obsidian imports to their initiating vault

**Stacked draft:** [PR #227](https://github.com/AmirrezaFarnamTaheri/Scriptor/pull/227) targets [PR #219](https://github.com/AmirrezaFarnamTaheri/Scriptor/pull/219). Scope: an isolated vault-ownership guard, not a second importer or authorization subsystem.

## Defect and boundary

The Obsidian dialog already captures the vault that opened it and suppresses late results after unmount. Its bridge previously called `authorizeSensitiveOperation('import_vault', obsidianPath)` without passing the originating vault identity. A queued renderer request could start native authorization after the active vault switched. The native import then used the newly active session and its token, creating a cross-vault write risk. This is source-supported but **not an observed real-world wrong-vault write**.

## Regression coverage

- Test-only [`4208e00`](https://github.com/AmirrezaFarnamTaheri/Scriptor/commit/4208e0091f22867b433ef32a39443c8246267c3a) adds source behavior tests for delayed approval retaining the original vault, rejecting an empty target before approval/invoke, and checking native guard order.
- Extend the existing real-dialog JSX harness to assert the captured initiating vault is forwarded into its bridge call without reimplementing the component.
- The native `validate_expected_vault` helper already has Rust tests for matching and mismatched vault IDs. The new required command argument prevents the import handler from using its optional-identity legacy escape path.
- **RED result:** not observed; queued source workflow is not a passing or failing assertion.

## Implementation

1. `ObsidianImportDialog` passes its captured `vaultId` when calling `vaultImportObsidian`.
2. The TypeScript bridge requires a nonblank owner before requesting approval and forwards `expectedVaultId` to Tauri.
3. Native `vault_import_obsidian` requires `expected_vault_id: String` and uses existing `validate_expected_vault` before token consumption/import.
4. Preserve native session resolution, import options, user approval, vault-scoped claim ownership, late-dialog guards and current authorized import implementation.

## Acceptance and limitations

- Run the repository's full source, typecheck, native Rust, desktop Windows, browser E2E, visual and documentation checks on the **final** head.
- In a packaged desktop client, open vault A's import, delay approval, switch to B, finish approval, and confirm **no B import**, intact content and clear error. Repeat with denied approval, dialog closure and explicit retry. Closing the dialog does not cancel already-submitted native work.
- Merge this stacked PR into #219 only after exact-head CI, review and installed-client acceptance. The wider MAT-005 backlog stays open.
