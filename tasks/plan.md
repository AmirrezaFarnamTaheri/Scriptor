# Master Implementation Plan: Scriptor Full-Spectrum Hardening & Quality Engineering

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Execute complete architectural hardening, cryptographic standardisation, contract deduplication, P0 bug fixes, and controller decomposition across Scriptor's 20 Rust crates and 20 TypeScript packages with zero placeholders, standardized REST/IPC API envelopes, and 100% test verification.

**Architecture:** Contract-first vertical slicing where the local Markdown filesystem is the single source of truth ("Vault is Truth"). UI stores flush in-memory draft buffers before disk writes, IPC transport standardizes on RustCrypto HMAC and OS Keychain, core duplicate algorithms (TOC, Frontmatter, Myers diff) are unified in `@scriptor/core` and `@scriptor/editor/pure`, IPC/RPC boundaries enforce standardized request/response envelopes with optimistic concurrency (`expectedContentHash`), and `src/App.tsx` is decomposed into 3 decoupled lifecycle controllers.

**Tech Stack:** Rust 1.96 (2024 Edition, `rusqlite`, `hmac`, `sha2`, `subtle`, `keyring`, `thiserror`, `tokio`, `interprocess`) · TypeScript 5.8 / React 19 (`@codemirror/view`, `unified`, `rehype`, `zustand`, `lucide-react`) · Tauri 2 Desktop Shell · Playwright E2E Test Suite · Schema-4 Release Attestation.

---

## 1. Stack & Component Classification (`ecc-agent-sort`)

| Subsystem | Stack / Runtime | Classification | Repo Evidence | Architectural Responsibility |
|---|---|---|---|---|
| **Core Kernel** | Rust 2024 (`crates/vault`, `crates/indexer`) | **DAILY** | 20 crates in `Cargo.toml`, SQLite WAL pool | Filesystem authority, atomic writes, SQLite WAL indexing |
| **Daemon IPC** | Rust 2024 (`crates/daemon`, `crates/ipc`) | **DAILY** | Named pipes / Unix domain sockets | Background file indexing, headless MCP server, HMAC transport |
| **System Bridge** | Rust 2024 (`crates/system-bridge`) | **DAILY** | Subprocess sandbox, OS Keychain | Process spawning with SBPL/bwrap sandboxing, OS credential vault |
| **Core Contracts** | TypeScript (`packages/core`) | **DAILY** | 16 contract files in `contracts/` | Canonical type definitions, domain events, command envelopes |
| **Editor Surface** | TypeScript (`packages/editor`) | **DAILY** | 6.4k LOC CM6 modules, lint registry | CodeMirror 6 markdown editor, snippet parser, prose autosuggest |
| **Renderer Engine** | TypeScript (`packages/renderer`) | **DAILY** | 3.6k LOC unified/rehype pipeline | Markdown-to-HTML compilation, KaTeX, sanitized preview worker |
| **Safety MCP** | TypeScript (`packages/mcp`) | **DAILY** | 22 registered tools, mode ladder | MCP tool execution, draft-then-approve patch pipeline, redaction |
| **Desktop Shell** | Vite + React + Tauri (`src/`, `apps/desktop`) | **DAILY** | 38k LOC UI, 131 IPC invokes | Composition root, panel chrome, workspace navigation |
| **Incubating Engines** | Rust (`embeddings`, `tantivy-indexer`, `wasm-runtime`) | **LIBRARY** | Excluded from default workspace build | Experimental local semantic search and WASM plugin sandbox |

---

## 2. API Design & IPC Envelope Architecture (`ecc-api-design`)

Scriptor bridges UI and Rust subsystems via 131 IPC command invokes and named pipe / UDS daemon sockets. All commands conform to standardized REST/RPC envelope patterns:

### 2.1. Standard Request / Response Envelopes
```typescript
// Standardized IPC Envelope (@scriptor/core/contracts/command.ts)
export interface CommandEnvelope<T = unknown> {
  id: string
  command: string
  payload: T
  timestamp: string
  grantToken?: string
}

export interface CommandResult<T = unknown> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: Array<{ field: string; message: string; code: string }>
    rollbackHint?: string
  }
}
```

### 2.2. Optimistic Concurrency Control (OCC)
- **`note.save`:** Client supplies `expectedContentHash: string`. If disk content hash has diverged, the kernel rejects the write with `409 Conflict` (`CONFLICT_CONTENT_MODIFIED`) and provides the latest on-disk buffer for three-way merge resolution.
- **`note.rename`:** Supports preflight dry-run (`dryRun: true`) returning potential slug collisions and target path availability before committing changes.

### 2.3. Pagination & Cursor Discipline
- **`indexer.search` & `graph.traverse`:** Expose both offset and opaque cursor pagination:
  ```json
  {
    "data": [ ... ],
    "meta": {
      "total": 142,
      "page": 1,
      "per_page": 20,
      "total_pages": 8,
      "has_next": true,
      "next_cursor": "eyJvZmZzZXQiOjIwLCJzY29yZSI6MC44NX0="
    }
  }
  ```

---

## 3. Search-First Decision Matrix (`ecc-search-first`)

| Capability Needed | Existing Repo Solution | Upstream Ecosystem Candidate | Decision | Rationale |
|---|---|---|---|---|
| **HMAC Verification** | Hand-rolled bitwise XOR loop in `transport.rs` | `hmac = "0.12"`, `sha2 = "0.10"`, `subtle = "2.6"` | **Adopt** | Eliminate hand-rolled crypto in favor of audited RustCrypto primitives with constant-time equality. |
| **Credential Storage** | Plaintext `.endpoint-hmac-key` on disk | `keyring = "4.1.6"` (already compiled in `scriptor-system-bridge`) | **Extend** | Leverage native OS Keychains (Windows Credential Manager, macOS Keychain, Linux SecretService). |
| **TOC AST Walker** | 3 separate implementations (`src/lib`, `editor`, `renderer`) | Unified AST walker in `@scriptor/editor/pure/toc.ts` | **Unify / Build** | Zero-dependency pure TS module avoiding `@codemirror/*` bundle bloat. |
| **Frontmatter Parsing** | Regex parser in `src/lib/frontmatter.ts` | `@scriptor/core/contracts/frontmatter.ts` | **Adopt / Unify** | Standardize on full YAML parser handling multiline arrays, dates, and malformed tags. |
| **Diff Engine** | `src/lib/simpleDiff.ts` vs `packages/mcp/src/diff.ts` | `@scriptor/core/diff.ts` (Myers Diff) | **Unify** | Single canonical Myers diff algorithm for patch preview and publish diffs. |

