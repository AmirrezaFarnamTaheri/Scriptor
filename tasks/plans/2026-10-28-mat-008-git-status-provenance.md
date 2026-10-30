# MAT-008 — Git status read provenance

**PR:** #213 (stacked on #211). **Issue:** #188. **Scope:** read provenance only; no Git mutation changes.

## Test-first ledger

- [x] Hosted RED on the test-only head is recorded in [`docs/VERIFICATION.md`](../../docs/VERIFICATION.md).
- [x] Controller forwards its captured target vault to the status fetcher; the no-vault sentinel never crosses native.
- [x] Typed bridge and native Tauri status command require and validate the initiating vault.
- [x] Headless daemon-backed status uses the existing switch lock, validating the requested vault inside the same critical section before RPC.
- [x] The separately exposed daemon Git status Tauri command and typed bridge also require the initiating vault, including the existing headless adapter source contract.
- [x] Browser fixture rejects invalid vault identity; canonical operation contract scope and generated artifacts record `expected-vault`.
- [ ] Current-head source, TypeScript, native, Browser E2E, Windows, desktop, visual and documentation gates.
- [ ] Installed desktop delayed-read/vault switch acceptance, including headless mode.
- [ ] Full MAT-008 cross-entrypoint parity and response-loss acceptance.

## Constraints

Status results do not prove a mutation completed. The original per-vault cache, request guard and native session remain authoritative. Do not weaken the expected-vault boundary or create another permission system. Keep draft until real-client acceptance.

## Authenticated transport test compilation correction
- [x] Correct the versioned Pong variant match in the existing two-client native regression without changing the daemon's vault-identity contract.
- [x] Compiler diagnostic and why it does not prove the cross-client security scenario are recorded in [the MAT-008 verification record](../../docs/VERIFICATION.md#mat-008--git-status-read-provenance-draft-pr-213).
- [ ] Require exact-head Clippy, daemon two-client suite and installed multiprocess/restart acceptance; retain the unresolved CodeRabbit daemon thread until evidence exists.

## Hosted real-process restart regression (authored; pending CI)

- A dedicated Rust example (`crates/daemon/examples/vault_status_probe.rs`) operates as a minimal authenticated RPC test client. Two distinct OS processes retain separate live `DaemonRpcClient` connections and do not expose note contents or credentials.
- The GitHub-hosted validation runner (`scripts/validation/daemon-git-vault-multiprocess.mjs`) launches an actual daemon binary, opens A and B in separate clients, proves stale A denial/current B success, restarts the daemon with a fresh authenticated endpoint nonce, reconnects both clients, and repeats stale/current checks in both directions.
- The existing `Frontend, accessibility, TUI, and daemon smoke` CI lane runs this regression following its daemon smoke. Results and the exact source revision must be recorded after execution. This source change is **not** evidence of a passing test or of an installed Tauri desktop package.
- The outstanding CodeRabbit thread remains unresolved until the hosted binary smoke passes and the release-staged/installed desktop, restart, and multiprocess evidence is independently established.

## Windows named-pipe two-process verification (authored; pending hosted CI)

The existing MAT-008 Rust/Node daemon multiprocess regression now also runs on the Windows 2025 GitHub worker immediately after its hermetic daemon/release smoke. The Windows run uses a separate named pipe and temporary APPDATA endpoint, two OS client processes, a restarted daemon with a fresh nonce, old-vault denial and current-vault success. The Linux run already passed at parent test head `6b41349`. Windows-specific results must be checked on the final PR #236 SHA; source authoring does not prove a passing Windows execution. The test is binary-level; a separately installed Tauri application remains unverified.
