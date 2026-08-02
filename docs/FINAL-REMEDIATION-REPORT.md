# Final remediation report

**Baseline:** uploaded Scriptor source archive  
**Target:** version `0.1.0` source candidate  
**Scope:** all 38 findings from the executive technical due-diligence assessment  
**Rule:** a finding is closed only by source evidence and a repeatable validation path. Documentation does not substitute for execution.

## Executive disposition

Every finding has an explicit disposition:

- **Remediated in source:** defect or missing control has a concrete implementation and repository-native check.
- **Risk-controlled:** the supported product path is safe, while a deliberate compatibility or architecture transition remains visible.
- **Release-environment gate:** source support exists, but proof requires platform signing, packaging, browser, or full toolchain execution.
- **Canonical-history gate:** source archives cannot prove authorship, churn, deleted secrets, or tag provenance.
- **Experimental by design:** capability is excluded from support claims until its graduation gate passes.

No finding is silently waived.

## Finding-by-finding closure

| ID | Disposition | Implemented control and proof boundary |
|---|---|---|
| F-01 | Remediated in source | `apps/desktop/src-tauri/src/authorization.rs` issues one-time operation/scope grants. `scripts/validation/authorization-inventory.mjs` verifies 19 high-impact commands are native-authorized and that generic renderer keychain access is absent. |
| F-02 | Risk-controlled | Shared IPC envelopes, authorization, process policy, error boundaries, watcher recovery, and domain crates now carry cross-adapter invariants. Desktop/daemon/CLI/MCP adapters remain larger than the target thin-adapter architecture; future extraction must proceed as characterized vertical workflows, not a big-bang rewrite. |
| F-03 | Remediated in source | All `ts-rs` exports target `packages/core/src/contracts/ipc-generated.ts`; duplicate stale output was removed. Source-contract tests require complete generated coverage and one canonical path. |
| F-04 | Remediated in source | Product and incubating Rust profiles are separated through workspace defaults and explicit `check:rust:product` / `check:rust:incubating` gates. Capability status is authoritative in `CAPABILITY-MATURITY.md`. |
| F-05 | Remediated in source | Graph BFS now returns deterministic depth, parent, and path provenance. Rust source contracts and graph tests define cycles, branching, bounds, and stable ordering. |
| F-06 | Remediated in source | Selected-file commits use an isolated temporary Git index, literal pathspecs, transactional ref update, rollback, and real-index reconciliation. Unrelated staged changes remain staged and unchanged. |
| F-07 | Remediated in source | MCP mutations persist and sync intent before mutation, append outcome after mutation, use idempotency keys, and reconcile pending intents after interruption. |
| F-08 | Remediated in source | Desktop shared state recovers poisoned locks through explicit helpers instead of repeated `unwrap` panics. |
| F-09 | Remediated in source | Runtime bridge and persisted-state payloads are parsed from `unknown` through `runtimeSchema.ts`, `vaultValidators.ts`, and generated contracts; corrupt storage is quarantined. |
| F-10 | Risk-controlled | UI state ownership moved into focused hooks; heavyweight panels and Monaco load lazily; CSS and package boundaries are modular. Large orchestration files remain decomposition candidates and are documented as such rather than treated as a release defect. |
| F-11 | Remediated in source | `versionedStorage.ts` centralizes schema versions, validation, migration, fallback, and corrupt-state quarantine. |
| F-12 | Remediated in source | Desktop CSP no longer permits inline scripts. Source checks guard the policy. |
| F-13 | Remediated for supported paths | `system-bridge/process.rs` owns executable resolution, environment/network policy, time/output bounds, process-tree cancellation, and receipts for shipped external launches. Code chunks and third-party plugin execution remain opt-in/experimental. |
| F-14 | Remediated in source | Public PlantUML fallback and remote font imports were removed; local rendering is explicit and source-tested. |
| F-15 | Remediated in source | External Actions use immutable commit SHAs with exact version comments; Node, pnpm, Rust, runners, and release tools are pinned. `action-pins.mjs` is fail-closed. |
| F-16 | Remediated in source | Supply-chain validation treats lockfiles as immutable inputs and verifies hashes; audit jobs do not run `cargo update`. |
| F-17 | Release-environment gate | External backups are portable, manifested, vault-bound, hash/size/path verified, journaled, and promoted with rollback. A restore drill on each supported OS remains a production release gate. |
| F-18 | Remediated in source | Daemon subscribers use bounded nonblocking delivery and drop accounting. A slow consumer is disconnected, the authenticated client automatically resubscribes with bounded backoff, and `ResyncRequired` forces consumers to reload authoritative state instead of silently continuing from an incomplete event history. |
| F-19 | Remediated in source | Supported subprocesses share timeout, cancellation, output bounds, and process-group/job-object termination through the process broker. |
| F-20 | Remediated in source | Desktop and daemon watchers use generation IDs, incremental change application, stale-generation rejection, and `RescanRequired` recovery. |
| F-21 | Remediated in source | Secondary indexes cover vault/path and link adjacency access patterns; migrations are transactional. Performance proof must be repeated on release hardware. |
| F-22 | Remediated in source | Knowledge/link APIs use aggregate/batch queries and bounded graph materialization instead of per-note lookups. |
| F-23 | Remediated in source | Vault scanning separates metadata discovery from bounded content reads and caps file count/note size. |
| F-24 | Risk-controlled | CodeMirror remains the default editor; Monaco is a lazy compatibility editor loaded only on first selection. Both stacks are intentionally supported until telemetry and compatibility evidence justify removal. |
| F-25 | Remediated in source | Desktop, daemon, and CLI initialize structured redacted tracing through `system-bridge/observability.rs`, with bounded local rotation. |
| F-26 | Remediated in source | `VERSION` is canonical across npm, Cargo, Tauri, and workflow metadata; `version.mjs check` is fail-closed. |
| F-27 | Release-environment gate | Production channels require platform signing/notarization and promote downloaded build artifacts rather than rebuilding. Credentials and signature verification can only be proven in protected platform environments. |
| F-28 | Remediated in source | Incomplete updater exposure, lock entries, generated Tauri permission schemas, and unused UI copy were removed; built-in updating is explicitly not shipped. |
| F-29 | Release-environment gate | Source contains checksum, CycloneDX SBOM, receipt, and attestation workflows. Consumer-verifiable provenance must be produced and verified on the canonical GitHub release run. |
| F-30 | Remediated in source | Knowledge Workbench tabs have unique semantic labels in all three shipped locales; locale parity is CI-enforced. |
| F-31 | Remediated in source | Shared modal/panel shells and repaired dialogs use labels/descriptions, `aria-modal`, initial focus, contained focus, Escape handling, and focus restoration. |
| F-32 | Release-environment gate | Visual coverage includes desktop light/dark, mobile, editor/preview, settings, graph, canvas, dialogs, and major workbenches; the editor follows the shell theme by default, tertiary text meets AA contrast on primary surfaces, and static frontend quality is CI-enforced. Fresh browser snapshots, axe results, 200% zoom, and platform-native review remain required because this build environment lacked dependencies/browser binaries. |
| F-33 | Remediated in source | Three shipped UI locales have exact key parity; UI locale, spellcheck, and citation locale are documented separately. Translation quality remains a content-owner responsibility. |
| F-34 | Remediated in source; counsel gate | LICENSE now contains an unmodified AGPL-3.0-or-later grant including compliant commercial use. Commercial licensing is an alternative, not an added restriction. Legal counsel remains required for material transactions. |
| F-35 | Remediated in source | Current architecture, capability maturity, operations, security, release, verification, and remediation documents distinguish supported, experimental, design-only, and external-gate states. Docs paths/version/license contracts are executable. |
| F-36 | Canonical-history gate | `.github/CODEOWNERS`, maintainer policy, and `scripts/governance/history-audit.sh` are present. Full ownership, deleted-secret, churn, signed-tag, and IP-provenance proof requires the canonical repository history; the uploaded archive cannot supply it. |
| F-37 | Experimental by design | Encryption primitives are explicitly excluded from supported vault claims. `ENCRYPTION-THREAT-MODEL.md` defines key, metadata, index, backup, Git, migration, and recovery gates before any graduation. |
| F-38 | Remediated in source | Audit/diagnostic logs are bounded, rotated, redacted, tail-read, and repairable; mutation records use an integrity chain. |

## Residual strategic work

These are not hidden release defects, but they remain important investments:

1. continue extracting typed application use cases from adapter coordination files;
2. collect real startup, memory, index, graph, and editor telemetry before removing compatibility paths;
3. add at least one independent security/release maintainer;
4. execute full history and platform release verification on the canonical repository;
5. keep encryption, WASM, embeddings, Tantivy, mobile, and third-party plugin execution outside support claims until their graduation gates pass.

## Acceptance boundary

Repository-native static and zero-install checks can verify source structure, contracts, governance, and many behavior-focused Node runners. They cannot replace Cargo compilation/tests, a frozen pnpm install, Playwright/axe, Tauri packaging, OS signing/notarization, restore drills, or canonical Git history. Exact executed and blocked checks are recorded in [`VERIFICATION.md`](VERIFICATION.md).