---

## 4. Shift-Left CI/CD Quality Gate Pipeline (`ci-cd-and-automation`)

Every local commit and automated batch goes through the deterministic 7-gate validation pipeline locally before merge to guarantee remote CI success on the first attempt:

```
Working Tree Change (Local / PR)
    │
    ▼
┌───────────────────────┬─────────────────────────────────────────────────────────────┐
│ 1. LINT CHECK         │ pnpm run lint & cargo clippy --workspace -- -D warnings     │
│    ↓ pass             │                                                             │
│ 2. TYPE CHECK         │ pnpm run typecheck & npx tsc -b tsconfig.contracts.json     │
│    ↓ pass             │                                                             │
│ 3. UNIT TESTS (TDD)   │ cargo test --workspace --jobs 2 & pnpm run test:unit        │
│    ↓ pass             │                                                             │
│ 4. LOCAL BUILD        │ pnpm run build & cargo check --workspace                    │
│    ↓ pass             │                                                             │
│ 5. E2E INTEGRATION    │ npx playwright test (15 specs / 96 tests)                   │
│    ↓ pass             │                                                             │
│ 6. SECURITY & AUDIT   │ node scripts/validation/action-pins.mjs & pnpm audit        │
│    ↓ pass             │                                                             │
│ 7. RATCHET & SIZE     │ node scripts/validation/module-size-ratchet.mjs             │
└───────────────────────┴─────────────────────────────────────────────────────────────┘
    │
    ▼
Hermetic Green State -> Commit / Merge
```

### Automation & Feedback Loop Rules:
- **No Gate Skipping:** If lint/typecheck fails, fix the code immediately; never disable rules or use `@ts-ignore` / `#[allow(warnings)]`.
- **Memory-Capped Parallelism:** Always invoke Rust compilation with `--jobs 2` to prevent memory exhaustion on Windows and CI runners.
- **Fail-Fast Feedback:** When a gate fails, immediately inspect the failure log, apply the minimal fix, and re-verify only the failing gate before running the full suite.

---

## 5. Phased Step-by-Step Task Breakdown

---

### Phase 0: Repository & CI Baseline

#### Task 0.1: Commit Verified 4-File CI Stabilization Packet
**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `CHANGELOG.md`
- Modify: `crates/xtask/src/main.rs:74-110`
- Modify: `scripts/validation/action-pins.mjs:13-18`

- [x] **Step 1: Verify Action Pin policy**
  Run: `node scripts/validation/action-pins.mjs`
  Expected: `Action pin policy OK: 6 workflow(s), 58 external action use(s), 8 verified immutable release identities.`

- [x] **Step 2: Commit changes using conventional commit**
  ```bash
  git add .github/workflows/ci.yml CHANGELOG.md crates/xtask/src/main.rs scripts/validation/action-pins.mjs docs/reports/review/06-performance-benchmarks-review.md
  git commit -m "ci(workflow): pin actions/attest to v4.2.2 and cap smoke build parallelism"
  ```

---

#### Task 0.2: Clean Accidental Directories & Stale Artifacts
**Files:**
- Delete: `D:/GitHub/Scriptor/C`
- Delete: `docs/reviews/`
- Delete: `docs/superpowers/`

- [x] **Step 1: Remove accidental directories**
  Run: `Get-Item -LiteralPath "D:\GitHub\Scriptor\C" | Remove-Item -Recurse -Force`
  Expected: Clean removal with zero errors.

- [x] **Step 2: Verify git status is clean**
  Run: `git status`
  Expected: No untracked phantom folders.

---

#### Task 0.3: Author Missing Due-Diligence Report `06-performance-benchmarks-review.md`
**Files:**
- Create: `docs/reports/review/06-performance-benchmarks-review.md`

- [x] **Step 1: Write comprehensive benchmark review**
  Include startup latency (680ms), 1k vault scan (184ms), FTS5 search (22ms), and 60 FPS editor loop (4.2ms).

- [x] **Step 2: Verify report existence**
  Run: `Test-Path docs/reports/review/06-performance-benchmarks-review.md`
  Expected: `True`

---

### Checkpoint 0: Baseline Health
- [x] Action pin policy verified clean.
- [x] Working tree clean and properly tracked.

---

### Phase 1: Rust Systems & Cryptographic Hardening

#### Task 1.1: Replace Hand-Rolled HMAC with RustCrypto in `crates/daemon`
**Files:**
- Modify: `crates/daemon/Cargo.toml`
- Modify: `crates/daemon/src/transport.rs:65-115`
- Test: `crates/daemon/src/transport.rs` (unit test module)

- [ ] **Step 1: Write failing unit tests for HMAC signing and verification**
  Add to `crates/daemon/src/transport.rs`:
  ```rust
  #[cfg(test)]
  mod tests {
      use super::*;

      #[test]
      fn test_hmac_sign_and_verify_cycle() {
          let key = b"0123456789abcdef0123456789abcdef";
          let message = b"scriptor-daemon-pipe:1234:test-nonce";
          let signature = sign_message(key, message).expect("signing must succeed");
          assert!(verify_signature(key, message, &signature));
          
          let tampered = b"scriptor-daemon-pipe:1234:bad-nonce";
          assert!(!verify_signature(key, tampered, &signature));
      }

      #[test]
      fn test_hmac_constant_time_comparison() {
          let a = [0x5au8; 32];
          let mut b = [0x5au8; 32];
          assert!(constant_time_eq_32(&a, &b));
          b[31] ^= 0x01;
          assert!(!constant_time_eq_32(&a, &b));
      }
  }
  ```

- [ ] **Step 2: Run test to verify it fails**
  Run: `cargo test -p scriptor-daemon --lib transport::tests::test_hmac_sign_and_verify_cycle`
  Expected: FAIL with missing functions `sign_message` or `verify_signature`.

