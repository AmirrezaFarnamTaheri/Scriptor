# Project Recovery and Delivery Roadmap

Date: 2026-08-13  
Repository: Scriptor  
Status: active execution ledger; packets through security/delivery are implemented and pushed,
while release/manual/platform gates remain open

## 1. Purpose

This roadmap converts the 2026-08-13 repository audit into an executable program. It covers the
current dirty worktree, open pull requests, build and governance failures, security boundaries,
documentation drift, incomplete capability work, quality evidence, and the broader seven-cluster
roadmap.

The immediate objective is not to add more surface area. It is to turn the current branch into a
small set of reviewable, evidence-backed changes, restore a truthful green baseline, and establish
the gates that future work must cross.

## 2. Verified baseline

Observed on 2026-08-13:

- Branch `feat/comprehensive-project-review` is 32 commits ahead of `origin/main`.
- The worktree contains 205 entries: 107 modified, 31 deleted, and 67 untracked.
- The tracked diff is approximately 4,860 additions and 5,286 deletions across 138 files.
- GitHub has four open PRs and no open issues.
- PR 71 is a draft with three failing checks; PRs 72 and 73 each have a browser/visual failure;
  PR 74 is green.
- `pnpm check:governance` fails on five `0.1.0` manifests while canonical `VERSION` is `0.1.1`.
- `pnpm check:source` fails on a formatting-sensitive IPC source assertion.
- `pnpm check:contracts` fails on an unavailable `vitest` import and a missing command registry.
- `pnpm lint` reports 18 errors and 23 warnings.
- `cargo check --locked` fails because `scriptor-publish-runner` uses `hex` without declaring it.
- `git diff --check` reports two extra trailing blank lines.
- Capability, updater, marketplace, encryption, and architecture-version documentation has drifted.

These observations are a point-in-time baseline. Re-run the commands before assigning work.

## 3. Program rules

1. Preserve unrelated user changes. Never use destructive Git recovery commands.
2. Every new behavior starts with a failing behavioral test when practical.
3. Every native command receives authorization classification and runtime payload validation.
4. Every external process goes through `crates/system-bridge/src/process.rs`.
5. Package consumers use declared exports; deep cross-package imports are forbidden.
6. A task is done only when its acceptance criteria and verification commands pass.
7. A wave is done only from a clean checkout of its candidate commit.
8. Historical reports must name their tested commit; they cannot establish current correctness.
9. Experimental and design-only work must not become a supported product claim accidentally.
10. Publishing, pushing, merging, releasing, and changing remote resources require explicit approval.

## 4. Priority model

| Priority | Meaning | Response |
| --- | --- | --- |
| P0 | Build, data-loss, security-boundary, or release-integrity blocker | Stop dependent work; resolve first |
| P1 | User-visible correctness, recovery, migration, or major maintainability risk | Required before merge/release |
| P2 | Quality, performance, documentation, and bounded cleanup | Schedule within the same milestone |
| P3 | Optional capability depth or demand-gated work | Do not start until Waves 0-5 are stable |

## 5. Stage gates

### Gate G0 — Worktree understood

- Every changed path belongs to one named change packet.
- Generated files and fixture mutations are identified.
- Deletions are classified as intentional, relocated, or accidental.
- No packet spans unrelated product capabilities.

### Gate G1 — Local structural baseline

All pass:

```powershell
git diff --check
pnpm check:governance
pnpm check:source
pnpm check:contracts
pnpm lint
cargo fmt --all --check
cargo check --locked
```

### Gate G2 — Behavioral baseline

All affected focused suites pass, followed by:

```powershell
pnpm check:mcp
pnpm check:plugins
pnpm check:editor
pnpm check:knowledge
pnpm check:merge
pnpm check:export
cargo test --locked --exclude scriptor-desktop
```

### Gate G3 — Product candidate

```powershell
pnpm build
pnpm test:e2e
pnpm test:visual
pnpm check:a11y
pnpm check:a11y-axe
cargo clippy --workspace --all-targets -- -D warnings
cargo deny check
pnpm audit --prod
```

### Gate G4 — Release candidate

- `pnpm check:release` passes in a clean environment.
- Platform desktop compile jobs pass on Windows, macOS, and Linux.
- Backup corruption rejection and interrupted-restore recovery are demonstrated.
- Release artifacts, evidence, checksums, SBOM, receipt, target identity, and attestations verify.
- Manual accessibility and native-shell matrices are recorded.

## 6. Wave 0 — Freeze, inventory, and partition

