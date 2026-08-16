# Scriptor Implementation Checklist (Multi-Skill Perfectionist Edition)

## Phase 0: Repository & CI Baseline
- [x] **Task 0.1:** Commit Verified 4-File CI Stabilization Packet (`action-pins.mjs`, `ci.yml`, `main.rs`, `CHANGELOG.md`)
- [x] **Task 0.2:** Clean Accidental Directories (`C:\`, `docs/reviews/`, `docs/superpowers/`)
- [x] **Task 0.3:** Author Missing Review Report `06-performance-benchmarks-review.md`
- [x] **Checkpoint 0:** Baseline Health Verified (`node scripts/validation/action-pins.mjs` exits 0)

## Phase 1: Rust Systems & Cryptographic Hardening
- [x] **Task 1.1:** Replace Hand-Rolled HMAC with RustCrypto `hmac::Hmac<sha2::Sha256>` + `subtle::ConstantTimeEq` in `crates/daemon`
- [x] **Task 1.2:** Integrate OS Keychain for Daemon Endpoint Secrets via `crates/system-bridge`
- [x] **Task 1.3:** Audit `SensitiveOperation` Authority Enum separation — `crates/vault` (kebab-case, plugin/crypto layer) and `apps/desktop` (snake_case, Tauri IPC consent layer) are intentionally separate and internally consistent; no change needed
- [x] **Task 1.4:** Unify `content_hash` and `lock_recover` Utilities across Workspace
- [x] **Task 1.5:** Align Crate Dependency Drift (`sha2 = "0.11"`, `pulldown-cmark = "0.13"`)
- [x] **Checkpoint 1:** Rust Core & Crypto Verified (`cargo test -p scriptor-daemon -p scriptor-system-bridge -p scriptor-vault -p scriptor-publish-runner -p scriptor-extractor`)

## Phase 2: Core Contracts, Deduplication & MCP Drift Resolution
- [x] **Task 2.1:** Auto-Generate MCP `manifest.ts` from `tool-scopes.ts` & Add Parity Gate in `runMcpValidation()`
- [x] **Task 2.2:** Deduplicate Table of Contents (TOC) Extraction into `@scriptor/editor/pure/toc.ts`
- [x] **Task 2.3:** Unify Frontmatter Parsing into `@scriptor/core/contracts/frontmatter.ts`
- [x] **Task 2.4:** Unify Diff Algorithms on Canonical Myers Diff in `@scriptor/core/diff`
- [x] **Checkpoint 2:** Contract Parity & Deduplication Verified (`pnpm run check:contracts` + 13 runners)

## Phase 3: QA Architecture, TDD & P0 Defect Closure
- [ ] **Task 3.1:** Fix Kanban Keyboard Move & Markdown AST Write-Back (Red-Green-Refactor)
- [ ] **Task 3.2:** Fix Markdown Preview Worker Timeout Fallback Degradation Warning Flag
- [x] **Task 3.3:** Fix `tsconfig.contracts.json` Composite Mapping
- [ ] **Checkpoint 3:** P0 Defects Resolved & Playwright Tests Passing (`npx playwright test e2e/frontend-polish-regressions.spec.ts e2e/preview-resilience.spec.ts`)

## Phase 4: Frontend Hotspot Decomposition & Design Polish
- [ ] **Task 4.1:** Extract `useWorkspaceNavigationController.ts` from `src/App.tsx` (~300 LOC reduction)
- [ ] **Task 4.2:** Extract `useEditorOrchestrationController.ts` from `src/App.tsx` (~400 LOC reduction)
- [ ] **Task 4.3:** Extract `usePanelSurfaceController.ts` from `src/App.tsx` (dropping `App.tsx` below 1,000 LOC)
- [ ] **Task 4.4:** Audit & Enforce 8-State Interactive CSS Matrix (WCAG 2.2 AA, 44px hit floor)
- [ ] **Checkpoint 4:** Frontend Hotspots Sliced (< 1,000 LOC `App.tsx`) & Design System Audited

## Phase 5: Provable Release & Full Suite Verification
- [ ] **Task 5.1:** Execute Hermetic Release Smoke Pipeline (`cargo test --workspace --jobs 2`, `pnpm run build`, full Playwright test suite)
- [ ] **Task 5.2:** Generate Provable Release Receipts (Schema-4, CycloneDX SBOM, Git Blob Identity)
- [ ] **Checkpoint 5:** Release Attestation Verified & Ready for Merging

---

## Phase 6: Forensic Hardening — Critical & High (Audit 2026-08-17)

> Added from deep forensic review of 225 Rust files + 495 TS files.
> Run after Phase 1 completes. Items are ordered by execution priority.

### 6-CRIT: Critical Security & Correctness

- [ ] **Task 6.C1:** Audit all `check_permission()` callsites — 12 of 14 `SensitiveOperation` variants return `Allowed` unconditionally
  - Files: `crates/vault/src/permissions.rs` + all callers
  - Action: `rg check_permission --type rust`; verify each callsite has an independent business-logic guard; add `#[must_use]` to `PermissionOutcome`

- [ ] **Task 6.C2:** Harden `rename_transaction.rs` — 74 `unwrap()`/`.expect()` panic sites risk leaving vault in broken mid-rename state
  - File: `crates/vault/src/rename_transaction.rs` (18,468 B)
  - Action: Convert I/O errors to `Result<_, VaultError>`; replace `lock().unwrap()` with `lock_recover()`; add rollback test

- [ ] **Task 6.C3:** Fix HMAC key migration window in `transport.rs:127-133`
  - File: `crates/daemon/src/transport.rs:127-133`
  - Action: If `keychain_set` fails → do NOT delete plaintext key file → return `Err` to abort migration; add mock test

- [ ] **Task 6.C4:** Resolve 3-tool MCP registry drift
  - Files: `crates/daemon/src/mcp_stdio.rs:139-155` vs `packages/mcp/src/manifest.ts`
  - Missing: `mcp.proposeTagPatch`, `mcp.moveNote`, `mcp.deleteNote`
  - Action: Either implement Rust handlers or remove from manifest; run `pnpm check:mcp` to verify

- [ ] **Checkpoint 6-CRIT:** `rg 'check_permission' --type rust` callsites all audited; `pnpm check:mcp` passes; `transport.rs` migration test green

### 6-HIGH: Reliability

- [ ] **Task 6.H1:** Replace 6× `lock().unwrap()` in `crates/daemon/src/key_session.rs` with `lock_recover()`
  - Lines: 130, 146, 159, 164, 181, 195

- [ ] **Task 6.H2:** Replace 2× `lock().unwrap()` in `crates/daemon/src/queue.rs` with `lock_recover()`
  - Lines: 150, 161

- [ ] **Task 6.H3:** Add `cargo clippy -- -D warnings` step to CI `validate-rust` job
  - File: `.github/workflows/ci.yml`

- [ ] **Task 6.H4:** Add `macos-15` CI runner for Tauri/Keychain compile and test coverage
  - File: `.github/workflows/ci.yml`

- [ ] **Task 6.H5:** Gate SRS schema migration behind `srs` Cargo feature flag
  - Files: `crates/indexer/src/migration.rs`, `crates/indexer/Cargo.toml`

- [ ] **Checkpoint 6-HIGH:** `cargo clippy --workspace -- -D warnings` exits 0; macOS job green; `key_session.rs` / `queue.rs` unwraps resolved

### 6-MED: Maintainability

- [ ] **Task 6.M1:** Consolidate 9 inline `Sha256::digest` callsites to `vault/src/hash.rs` helpers (`content_hash`, `path_hash`)
- [ ] **Task 6.M2:** Write unit tests for `packages/mcp/src/runtime.ts` (currently zero coverage on 17,885 B dispatch core)
- [ ] **Task 6.M3:** Decompose `crates/daemon/src/handler.rs` (36,640 B, 35 unwraps) into `command_gateway/<domain>.rs` modules
- [ ] **Task 6.M4:** Add `WasmRuntimeError::NotImplemented` variant — retire string-matched `Runtime("WASM runtime stub…")` pattern
- [ ] **Task 6.M5:** Extend CI `validate-rust` test coverage from 3 crates to full `--workspace`
- [ ] **Task 6.M6:** Remove/replace 11 `console.log/warn/error` calls across `packages/**/*.ts`
- [ ] **Task 6.M7:** Promote `citationberg` git-pin to crates.io version constraint when upstream publishes

### 6-LOW: Polish

- [ ] **Task 6.L1:** Add `rust-version = "1.96"` to `[workspace.package]` in `Cargo.toml`
- [ ] **Task 6.L2:** Extend CI artifact retention from 7 to 30 days for evidence jobs
- [ ] **Task 6.L3:** Add `#[must_use]` to `PermissionOutcome` in `vault/src/permissions.rs:94`
- [ ] **Task 6.L4:** Clone-reduction audit — 236 `.clone()` sites; replace candidates with `Arc`-sharing in `handler.rs`, `transport.rs`
- [ ] **Task 6.L5:** Document Windows endpoint ACL gap in `SECURITY.md`
- [ ] **Task 6.L6:** Verify DQL query output is bounded by a hard `LIMIT` ceiling in `indexer/src/dql.rs`

---

## Progress Summary

| Phase | Items | Done |
|---|---|---|
| Phase 0 — CI Baseline | 4 | ✅ 4 |
| Phase 1 — Rust/Crypto | 6 | ✅ 5 / ⏳ 1 checkpoint |
| Phase 2 — Contracts/MCP | 5 | 0 |
| Phase 3 — QA/P0 Bugs | 4 | 0 |
| Phase 4 — Frontend | 5 | 0 |
| Phase 5 — Release | 3 | 0 |
| Phase 6 — Forensic Hardening | 22 | 0 |
| **TOTAL** | **49** | **9 done · 40 remaining** |