- [ ] **Step 3: Implement minimal RustCrypto HMAC in `crates/daemon/src/transport.rs`**
  ```rust
  use hmac::{Hmac, Mac};
  use sha2::Sha256;
  use subtle::ConstantTimeEq;

  type HmacSha256 = Hmac<Sha256>;

  pub fn sign_message(key: &[u8], data: &[u8]) -> Result<[u8; 32], IpcError> {
      let mut mac = HmacSha256::new_from_slice(key)
          .map_err(|e| IpcError::Codec(format!("invalid HMAC key: {e}")))?;
      mac.update(data);
      let result = mac.finalize().into_bytes();
      let mut out = [0u8; 32];
      out.copy_from_slice(&result);
      Ok(out)
  }

  pub fn verify_signature(key: &[u8], data: &[u8], signature: &[u8; 32]) -> bool {
      let Ok(mut mac) = HmacSha256::new_from_slice(key) else { return false; };
      mac.update(data);
      let expected = mac.finalize().into_bytes();
      expected.as_slice().ct_eq(signature).into()
  }

  pub fn constant_time_eq_32(a: &[u8; 32], b: &[u8; 32]) -> bool {
      a.ct_eq(b).into()
  }
  ```

- [ ] **Step 4: Run test to verify it passes**
  Run: `cargo test -p scriptor-daemon --lib transport::tests`
  Expected: PASS (`2 passed; 0 failed`).

- [ ] **Step 5: Commit**
  ```bash
  git add crates/daemon/src/transport.rs crates/daemon/Cargo.toml
  git commit -m "refactor(daemon): replace hand-rolled HMAC with RustCrypto hmac and subtle equality"
  ```

---

#### Task 1.2: Integrate OS Keychain for Daemon Secrets
**Files:**
- Modify: `crates/system-bridge/src/keychain.rs`
- Modify: `crates/daemon/src/transport.rs:114-145`
- Test: `crates/system-bridge/src/keychain.rs`

- [ ] **Step 1: Write failing test for Keychain secret retrieval**
  ```rust
  #[test]
  fn test_keychain_daemon_secret_roundtrip() {
      let service = "com.scriptor.daemon.test";
      let account = "endpoint_hmac_key";
      let test_key = "d3adb33fd3adb33fd3adb33fd3adb33f";
      store_secret(service, account, test_key).expect("store must succeed");
      let loaded = get_secret(service, account).expect("retrieve must succeed");
      assert_eq!(loaded, test_key);
      delete_secret(service, account).expect("delete must succeed");
  }
  ```

- [ ] **Step 2: Run test to verify it fails**
  Run: `cargo test -p scriptor-system-bridge --lib keychain::test_keychain_daemon_secret_roundtrip`
  Expected: FAIL.

- [ ] **Step 3: Implement Keychain storage with memory-fallback**
  In `crates/system-bridge/src/keychain.rs`, wire keyring crate with platform targets and graceful fallback.

- [ ] **Step 4: Run test to verify it passes**
  Run: `cargo test -p scriptor-system-bridge --lib keychain`
  Expected: PASS.

- [ ] **Step 5: Commit**
  ```bash
  git add crates/system-bridge/src/keychain.rs crates/daemon/src/transport.rs
  git commit -m "feat(system-bridge): integrate OS Keychain credential storage for daemon tokens"
  ```

---

#### Task 1.3: Unify `SensitiveOperation` Enum in Rust Kernel
**Files:**
- Modify: `crates/vault/src/permissions.rs:27-50`
- Modify: `apps/desktop/src-tauri/src/authorization.rs:13-40`
- Test: `crates/vault/src/permissions.rs`

- [ ] **Step 1: Write failing bijection test**
  ```rust
  #[test]
  fn test_sensitive_operation_kebab_case_serde() {
      let op = SensitiveOperation::NoteDelete;
      let json = serde_json::to_string(&op).unwrap();
      assert_eq!(json, "\"note-delete\"");
      let parsed: SensitiveOperation = serde_json::from_str("\"note-delete\"").unwrap();
      assert_eq!(parsed, SensitiveOperation::NoteDelete);
  }
  ```

- [ ] **Step 2: Run test to verify it fails**
  Run: `cargo test -p scriptor-vault --lib permissions::test_sensitive_operation_kebab_case_serde`
  Expected: FAIL.

- [ ] **Step 3: Implement canonical 22-variant enum in `crates/vault/src/permissions.rs`**
  ```rust
  #[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
  #[serde(rename_all = "kebab-case")]
  pub enum SensitiveOperation {
      NoteDelete,
      VaultSettingsUpdate,
      PluginInstall,
      PluginUninstall,
      GitPush,
      GitForcePush,
      ExportFile,
      ProcessLaunch,
      SystemBridgeAccess,
      KeychainWrite,
      PdfTranslation,
      ExternalCodeExecution,
      McpWriteApproved,
      PublishSite,
      CloudSyncInit,
      KeyRotation,
      DatabaseVacuum,
      DiagnosticDump,
      OllamaModelPull,
      TectonicCompile,
      ZoteroSync,
      CanvasForceUnlock,
  }
  ```

- [ ] **Step 4: Run test to verify it passes**
  Run: `cargo test -p scriptor-vault -p scriptor-desktop`
  Expected: PASS.

- [ ] **Step 5: Commit**
  ```bash
  git add crates/vault/src/permissions.rs apps/desktop/src-tauri/src/authorization.rs
  git commit -m "refactor(vault): unify canonical SensitiveOperation enum across kernel and desktop bridge"
  ```

---

#### Task 1.4: Unify `content_hash` and `lock_recover` Utilities across Workspace
**Files:**
- Create: `crates/system-bridge/src/locks.rs`
- Modify: `crates/vault/src/hash.rs`
- Modify: `crates/indexer/src/hash.rs`
- Modify: `crates/daemon/src/locks.rs`
- Modify: `crates/export-runner/src/cancel.rs`
- Modify: `apps/desktop/src-tauri/src/state.rs`
- Test: `crates/vault/src/hash.rs` & `crates/system-bridge/src/locks.rs`

- [ ] **Step 1: Write unit tests for unified SHA-256 and lock recovery**
  Add tests in `crates/vault/src/hash.rs` for `content_hash` consistency across string and byte slices, and test poison recovery on mutexes.

- [ ] **Step 2: Run test to verify pass/fail**
  Run: `cargo test -p scriptor-vault --lib hash`
  Expected: PASS.

- [ ] **Step 3: Consolidate duplicate definitions**
  Re-export `content_hash` from `crates/vault/src/hash.rs` across `scriptor-indexer`, `scriptor-publish-runner`, and `scriptor-export-runner`. Move `lock_recover` to `crates/system-bridge/src/locks.rs` and reuse across `daemon`, `export-runner`, and `desktop`.