Goal: turn the 205-entry worktree into reviewable ownership packets without losing work.

### W0.1 Capture exact baseline

Artifacts:

- timestamped `git status --porcelain=v2` inventory;
- `git diff --stat`, `git diff --numstat`, and `git diff --check` output;
- current branch/base/head identifiers;
- list of untracked directories and generated artifacts.

Acceptance criteria:

- Inventory distinguishes tracked modifications, deletions, untracked source, generated output,
  fixture databases, screenshots, and reports.
- No cleanup is performed as part of inventory.

### W0.2 Classify all deletions

Review the 31 deleted paths, especially old components, hooks, mobile code, graph helpers, platform
abstractions, and type declarations.

For each deletion record one disposition:

- superseded by a named new module;
- intentionally retired capability;
- dead code proven unreachable;
- accidental deletion requiring restoration;
- deferred decision blocking packet extraction.

Acceptance criteria:

- Every deleted public component or hook has either a replacement import path or removal evidence.
- TypeScript build and boundary checks prove no dangling imports.
- Product/capability docs reflect intentionally retired surfaces.

### W0.3 Classify generated and binary changes

Scope:

- tracked `index.sqlite` fixtures;
- documentation screenshots;
- Cargo and pnpm lockfiles;
- ignored build, report, test, and log directories.

Acceptance criteria:

- SQLite changes are reproduced by a documented fixture/migration command or excluded.
- Screenshot changes identify the exact visual test and reviewed platform baseline.
- Lockfile changes correspond only to declared manifest changes.
- No ignored runtime output enters a source packet.

### W0.4 Create change-packet ledger

Partition the work into at least these packets:

| Packet | Primary scope | Required reviewers/gates |
| --- | --- | --- |
| A | baseline, versions, manifests, lockfiles | governance, source, build |
| B | index schema, tasks, kanban, fuzzy search | migration, restart, query correctness |
| C | Git merge3, queue, sync, conflict UI | data preservation, cancellation, recovery |
| D | publish, export, reader output, template engine | opt-in scope, diff, process policy |
| E | encryption, keys, permissions | threat model, restart, redaction, recovery |
| F | capture and extraction | network authorization, sanitization, bounds |
| G | reader UI and navigation stores | React correctness, a11y, URL safety |
| H | embeddings | experimental isolation, resource limits |
| I | CLI/daemon/IPC | auth nonce, contracts, transport recovery |
| J | CI/release workflows | immutable actions, provenance, release evidence |
| K | cleanup/deletions/docs | reachability, claims, history |

Exit gate: G0.

## 7. Wave 1 — Restore deterministic build and governance

Goal: achieve G1 without changing product behavior beyond necessary corrections.

### W1.1 Synchronize versions

Update all workspace crate/package versions through the canonical version workflow, including:

- `packages/template-engine/package.json`;
- `crates/annotations/Cargo.toml`;
- `crates/capture/Cargo.toml`;
- `crates/extractor/Cargo.toml`;
- `crates/publish-runner/Cargo.toml`.

Acceptance criteria:

- `node scripts/release/version.mjs check` passes.
- Lockfiles contain no unrelated dependency movement.
- The changelog accurately distinguishes released `0.1.1` from current unreleased work.

### W1.2 Repair publish-runner compilation

Tasks:

- Add a workspace-consistent `hex` dependency or replace the call with an existing approved encoder.
- Remove unused `PathBuf` and unnecessary mutability.
- Add a test asserting stable SHA-256 hex output for known bytes.

Acceptance criteria:

- `cargo test -p scriptor-publish-runner` passes.
- `cargo check --locked` passes this crate with zero warnings.

### W1.3 Repair capture contracts

Tasks:

- Decide whether tests use the repository-native Node harness or Vitest.
- If Vitest is intended, declare it in the owning package/tooling boundary; otherwise convert the test.
- Implement or correct the missing command-registry public path.
- Add the required package export rather than using a deep import.

Acceptance criteria:

- `pnpm check:contracts` passes.
- `pnpm lint:boundaries` passes.
- Capture tests exercise public package surfaces where appropriate.

### W1.4 Repair IPC source contract

Tasks:

- Replace formatting-sensitive regex inspection with an AST/parser check or whitespace-tolerant
  structural assertion.
- Add a validator regression test using rustfmt-expanded enum fields.
- Preserve the actual invariant: authenticated endpoint nonce and resynchronization event support.

Acceptance criteria:

- The validator fails when `ResyncRequired` or `endpoint_nonce` is removed.
- The validator passes across rustfmt formatting.
- `pnpm check:source` passes.

