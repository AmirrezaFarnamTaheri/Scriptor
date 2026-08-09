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
- [ ] Task 2: IPC Contracts, C4 Architecture, 4-Axis CodeNav, Code Topology & Rust Crates Review
  - **Description:** Generate C4 System Context (`c4-context.md`) and C4 Container (`c4-container.md`) specifications, run `ce-doc-review` on C4 docs, audit Rust workspace using CodeNav 4-axis navigation (Temporal, Structural, Semantic, Precision), Codemap hub blast-radius analysis, and `graphify-code-topology` (AST call graph, SQLite schema ER graphing, foreign key integrity `PRAGMA foreign_keys = ON`, index coverage), verify Rust-to-TS IPC contract generation, format checks, Clippy lints, Cargo Deny safety, backend service/repository separation (`ecc-backend-patterns`), `thiserror`/`anyhow` distinction, `unsafe` safety comments (`unsafe-safety-comment`), zero unwrap in production (`err-no-unwrap-prod`), no Tokio mutex across await (`async-no-lock-await`), and rust test suite execution following RARV execution & Karpathy guidelines.
  - **Acceptance criteria:**
    - [ ] `docs/architecture/c4-context.md` and `docs/architecture/c4-container.md` written with Mermaid C4 diagrams.
    - [ ] `ce-doc-review` passes multi-persona audit on C4 specs.
    - [ ] CodeNav 4-axis navigation, Codemap hub impact analysis, and SQLite schema integrity (`PRAGMA foreign_keys = ON`) verified.
    - [ ] `pnpm check:contracts` and `pnpm check:ts-rs` pass.
    - [ ] Rust safety & unwrap audit passes (0 unwrap in prod paths, 100% `// SAFETY:` coverage).
    - [ ] `cargo fmt --all --check` reports zero formatting diffs.
    - [ ] `cargo clippy --workspace --all-targets -- -D warnings` reports zero warnings.
    - [ ] `pnpm check:deny` passes zero advisory or license violations.
    - [ ] `pnpm test:rust` passes all unit and integration tests.
    - [ ] `ce-code-review` gate passes with 0 P0/P1 unmitigated findings.
  - **Verification:** `pnpm check:contracts && pnpm test:rust && pnpm check:deny`
  - **Dependencies:** Task 1
  - **Files likely touched:** `docs/architecture/c4-context.md`, `docs/architecture/c4-container.md`, `docs/reports/review/02-rust-ipc-engine-review.md`

## Phase 3: Frontend Architecture, Elite Frontend UI/UX, React Patterns, DFII, Deslop & AI Slop Cleaner Audit
- [ ] Task 3: Frontend Architecture, Elite Frontend UI/UX, Interface Design, DFII & Deslop Audit
  - **Description:** Evaluate DFII score ($\ge 8$), verify PRE-ACT UI operator checklist, UI/UX Pro Max rules & `interface-design.md` compliance (`cursor-pointer`, touch targets $\ge 44\times 44\text{px}$, zero emoji icons, stable hover states without layout shift, monospace for data/timestamps, `tabular-nums` for numeric columns), execute AI Slop Cleaner 4-pass protocol (Pass 1 Dead Code, Pass 2 Duplicates, Pass 3 Naming/Errors, Pass 4 Test Reinforcement), audit all TypeScript monorepo packages, run package validation scripts, check ESLint rules, CSS custom properties, custom hooks stability (`useQuery` ref protection against infinite re-fetch loops), list virtualization, error boundaries (`ErrorBoundary`), UI state matrices (loading/empty/error), component composition, zero AI slop defaults against `DESIGN.md:23-31`, and Vite build output following RARV execution & Karpathy guidelines.
  - **Acceptance criteria:**
    - [ ] `interface-design.md` compliance verified across UI components and data tables.
    - [ ] DFII score evaluated ($\ge 8$) and PRE-ACT UI operator checklist & UI/UX Pro Max rules verified.
    - [ ] AI Slop Cleaner 4-pass cleanup protocol executed with zero masking fallbacks remaining.
    - [ ] All package validation scripts (`check:mcp`, `check:plugins`, `check:canvas`, `check:editor`, `check:portal`, `check:renderer`, `check:export`) pass.
    - [ ] Domain runners (`check:knowledge`, `check:merge`, `check:citations`, `check:headless`) pass.
    - [ ] `pnpm check:frontend-quality` passes.
    - [ ] Component architecture & de-slop audit passes against `DESIGN.md:1-88` (0 unapproved hex colors, 0 sub-44px target violations, full state matrices).
    - [ ] `pnpm lint` (`eslint . --max-warnings=0`) passes.
    - [ ] `pnpm build` succeeds and bundle graph stays within size ratchet limits.
    - [ ] `ce-code-review` gate passes with 0 P0/P1 unmitigated findings.
  - **Verification:** `pnpm lint && pnpm build`
  - **Dependencies:** Task 2
  - **Files likely touched:** `docs/reports/review/03-frontend-packages-review.md`