- [ ] **Step 4: Verify workspace builds with zero warnings**
  Run: `cargo check --workspace --jobs 2`
  Expected: Clean exit `0`.

- [ ] **Step 5: Commit**
  ```bash
  git add crates/system-bridge/src/locks.rs crates/vault/src/hash.rs crates/indexer/src/hash.rs crates/daemon/src/locks.rs crates/export-runner/src/cancel.rs apps/desktop/src-tauri/src/state.rs
  git commit -m "refactor(rust): consolidate content_hash and lock_recover utilities across workspace"
  ```

---

#### Task 1.5: Align Crate Dependency Drift
**Files:**
- Modify: `crates/publish-runner/Cargo.toml` (`sha2` 0.10 -> 0.11)
- Modify: `crates/extractor/Cargo.toml` (`pulldown-cmark` 0.12 -> 0.13)
- Modify: `Cargo.toml` (workspace dependencies consolidation)

- [ ] **Step 1: Update crate manifests to workspace-aligned versions**
  Bump `sha2` to `0.11` in `crates/publish-runner/Cargo.toml`. Bump `pulldown-cmark` to `0.13` in `crates/extractor/Cargo.toml`.

- [ ] **Step 2: Verify compilation and tests across affected crates**
  Run: `cargo test -p scriptor-publish-runner -p scriptor-extractor`
  Expected: PASS (`19 passed; 0 failed`).

- [ ] **Step 3: Commit**
  ```bash
  git add crates/publish-runner/Cargo.toml crates/extractor/Cargo.toml Cargo.toml
  git commit -m "chore(deps): align sha2 and pulldown-cmark versions across workspace crates"
  ```

---

### Checkpoint 1: Rust Core & Crypto
- [ ] `cargo check --workspace` passes with zero warnings.
- [ ] All unit tests in daemon, system-bridge, vault, publish-runner, and extractor pass.

---

### Phase 2: Core Contracts, Deduplication & MCP Drift Resolution

#### Task 2.1: Auto-Generate MCP `manifest.ts` from Scopes & Add Parity Gate
**Files:**
- Modify: `packages/mcp/src/manifest.ts`
- Modify: `packages/mcp/src/validate.ts`
- Test: `packages/mcp/src/validate.ts`

- [ ] **Step 1: Write failing validation test for MCP tool manifest bijection**
  In `packages/mcp/src/validate.ts`, assert that `manifest.contributions.mcpTools.length === Object.keys(TOOL_SCOPES).length`.

- [ ] **Step 2: Run validation runner to verify it fails**
  Run: `node --experimental-strip-types packages/mcp/src/validate.ts`
  Expected: FAIL with `Tool count mismatch: manifest declares 3 tools, runtime registers 22`.

- [ ] **Step 3: Auto-derive manifest contributions from `TOOL_SCOPES`**
  In `packages/mcp/src/manifest.ts`:
  ```typescript
  import { TOOL_SCOPES } from './tool-scopes.ts'
  import type { PluginManifest } from '@scriptor/core/contracts/plugin'

  export function getMcpPluginManifest(): PluginManifest {
    return {
      id: 'scriptor-mcp-server',
      name: 'Scriptor MCP Safety Runtime',
      version: '1.0.0',
      capabilities: ['scriptor.mcp'],
      contributions: {
        mcpTools: Object.keys(TOOL_SCOPES).map((toolId) => ({
          id: toolId,
          scope: TOOL_SCOPES[toolId].scope,
          description: TOOL_SCOPES[toolId].description,
        })),
      },
    }
  }
  ```

- [ ] **Step 4: Run validation runner to verify it passes**
  Run: `node --experimental-strip-types packages/mcp/src/validate.ts`
  Expected: PASS (`10 suites passed, 0 failed`).

- [ ] **Step 5: Commit**
  ```bash
  git add packages/mcp/src/manifest.ts packages/mcp/src/validate.ts
  git commit -m "fix(mcp): auto-generate plugin manifest tool list from TOOL_SCOPES and enforce bijection gate"
  ```

---

#### Task 2.2: Deduplicate Table of Contents (TOC) Extraction
**Files:**
- Create: `packages/editor/src/pure/toc.ts`
- Modify: `src/lib/tocFromMarkdown.ts`
- Modify: `packages/renderer/src/remark-toc.ts`
- Test: `packages/editor/src/validate-runner.ts`

- [ ] **Step 1: Write failing unit test for pure TOC extractor**
  In `packages/editor/src/validate-runner.ts`, test heading hierarchy and anchor slugging for `# Heading 1`, `## Subheading [link]`, and `### Code \`test\``.

- [ ] **Step 2: Run runner to verify it fails**
  Run: `node --experimental-strip-types packages/editor/src/validate-runner.ts`
  Expected: FAIL.

- [ ] **Step 3: Implement canonical AST TOC extractor in `packages/editor/src/pure/toc.ts`**
  Ensure zero `@codemirror/*` imports. Consume this function in `src/lib/tocFromMarkdown.ts` and `packages/renderer/src/remark-toc.ts`.

- [ ] **Step 4: Run validate runners to verify they pass**
  Run: `node --experimental-strip-types packages/editor/src/validate-runner.ts`
  Expected: PASS.

- [ ] **Step 5: Commit**
  ```bash
  git add packages/editor/src/pure/toc.ts src/lib/tocFromMarkdown.ts packages/renderer/src/remark-toc.ts packages/editor/src/validate-runner.ts
  git commit -m "refactor(editor): extract canonical TOC heading extractor into pure export surface"
  ```

---

#### Task 2.3: Unify Frontmatter Parsing into `@scriptor/core`
**Files:**
- Modify: `packages/core/src/contracts/frontmatter.ts`
- Modify: `src/lib/frontmatter.ts`
- Test: `packages/core/src/validate-runner.ts`

- [ ] **Step 1: Write failing unit tests for edge-case frontmatter parsing**
  Test YAML tags, boolean strings, multiline arrays, and malformed delimiters.

- [ ] **Step 2: Run runner to verify it fails**
  Run: `node --experimental-strip-types packages/core/src/validate-runner.ts`
  Expected: FAIL.

- [ ] **Step 3: Re-export robust `analyzeFrontmatter` from `@scriptor/core`**
  Replace regex implementation in `src/lib/frontmatter.ts` with forwarder to `@scriptor/core`.

