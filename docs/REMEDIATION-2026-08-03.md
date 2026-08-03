# 2026-08-03 audit remediation

This record maps every finding in `Scriptor-Forensic-Code-Performance-and-Release-Audit-2026-08-03.md` to the source change and proof added in this candidate.

## Finding closure

| Finding | Source resolution | Repository proof | Remaining release proof |
|---|---|---|---|
| P0-01 Mutable release actions | All external actions in five workflows use reviewed 40-character SHAs with exact version comments. Stale verified-action entries were removed. | `node scripts/validation/action-pins.mjs` | Re-run in the canonical protected branch before promotion. |
| P0-02 Evidence detached from source | Receipts and SBOMs embed the Git commit and deterministic source-tree SHA-256. Git-mode identity hashes canonical blobs and file modes in one bounded batch, so clean checkout line-ending normalization cannot change the identity. Verification requires a clean canonical checkout, exact subject set, exact checksums, and matching SBOM metadata. Historical failed CI material is excluded from source evidence. | `node --test scripts/release/release-evidence-utils.test.mjs`; clean-Git smoke and tamper tests in the remediation evidence bundle | Generate, sign, attest, and upload evidence from the frozen release commit on the promotion runner. |
| P1-01 Editor payload eagerly loaded | Monaco and CodeMirror use separate lazy components and package entry points. Vite emits a manifest. The bundle checker traverses manifest keys/files, rejects either editor engine from the entry graph, and enforces initial gzip budgets. | `node scripts/validation/source-contracts.mjs`; known-good/known-bad manifest falsification | Run `pnpm build && pnpm check:bundle` with the frozen dependency graph and capture a cold-start trace. |
| P1-02 False-green lint | `lint` runs `eslint . --max-warnings=0`. React Hooks correctness rules, Fast Refresh, and explicit `any` are errors. Warning sources were refactored into derived state, stable callbacks, event-safe refs, and focused owners. | Frontend/source validators and TypeScript syntax parse; configuration inspection | Run the pinned ESLint dependency graph in clean CI. |
| P1-03 Inconsistent note deletion | One controller owns authorization-backed deletion, tab close, index rebuild, vault refresh, structured failures, success notification, and duplicate-click exclusion. After disk deletion, all reconciliation stages are attempted and multiple failures are aggregated instead of leaving later cleanup untried. Both UI entry points use it. | `node --experimental-strip-types src/controllers/validate-delete-note-controller.ts` | Exercise native authorization cancellation and filesystem failure in desktop E2E. |
| P1-04 Blanket process exceptions | Every non-broker launch has one adjacent exception ID and one live inventory record. The checker rejects blanket markers, duplicate/reused/missing/unused IDs, invalid or expired review dates, missing bounds, and absent negative tests. | `node scripts/validation/rust-source-contracts.mjs`; known-bad unmatched launch falsification | Run Rust unit/integration tests with the pinned toolchain. |
| P1-05 Coordination hotspots | Domain owners now cover deletion, telemetry, shortcuts, sidebar actions, auxiliary data, settings vault config, MCP tests, daemon command support, daemon transport tests, and CLI benchmarks. The six hotspot files have lower ceilings enforced by a ratchet. | `node scripts/validation/module-size-ratchet.mjs`; oversize falsification | Continue characterized extraction when behavior changes require it; do not perform a big-bang adapter rewrite. |
| P1-06 False 1k benchmark | The local helper builds the release CLI once, generates exactly 1,000 notes, validates cardinality, hashes the fixture tree, parses full JSON reports, and records p50/p95. Rust benchmark reports reject zero iterations. | `node --test scripts/benchmarks/benchmark-utils.test.mjs`; source contract | Run the benchmark on supported release hardware and archive measured distributions. |
| P2-01 Undefined CSS tokens | Missing semantic tokens are defined across themes. A repository validator checks declarations, uses, dynamic variables, and fallbacks. | `node scripts/validation/css-custom-properties.mjs`; undefined-token falsification | Browser contrast and visual checks remain part of release UI validation. |
| P2-02 Global reduced-motion kill | The universal `0.01ms` rule was removed. Component motion rules provide targeted reduced-motion behavior while retaining immediate state/focus feedback. | Frontend quality and CSS inspection | Verify dialogs, panels, loading, focus, and editor transitions in browser/native reduced-motion mode. |
| P2-03 Startup debug logs | Unconditional startup environment logging was removed. | `src/main.tsx`; frontend quality validator | Confirm production browser/native console during smoke testing. |
| P3-01 Stale product context | `PRODUCT.md` now includes Positioning, Operating context, Evidence on hand, and Product principles grounded in current repository documents. | Documentation contracts | Refresh only when product facts or support posture change. |