## Phase 4: System Bridge, Daemon & Integration Verification
- [ ] Task 4: System Bridge, Daemon & Integration Verification
  - **Description:** Run terminal UI smoke, daemon IPC smoke, process authorization inventory audit, container smoke, release smoke via cargo xtask, and verify 4-phase failure capture protocol (`ecc-agent-introspection-debugging`) following RARV execution & Karpathy guidelines.
  - **Acceptance criteria:**
    - [ ] `pnpm check:tui` and `pnpm check:daemon` run and terminate cleanly.
    - [ ] `pnpm check:authorization` matches 100% of process launches against `process-launch-inventory.json`.
    - [ ] `pnpm check:container` and `pnpm check:xtask` pass.
    - [ ] `pnpm check:audit` reports 0 high/critical production vulnerabilities.
    - [ ] `ce-code-review` gate passes with 0 P0/P1 unmitigated findings.
  - **Verification:** `pnpm check:tui && pnpm check:daemon && pnpm check:authorization && pnpm check:xtask`
  - **Dependencies:** Task 3
  - **Files likely touched:** `docs/reports/review/04-daemon-smoke-integration-review.md`

## Phase 5: End-to-End, Visual Ralph Verdict, Elite QA TDD & Accessibility (a11y) Review
- [ ] Task 5: End-to-End, Visual Ralph Verdict, Elite QA TDD & Accessibility (a11y) Review
  - **Description:** Run accessibility smoke, axe-core WCAG 2.2 AA audit (`DESIGN.md:56-70`), audit Playwright Page Object Model structure (`e2e/pages/`), `data-testid` locators, network timing stability (`waitForResponse`), test artifact collection (`artifacts/screenshots/`, `artifacts/videos/`, `artifacts/traces/`), execute Playwright E2E suite across responsive breakpoints (320px, 375px, 768px, 1024px, 1440px), and Visual Ralph snapshot comparison tests (`score >= 90` threshold) enforcing TDD Iron Law and 4-phase systematic debugging following RARV execution & Karpathy guidelines.
  - **Acceptance criteria:**
    - [ ] TDD Iron Law (RED-GREEN-REFACTOR) & 4-phase systematic debugging guidelines verified.
    - [ ] Playwright Page Object Model structure and `data-testid` locators verified.
    - [ ] Test artifacts setup verified (`artifacts/screenshots/`, `artifacts/videos/`, `artifacts/traces/`).
    - [ ] Visual Ralph verdict score $\ge 90$ verified against snapshot baselines (`playwright.visual.config.ts`).
    - [ ] `pnpm check:a11y` and `pnpm check:a11y-axe` pass with zero WCAG 2.2 AA violations.
    - [ ] `pnpm test:e2e` passes all end-to-end specifications.
    - [ ] `pnpm test:visual` matches visual snapshot verdict baselines within tolerance.
    - [ ] `ce-code-review` gate passes with 0 P0/P1 unmitigated findings.
  - **Verification:** `pnpm check:a11y && pnpm check:a11y-axe && pnpm test:e2e && pnpm test:visual`
  - **Dependencies:** Task 4
  - **Files likely touched:** `docs/reports/review/05-e2e-visual-a11y-review.md`

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