### W1.5 Resolve lint and React correctness

Subtasks:

- remove unused task types, variables, constants, and imports;
- replace countable regex spaces with explicit quantifiers;
- remove unused snippet-parser branches or wire them with tests;
- stabilize `App.tsx` setters with owned callbacks or reduce the dependency surfaces;
- remove unused reader handler wiring;
- replace synchronous effect-derived state with derived state, event transitions, or asynchronous
  subscription callbacks;
- represent navigation activity with render-safe state rather than reading a ref during render;
- remove the undefined `jsx-a11y` rule directive or install/configure the owning plugin consistently;
- remove unused ESLint suppressions.

Acceptance criteria:

- `pnpm lint` reports zero errors and zero warnings.
- Behavior tests cover navigation back/forward and loading/idle transitions.
- No new blanket lint suppression is introduced.

### W1.6 Normalize diff hygiene

- Remove trailing blank-line errors.
- Review line-ending configuration without mass rewriting the worktree.
- Confirm `.gitattributes` covers source types deliberately.

Exit gate: G1.

## 8. Wave 2 — Security and authority boundaries

Goal: make advertised permission and capability controls enforceable below the renderer.

### W2.1 Capability command map

Create one canonical mapping from every gated command to its `scriptor.*` capability ID.

Acceptance criteria:

- Unknown capability IDs fail closed.
- Every manifest ID matches `^scriptor\.[a-z0-9-]+$`.
- Bare aliases such as `graph` are rejected after a documented migration period.

### W2.2 Backend capability enforcement

Add dispatch middleware before real command handlers execute.

Required tests:

- enabled capability succeeds;
- disabled capability returns `RpcError::PluginDisabled { capability_id }`;
- missing or corrupt capability state fails according to a documented compatibility policy;
- direct daemon/IPC invocation cannot bypass renderer gating;
- restart preserves the decision;
- authorization and capability errors remain distinguishable.

### W2.3 Vault-scoped plugin state

Implement versioned `.scriptor/plugins.json` containing:

- `schemaVersion`;
- `enabledPlugins`;
- `disabledPlugins`;
- per-plugin settings;
- migration metadata if imported from legacy local storage.

Acceptance criteria:

- state is confined to the active vault;
- malformed state is quarantined or surfaced without silent reset;
- atomic writes and restart tests pass;
- legacy browser-profile state migrates at most once;
- secrets are prohibited from this file.

### W2.4 Manifest convergence

Create validated manifests for Citations, Graph, and MCP, then delete duplicate handwritten
manifest logic.

Acceptance criteria:

- all first-party capabilities pass `pnpm check:plugins`;
- catalog, runtime, and UI read the same contract;
- manifests declare maturity and authority requirements.

### W2.5 Disable teardown

Define lifecycle hooks for activation, deactivation, and disposal.

Prove that disabling a capability:

- terminates graph/layout workers;
- unregisters editor extensions and commands;
- cancels or rejects new jobs safely;
- releases subscriptions and listeners;
- does not lose unsaved document state.

### W2.6 Native command authorization inventory

For every new Tauri/daemon command introduced by the worktree, record:

- read/write/network/process/secret/destructive classification;
- scope and one-time grant requirements;
- runtime schema;
- path-confinement behavior;
- timeout/cancellation/bounds;
- audit/redaction behavior.

Exit criteria:

```powershell
pnpm check:authorization
pnpm check:mcp
pnpm check:plugins
cargo test -p scriptor-ipc -p scriptor-daemon
```

## 9. Wave 3 — Data model, migrations, tasks, and index integrity

Goal: land schema and task functionality without corrupting or stranding existing vault indexes.

### W3.1 Schema-train reconciliation

- Determine the actual current schema version.
- Assign unique versions to FTS, tasks, annotations, and future SRS work.
- Permit only one open rebuild-forcing migration at a time.
- Update migration documentation and fixtures.

### W3.2 Migration test matrix

Required cases:

- empty database to latest;
- each supported prior version to latest;
- interrupted migration rollback;
- corrupt metadata rejection;
- repeated startup idempotency;
- concurrent/busy database behavior;
- downgrade policy or explicit downgrade refusal;
- large-vault timing and progress reporting.

### W3.3 Task parser and recurrence

- Specify task grammar, status vocabulary, priority semantics, dates, recurrence, and unknown tokens.
- Preserve original Markdown when a task is not mutated.
- Ensure locale/time-zone behavior is deterministic.
- Add property or table-driven parsing tests for malformed and edge-case inputs.