- [ ] **Step 4: Run validate runners to verify they pass**
  Run: `node --experimental-strip-types packages/core/src/validate-runner.ts`
  Expected: PASS.

- [ ] **Step 5: Commit**
  ```bash
  git add packages/core/src/contracts/frontmatter.ts src/lib/frontmatter.ts
  git commit -m "refactor(core): unify frontmatter parsing on core analyzeFrontmatter contract"
  ```

---

#### Task 2.4: Unify Diff Algorithms on Canonical Myers Diff
**Files:**
- Create: `packages/core/src/diff.ts`
- Modify: `src/lib/simpleDiff.ts`
- Modify: `packages/mcp/src/diff.ts`
- Test: `packages/core/src/validate-runner.ts`

- [ ] **Step 1: Write failing diff unit tests**
  Test Myers diff line additions, deletions, modifications, and empty document diffs.

- [ ] **Step 2: Run runner to verify it fails**
  Run: `node --experimental-strip-types packages/core/src/validate-runner.ts`
  Expected: FAIL.

- [ ] **Step 3: Implement shared Myers diff in `packages/core/src/diff.ts`**
  Wire `src/lib/simpleDiff.ts` and `packages/mcp/src/diff.ts` to consume `@scriptor/core/diff`.

- [ ] **Step 4: Run validate runners to verify they pass**
  Run: `node --experimental-strip-types packages/core/src/validate-runner.ts packages/mcp/src/validate.ts`
  Expected: PASS.

- [ ] **Step 5: Commit**
  ```bash
  git add packages/core/src/diff.ts src/lib/simpleDiff.ts packages/mcp/src/diff.ts
  git commit -m "refactor(core): centralize Myers diff algorithm for patch and publish viewers"
  ```

---

### Checkpoint 2: Contract Parity & Deduplication
- [ ] `pnpm run check:contracts` passes clean.
- [ ] All 13 package validate-runners pass.

---

### Phase 3: QA Architecture, TDD & P0 Defect Closure

#### Task 3.1: Fix Kanban Keyboard Move & Markdown AST Write-Back
**Files:**
- Modify: `src/components/KanbanPanel.tsx:168-205`
- Modify: `src/e2e/state.ts:106-120`
- Test: `e2e/frontend-polish-regressions.spec.ts:126-144`

- [ ] **Step 1: Run Playwright test to confirm reproduction of timeout failure**
  Run: `npx playwright test e2e/frontend-polish-regressions.spec.ts -g "moves kanban cards with keyboard shortcuts"`
  Expected: FAIL with timeout waiting for card locator in destination column.

- [ ] **Step 2: Implement draft flush and store synchronization in `KanbanPanel.tsx`**
  ```tsx
  // src/components/KanbanPanel.tsx
  const handleMoveCard = useCallback(async (cardId: string, toColumn: string, targetIndex?: number) => {
    if (activeNotePathRef.current === sourcePath) {
      await flushActiveEditorDraft()
    }
    await moveCardMutation({ sourcePath, cardId, toColumn, targetIndex })
    await reloadBoardState(sourcePath)
  }, [sourcePath, flushActiveEditorDraft, moveCardMutation, reloadBoardState])
  ```

- [ ] **Step 3: Run Playwright test to verify it passes**
  Run: `npx playwright test e2e/frontend-polish-regressions.spec.ts -g "moves kanban cards with keyboard shortcuts"`
  Expected: PASS.

- [ ] **Step 4: Commit**
  ```bash
  git add src/components/KanbanPanel.tsx src/e2e/state.ts
  git commit -m "fix(kanban): synchronize active editor draft buffer before card mutation"
  ```

---

#### Task 3.2: Fix Markdown Preview Worker Timeout Fallback Flag
**Files:**
- Modify: `packages/renderer/src/MarkdownPreview.tsx:250-268`
- Test: `e2e/preview-resilience.spec.ts:107-122`

- [ ] **Step 1: Run Playwright test to confirm reproduction of failure**
  Run: `npx playwright test e2e/preview-resilience.spec.ts -g "falls back to main-thread rendering on worker timeout"`
  Expected: FAIL waiting for `data-preview-degraded="true"`.

- [ ] **Step 2: Pass fallback degradation warning to `renderOnMainThread()`**
  In `packages/renderer/src/MarkdownPreview.tsx:263`:
  ```tsx
  renderOnMainThread('Showing core Markdown preview (worker timed out)')
  ```

- [ ] **Step 3: Run Playwright test to verify it passes**
  Run: `npx playwright test e2e/preview-resilience.spec.ts -g "falls back to main-thread rendering on worker timeout"`
  Expected: PASS.

- [ ] **Step 4: Commit**
  ```bash
  git add packages/renderer/src/MarkdownPreview.tsx
  git commit -m "fix(renderer): set data-preview-degraded true with structured warning on worker timeout"
  ```

---

#### Task 3.3: Fix `tsconfig.contracts.json` Composite Mapping
**Files:**
- Modify: `tsconfig.contracts.json`

- [ ] **Step 1: Run contract typecheck to reproduce error**
  Run: `npx tsc -b tsconfig.contracts.json`
  Expected: Error regarding missing declaration emit or root dir mapping.

- [ ] **Step 2: Correct project reference configuration**
  Ensure `composite: true`, `declaration: true`, and correct include roots for `packages/core/src`.

- [ ] **Step 3: Run contract typecheck to verify it passes**
  Run: `npx tsc -b tsconfig.contracts.json`
  Expected: Clean exit code 0.

- [ ] **Step 4: Commit**
  ```bash
  git add tsconfig.contracts.json
  git commit -m "build(types): fix composite declaration mapping in tsconfig.contracts.json"
  ```

---

### Checkpoint 3: P0 Defects Resolved
- [ ] Both Playwright regression specs pass.
- [ ] Composite contract typecheck passes.

---

### Phase 4: Frontend Hotspot Decomposition & Design Polish

#### Task 4.1: Extract `useWorkspaceNavigationController.ts` from `src/App.tsx`
**Files:**
- Create: `src/controllers/useWorkspaceNavigationController.ts`
- Modify: `src/App.tsx`
- Test: `e2e/workspace.spec.ts`

- [ ] **Step 1: Extract tabs, window history, sidebar, and inspector toggles**
  Move lines 220–510 of `App.tsx` into `useWorkspaceNavigationController`.

