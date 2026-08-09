# Scriptor Comprehensive Project Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Execute a complete, deep, detailed, broad, rigorous, holistic, and concrete review of the entire Scriptor codebase (`D:\GitHub\Scriptor`) across governance, Rust/daemon backend patterns, frontend React UI architecture/patterns/de-slop, IPC contracts, HMI/onboarding guides (`docs/ONBOARDING.md`, `GEMINI.md`), C4 architecture documentation (`docs/architecture/c4-context.md`, `docs/architecture/c4-container.md`), 4-axis navigation (`codenav`), structural hub blast-radius mapping (`codemap`), code topology & SQLite schema graphing (`graphify-code-topology`), Karpathy Engineering Guidelines (`karpathy-guidelines`), Elite Frontend UI/UX Architecture (`elite-frontend-architect`), Utilitarian Desktop Interface Design System Contract (`interface-design.md`), Multi-Persona Document Review (`ce-doc-review`), Elite QA TDD & Systematic Debugging Mastery (`elite-qa-architect`), Journalistic Press Release Synthesis (`press-release-writer`), Code Review Gates & Multi-Persona Auditing (`ce-code-review`), frontend DFII evaluation, AI slop cleaner 4-pass protocol (`ai-slop-cleaner`), Playwright E2E/visual/a11y test suites with Page Object Models, Visual Ralph verdict testing (`score >= 90`), performance budgets & benchmarks, metric-driven iterative optimization (`ce-optimize`), meta-harness skill optimization (`meta-optimize`), agent failure-introspection protocols, project skill surface, release security, and interactive technical architecture diagrams (`archify`).

**Architecture:** A 7-task structured audit workflow governed by 36 invoked project and ecosystem skills:
1. `writing-plans` & `planning-and-task-breakdown` (Bite-sized tasks, non-placeholder commands, dependency ordering)
2. `core-skill-obedience` (Order of operations: Planning $\rightarrow$ Architecture $\rightarrow$ Tech-Stack; RARV execution loop)
3. `karpathy-guidelines` (Think before coding, Simplicity First, Surgical Changes, Goal-Driven Execution loops)
4. `codebase-onboarding` (Full repo architecture mapping, onboarding guide `docs/ONBOARDING.md`, enhanced `GEMINI.md`)
5. `codenav` (4-axis navigation: Temporal, Structural/Topological, Semantic, Precision/Literal)
6. `codemap` (Codebase structural tree mapping, `.codemap/config.json`, hub file blast-radius analysis)
7. `graphify-code-topology` (AST call-graph topology, SQLite schema ER graphing, foreign key integrity, index coverage)
8. `architecture-c4-model` (Level 1 System Context `c4-context.md`, Level 2 Containers `c4-container.md`, Mermaid C4 diagrams)
9. `interface-design` (Utilitarian desktop UI design doc `interface-design.md`, density, monospace for data/timestamps, `tabular-nums`, missing states audit)
10. `ce-doc-review` (Multi-persona document review: coherence, feasibility, product, design, security, scope, adversarial lenses)
11. `elite-frontend-architect` (Distinctive UI stance, DFII $\ge 8$, UI/UX Pro Max rules, WCAG 2.2 AA floor, touch targets $\ge 44\times 44\text{px}$, cursor-pointer)
12. `architecture-frontend-design` (DFII evaluation score, intentional minimalist research/writing tone, PRE-ACT operator checklist)
13. `ai-slop-cleaner` (Lock behavior with regression tests first, inventory masking fallbacks, 4-pass cleanup: dead code, duplicates, naming, test reinforcement)
14. `frontend-design-deslop` & `$design` (Strategy-driven design, canonical `DESIGN.md` tokens, zero AI slop defaults)
15. `visual-ralph` (Visual Ralph loop: approved reference $\rightarrow$ Visual Verdict `score >= 90` $\rightarrow$ secondary pixel diffs)
16. `ce-optimize` (Metric-driven iterative optimization loop, `.context/compound-engineering/ce-optimize/` scaffolding, CP-0 to CP-5 checkpoints)
17. `meta-optimize` (Outer-loop harness optimization, usage trace analysis, SKILL.md prompt & parameter optimization proposals)
18. `elite-qa-architect` (TDD Iron Law: RED $\rightarrow$ GREEN $\rightarrow$ REFACTOR, 4-phase systematic debugging protocol, smart error grouping: infra $\rightarrow$ API $\rightarrow$ logic)
19. `press-release-writer` (Journalistic release synthesis, inverted pyramid, 5W1H lead in 25-35 words, factual boilerplate, zero banned fluff)
20. `ce-code-review` (Risk-driven reviewer persona roster, P0-P3 severity scale, zero P0/P1 unmitigated defects gate)
21. `e2e-testing` & `ecc-e2e-testing` (Playwright Page Object Model, `data-testid` locators, `waitForResponse` network stability, screenshot/video/trace artifact management, flaky test quarantine)
22. `archify` (Interactive technical system architecture, IPC sequence, dataflow, and authorization workflow diagrams)
23. `find-skills` & `project-skill-audit` (Ecosystem skill discovery & project-local skill surface recommendations)
24. `rust-skills` (Rust 1.96 / 2024 edition safety, error handling, borrowing, async mutex safety, clippy/deny)
25. `ecc-backend-patterns` (Service/Repository separation, indexer query optimization, N+1 prevention, background queues, structured logging)
26. `frontend-ui-engineering`, `frontend-design` (UI component composition, state matrices, zero AI slop)
27. `ecc-frontend-patterns` (Compound components, custom hooks stability against infinite re-fetch loops, memoization, virtualization, error boundaries)
28. `ecc-agent-introspection-debugging` (4-phase failure capture, root-cause diagnosis, contained recovery, introspection report)
29. `agent-skills-performance-optimization` & `performance-goal` (5-step Measure-Identify-Fix-Verify-Guard workflow against performance budgets and `perf-baselines.json`)

