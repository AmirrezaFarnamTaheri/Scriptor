# MAT-008 — Git status read provenance

**PR:** #213 (stacked on #211). **Issue:** #188. **Scope:** read provenance only; no Git mutation changes.

## Test-first ledger

- [x] Hosted RED on test-only head `caf63390`: CI #40599461753 proved three behavioral failures in the real bridge/controller tests.
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