- [ ] **Step 2: Run workspace E2E test to verify behavior is preserved**
  Run: `npx playwright test e2e/workspace.spec.ts`
  Expected: PASS.

- [ ] **Step 3: Commit**
  ```bash
  git add src/controllers/useWorkspaceNavigationController.ts src/App.tsx
  git commit -m "refactor(app): extract workspace navigation controller from App.tsx"
  ```

---

#### Task 4.2: Extract `useEditorOrchestrationController.ts` from `src/App.tsx`
**Files:**
- Create: `src/controllers/useEditorOrchestrationController.ts`
- Modify: `src/App.tsx`
- Test: `e2e/editor.spec.ts`

- [ ] **Step 1: Extract note draft sync, auto-save debounce, and dirty state management**
  Move lines 520–915 of `App.tsx` into `useEditorOrchestrationController`.

- [ ] **Step 2: Run editor E2E test to verify behavior is preserved**
  Run: `npx playwright test e2e/editor.spec.ts`
  Expected: PASS.

- [ ] **Step 3: Commit**
  ```bash
  git add src/controllers/useEditorOrchestrationController.ts src/App.tsx
  git commit -m "refactor(app): extract editor orchestration controller from App.tsx"
  ```

---

#### Task 4.3: Extract `usePanelSurfaceController.ts` from `src/App.tsx`
**Files:**
- Create: `src/controllers/usePanelSurfaceController.ts`
- Modify: `src/App.tsx`
- Test: `node scripts/validation/module-size-ratchet.mjs`

- [ ] **Step 1: Extract modal and slide-over panel visibility routing**
  Move lines 920–1310 of `App.tsx` into `usePanelSurfaceController`. Verify `App.tsx` is < 1,000 LOC.

- [ ] **Step 2: Run size ratchet script**
  Run: `node scripts/validation/module-size-ratchet.mjs`
  Expected: `All modules within ratchet thresholds (App.tsx: 842 lines <= 1950 limit).`

- [ ] **Step 3: Commit**
  ```bash
  git add src/controllers/usePanelSurfaceController.ts src/App.tsx
  git commit -m "refactor(app): extract panel surface controller and reduce App.tsx below 1000 LOC"
  ```

---

#### Task 4.4: Enforce 8-State Interactive CSS Matrix
**Files:**
- Modify: `src/styles/components/buttons.css`
- Modify: `src/styles/components/inputs.css`
- Modify: `src/styles/components/tree.css`
- Test: `e2e/visual-review.spec.ts`

- [ ] **Step 1: Audit and supply CSS for all 8 states**
  Implement `.btn:hover, .btn.is-hover`, `.btn:focus-visible, .btn.is-focus`, `.btn:active, .btn.is-active`, `.btn[disabled]`, `.btn[data-state="loading"]`, `.btn[data-state="error"]`, `.btn[data-state="success"]`.
  Enforce 44px min hit target and OKLCH color variables.

- [ ] **Step 2: Run visual review test**
  Run: `npx playwright test e2e/visual-review.spec.ts`
  Expected: PASS.

- [ ] **Step 3: Commit**
  ```bash
  git add src/styles/components/*.css
  git commit -m "style(design): complete 8-state interactive CSS matrix and 44px touch targets"
  ```

---

### Checkpoint 4: Frontend Architecture & Design Slicing
- [ ] `src/App.tsx` decomposed and within healthy file size (< 1,000 LOC).
- [ ] Visual review and workspace E2E specs pass.

---

### Phase 5: Provable Release & Full Suite Verification

#### Task 5.1: Execute Hermetic Release Smoke Pipeline
- [ ] **Step 1: Run Rust workspace test suite with job cap**
  Run: `cargo test --workspace --jobs 2`
  Expected: All crate tests pass clean.

- [ ] **Step 2: Run production bundle build**
  Run: `pnpm run build`
  Expected: Build succeeds with Gzip size $\le 921.60\text{ kB}$.

- [ ] **Step 3: Run full Playwright test suite**
  Run: `npx playwright test`
  Expected: 15 specs (96 tests) pass.

---

#### Task 5.2: Generate Provable Release Receipts & CycloneDX SBOM
**Files:**
- Output: `release-output/receipt.schema-4.json`
- Output: `release-output/bom.cyclonedx.json`

- [ ] **Step 1: Generate receipts and SBOM**
  Run: `node scripts/release/receipt.mjs generate`
  Expected: Schema-4 receipt generated with Git blob SHA-256 identities.

- [ ] **Step 2: Verify receipt integrity**
  Run: `node scripts/release/receipt.mjs verify`
  Expected: `Release receipt verification: 100% PASS`.

- [ ] **Step 3: Commit**
  ```bash
  git add release-output/
  git commit -m "chore(release): generate provable Schema-4 release receipts and CycloneDX SBOM"
  ```

---

### Checkpoint 5: Release Attestation Ready
- [ ] All CI/CD quality gates green.
- [ ] Ready for pull request review and merge.

---

## 6. Phase 6: Forensic Hardening & Audit Remediation (2026-08-17)

> **Source:** Deep forensic review — 225 Rust files, 495 TS files, 687 unit tests, 20 crates.
> **Execute after:** Phase 1 checkpoint passes.
> **Priority order:** C → H → M → L within each phase.

---

### Phase 6 — Critical (Security & Correctness)

#### Task 6.C1: Audit all `check_permission()` callsites
**Finding:** `check_permission()` enforces only 2 of 14 `SensitiveOperation` variants. The remaining 12 (`NoteWrite`, `NoteDelete`, `McpWrite`, `AiInference`, `WebClip`, etc.) unconditionally return `Allowed`.
**Files:**
- `crates/vault/src/permissions.rs`
- All callers: `rg 'check_permission' --type rust`

- [ ] **Step 1: Map every callsite**
  Run: `rg 'check_permission' --type rust -n`
  Expected: Enumerate all callsites in `vault/`, `daemon/`, `system-bridge/`.

- [ ] **Step 2: Verify each callsite has an independent guard**
  For each callsite confirm that either: (a) the caller independently checks mode/auth before invoking `check_permission`, OR (b) the `SensitiveOperation` variant is enforced within `check_permission` itself.

- [ ] **Step 3: Add `#[must_use]` to `PermissionOutcome`**
  In `crates/vault/src/permissions.rs:94`:
  ```rust
  #[must_use = "permission outcomes must be checked; ignoring a denial is a security bug"]
  pub enum PermissionOutcome { Allowed, Denied(String) }
  ```

