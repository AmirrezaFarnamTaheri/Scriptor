# Task List: Scriptor Comprehensive Project Review (Final Master Edition)

## Phase 1: Governance, Interface Design & Repository Contracts
- [x] Task 1: Governance, Onboarding, Interface Design & Document Review Verification
  - **Description:** Publish `interface-design.md`, run multi-persona document review (`ce-doc-review`), run version alignment, action pin linting, module boundary checks, i18n parity, docs contracts, onboarding guide verification (`docs/ONBOARDING.md`, `GEMINI.md`), and source contract verification scripts following RARV execution & Karpathy guidelines.
  - **Acceptance criteria:**
    - [x] `interface-design.md` published detailing utilitarian desktop UI design system contract.
    - [x] `ce-doc-review` passes multi-persona document audit on planning and onboarding docs.
    - [x] `docs/ONBOARDING.md` and `GEMINI.md` are valid and up to date.
    - [x] `pnpm version:check` passes with zero version mismatches.
    - [x] `pnpm lint:actions` passes with zero unpinned GitHub actions.
    - [x] `pnpm lint:boundaries` passes with zero cross-boundary violations.
    - [x] `pnpm check:i18n` passes with 100% key parity.
    - [x] `pnpm check:docs` and `pnpm check:source` pass cleanly.
    - [x] `ce-code-review` gate passes with 0 P0/P1 unmitigated findings.
  - **Verification:** `pnpm check:governance`
  - **Dependencies:** None
  - **Files likely touched:** `interface-design.md`, `docs/reports/review/01-governance-contracts-review.md`

## Phase 2: Rust Crates, C4 Architecture, Code Topology & IPC Engine Review
- [x] Task 2: IPC Contracts, C4 Architecture, 4-Axis CodeNav, Code Topology & Rust Crates Review
  - **Description:** Generate C4 System Context (`c4-context.md`) and C4 Container (`c4-container.md`) specifications, run `ce-doc-review` on C4 docs, audit Rust workspace using CodeNav 4-axis navigation (Temporal, Structural, Semantic, Precision), Codemap hub blast-radius analysis, and `graphify-code-topology` (AST call graph, SQLite schema ER graphing, foreign key integrity `PRAGMA foreign_keys = ON`, index coverage), verify Rust-to-TS IPC contract generation, format checks, Clippy lints, Cargo Deny safety, backend service/repository separation (`ecc-backend-patterns`), `thiserror`/`anyhow` distinction, `unsafe` safety comments (`unsafe-safety-comment`), zero unwrap in production (`err-no-unwrap-prod`), no Tokio mutex across await (`async-no-lock-await`), and rust test suite execution following RARV execution & Karpathy guidelines.
  - **Acceptance criteria:**
    - [x] `docs/architecture/c4-context.md` and `docs/architecture/c4-container.md` written with Mermaid C4 diagrams.
    - [x] `ce-doc-review` passes multi-persona audit on C4 specs.
    - [x] CodeNav 4-axis navigation, Codemap hub impact analysis, and SQLite schema integrity (`PRAGMA foreign_keys = ON`) verified.
    - [x] `pnpm check:contracts` and `pnpm check:ts-rs` pass.
    - [x] Rust safety & unwrap audit passes (0 unwrap in prod paths, 100% `// SAFETY:` coverage).
    - [x] `cargo fmt --all --check` reports zero formatting diffs.
    - [x] `cargo clippy --workspace --all-targets -- -D warnings` reports zero warnings.
    - [x] `pnpm check:deny` passes zero advisory or license violations.
    - [x] `pnpm test:rust` passes all unit and integration tests.
    - [x] `ce-code-review` gate passes with 0 P0/P1 unmitigated findings.
  - **Verification:** `pnpm check:contracts && pnpm test:rust && pnpm check:deny`
  - **Dependencies:** Task 1
  - **Files likely touched:** `docs/architecture/c4-context.md`, `docs/architecture/c4-container.md`, `docs/reports/review/02-rust-ipc-engine-review.md`