**Tech Stack:** Rust 1.96 / 2024 Edition (cargo, clippy, deny, ts-rs, tokio, thiserror, anyhow), TypeScript/React 19 (pnpm 10.33.0, vite 8, eslint, tsc, tanstack-virtual, zustand), Tauri 2 desktop app, Playwright E2E/visual, axe-core a11y, C4 Mermaid diagrams, Archify standalone SVG/HTML diagrams, semantic CSS custom properties, Node.js validation scripts, PowerShell benchmarks.

---

### Master Skill Enforcement Matrix

| Domain | Skill Invoked | Applied Review Standard |
|---|---|---|
| **Process & Discipline** | `core-skill-obedience` | Order of Operations (Planning $\rightarrow$ Arch $\rightarrow$ Tech) + RARV Loop (`[PRE-ACT]`, `[ACT]`, `[VERIFY]`) |
| **Karpathy Discipline** | `karpathy-guidelines` | Think Before Coding, Simplicity First (no single-use abstractions), Surgical Changes (touch only requested lines), Goal-Driven Verification |
| **Plan Architecture** | `writing-plans`, `planning-and-task-breakdown` | Bite-sized tasks, exact file paths, explicit non-placeholder commands & commits |
| **Onboarding & Guide** | `codebase-onboarding` | Codebase architecture map, key entry points table, [`docs/ONBOARDING.md`](file:///D:/GitHub/Scriptor/docs/ONBOARDING.md), enhanced [`GEMINI.md`](file:///D:/GitHub/Scriptor/GEMINI.md) |
| **4-Axis Navigation** | `codenav` | Orient (Structural+Semantic) $\rightarrow$ Locate (Precision) $\rightarrow$ Verify (Temporal) $\rightarrow$ Blast Radius (Structural) |
| **Structural Hub Mapping** | `codemap` | Hub file identification (`codemap --deps`, `--importers`), `.codemap/config.json`, changed file impact |
| **Code Topology & Schema** | `graphify-code-topology` | AST call-graph topology, SQLite schema ER graphing, foreign key integrity (`PRAGMA foreign_keys = ON`), index coverage |
| **C4 Architecture** | `architecture-c4-model` | System Context [`docs/architecture/c4-context.md`](file:///D:/GitHub/Scriptor/docs/architecture/c4-context.md) & Container Specs [`docs/architecture/c4-container.md`](file:///D:/GitHub/Scriptor/docs/architecture/c4-container.md) |
| **Interface Design Doc** | `interface-design` | Utilitarian UI design doc `interface-design.md`, density, monospace for data/timestamps, `tabular-nums`, missing states audit |
| **Document Review** | `ce-doc-review` | Multi-persona plan/requirements audit (`coherence`, `feasibility`, `product`, `design`, `security`, `scope`, `adversarial`) |
| **Elite Frontend UI/UX** | `elite-frontend-architect` | Distinctive aesthetic stance, DFII $\ge 8$, UI/UX Pro Max rules (touch targets $\ge 44\times 44\text{px}$, cursor-pointer, zero emoji icons) |
| **UI De-Slop & Craft** | `frontend-design-deslop`, `ai-slop-cleaner` | Strategy-driven tokens, 4-pass deslop (dead code, duplicates, naming, test reinforcement), 0 AI slop defaults |
| **Visual Verdict Loop** | `visual-ralph` | Visual Ralph verdict `score >= 90`, snapshot pixel diff overlays (`playwright.visual.config.ts`) |
| **Iterative Optimization** | `ce-optimize` | Metric-driven loop (`.context/compound-engineering/ce-optimize/`), CP-0 to CP-5 disk checkpoints |
| **Harness Meta-Optimize** | `meta-optimize` | Outer-loop skill/harness optimization proposals (`.aris/meta/pending/`) |
| **TDD & QA Mastery** | `elite-qa-architect` | TDD Iron Law (RED-GREEN-REFACTOR), 4-phase systematic debugging, smart error grouping (infra $\rightarrow$ API $\rightarrow$ logic) |
| **Press Release Synthesis**| `press-release-writer` | Journalistic release document, inverted pyramid structure, 5W1H lead in 25-35 words, 0 banned marketing fluff |
| **Code Review Gates** | `ce-code-review` | Risk-driven reviewer persona roster, P0-P3 severity scale, 0 P0/P1 unmitigated defects gate before task sign-off |
| **Playwright E2E** | `e2e-testing`, `ecc-e2e-testing` | Page Object Model (`e2e/pages/`), `data-testid` locators, network timing stability, screenshot/video/trace artifact management |
| **Diagrams & System Maps** | `archify` | Self-contained HTML/SVG system architecture, IPC sequence, dataflow, & authorization diagrams |
| **Skill Audit** | `project-skill-audit`, `find-skills` | Audit repo surface (`AGENTS.md`, `GEMINI.md`); propose local & ecosystem skill additions |
| **Rust Core & IPC** | `rust-skills` | `thiserror` vs `anyhow`, zero unwrap in prod, mandatory `// SAFETY:` comments, no async mutex across await |
| **Backend Services** | `ecc-backend-patterns` | Service/Repository separation, N+1 query prevention, background job queues, structured logging |
| **Frontend UI/UX** | `frontend-ui-engineering`, `ecc-frontend-patterns` | Composition over configuration, custom hooks ref protection, memoization, list virtualization, error boundaries |
| **Performance** | `agent-skills-performance-optimization`, `performance-goal` | 5-step Measure-Identify-Fix-Verify-Guard workflow against `perf-baselines.json` budgets |
| **Failure Recovery** | `ecc-agent-introspection-debugging` | 4-phase failure capture & self-debug report on test/benchmark blockers |

---

### Pre-Flight Discipline (`core-skill-obedience` & `karpathy-guidelines`)

All audit tasks strictly enforce the **Order of Operations** and **Karpathy Engineering Guidelines**:
1. **Karpathy Core Principles:**
   - **Think Before Coding:** Explicitly state assumptions. Never hide ambiguity.
   - **Simplicity First:** Write the minimum necessary code. Zero single-use abstractions or speculative complexity.
   - **Surgical Changes:** Modify only files required by the audit task. Clean up only your own mess.
   - **Goal-Driven Execution:** Define explicit verification commands (`step -> verify: command`).
2. **Phase 1 (Governance & Process):** Verify onboarding guide (`docs/ONBOARDING.md`), project `GEMINI.md`, workspace manifests, action pins, version alignment, module boundaries, i18n parity, and multi-persona document review (`ce-doc-review`).
3. **Phase 2 & 4 (Backend & C4 Architecture):** Audit C4 System Context (`c4-context.md`), C4 Container (`c4-container.md`), 4-axis navigation (`codenav`), structural hubs (`codemap`), code topology & SQLite schema graphing (`graphify-code-topology`), Rust core crates, `system-bridge` process launch inventory, IPC definitions, and daemon service architecture.
4. **Phase 3, 5, 6, 7 (Tech-Stack, UI, QA & Diagrams):** Audit React 19 monorepo packages, UI component composition, Elite Frontend Architecture, Interface Design System Contract (`interface-design.md`), DFII $\ge 8$ rating, 4-pass deslop protocol (`ai-slop-cleaner`), PRE-ACT UI operator checklist, Playwright E2E POM structure, Elite QA TDD & Systematic Debugging, Visual Ralph verdict (`score >= 90`), performance budgets, `ce-optimize` measurement scaffolding, Archify architecture diagrams, Press Release synthesis (`press-release-writer`), Code Review Gates (`ce-code-review`), skill surface, and release security evidence.

---

### Task 1: Governance, Onboarding, Interface Design & Document Review Verification

**Files:**
- Create: `interface-design.md` (Utilitarian Desktop Interface Design System Contract)
- Modify: `docs/reports/review/01-governance-contracts-review.md` (Create review section)
- Test: `docs/ONBOARDING.md`, `GEMINI.md`, `scripts/validation/source-contracts.mjs`, `scripts/validation/action-pins.mjs`, `scripts/validation/deep-module-boundaries.mjs`, `scripts/validation/i18n-parity.mjs`, `scripts/validation/docs-contracts.mjs`, `scripts/validation/rustsec-exceptions.mjs`

- [ ] **Step 1: [PRE-ACT] Read governance rules, onboarding docs & GEMINI.md guidelines**

Review `AGENTS.md:1-10`, `GEMINI.md:1-43`, `docs/ONBOARDING.md`, and `interface-design.md` rules.

- [ ] **Step 2: [ACT] Create Utilitarian Desktop Interface Design System Contract (`interface-design.md`)**

Write `interface-design.md` at project root specifying:
1. Context: Local-first writing & research desktop application (Tauri 2 + React 19).
2. Component Library: Tailwind CSS custom properties + Lucide React icons + Radix UI primitives.
3. Customization Layer: Desaturated minimalist tone, border-only card separation (`border-border`), system font stack with `monospace` for IDs/timestamps/data and `tabular-nums` for columns, high-contrast light/dark modes.
4. Layout Patterns: Collapsible sidebar (240px expanded) + page header + main workspace content area.
5. Data Patterns: Data tables with inline filter bars, skeleton loaders, full state coverage (loading, empty, error).
Expected: `interface-design.md` created with 0 anti-pattern ambiguities.

- [ ] **Step 3: [ACT] Execute Multi-Persona Document Review (`ce-doc-review`) across Master Plan & Onboarding Docs**

Run multi-persona document review on `docs/superpowers/plans/2026-08-09-comprehensive-project-review.md` and `docs/ONBOARDING.md` using `coherence-reviewer`, `feasibility-reviewer`, `product-lens-reviewer`, and `scope-guardian-reviewer` personas.
Expected: All document requirements, feasibility assertions, and completeness checks verified with 0 unresolved contradictions.

- [ ] **Step 4: [ACT] Run workspace version parity check**

Run: `pnpm version:check`
Expected: Output showing version synchronization across `VERSION`, `package.json`, `Cargo.toml`, and app manifests with zero version mismatches.

- [ ] **Step 5: [ACT] Run GitHub Actions workflow security pinning check**

Run: `pnpm lint:actions`
Expected: PASS with 0 unpinned GitHub Actions (all actions pinned to 40-character commit SHAs).

- [ ] **Step 6: [ACT] Run deep module boundaries linting**

Run: `pnpm lint:boundaries`
Expected: PASS with 0 illegal cross-package or deep internal import violations.

- [ ] **Step 7: [ACT] Check internationalization (i18n) key parity**

Run: `pnpm check:i18n`
Expected: PASS with 100% key match across supported locale dictionaries.

- [ ] **Step 8: [ACT] Verify documentation contracts and onboarding guides**

Run: `pnpm check:docs`
Expected: PASS with zero broken cross-references or contract violations in `docs/` and `docs/ONBOARDING.md`.

- [ ] **Step 9: [ACT] Execute full source contracts and rustsec exception suite**

Run: `pnpm check:source`
Expected: PASS across source contracts, desktop branding, Rust source contracts, authorization inventory, frontend quality, module size ratchet, and rustsec exceptions.

- [ ] **Step 10: [VERIFY] Run ce-code-review gate, verify task criteria & commit review findings**

Run code review gate with `correctness-reviewer` and `project-standards-reviewer` personas. Verify 0 P0/P1 defects and commit:

```bash
git add interface-design.md docs/reports/review/01-governance-contracts-review.md
git commit -m "docs: publish interface-design.md contract and record governance, onboarding, and document review findings"
```

---

### Task 2: IPC Contracts, C4 Architecture, Code Topology & Rust Backend Review

**Files:**
- Modify: `docs/reports/review/02-rust-ipc-engine-review.md` (Create review section)
- Create: `docs/architecture/c4-context.md` (C4 System Context documentation & Mermaid diagram)
- Create: `docs/architecture/c4-container.md` (C4 Container documentation & Mermaid diagram)
- Test: `crates/ipc`, `crates/vault`, `crates/indexer`, `crates/citation-engine`, `crates/canvas-engine`, `crates/export-runner`, `crates/native-git`, `crates/system-bridge`, `crates/daemon`, `crates/cli`, `crates/embeddings`, `crates/tantivy-indexer`, `crates/wasm-runtime`, `apps/desktop/src-tauri`

- [ ] **Step 1: [PRE-ACT] Read C4 Model, CodeNav & Code Topology guidelines**

Review `architecture-c4-model` (`c4-context.md`, `c4-container.md`), `codenav` (4-axis navigation), `codemap` (hub blast radius), `graphify-code-topology` (AST call graph, SQLite schema ER graphing, foreign key integrity `PRAGMA foreign_keys = ON`, index coverage), `rust-skills` (`err-thiserror-lib`, `err-no-unwrap-prod`, `async-no-lock-await`, `unsafe-safety-comment`), `ecc-backend-patterns` (repository/service layer separation, query optimization, background job queueing, structured logging), `crates/ipc/src/lib.rs`, and `Cargo.toml`.

- [ ] **Step 2: [ACT] Generate C4 Model System Context (`c4-context.md`) and Container (`c4-container.md`) Specifications**

Document:
1. `docs/architecture/c4-context.md` — Personas (Writer, Researcher, Academic), external systems (Zotero, Git remotes, PDF engine, LLM provider), and Mermaid `C4Context` diagram.
2. `docs/architecture/c4-container.md` — Deployable containers (Tauri 2 shell, React 19 SPA, Vault Engine, Indexer Engine, Daemon IPC, Tantivy FTS, SQLite storage), technology choices, and Mermaid `C4Container` diagram.
Expected: Both C4 documents written with zero missing bounded contexts or syntax errors.

- [ ] **Step 3: [ACT] Run Multi-Persona Document Review (`ce-doc-review`) on C4 Specifications**

Run `ce-doc-review` on `c4-context.md` and `c4-container.md` using `coherence-reviewer`, `feasibility-reviewer`, `security-lens-reviewer`, and `adversarial-document-reviewer`.
Expected: Architecture specs pass multi-persona review with 0 structural omissions.

- [ ] **Step 4: [ACT] Verify IPC Rust-to-TypeScript contract synchronization**

Run: `pnpm check:contracts`
Expected: `tsc -p tsconfig.contracts.json --noEmit` completes with 0 errors.

- [ ] **Step 5: [ACT] Run Rust ts-rs export tests for IPC definitions**

Run: `pnpm check:ts-rs`
Expected: `cargo test -p scriptor-ipc` passes with 0 failures.

- [ ] **Step 6: [ACT] Audit Backend Service Architecture, Code Topology & SQLite Schema Integrity**

Audit Rust crates (`crates/vault`, `crates/indexer`, `crates/daemon`) using `graphify-code-topology`:
1. Service/Repository separation (`MarketService` / `VaultService` abstraction pattern).
2. Code topology call-graph & blast radius mapping across core module boundaries.
3. SQLite database schema ER graphing: verify `PRAGMA foreign_keys = ON`, cascading deletes, reference integrity, and index coverage on search/graph tables in `crates/indexer`.
4. Indexer batch processing & N+1 query prevention (`mem-reuse-collections`, batch indexing).
5. Background indexing job queues and task cancellation (`async-cancellation-token`).
6. Structured logging format (`tracing` / JSON log entries with requestId/context).
7. `thiserror` in libraries vs `anyhow` in binaries (`err-thiserror-lib`, `err-anyhow-app`).
8. Zero `unwrap()` in production paths (`err-no-unwrap-prod`) and `// SAFETY:` on `unsafe` blocks.
9. Zero Tokio async `Mutex` locks held across `.await` points (`async-no-lock-await`).
Expected: 0 backend architectural violations, schema integrity issues, or safety comment gaps.

- [ ] **Step 7: [ACT] Verify Rust formatting across workspace**

Run: `cargo fmt --all --check`
Expected: 0 formatting diffs reported across all workspace crates.

- [ ] **Step 8: [ACT] Run Clippy lints with warnings as errors**

Run: `cargo clippy --workspace --all-targets -- -D warnings`
Expected: PASS with 0 warnings or compiler errors.

- [ ] **Step 9: [ACT] Run Cargo Deny security and license dependency checks**

Run: `pnpm check:deny`
Expected: `cargo deny check` passes with 0 advisory, license, or ban violations.

- [ ] **Step 10: [ACT] Run cargo test suite across product and incubating crates**

Run: `pnpm test:rust`
Expected: All unit and integration tests pass across `crates/`.

- [ ] **Step 11: [VERIFY] Run ce-code-review gate, verify C4 docs & commit review findings**

Run code review gate with `correctness-reviewer`, `api-contract-reviewer`, `reliability-reviewer`, and `security-reviewer` personas. Verify 0 P0/P1 defects and commit:

```bash
git add docs/architecture/c4-context.md docs/architecture/c4-container.md docs/reports/review/02-rust-ipc-engine-review.md
git commit -m "docs: publish C4 architecture specs and record Rust/IPC review findings"
```

---

### Task 3: Frontend Architecture, Elite Frontend UI/UX, Interface Design, DFII & Deslop Audit

**Files:**
- Modify: `docs/reports/review/03-frontend-packages-review.md` (Create review section)
- Test: `packages/core`, `packages/editor`, `packages/canvas`, `packages/portal`, `packages/renderer`, `packages/export`, `packages/mcp`, `packages/plugin-api`, `packages/zotero-connector`, `src/App.tsx`, `src/index.css`, `src/styles/`, `interface-design.md`, `DESIGN.md`

- [ ] **Step 1: [PRE-ACT] Read DESIGN.md & interface-design.md canonical contracts, Elite Frontend rules, DFII index & Deslop guidelines**

Review `interface-design.md`, `elite-frontend-architect` (distinctive visual stance, DFII $\ge 8$, UI/UX Pro Max rules: touch targets $\ge 44\times 44\text{px}$, `cursor-pointer`, zero emoji icons, stable hover states without layout shift, light/dark contrast parity), `architecture-frontend-design`, `frontend-design-deslop` (strategy-driven design, zero AI slop defaults, token-first rules), `ai-slop-cleaner` (lock behavior with regression tests first, inventory masking fallbacks, 4-pass deslop: Pass 1 Dead Code, Pass 2 Duplicates, Pass 3 Naming/Errors, Pass 4 Test Reinforcement), `DESIGN.md:1-88`, `GEMINI.md:19-29`, `frontend-ui-engineering`, and `ecc-frontend-patterns`.

- [ ] **Step 2: [ACT] Run individual package TypeScript runner checks**

Run: `pnpm check:mcp && pnpm check:plugins && pnpm check:canvas && pnpm check:editor && pnpm check:portal && pnpm check:renderer && pnpm check:export`
Expected: All package validation runners complete successfully with 0 contract errors.

- [ ] **Step 3: [ACT] Verify domain-specific validation suites**

Run: `pnpm check:knowledge && pnpm check:merge && pnpm check:citations && pnpm check:headless`
Expected: PASS with 0 failures across knowledge graph, merge engine, citation processing, and headless runners.

- [ ] **Step 4: [ACT] Audit CSS custom properties and frontend quality gates against interface-design.md**

Run: `pnpm check:frontend-quality`
Expected: PASS with 0 unapproved CSS custom properties, missing design tokens, or illegal UI inline style violations.

- [ ] **Step 5: [ACT] Audit Elite Frontend Architecture, React Component Patterns, Hooks Stability, DFII, Deslop & 4-Pass AI Slop Cleaner**

Verify UI components in `src/components/` and `packages/` follow:
1. Interface Design contract (`interface-design.md` compliance for density, tabular-nums on numeric columns, monospace on IDs/data).
2. DFII evaluation score $\ge 8$ (intentional local-first writing workspace tone, high feasibility, zero consistency risk).
3. PRE-ACT operator checklist & UI/UX Pro Max standards (`cursor-pointer` on all interactive controls, touch targets $\ge 44\times 44\text{px}$, light/dark contrast verified, zero emoji icons).
4. Composition over over-configuration & compound components (`Tabs`, `CardHeader`).
5. Custom hooks referential stability (`useQuery`/`useCallback` ref protection against infinite re-fetch loops).
6. Memoization & List Virtualization (`useMemo` for sorting/filtering, virtualized lists for long notes/search results).
7. Error Boundaries (`ErrorBoundary` wrapper around major workspace panels).
8. Full interactive state matrices (loading, empty, actionable error, mutation confirmation, cancellation).
9. Anti-slop directives in `DESIGN.md:23-31` (no purple/indigo AI gradients, no glassmorphism, no emojis as structural icons, Lucide React SVGs only, no layout-shifting hover transforms, no invented scores).
10. AI Slop Cleaner 4-Pass Protocol (Pass 1 Dead code deletion, Pass 2 Duplicate removal, Pass 3 Naming/error handling cleanup, Pass 4 Test reinforcement).
Expected: 0 UI slop violations or masking fallback hacks found in component architecture audit.

- [ ] **Step 6: [ACT] Run ESLint across entire repository with zero warnings allowed**

Run: `pnpm lint`
Expected: `eslint . --max-warnings=0` passes cleanly.

- [ ] **Step 7: [ACT] Run web application build and verify bundle graph**

Run: `pnpm build`
Expected: `tsc -b && vite build` succeeds and `bundle-graph.mjs` verifies bundle size limits.

- [ ] **Step 8: [VERIFY] Run ce-code-review gate, verify task criteria & commit review findings**

Run code review gate with `correctness-reviewer`, `maintainability-reviewer`, and `julik-frontend-races-reviewer` personas. Verify 0 P0/P1 defects and commit:

```bash
git add docs/reports/review/03-frontend-packages-review.md
git commit -m "docs: record frontend UI architecture, DFII score, React patterns, and AI slop cleaner review findings"
```

---

### Task 4: System Bridge, Daemon Integration & Agent Introspection Protocol Verification

**Files:**
- Modify: `docs/reports/review/04-daemon-smoke-integration-review.md` (Create review section)
- Test: `crates/system-bridge/src/process.rs`, `scripts/validation/tui-smoke.mjs`, `scripts/validation/daemon-smoke.mjs`, `scripts/validation/authorization-inventory.mjs`, `scripts/validation/container-smoke.ps1`, `crates/xtask`

- [ ] **Step 1: [PRE-ACT] Read process launch inventory, system bridge rules & Introspection Debugging protocol**

Review `scripts/validation/process-launch-inventory.json`, `crates/system-bridge/src/process.rs`, and `ecc-agent-introspection-debugging` (4-phase failure capture: Failure Capture $\rightarrow$ Root-Cause Diagnosis $\rightarrow$ Contained Recovery $\rightarrow$ Introspection Report).

- [ ] **Step 2: [ACT] Execute TUI smoke test**

Run: `pnpm check:tui`
Expected: Terminal UI smoke runner launches and terminates cleanly without errors.

- [ ] **Step 3: [ACT] Execute Daemon IPC smoke test**

Run: `pnpm check:daemon`
Expected: Daemon process starts, processes test IPC commands, and shuts down cleanly.

- [ ] **Step 4: [ACT] Audit process launch and authorization inventory**

Run: `pnpm check:authorization`
Expected: PASS with 100% coverage of spawned processes against `process-launch-inventory.json`.

- [ ] **Step 5: [ACT] Execute container smoke verification**

Run: `pnpm check:container`
Expected: Container environment build/run smoke script completes cleanly.

- [ ] **Step 6: [ACT] Run release smoke test via cargo xtask**

Run: `pnpm check:xtask`
Expected: `cargo xtask release-smoke` completes with 0 errors.

- [ ] **Step 7: [ACT] Run production dependency audit**

Run: `pnpm check:audit`
Expected: 0 high or critical security vulnerabilities reported in production dependencies.

- [ ] **Step 8: [VERIFY] Run ce-code-review gate, verify task criteria & commit review findings**

Run code review gate with `reliability-reviewer` and `security-reviewer` personas. Verify 0 P0/P1 defects and commit:

```bash
git add docs/reports/review/04-daemon-smoke-integration-review.md
git commit -m "docs: record daemon, smoke, and integration review findings"
```

---

### Task 5: End-to-End, Visual Ralph Verdict, Elite QA TDD & Accessibility (a11y) Review

**Files:**
- Modify: `docs/reports/review/05-e2e-visual-a11y-review.md` (Create review section)
- Test: `scripts/validation/a11y-smoke.mjs`, `scripts/validation/a11y-axe.mjs`, `playwright.e2e.config.ts`, `playwright.visual.config.ts`, `e2e/`, `e2e/pages/`, `scripts/screenshots/capture.ps1`

- [ ] **Step 1: [PRE-ACT] Read Playwright POM patterns, Visual Ralph verdict rules, Elite QA TDD Iron Law & WCAG 2.2 AA floor**

Review `elite-qa-architect` (TDD Iron Law: RED $\rightarrow$ Verify RED $\rightarrow$ GREEN $\rightarrow$ Verify GREEN $\rightarrow$ REFACTOR; 4-phase systematic debugging protocol; smart test error grouping), `visual-ralph` (Visual Ralph loop: approved reference $\rightarrow$ Visual Verdict `score >= 90` $\rightarrow$ secondary pixel diffs), `e2e-testing` & `ecc-e2e-testing` (Page Object Model in `e2e/pages/`, `data-testid` locators, network timing `waitForResponse`, screenshot/trace/video artifact management), `playwright.e2e.config.ts`, `playwright.visual.config.ts`, `DESIGN.md:56-70` (WCAG 2.2 AA floor), and `docs/validation/FRONTEND_QUALITY.md`.

- [ ] **Step 2: [ACT] Run standard accessibility (a11y) smoke test**

Run: `pnpm check:a11y`
Expected: PASS with 0 accessibility DOM structure violations.

- [ ] **Step 3: [ACT] Run automated axe-core WCAG 2.2 AA accessibility audit**

Run: `pnpm check:a11y-axe`
Expected: PASS with 0 critical or serious WCAG accessibility violations (focus containment, ARIA labels, target sizes, color contrast, roving tabIndex).

- [ ] **Step 4: [ACT] Audit Playwright E2E Suite Structure & Page Object Models**

Audit `e2e/` for:
1. Page Object Model pattern separation (`e2e/pages/WorkspacePage.ts`, `EditorPage.ts`, `CanvasPage.ts`).
2. Locator strategy (`data-testid` attributes over brittle CSS text selectors).
3. Explicit network timing stabilization (`waitForResponse` over arbitrary `waitForTimeout`).
4. Flaky test quarantine & retry strategies (`retries: 2` in CI, `test.fixme` logging).
5. E2E artifact collection (`artifacts/screenshots/`, `artifacts/videos/`, `artifacts/traces/`).
Expected: 0 POM structural gaps or anti-patterns found in E2E suite.

- [ ] **Step 5: [ACT] Execute Playwright End-to-End (E2E) test suite**

Run: `pnpm test:e2e`
Expected: All E2E test specs in `e2e/` pass cleanly across responsive viewports (`320`, `375`, `768`, `1024`, `1440` pixels).

- [ ] **Step 6: [ACT] Execute Playwright Visual Ralph regression comparison & snapshot capture suite**

Run: `pnpm test:visual`
Expected: All visual snapshot baseline comparisons match within Visual Ralph verdict tolerance (`score >= 90`) across light/dark themes and app surfaces.

- [ ] **Step 7: [VERIFY] Run ce-code-review gate, verify task criteria & commit review findings**

Run code review gate with `testing-reviewer` and `adversarial-reviewer` personas. Verify 0 P0/P1 defects and commit:

```bash
git add docs/reports/review/05-e2e-visual-a11y-review.md
git commit -m "docs: record E2E, Visual Ralph verdict, POM structure, and accessibility review findings"
```

---

### Task 6: Performance Budget, Measurement, `ce-optimize` & Benchmark Audit

**Files:**
- Modify: `docs/reports/review/06-performance-benchmarks-review.md` (Create review section)
- Test: `perf-baselines.json`, `scripts/benchmarks/check-baselines.mjs`, `scripts/benchmarks/startup.ps1`, `scripts/benchmarks/idle-memory.ps1`, `scripts/benchmarks/vault-scan.ps1`, `scripts/benchmarks/search.ps1`, `scripts/benchmarks/canvas-interaction.ps1`, `scripts/benchmarks/editor-latency.ps1`, `scripts/benchmarks/large-note-open.ps1`

- [ ] **Step 1: [PRE-ACT] Read performance budget, Core Web Vitals & ce-optimize guidelines**

Review `agent-skills-performance-optimization` 5-step workflow (Measure $\rightarrow$ Identify $\rightarrow$ Fix $\rightarrow$ Verify $\rightarrow$ Guard), `ce-optimize` (metric-driven iterative optimization loop, `.context/compound-engineering/ce-optimize/` scaffolding, CP-0 to CP-5 checkpoints), performance budgets (bundle size ratchet, startup < 1500ms, idle memory < 120MB, search query < 50ms), `perf-baselines.json`, and `performance-goal` contract rules.

- [ ] **Step 2: [ACT] Check current performance against historical baselines**

Run: `pnpm check:perf`
Expected: `node scripts/benchmarks/check-baselines.mjs` verifies memory and latency metrics are within `perf-baselines.json` limits.

- [ ] **Step 3: [ACT] Benchmark application startup performance**

Run: `pnpm bench:startup`
Expected: Cold and warm startup benchmark times printed and within target bounds (< 1500ms).

- [ ] **Step 4: [ACT] Benchmark desktop idle memory usage**

Run: `pnpm bench:idle-memory`
Expected: Idle RSS memory usage measured and under threshold (< 120MB).

- [ ] **Step 5: [ACT] Benchmark vault indexing scan performance**

Run: `pnpm bench:vault-scan`
Expected: Scan throughput measured across synthetic test vaults.

- [ ] **Step 6: [ACT] Benchmark search query latency**

Run: `pnpm bench:search`
Expected: Search query response time measured (< 50ms for 10k items).

- [ ] **Step 7: [ACT] Benchmark canvas interaction and snapshot performance**

Run: `pnpm bench:canvas`
Expected: Frame rendering time and canvas snapshot serialization benchmark results logged.

- [ ] **Step 8: [ACT] Benchmark editor latency and large note opening**

Run: `pnpm bench:editor-latency && pnpm bench:large-note`
Expected: Keypress-to-paint latency and 1MB+ file opening times measured and verified.

- [ ] **Step 9: [VERIFY] Run ce-code-review gate, record evaluator checkpoints & commit review findings**

Record evaluator pass checkpoints and commit:

```bash
git add docs/reports/review/06-performance-benchmarks-review.md
git commit -m "docs: record performance budget, measurement, and benchmark review findings"
```

---

### Task 7: Technical Diagrams (`archify`), Skill Surface, Press Release Synthesis & Harness Meta-Optimization (`meta-optimize`)

**Files:**
- Create: `docs/reports/COMPREHENSIVE-PROJECT-REVIEW.md`
- Create: `docs/reports/SKILL-SURFACE-AUDIT.md`
- Create: `docs/reports/PRESS-RELEASE-AUDIT-SUMMARY.md` (`press-release-writer` milestone summary)
- Create: `docs/architecture/scriptor-system-architecture.html` (`archify` architecture diagram)
- Create: `docs/architecture/scriptor-ipc-dataflow.html` (`archify` sequence/dataflow diagram)
- Test: `scripts/release/generate-sbom.mjs`, `scripts/release/create-receipt.mjs`, `scripts/release/verify-release-evidence.mjs`, `scripts/validation/release-hardening-contracts.test.mjs`, `scripts/release/signing-policy.test.mjs`

- [ ] **Step 1: [PRE-ACT] Review release security specifications, Archify diagram, Press Release Writer & meta-optimize rules**

Review `docs/RELEASE-SECURITY.md`, `docs/VERIFICATION.md`, `archify` diagram layout principles (standalone HTML/SVG, dark/light theme toggle, semantic nodes, zero external runtime dependencies), `press-release-writer` rules (universal structure, inverted pyramid, 5W1H lead in 25-35 words, factual boilerplate, zero banned marketing fluff), and `meta-optimize` (outer-loop harness optimization, usage trace analysis, SKILL.md prompt & parameter optimization proposals).

- [ ] **Step 2: [ACT] Generate Archify Interactive System Architecture & IPC Dataflow Diagrams**

Generate interactive technical diagrams:
1. `docs/architecture/scriptor-system-architecture.html` — System architecture map (`architecture` mode) documenting Tauri 2 shell, Rust kernel crates (`vault`, `indexer`, `citation`, `canvas`, `daemon`), system bridge sandbox, and TS monorepo packages.
2. `docs/architecture/scriptor-ipc-dataflow.html` — IPC sequence & dataflow map (`sequence`/`dataflow` mode) tracing Markdown note mutation, indexing, graph updates, and atomic Git commit pipeline.
Expected: HTML/SVG diagrams generated with dark/light theme toggles and zero diagnostics errors.

- [ ] **Step 3: [ACT] Audit project-local skill surface & run harness meta-optimization (`meta-optimize`)**

1. Audit `.agents/skills`, `.codex/skills`, and `skills/` for Scriptor. Document project skill recommendations (`scriptor-governance-audit`, `scriptor-rust-ipc-audit`, `scriptor-frontend-quality-audit`, `scriptor-release-security-audit`) in `docs/reports/SKILL-SURFACE-AUDIT.md`.
2. Analyze agent execution logs and propose harness optimizations for skill prompt scaffolding and convergence rules using `meta-optimize` rules (outputting proposals under `.aris/meta/pending/`).
Expected: Skill surface audit documented and meta-optimization report staged.

- [ ] **Step 4: [ACT] Synthesize Journalistic Press Release Milestone Announcement (`press-release-writer`)**

Write `docs/reports/PRESS-RELEASE-AUDIT-SUMMARY.md` following `press-release-writer` guidelines:
- Headline variants (data-driven, contrast, technical milestone).
- Dateline: `-- [LEAD]` 5W1H in 25-35 words.
- Executive quotes adding architectural insight.
- Factual boilerplate & media contact details.
Expected: Press release written in inverted pyramid structure with 0 banned marketing fluff phrases ("thrilled", "cutting-edge").

- [ ] **Step 5: [ACT] Run Multi-Persona Document Review (`ce-doc-review`) on Final Review Reports & Press Release**

Run `ce-doc-review` on `docs/reports/COMPREHENSIVE-PROJECT-REVIEW.md`, `docs/reports/SKILL-SURFACE-AUDIT.md`, and `docs/reports/PRESS-RELEASE-AUDIT-SUMMARY.md`.
Expected: Comprehensive review report and deliverables pass multi-persona document review.

- [ ] **Step 6: [ACT] Run Software Bill of Materials (SBOM) generator**

Run: `pnpm release:sbom`
Expected: CycloneDX SBOM file generated successfully in `dist/` or `artifacts/`.

- [ ] **Step 7: [ACT] Run release receipt creator and evidence verifier**

Run: `pnpm release:receipt && pnpm release:evidence:verify`
Expected: Receipt produced and evidence verification passes with 0 checksum or signature errors.

- [ ] **Step 8: [ACT] Run release hardening and signing policy test contracts**

Run: `pnpm check:release-hardening && pnpm check:release-signing`
Expected: All release security contract tests pass.

- [ ] **Step 9: [ACT] Synthesize review findings into final holistic report**

Run: `node -e "const fs = require('fs'); const files = fs.readFileSync ? fs.readdirSync('docs/reports/review').filter(f => f.endsWith('.md')) : []; const content = files.map(f => fs.readFileSync('docs/reports/review/' + f, 'utf8')).join('\n\n---\n\n'); fs.writeFileSync('docs/reports/COMPREHENSIVE-PROJECT-REVIEW.md', '# Scriptor Comprehensive Project Review Report\n\nDate: 2026-08-09\n\n' + content);"`
Expected: `docs/reports/COMPREHENSIVE-PROJECT-REVIEW.md` generated combining all sub-report sections.

- [ ] **Step 10: [VERIFY] Execute final ce-code-review multi-persona gate & commit**

Run full `/ce-code-review depth:full` across entire change set. Verify 0 P0/P1 unmitigated findings and commit:

```bash
git add docs/architecture/scriptor-system-architecture.html docs/architecture/scriptor-ipc-dataflow.html docs/reports/SKILL-SURFACE-AUDIT.md docs/reports/PRESS-RELEASE-AUDIT-SUMMARY.md docs/reports/COMPREHENSIVE-PROJECT-REVIEW.md
git commit -m "docs: publish Archify architecture diagrams, skill surface audit, press release synthesis, meta-optimization report, and comprehensive project review report"
```