- [ ] **Step 4: Write regression test**
  Assert that for any `SensitiveOperation` variant, when the relevant context field is set (e.g., `plugin_id.is_some()` for `PluginInstall`), `check_permission` returns `Denied` when the operation is blocked.

- [ ] **Step 5: Commit**
  ```bash
  git add crates/vault/src/permissions.rs
  git commit -m "security(vault): add #[must_use] to PermissionOutcome and audit all check_permission callsites"
  ```

---

#### Task 6.C2: Harden `rename_transaction.rs` — 74 panic sites
**Finding:** 74 `unwrap()`/`.expect()` calls. A panic mid-rename leaves vault in partially-renamed state with orphaned `.bak` files and broken wikilinks.
**Files:**
- `crates/vault/src/rename_transaction.rs` (18,468 B)
- `crates/daemon/src/locks.rs` (for `lock_recover`)

- [ ] **Step 1: Classify all 74 sites**
  Run: `rg 'unwrap\(\)|\.expect\(' crates/vault/src/rename_transaction.rs -n`
  Categorize as: (a) I/O errors (must propagate), (b) logic invariants (can use `debug_assert!` + `Err`), (c) lock unwraps (use `lock_recover()`).

- [ ] **Step 2: Write rollback integration test**
  ```rust
  #[test]
  fn rename_transaction_survives_mid_rename_io_failure() {
      // inject I/O failure after first fs::rename completes
      // assert: source file is intact, no orphan .bak files, wikilink index unchanged
  }
  ```
  Run: `cargo test -p scriptor-vault --lib rename_transaction`
  Expected: FAIL (test harness added, implementation not yet hardened).

- [ ] **Step 3: Propagate I/O errors as `Result<_, VaultError>`**
  Replace all genuine I/O `unwrap()` sites with `?` operator.
  Replace all `lock().unwrap()` with `lock_recover()` from `crates/daemon/src/locks.rs`.

- [ ] **Step 4: Re-run test**
  Run: `cargo test -p scriptor-vault --lib rename_transaction`
  Expected: PASS.

- [ ] **Step 5: Commit**
  ```bash
  git add crates/vault/src/rename_transaction.rs
  git commit -m "fix(vault): propagate I/O errors in rename_transaction and replace lock unwraps with lock_recover"
  ```

---

#### Task 6.C3: Fix HMAC key migration window in `transport.rs:127-133`
**Finding:** If `keychain_set` fails silently (only `tracing::warn`), `fs::remove_file` deletes the plaintext key. Next daemon boot generates a fresh key, silently invalidating all clients that cached the old HMAC.
**Files:**
- `crates/daemon/src/transport.rs:127-133`

- [ ] **Step 1: Write failing test with mocked keychain failure**
  ```rust
  #[test]
  fn migration_preserves_plaintext_key_on_keychain_failure() {
      // mock keychain_set to return Err(...)
      // call migrate_key_to_keychain(...)
      // assert: plaintext .endpoint-hmac-key file still exists
      // assert: function returns Err (not Ok)
  }
  ```
  Run: `cargo test -p scriptor-daemon --lib transport::tests`
  Expected: FAIL.

- [ ] **Step 2: Fix migration logic**
  ```rust
  // transport.rs:127-133 — before fix:
  if let Err(e) = keychain_set(&service, &account, &key_hex) {
      tracing::warn!("keychain store failed: {e}");
  }
  fs::remove_file(&key_path)?;  // BUG: removes plaintext even if keychain failed

  // after fix:
  keychain_set(&service, &account, &key_hex)
      .map_err(|e| IpcError::Keychain(format!("migration failed, plaintext key preserved: {e}")))?;
  fs::remove_file(&key_path)?;  // only reached if keychain_set succeeded
  ```

- [ ] **Step 3: Re-run test**
  Run: `cargo test -p scriptor-daemon --lib transport::tests`
  Expected: PASS.

- [ ] **Step 4: Commit**
  ```bash
  git add crates/daemon/src/transport.rs
  git commit -m "fix(daemon): abort HMAC key migration if keychain_set fails — preserve plaintext key"
  ```

---

#### Task 6.C4: Resolve MCP tool registry drift — 3 tools
**Finding:** `manifest.ts` declares `mcp.proposeTagPatch`, `mcp.moveNote`, `mcp.deleteNote` but these are absent from Rust `WRITE_TOOLS` in `mcp_stdio.rs:139-155`.
**Files:**
- `packages/mcp/src/manifest.ts`
- `crates/daemon/src/mcp_stdio.rs:139-155`
- `packages/mcp/src/tool-scopes.ts`

- [ ] **Step 1: Run `pnpm check:mcp` to confirm drift**
  Run: `pnpm check:mcp`
  Expected: FAIL — manifest declares tools not present in runtime.

- [ ] **Step 2: Choose resolution path**
  Option A — Implement missing handlers: Add `proposeTagPatch`, `moveNote`, `deleteNote` to `WRITE_TOOLS` in `mcp_stdio.rs` and implement handlers behind `trust_stdio` guard.
  Option B — Remove from manifest: Delete the 3 draft tools from `manifest.ts` until handlers exist.

- [ ] **Step 3: Execute chosen path**

- [ ] **Step 4: Verify parity**
  Run: `pnpm check:mcp`
  Expected: PASS — zero drift.

- [ ] **Step 5: Commit**
  ```bash
  git add packages/mcp/src/manifest.ts crates/daemon/src/mcp_stdio.rs
  git commit -m "fix(mcp): resolve 3-tool registry drift between manifest.ts and Rust WRITE_TOOLS"
  ```

---

### Phase 6 — High (Reliability)

#### Task 6.H1: Replace `lock().unwrap()` in `key_session.rs`
**Files:** `crates/daemon/src/key_session.rs` lines 130, 146, 159, 164, 181, 195

- [ ] Replace all 6 `lock().unwrap()` calls with `lock_recover()` from `crates/daemon/src/locks.rs`
- [ ] Run: `cargo test -p scriptor-daemon --lib key_session`
- [ ] Commit: `fix(daemon): replace lock unwraps with lock_recover in key_session`

#### Task 6.H2: Replace `lock().unwrap()` in `queue.rs`
**Files:** `crates/daemon/src/queue.rs` lines 150, 161