## Phase 3: Frontend Architecture, Design System, UI/UX & Deslop Audit
- [x] Task 3: Frontend Architecture, Elite Frontend UI/UX, Interface Design, DFII & Deslop Audit
  - **Description:** Audit frontend architecture (`ecc-frontend-patterns`), design system contracts (`DESIGN.md`, `interface-design.md`), DFII (Deslop & Anti-Slop) criteria (`ai-slop-cleaner`), 4-Pass AI Slop Cleaner, run individual package runner checks (`check:mcp`, `check:plugins`, `check:canvas`, `check:editor`, `check:portal`, `check:renderer`, `check:export`), domain-specific validation runners (`check:knowledge`, `check:merge`, `check:citations`, `check:headless`), verify CSS custom property usage against tokens (`pnpm check:frontend-quality`), run ESLint across workspace (`pnpm lint`), and verify production web application build (`pnpm build`).
  - **Acceptance criteria:**
    - [x] Pre-act read of `DESIGN.md`, `interface-design.md`, and design token contracts completed.
    - [x] Package TS validation runners (`check:mcp`, `check:plugins`, `check:canvas`, `check:editor`, `check:portal`, `check:renderer`, `check:export`) pass cleanly.
    - [x] Domain-specific validation runners (`check:knowledge`, `check:merge`, `check:citations`, `check:headless`) pass cleanly.
    - [x] `pnpm check:frontend-quality` reports zero undefined CSS custom property references.
    - [x] DFII & 4-Pass AI Slop Cleaner audit confirms zero slop, zero orphan styles, and clean React component state/hooks discipline.
    - [x] `pnpm lint` passes with `--max-warnings=0`.
    - [x] `pnpm build` produces optimized web bundle within budget limits.
    - [x] `ce-code-review` gate passes with 0 P0/P1 unmitigated findings.
  - **Verification:** `pnpm lint && pnpm build`
  - **Dependencies:** Task 2
  - **Files likely touched:** `docs/reports/review/03-frontend-packages-review.md`

## Phase 4: Quality Assurance & Playwright E2E Test Infrastructure Review
- [x] Task 4: Quality Assurance, Playwright E2E Suites & Test Infrastructure Review
  - **Description:** Pre-act read of `playwright.config.ts`, `e2e/fixtures/`, `e2e/pages/`, `e2e-testing`, and QA Architect rules, audit Page Object Model (POM) separation, locator resilience (`data-testid`, zero fragile XPath), fixture teardown hygiene, auto-waiting patterns, run Playwright test suite (`pnpm test:e2e`), verify zero flaky/failed specs, and inspect trace recording & HTML report integrity following RARV execution & Karpathy guidelines.
  - **Acceptance criteria:**
    - [x] Pre-act read of `playwright.e2e.config.ts`, `e2e/fixtures/`, `e2e/pages/`, and QA rules completed.
    - [x] POM abstraction and `data-testid` locator resilience verified across all spec files.
    - [x] `pnpm test:e2e` passes with zero failed or flaky specs.
    - [x] Artifact cleanup, trace recording, and HTML report policies verified.
    - [x] `ce-code-review` gate passes with 0 P0/P1 unmitigated findings.
  - **Verification:** `pnpm check:tui && pnpm check:daemon && pnpm check:authorization && pnpm check:xtask`
  - **Dependencies:** Task 3
  - **Files likely touched:** `docs/reports/review/04-daemon-smoke-integration-review.md`

## Phase 5: System Bridge, Daemon & Integration Verification
- [x] Task 5: System Bridge, Daemon IPC & Integration Verification
  - **Description:** Run terminal UI smoke, daemon IPC smoke, process authorization inventory audit, container smoke, release smoke via cargo xtask, and verify 4-phase failure capture protocol (`ecc-agent-introspection-debugging`) following RARV execution & Karpathy guidelines.
  - **Acceptance criteria:**
    - [x] `pnpm check:tui` and `pnpm check:daemon` run and terminate cleanly.
    - [x] Process launch authorization matches 100% against `process-launch-inventory.json`.
    - [x] `pnpm check:xtask` (`cargo xtask release-smoke`) passes.
    - [x] `pnpm check:audit` reports 0 high/critical production vulnerabilities.
    - [x] `ce-code-review` gate passes with 0 P0/P1 unmitigated findings.
  - **Verification:** `pnpm check:tui && pnpm check:daemon && pnpm check:authorization && pnpm check:xtask && pnpm check:audit`
  - **Dependencies:** Task 4
  - **Files likely touched:** `docs/reports/review/05-system-bridge-daemon-review.md`