### W3.4 Task index and write path

- Index tasks transactionally with note generations.
- Route task mutation through the canonical note-write path.
- Require expected-content hashes for conflict-sensitive writes.
- Reconcile index state after external file changes.

### W3.5 Kanban behavior

- Define the Markdown serialization format and compatibility policy.
- Test reorder, cross-column move, concurrent edit conflict, empty board, malformed board, undo,
  keyboard operation, and restart.
- Never overwrite unrelated Markdown around the board representation.

### W3.6 Search and fuzzy scoring

- Define one canonical scorer and deterministic tie-breaking.
- Bound result counts and input size.
- Add Unicode, diacritic, path, title, content, and adversarial-query tests.
- Record performance against 100, 1k, 5k, and 25k fixtures.

Exit criteria:

```powershell
pnpm check:knowledge
cargo test -p scriptor-indexer
pnpm bench:search-1k
```

## 10. Wave 4 — Git synchronization and conflict safety

Goal: guarantee that Git automation cannot destroy local edits or mutate unintended paths.

### W4.1 Git contracts

Define typed contracts for status, fetch, ahead/behind, pull plan, push plan, queue entries,
conflicts, merge results, cancellation, and recovery receipts.

### W4.2 Merge3 correctness

Test:

- clean non-overlapping merge;
- same-line conflict;
- insert/delete conflict;
- Unicode and mixed line endings;
- conflict-marker text already present in content;
- empty/base-missing cases;
- large files and bounded memory;
- round-trip without truncation.

### W4.3 Offline queue

- Persist queue entries durably and idempotently.
- Bind entries to repository/vault identity and expected branch/HEAD.
- Reject stale scope after branch or remote changes.
- Provide retry, cancel, inspect, and clear operations with audit evidence.

### W4.4 Pull/push safety

- Never invoke interactive credential prompts.
- Show planned remote, branch, commits, and dirty-worktree consequences.
- Pause automatic sync while editor state is dirty.
- Refuse destructive reconciliation without explicit confirmation.
- Route any Git subprocess through the process broker.

### W4.5 Conflict UI

- Preserve base/ours/theirs and unresolved content.
- Support keyboard-complete resolution.
- Record ordered outcomes in the activity/audit log.
- Test restart during conflict resolution.

Exit criteria:

```powershell
pnpm check:merge
cargo test -p scriptor-native-git
pnpm test:e2e -- --grep git
```

## 11. Wave 5 — Publish, export, templates, reader, and capture

Goal: provide reproducible output and bounded ingestion without privacy leaks.

### W5.1 Publish planning before mutation

- Publishing defaults to frontmatter opt-in.
- Produce a deterministic plan showing creates, updates, skips, conflicts, and deletions.
- Require review of the plan before any remote sink.
- Orphan deletion is separately opted in.
- Private/encrypted content is excluded unless policy explicitly allows it.

### W5.2 Publish runner

- Seal output paths against traversal and symlink escape.
- Make writes atomic and resumable.
- Produce content hashes and a receipt.
- Add dry-run, cancellation, partial failure, restart, and idempotency tests.

### W5.3 Export fidelity

- Validate every Pandoc argument through the typed profile.
- Use only the process broker for Pandoc or other converters.
- Test headings, outline, internal links, citations, diagrams, attachments, Unicode, RTL text,
  footnotes, code blocks, and failure diagnostics.
- Decide `pandoc` versus `webview` default PDF backend.

### W5.4 One template engine

- Consolidate filters, `{{var}}`, and supported `<% %>` grammar in `packages/template-engine`.
- Prohibit arbitrary evaluation.
- Define escaping, async resolution, recursion, missing variables, and resource bounds.
- Delete duplicate expanders only after compatibility tests pass.

### W5.5 Reader safety and accessibility

- Validate local file types and sizes.
- Revoke object URLs and cancel stale loads.
- Route external URLs through `safeExternalUrl` and native policy.
- Cover keyboard selection, screen readers, zoom, high contrast, loading, error, and unsupported media.

### W5.6 Capture/extraction boundary

- Require explicit network authority per source/scope.
- Bound response size, redirects, time, and content types.
- Sanitize HTML before conversion.
- Preserve source attribution and capture timestamp.
- Treat extracted content as untrusted Markdown/data.
- Start with CLI capture before committing to a browser extension.

Exit criteria:

```powershell
pnpm check:export
pnpm check:editor
cargo test -p scriptor-publish-runner -p scriptor-export-runner -p scriptor-capture -p scriptor-extractor
pnpm release:export-smoke
```