## Structural deltas

The hotspot pass reduced concentration without changing public product boundaries:

| File | Before | After |
|---|---:|---:|
| `src/App.tsx` | 2,328 lines, 27 effects, 29 callbacks | 2,128 lines, 6 effects, 13 callbacks |
| `crates/daemon/src/command_gateway.rs` | 1,366 lines | 942 lines |
| `crates/daemon/src/transport.rs` | 1,285 lines | 634 lines |
| `crates/cli/src/main.rs` | 1,134 lines | 971 lines |
| `src/components/SettingsPanel.tsx` | 919 lines | 616 lines |
| `packages/mcp/src/runtime.ts` | 947 lines | 777 lines |

`App.tsx` remains the composition root. Domain logic moved behind hooks/controllers; the ratchet prevents the six identified hotspots from returning to their prior size. Further extraction should follow characterized workflows and a working semantic build.

## Verification posture

Source remediation is complete for all twelve findings. Production promotion remains conditional on the clean-environment gates in [`VERIFICATION.md`](VERIFICATION.md): pinned install, warning-zero ESLint, semantic TypeScript build, production bundle inspection, Rust format/Clippy/test/deny, browser/accessibility checks, native packaging/signing, recovery drills, and measured performance on supported platforms.

## Promotion pre-mortem

Assume the release failed after promotion. The highest-probability paths and enforced prevention gates are:

| Failure path | Conditions that enabled it | Inverted prevention requirement | Promotion gate |
|---|---|---|---|
| Stale or substituted artifacts were published | Build and evidence came from different source states; extra subjects were accepted | Build once from a frozen tag; bind every subject to the same commit and source-tree hash; reject missing, extra, unsafe, or modified subjects | `verify-release-evidence.mjs` passes in the clean promotion checkout before attestation/upload |
| Editor startup regressed despite a passing source check | A heavy editor entered the initial Vite graph through an alias or manifest key not covered by filename-only matching | Traverse manifest keys, files, names, and source identities; falsify with a known-bad static editor import; enforce initial gzip budget | `pnpm build && pnpm check:bundle` plus captured cold-start trace |
| A destructive note action left UI/index/disk inconsistent | Multiple deletion paths or partial async success were treated as success | One controller owns authorization, delete, close, rebuild, refresh, structured failure, and duplicate exclusion | Native E2E covers cancellation and each failure stage before release |
| A process launch bypassed governance as a large Rust module evolved | One file-wide exception implicitly authorized new launch sites | One adjacent unique exception ID per launch, complete live inventory, bounded output/time, expiry, and negative test | Rust source contract plus Cargo tests pass; expired/unused inventory fails |
| Static remediation was mistaken for production proof | Missing dependencies/toolchains prevented semantic, browser, native, or signing checks | Pending proof remains a hard release gate; no promotion based on archive-only checks | Every item in `docs/RELEASE-CHECKLIST.md` is checked against exact tag and artifact bytes |

Release owner: release manager. Verification checkpoints: clean CI, platform packaging jobs, promotion job. Stop condition: any failed or pending required gate blocks publication.