## Phase 6: Performance Budget, Measurement, `ce-optimize` & Benchmark Audit
- [ ] Task 6: Performance Budget, Measurement, `ce-optimize` & Benchmark Audit (`agent-skills-performance-optimization` & `performance-goal`)
  - **Description:** Execute the 5-step Measure-Identify-Fix-Verify-Guard performance workflow. Set up `ce-optimize` disk checkpoints (`.context/compound-engineering/ce-optimize/`), benchmark startup speed, idle memory usage, vault indexing, search latency, canvas rendering, editor latency, and large note opening against performance budgets and `perf-baselines.json` following RARV execution & Karpathy guidelines.
  - **Acceptance criteria:**
    - [ ] `ce-optimize` disk checkpoints (CP-0 to CP-5) and baseline metric logging established.
    - [ ] `pnpm check:perf` verifies metrics against `perf-baselines.json`.
    - [ ] `pnpm bench:startup` measures startup < 1500ms.
    - [ ] `pnpm bench:idle-memory` measures idle RSS < 120MB.
    - [ ] `pnpm bench:vault-scan`, `bench:search`, `bench:canvas`, `bench:editor-latency`, and `bench:large-note` complete and log benchmark data.
    - [ ] `ce-code-review` gate passes with 0 P0/P1 unmitigated findings.
  - **Verification:** `pnpm check:perf && pnpm bench:startup && pnpm bench:idle-memory`
  - **Dependencies:** Task 5
  - **Files likely touched:** `docs/reports/review/06-performance-benchmarks-review.md`

## Phase 7: Technical Diagrams (`archify`), Skill Surface, Press Release Synthesis & Harness Meta-Optimization (`meta-optimize`)
- [ ] Task 7: Technical Diagrams (`archify`), Skill Surface, Press Release Synthesis (`press-release-writer`) & Harness Meta-Optimization (`meta-optimize`) Synthesis
  - **Description:** Generate Archify interactive technical diagrams (`scriptor-system-architecture.html`, `scriptor-ipc-dataflow.html`), audit project skill surface (`project-skill-audit`), synthesize journalistic press release summary (`press-release-writer`), run `ce-doc-review` on report deliverables, execute `meta-optimize` harness analysis (staging prompt & parameter diff proposals in `.aris/meta/pending/`), generate CycloneDX SBOM, release receipt, verify release evidence, run hardening/signing policy tests, and synthesize top-level audit reports.
  - **Acceptance criteria:**
    - [ ] Archify diagrams generated (`scriptor-system-architecture.html`, `scriptor-ipc-dataflow.html`).
    - [ ] Project skills audit completed and documented in `docs/reports/SKILL-SURFACE-AUDIT.md`.
    - [ ] Press release synthesis document published to `docs/reports/PRESS-RELEASE-AUDIT-SUMMARY.md`.
    - [ ] `ce-doc-review` passes multi-persona document audit on reports.
    - [ ] `meta-optimize` harness proposals staged under `.aris/meta/pending/`.
    - [ ] `pnpm release:sbom` and `pnpm release:receipt` execute successfully.
    - [ ] `pnpm release:evidence:verify`, `check:release-hardening`, and `check:release-signing` pass.
    - [ ] Synthesized report published to `docs/reports/COMPREHENSIVE-PROJECT-REVIEW.md`.
    - [ ] Final `ce-code-review depth:full` gate passes with 0 P0/P1 unmitigated findings.
  - **Verification:** `pnpm release:evidence:verify && pnpm check:release-hardening`
  - **Dependencies:** Task 6
  - **Files likely touched:** `docs/architecture/scriptor-system-architecture.html`, `docs/architecture/scriptor-ipc-dataflow.html`, `docs/reports/SKILL-SURFACE-AUDIT.md`, `docs/reports/PRESS-RELEASE-AUDIT-SUMMARY.md`, `docs/reports/COMPREHENSIVE-PROJECT-REVIEW.md`