## 12. Wave 6 — Encryption, embeddings, AI, and experimental work

This wave is locked until Waves 0-5 pass G3.

### W6.1 Encryption threat-model reconciliation

- Define what is encrypted: full vault, individual notes, inline blocks, attachments, indexes,
  backups, logs, exports, and temporary files.
- Document metadata leakage and unsupported guarantees.
- Specify key source, key derivation, rotation, session timeout, and recovery.

### W6.2 Encryption negative and recovery tests

- wrong key;
- corrupt ciphertext;
- interrupted write/rotation;
- expired key session;
- crash during promotion;
- backup/restore;
- search/export/publish attempting to consume protected content;
- redaction from logs and panic output.

No supported encrypted-vault claim is allowed until these pass on every supported OS.

### W6.3 Embeddings isolation

- Keep embeddings outside default build/release until graduated.
- Bound model size, memory, batching, cache, cancellation, and vault scope.
- Prevent embedding encrypted or excluded content without explicit policy.
- Separate provider/network embeddings from local embeddings in contracts and UI.

### W6.4 AI write authority

- All AI-produced mutations use a diff-gated draft approval path.
- Provider keys never cross into renderer storage.
- Network destinations and content scope are shown before sending.
- Prompts, responses, and logs follow bounded retention and redaction policy.

### W6.5 Experimental promotion checklist

For embeddings, Tantivy, WASM, plugins, or AI, require all eight maturity graduation conditions:
owner, stable contract, failure tests, authority model, performance evidence, docs, release inclusion,
and changelog.

## 13. Wave 7 — Documentation, evidence, and roadmap repair

### W7.1 Reconcile authoritative claims

Update together:

- `PRODUCT.md`;
- `DESIGN.md` when interaction claims change;
- `docs/ARCHITECTURE.md`;
- `docs/CAPABILITY-MATURITY.md`;
- `docs/CAPABILITIES.md` if retained;
- `docs/VERIFICATION.md`;
- `CHANGELOG.md`.

Correct at minimum:

- architecture version `0.1.0` versus canonical `0.1.1`;
- updater disabled versus channel-aware updater implementation;
- marketplace supported versus bundled experimental catalog;
- encryption source paths and maturity;
- mobile deletion/design-only posture;
- first-party in-process plugins versus future WASM sandboxing.

### W7.2 Repair stale plans

- Reconcile or archive the 2026-08-09 comprehensive review plan.
- Correct renamed/transposed report references.
- Mark objective status from artifacts rather than stale checkboxes.
- Resolve dangling references to absent `tasks/plan.md`, `tasks/todo.md`, and comprehensive report.
- Add explicit “not claimed” sections.

### W7.3 Publish missing performance evidence

Create `docs/reports/review/06-performance-benchmarks-review.md` with:

- exact commit and clean/dirty state;
- OS, CPU, RAM, toolchain, build mode;
- fixture identity and size;
- startup, idle memory, indexing, search, graph, editor, canvas, and export results;
- p50/p95 where applicable;
- baseline comparison and regression decision.

### W7.4 Documentation contracts

- Add a check that supported claims have a corresponding Supported ledger row.
- Validate links and referenced paths.
- Require historical reports to state commit/date and proof vocabulary.
- Detect version and source-path drift where practical.

## 14. Wave 8 — PR and release convergence

### W8.1 PR 71 recovery

- Re-run the three failing jobs locally where reproducible.
- Split unrelated packets before requesting review.
- Rebase after dependency merge decisions.
- Attach exact verification evidence; do not rely on earlier green commits.

### W8.2 PRs 72 and 73 visual failures

- Compare failing snapshots, browser versions, fonts, viewport, and animation state.
- Determine whether failures share a baseline/environment cause.
- Never raise snapshot thresholds merely to hide full-page movement.
- Regenerate baselines only after human review of intentional changes.

### W8.3 PR 74 ordering

- Evaluate lockfile overlap with current unstaged Rust changes.
- If merged first, rebase and rerun Rust/security gates.
- If deferred, document why the green dependency update is blocked.

### W8.4 Issue tracker bootstrap

After explicit approval, create issues for unresolved P0/P1 work with:

- reproduction/evidence;
- affected versions and modules;
- security/data-loss classification;
- acceptance criteria;
- verification commands;
- dependencies and owner.

### W8.5 Release candidate

- Freeze source and dependency versions.
- Run G4 from a clean canonical clone.
- Record all pending platform/manual proof explicitly.
- Publish only with explicit authorization.

