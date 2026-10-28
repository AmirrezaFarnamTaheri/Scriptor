# MAT-008 — Daemon Git status RPC identity

**PR:** #215 stacked on #213; **tracked by:** #188.

## Failing-first evidence

- Test-only head `d51b0e3`; hosted CI #40666737446 failed `unscoped_git_status_is_rejected_before_native_read_on_both_daemon_routes` (61 other daemon tests passed). An unbound request reached the native Git status read.

## Implementation checklist

- [x] The typed `RpcMethod::GitStatus` requires `expected_vault_id`.
- [x] One authoritative `DaemonState` identity helper is used before Git root resolution by typed RPC and both daemon Invoke paths.
- [x] Desktop, CLI and TUI propagate the initiating ID returned by daemon `OpenVault`.
- [x] Preserve failing-first denial assertions and add mismatch/matching-ID coverage.
- [x] Synchronize generated TypeScript IPC binding, operation-catalog scope, docs, and changelog.
- [x] Diagnose exact-head Clippy failure on CI #40671152135: `daemon_client::open_vault` is an unused wrapper after the identity-returning API migration; remove it without lowering warning policy.
- [ ] Verify all exact-head Rustfmt, Rust/Clippy, source-contract, Browser E2E, Windows, desktop, screenshots, localization, and visual checks.
- [ ] Perform installed authenticated-IPC vault-switch, restart, and stale-read acceptance.
- [ ] Complete broader MAT-008 cross-entrypoint mutation parity and capability graduation.

## Safety invariants

Use existing daemon mutex, authenticated IPC and native Git status kernel. A failed transport reply is not evidence of native mutation rollback. Do not add a parallel daemon vault authority or a second permission broker.

## Post-integration authenticated RPC regression (PR #213)

- [x] PR #215's daemon identity enforcement is merged into parent PR #213. A new two-client, socket-backed regression in `crates/daemon/src/transport/tests.rs` opens vault A through client A, switches to vault B through a second authenticated client, and requires the first client's old GitStatus identity to fail closed while B's status remains available.
- [ ] Execute the new test through hosted exact-head Rust/Clippy CI and record the outcome in `docs/VERIFICATION.md`. This is an automated authenticated transport check, not an installed desktop's real multi-process/restart acceptance.
- [ ] Keep CodeRabbit's daemon cross-client finding open if hosted tests or installed-client acceptance remain incomplete.