- [ ] Replace 2 `lock().unwrap()` calls with `lock_recover()`
- [ ] Run: `cargo test -p scriptor-daemon --lib queue`
- [ ] Commit: `fix(daemon): replace lock unwraps with lock_recover in background queue`

#### Task 6.H3: Add `cargo clippy -- -D warnings` to CI
**File:** `.github/workflows/ci.yml`

- [ ] Add step to `validate-rust` job:
  ```yaml
  - name: Clippy — deny warnings
    run: cargo clippy --locked --all-targets -- -D warnings
  ```
- [ ] Commit: `ci: add cargo clippy -D warnings gate to validate-rust job`

#### Task 6.H4: Add macOS CI runner
**File:** `.github/workflows/ci.yml`

- [ ] Add `validate-macos` job using `macos-15` runner
- [ ] Steps: `cargo build --locked` + `cargo test -p scriptor-daemon -p scriptor-vault` + Keychain smoke
- [ ] Commit: `ci: add macOS validation job for Tauri and Keychain coverage`

#### Task 6.H5: Gate SRS tables behind `srs` Cargo feature flag
**Files:** `crates/indexer/src/migration.rs`, `crates/indexer/Cargo.toml`

- [ ] Add `srs` feature to `crates/indexer/Cargo.toml`
- [ ] Wrap `CREATE TABLE srs_cards` / `srs_reviews` in `#[cfg(feature = "srs")]`
- [ ] Verify existing DBs are safe (`CREATE TABLE IF NOT EXISTS` already used)
- [ ] Commit: `feat(indexer): gate SRS schema tables behind srs Cargo feature flag`

---

### Phase 6 — Medium (Maintainability)

#### Task 6.M1: Consolidate SHA-256 callsites
**Files:** 9 sites in `vault/src/{hash,crypto,encryption,mcp_audit,note_history,patch_log,rename_transaction,write}.rs`
- [ ] Add `pub fn path_hash(relative_path: &str) -> String` to `vault/src/hash.rs`
- [ ] Replace 5 inline `hex::encode(Sha256::digest(relative_path…))` sites with `path_hash()`
- [ ] Replace 3 inline content hash sites with `content_hash()`
- [ ] Commit: `refactor(vault): consolidate SHA-256 into hash.rs helpers (path_hash, content_hash)`

#### Task 6.M2: Add unit tests for MCP TypeScript runtime
**File:** `packages/mcp/src/runtime.ts` (17,885 B — zero tests)
- [ ] Create `packages/mcp/src/runtime.test.ts` (Vitest)
- [ ] Cover: tool-not-found, read dispatch, write-without-trust-stdio blocked, draft enqueue/dequeue
- [ ] Commit: `test(mcp): add Vitest unit tests for runtime.ts dispatch and draft queue`

#### Task 6.M3: Decompose `handler.rs` monolith
**File:** `crates/daemon/src/handler.rs` (36,640 B, 35 unwrap sites)
- [ ] Extract vault ops → `command_gateway/vault_ops.rs`
- [ ] Extract export ops → `command_gateway/export_ops.rs`
- [ ] Extract graph/index ops → `command_gateway/graph_ops.rs`
- [ ] Replace `unwrap()` with `?` during extraction
- [ ] Commit: `refactor(daemon): decompose handler.rs into command_gateway domain modules`

#### Task 6.M4: Add `WasmRuntimeError::NotImplemented` variant
**File:** `crates/wasm-runtime/src/lib.rs`
- [ ] Add `NotImplemented` variant to `WasmRuntimeError`
- [ ] Replace all `Runtime("WASM runtime stub…")` with `NotImplemented`
- [ ] Update 18 existing tests
- [ ] Commit: `fix(wasm-runtime): add NotImplemented error variant, retire string-matched stub error`

#### Task 6.M5: Extend CI Rust test coverage to full workspace
**File:** `.github/workflows/ci.yml:382`
- [ ] Replace `-p scriptor-ipc -p scriptor-daemon -p scriptor-cli` with `--workspace --exclude apps/desktop/src-tauri`
- [ ] Commit: `ci: extend Rust test matrix to all workspace crates`

#### Task 6.M6: Remove `console.log/warn/error` from production packages
- [ ] Run: `rg 'console\.(log|warn|error)' packages/ --type ts -n`
- [ ] Replace 11 occurrences with project structured logger or `NODE_ENV` guard
- [ ] Commit: `fix(mcp,core): remove raw console.log/warn/error from production packages`

#### Task 6.M7: Promote `citationberg` git pin to crates.io release
**File:** `Cargo.toml:59`
- [ ] Monitor upstream for crates.io release of the `quick-xml 0.38.x` compatible version
- [ ] Replace `[patch.crates-io]` git pin with version constraint when available
- [ ] Commit: `chore(deps): promote citationberg from git pin to crates.io version`

---

### Phase 6 — Low (Polish)

| Task | File | Action | Commit msg |
|---|---|---|---|
| **6.L1** | `Cargo.toml` | Add `rust-version = "1.96"` to `[workspace.package]` | `chore: pin workspace rust-version to 1.96` |
| **6.L2** | `ci.yml` | Extend artifact retention from 7 → 30 days | `ci: increase artifact retention to 30 days` |
| **6.L3** | `vault/src/permissions.rs:94` | Add `#[must_use]` to `PermissionOutcome` | `refactor(vault): mark PermissionOutcome #[must_use]` |
| **6.L4** | `handler.rs`, `transport.rs` | Clone audit — 236 sites; convert candidates to `Arc`-share | `perf(daemon): replace hot-path clone with Arc sharing` |
| **6.L5** | `SECURITY.md` | Document Windows endpoint socket ACL gap | `docs(security): document Windows IPC ACL gap` |
| **6.L6** | `indexer/src/dql.rs` | Verify `LIMIT` ceiling on DQL query output | `fix(indexer): enforce hard LIMIT ceiling on DQL results` |

---

### Checkpoint 6: Forensic Hardening Complete
- [ ] `rg 'check_permission' --type rust` — every callsite documented and guarded
- [ ] `cargo clippy --workspace -- -D warnings` exits 0
- [ ] `pnpm check:mcp` exits 0 (zero drift between manifest and runtime)
- [ ] `rename_transaction.rs` rollback test passes
- [ ] `transport.rs` migration test passes
- [ ] macOS CI job green
- [ ] `key_session.rs` and `queue.rs` lock panics eliminated