## 15. Cross-cutting verification matrix

| Concern | Minimum proof |
| --- | --- |
| Version/governance | `pnpm check:governance` |
| Package boundaries | `pnpm lint:boundaries`, contract typecheck |
| Rust compilation | locked check, fmt, clippy warning-zero |
| Native authority | authorization inventory plus negative tests |
| IPC | generated contract parity, nonce, malformed frame, resync, restart |
| Filesystem | traversal, symlink, race, atomicity, confinement |
| SQLite | upgrade, rollback, busy, corruption, idempotency, performance |
| Git | dirty tree, detached HEAD, conflict, cancellation, restart |
| Process | allowlist, env, network, timeout, output bound, tree kill |
| UI | loading, empty, error, success, cancellation, long content |
| Accessibility | keyboard, focus, screen reader, 200% zoom, contrast, motion |
| Publishing | opt-in plan, diff, path safety, retry, receipt |
| Encryption | wrong key, corruption, interruption, redaction, recovery |
| Release | source identity, lockfiles, artifacts, checksums, SBOM, attestations |

## 16. Risk register

| Risk | Severity | Mitigation / stop condition |
| --- | --- | --- |
| Large mixed diff hides regressions | Critical | No merge before packet partition and G1 |
| Disabled capability remains callable | Critical | Backend negative tests before plugin claims |
| Publish leaks private notes | Critical | Opt-in plan/diff before any sink |
| Encryption overclaimed | Critical | Remain experimental until recovery matrix passes |
| Index migration strands vaults | High | Version train plus upgrade/interruption tests |
| Git sync destroys edits | High | Dirty-state pause, merge3 tests, durable recovery |
| New commands bypass authority | High | Inventory and native enforcement gate |
| Fixture DB changes are incidental | High | Deterministic regeneration or exclusion |
| Stale docs misdirect implementation | High | W7 reconciliation before release |
| Visual baselines mask movement | Medium | Human review; stable thresholds |
| Incubating crates silently ship | Medium | Default-member and artifact checks |
| Roadmap scope exceeds capacity | High | Commit only through an explicit wave boundary |

## 17. Human decisions required

Record each decision in an ADR or the authoritative plan before dependent work begins.

1. Commit through Wave 3 or Wave 5 for the next milestone.
2. Keep AI in Wave 6 or promote it after the permission/diff prerequisites.
3. Set acceptable worst-case 25k-vault reindex time and memory.
4. Promote, retain as evaluation, or retire Tantivy.
5. Choose default PDF export backend.
6. Confirm browser extension is outside launch scope.
7. Define `rustFeatureGate` as a real Cargo feature or rename it as runtime capability metadata.
8. Decide whether citation-engine is wired into product paths or demoted from default members.
9. Decide whether desktop resource catalog is a committed capability or removable scaffolding.
10. Decide updater support posture and release channel guarantees.

## 18. Suggested milestone structure

| Milestone | Included waves | Exit condition |
| --- | --- | --- |
| M0 Baseline recovery | W0-W1 | G1 green |
| M1 Authority and data integrity | W2-W3 | security negative tests and migrations green |
| M2 Safe synchronization | W4 | Git recovery suite green |
| M3 Reproducible content flow | W5 | publish/export/capture gates green |
| M4 Experimental evaluation | W6 | no unsupported graduation claims |
| M5 Release convergence | W7-W8 | G4 and exact-head CI green |

## 19. First 20 execution tickets

1. Inventory all 205 worktree entries into packets A-K.
2. Review and classify all 31 deletions.
3. Prove or revert the two tracked SQLite fixture mutations.
4. Synchronize five stale package/crate versions.
5. Repair `scriptor-publish-runner` dependency and warning failures.
6. Repair capture test runner and missing command registry.
7. Make IPC source validation formatting-independent.
8. Resolve all 18 ESLint errors.
9. Resolve all 23 ESLint warnings without blanket suppression.
10. Clear `git diff --check` failures.
11. Run and record G1 from the resulting candidate.
12. Define canonical capability IDs and command mapping.
13. Add backend disabled-capability enforcement.
14. Add direct-RPC negative tests for Canvas, Citations, Export, Graph, and MCP.
15. Implement vault-scoped versioned plugin state and migration.
16. Add missing plugin manifests and remove duplicate conventions.
17. Add plugin worker/extension teardown.
18. Reconcile index schema version assignments and migration fixtures.
19. Complete migration interruption/restart tests.
20. Publish the missing performance benchmark report before further feature expansion.

## 20. Definition of program success

The program is successful when:

- the active work is partitioned into comprehensible, reviewable changes;
- all supported capabilities have enforceable boundaries and truthful documentation;
- no Git, publish, encryption, migration, or note-write path can silently lose or expose data;
- G4 passes against the exact release candidate in a clean environment;
- PR status, issue tracking, roadmap status, and capability maturity agree with repository evidence;
- remaining experimental work is isolated, owned, bounded, and explicitly non-shipping;
- a contributor can locate the owner, contract, tests, failure semantics, and verification command
  for each major workflow without relying on stale plans.

## 21. Explicit non-claims

This roadmap does not claim that:

- the current branch is buildable or merge-ready;
- any failed verification listed in the baseline has been repaired;
- encrypted vaults, embeddings, Tantivy, WASM plugins, mobile, a public marketplace, or AI writes
  are supported;
- old review reports establish correctness for the current worktree;
- passing source checks proves platform packaging, recovery, accessibility, or public release;
- all optional Wave 6+ capabilities should be built.

## 22. Validation amendments — 2026-08-13

The following evidence was collected after this roadmap's initial baseline. These are current
findings, not completed delivery claims.

### Baseline repair completed in the working tree

- Rust version parity was repaired for `annotations`, `capture`, `extractor`, and
  `publish-runner`; `packages/template-engine` still requires version parity.
- `scriptor-publish-runner` now has its declared hash encoder and focused tests pass.
- Native-Git diff hygiene and Merge3 doctest coverage were repaired.
- CLI adapters now use the current vault write, fast-forward pull, and export input contracts;
  focused CLI tests pass.
- Contract typecheck, lint, and frontend-quality checks pass after targeted cleanup.
- Source-contract validation was made rustfmt-compatible for `ResyncRequired`, and its stale
  overlay-store reference was updated to the replacement `useOverlayPanelStore` owner.

### Newly confirmed P0 integration defects

1. **Reader, Tasks, and Kanban lack a complete reachable product flow.** Reader state has no
   confirmed production trigger, and Task/Kanban panels are not mounted from the main workspace.
   Add activation routes, command-palette/keyboard and pointer entry points, and focused E2E tests
   before treating these as shipped surfaces.
2. **Full application typecheck remains broken.** The reader store depends on unresolved
   `zustand`/Immer dependencies, uses an incorrect vault descriptor field, and overlay/rename
   setter signatures have mismatches. Repair full `tsc -b` before visual or release testing.
3. **Kanban moves do not truthfully persist their stated operation.** The UI changes a card's
   column while the native mutation changes only the checkbox marker. Define and implement the
   Markdown column serialization, reject unknown destinations, and test reload/restart plus failed
   mutation rollback.
4. **Reader state and offline guarantees are untruthful.** File I/O state is disconnected from
   rendered state; PDF/EPUB wrappers use CDN assets; a PDF wrapper assignment error turns a
   successful render into an error. Bundle locally, wire error/loading ownership once, and add
   offline and rejection tests.
5. **Task/Kanban mutation and dialog accessibility require completion.** Mutations discard
   failures; dialogs lack complete modal focus semantics; Kanban has drag-only mutation. Add
   pending/error/success states, keyboard alternatives, accessible modal primitives, and the
   design-system viewport/44px/reduced-motion checks.

### G1 status after amendments

| Requirement | Current result |
| --- | --- |
| `git diff --check` on repaired native-Git paths | Pass |
| `pnpm check:contracts` | Pass |
| `pnpm lint` | Pass |
| frontend-quality validator | Pass |
| source-contract checks through frontend quality | Pass |
| `pnpm check:governance` | Blocked by template-engine version drift and `App.tsx` size ratchet |
| `cargo check --locked` | CLI adapter errors repaired; full rerun still required |
| `pnpm exec tsc -b --pretty false` | Fails on Reader/panel integration defects |

### Wave 2 authority increment — 2026-08-13

The first authority increment is implemented but Wave 2 is **not complete**.

- `crates/vault/src/plugin_state.rs` owns versioned, vault-scoped `.scriptor/plugins.json` state,
  validates canonical `scriptor.*` IDs, prohibits secret-shaped setting keys, and uses the vault
  atomic-write primitive. A missing file follows the explicit compatibility policy: existing
  built-ins remain enabled until a vault records a decision; unknown capability IDs are not
  inferred.
- `crates/daemon/src/capabilities.rs` is the canonical daemon map for Graph, Export, Canvas, and
  mapped `Invoke` commands. `DaemonState` reloads the active vault state on open; both normal and
  outside-lock transport dispatch reject disabled Graph/Export requests with structured
  `RpcResult::Error(RpcError::PluginDisabled { capability_id })` before handler/job execution.
- Direct desktop Canvas write/snapshot/template commands and native Export run/start/cancel commands
  now load the same active-vault state before executing. MCP stdio refuses startup for a vault with
  `scriptor.mcp` disabled, so authenticated daemon, direct Tauri, and stdio adapters cannot use
  renderer storage as an authority bypass.
- Canvas, Export, and MCP manifests now declare canonical capability IDs and the plugin validator
  rejects bare aliases.

Focused evidence: `cargo test -p scriptor-vault plugin_state`,
`cargo test -p scriptor-daemon capabilities`, `cargo test -p scriptor-ipc`,
`pnpm check:contracts`, and `pnpm check:plugins` pass.

Remaining Wave 2 work: vault-backed renderer get/update APIs and one-time browser migration,
exhaustive catalog parity, lifecycle teardown, and direct authenticated transport/restart
integration tests.

### Wave 2 renderer authority follow-up — 2026-08-13

Desktop renderer state now calls `plugin_state_get` and `plugin_state_set_enabled`, which operate
only on the active vault's `.scriptor/plugins.json`; the legacy local-storage key remains a
non-native compatibility fallback rather than the desktop authority source. This closes the
renderer-to-native authority gap for state changes. Remaining work is the explicit, recorded
one-time migration of pre-existing local-storage decisions, teardown/lifecycle implementation,
and end-to-end rejection/restart tests for every mapped command.

### Finalization boundary — 2026-08-13

This roadmap is the active implementation ledger. The 2026-08-09 comprehensive review plan,
brainstorm reconciliation, and 2026-08-10 Rust stale-code audit are historical records and are
explicitly marked as such; they must not be used as removal authority or current support evidence.

The repository can be structurally clean only after a frozen, reviewable change packet is selected.
The current worktree contains 261 tracked/untracked entries spanning multiple packets, so a
destructive global cleanup, history rewrite, PR merge, issue creation, release publication, or
claim of G4 is intentionally out of scope without a user-selected packet and explicit external
authorization. Required external/manual conditions remain W8 and G4: remote PR/issue decisions,
platform CI, visual baseline approval, release artifacts, and manual accessibility/recovery proof.

### Packet progress — 2026-08-13

The following reviewable commits are pushed to PR 71 with local evidence:

| Commit | Packet | Evidence |
| --- | --- | --- |
| `e884288` | vault-scoped capability authority | vault/daemon/plugin/IPC tests, desktop check, TypeScript and contract checks |
| `111bc3c` | Reader, Tasks, Kanban, index integrity | 8 contract tests, 30 indexer tests, 5 focused Playwright flows, TypeScript build |
| `8866b07` | CI cache and job-status hardening | action-pin validator and staged diff check |
| `c41878a` | deterministic Git merge and queued recovery | 36 unit tests, 3 integration tests, 2 doctests, clippy with `-D warnings` |
| `6e3986f` | capture, extraction, publish planning, export sealing | capture/extractor/export tests and clippy |
| `daa8a2f` | encryption, permissions, embedding isolation | vault crypto/inline/permission tests and embedding tests |

These commits are implementation evidence, not release approval. Remaining work is limited to
deletion/reachability review, documentation and screenshot review, full clean-clone G1–G4
execution, cross-platform visual baseline approval, native capability migration/restart checks,
and remote CI/release-artifact verification. Until those are evidenced, this branch remains a
recovery candidate and must not be merged or released solely because focused packets are green.

### Verification update — 2026-08-13

- `pnpm test:e2e -- --workers=1`: **71 passed**.
- `pnpm test:visual -- --workers=1`: **28 passed** after the plugin-marketplace heading fix in
  `dfc791d`.
- `pnpm check:a11y`: **passed** after `0980de2` added the workspace live status region.
- `pnpm check:a11y-axe`: local execution remains blocked by the missing lockfile chromedriver
  executable/postinstall artifact; this is recorded as environment evidence, not a passing gate.
- Governance, source, contracts, TypeScript build, Rust formatting, and locked workspace check all
  pass locally after `fe21160`.

The 155 remaining worktree paths are still mixed across documentation screenshots, fixture databases,
historical deletions, editor/CLI refactors, and release evidence. They are not treated as finalized
until each is assigned to a packet and its generated/binary provenance is reviewed.
