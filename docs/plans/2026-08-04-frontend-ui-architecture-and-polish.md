# Master Implementation Plan: Scriptor Frontend UI/UX Architecture, Deslop & Quality Engineering

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to execute this plan task-by-task. All steps use checkbox (`- [ ]`) syntax for progress tracking.

**Goal:** Transform Scriptor’s user interface into a world-class, high-craft, anti-slop "operate" workspace. Integrate robust design tokens, strict A11y floors, comprehensive Code Review & Quality Gates (5-Axis), and Swarm Review protocols for every architectural change.

---

## 🎨 Design Feasibility & Impact Index (DFII) Scorecard

| Axis | Score | Rationale |
|------|-------|-----------|
| **Aesthetic Impact** | `+4` | Monospace brutalist "Operate" workspace (Space Mono, `#0F172A`, `#22C55E`) provides instant visual distinction from generic SaaS templates. |
| **Context Fit** | `+4` | Local-first markdown knowledge workspace demands code-density, rapid keyboard discoverability, and clean technical boundaries. |
| **Implementation Feasibility** | `+3` | Built on pure CSS custom properties, React 18, Vite, and Lucide icons without bulky UI dependencies. |
| **Performance Safety** | `+3` | Enforces a strict `< 16ms` re-render budget, leaf-node state isolation, and `Promise.all` waterfall elimination. |
| **Consistency Risk** | `-1` | Managed via strict token system (`design-system/scriptor/MASTER.md`) and pre-commit anti-slop audits. |
| **Total DFII Score** | **`+13 / 15`** | **Pass (Target >= +8). Strong opinions, well-executed.** |

---

## 📐 Strategy, Identity & Anti-Slop Design System

### 1. Brand Adjectives & Aesthetic Essence
- **Adjectives:** Technical, Authoritative, Monospaced, Precise, Tactical.
- **Aesthetic Essence:** *"Minimal Technical Block-Based Workspace"* (Raw dark slate/charcoal backdrop, crisp borders, monospace typography, and vibrant green operational accents).
- **Signature Move:** Monospace Code-Density HUD & Raw Brutalist Chrome featuring visible keyboard shortcut badges (`⌘K`, `⌘\`, `⌘I`, `⌘G`) and glowing operational indicators.

### 2. OKLCH Color Distribution (60-30-10 Rule)
- **Dominant Field (60%):** `#0F172A` (Slate 900) - Deep, noise-textured background for zero eye fatigue.
- **Surface Structure (30%):** `#1E293B` (Slate 800) / `#334155` (Slate 700) - Elevated panels, clean borders (`#334155`), and subtle glassmorphic overlays.
- **Operational Accent (10%):** `#22C55E` (Emerald 500) - High-signal CTA buttons, status badges, active indicators, and shortcut highlights.
- **Typography:** Text Primary (`#F8FAFC`), Text Muted (`#94A3B8`), Text Faint (`#64748B`).

### 3. Typography & Spacing Hierarchy
- **Font Stack:** Primary Display & Monospace: **Space Mono** (`wght@400;700`), Body Fallback: System UI / Mono.
- **Type Scale Ratio:** 1.25 (Major Third): `11px` (micro), `12px` (caption/shortcut), `14px` (body), `18px` (h3/header), `22px` (h2), `28px` (h1).
- **Spacing Scale:** 4px, 8px, 12px, 16px, 24px, 32px, 48px.
- **Touch Targets:** Minimum `44x44px` hit areas on all interactive elements across desktop and mobile.

---

## 🚀 Phase Breakdown & Comprehensive Task Matrix

### 🚀 Phase 0: Codebase Onboarding & 4-Axis Navigation Reconnaissance
*Driven by: `/codebase-onboarding`, `/codenav`*

Before touching core UI components, establish codebase conventions, structural mapping, and 4-Axis navigation protocols to ensure all agents and developers share the same architectural context.

- [x] **Task 0.1: 4-Axis Navigation Baseline (`/codenav`)**
  - **Temporal Axis:** Audit git commit history to understand recent architectural decisions and churn.
  - **Structural Axis:** Map component call hierarchies and module dependencies using AST exploration (`graphify` / `codegraph`).
  - **Semantic Axis:** Query domain concepts across documentation to locate workspace state handlers.
  - **Precision Axis:** Pinpoint exact symbol definitions and line numbers for key components (`UnifiedPanelShell`, `GitPanel`, `MobileWorkspaceNav`).
- [x] **Task 0.2: Generate `ONBOARDING.md` / `GEMINI.md`**
  - Run directory reconnaissance (excluding `node_modules`, `dist`).
  - Map data flow (from Panel trigger to state hook to render).
  - Document strict naming conventions (`PascalCase` for components, `camelCase` for hooks).
  - **Verification:** `GEMINI.md` exists at project root under 100 lines, reflecting React 18, Vite, and Playwright testing scripts.

---

### 🏛️ Phase 0.5: C4 Architecture Documentation
*Driven by: `/architecture-c4-model`*

Formalize Scriptor's system boundaries, application containers, and component topologies using standard C4 Model diagrams and documentation.

- [x] **Task 0.5.1: C4 Context Diagram & Persona Mapping (`docs/architecture/c4-context.md`)**
  - Define user personas (Developer, Technical Writer, Agentic Auditor).
  - Map external platform integrations (Git remotes, MCP servers, Local File System).
  - Generate a `C4Context` Mermaid diagram illustrating high-level user journeys.
- [x] **Task 0.5.2: C4 Container & Component Specifications (`docs/architecture/c4-container.md`)**
  - Map deployable units (Vite/React Frontend, MCP Gateway, Local Storage / IndexedDB).
  - Detail internal component boundaries (`AppShell`, `ChromeManager`, `PanelControllers`, `StateHooks`).
  - Generate a `C4Container` Mermaid diagram defining IPC/HTTP data flows between containers.

---

### 🎨 Phase 1: Strategy, Token System & Anti-Slop Safeguards
*Driven by: `/frontend-design-deslop`, `/design-system-architect`, `/ui-ux-pro-max`*

- [x] **Task 1.1: Authoritative Token Matrix Sync**
  - Implement the `ui-ux-pro-max` generated Master Design System (`design-system/scriptor/MASTER.md`).
  - Adopt **Space Mono** (`wght@400;700`) as the primary brutalist/technical typography.
  - Apply the Strict Palette: Background (`#0F172A`), Text (`#F8FAFC`), Primary (`#1E293B`), Secondary (`#334155`), and CTA (`#22C55E`).
- [x] **Task 1.2: Establish Anti-Slop Directives**
  - Zero flat design without depth. Ensure 48px+ gaps and bold scroll-snap sections.
  - Zero emojis as UI icons (Lucide SVG only).
  - Hover transitions must run at strict `150ms-300ms` bounds with high color contrast shifts.

---

### 🛠 Phase 2: App Shell, Craft Layer & Accessibility Floor
*Driven by: `/frontend-ui-engineering`, `/architecture-frontend-design`, `/ui-ux-pro-max`*

- [x] **Task 2.1: Enhance Keyboard Shortcut Discoverability (`AppTopBar.tsx`)**
  - Add stylized, visible keyboard shortcut badges (`⌘K`, `⌘\`, `⌘I`, `⌘G`) inside custom tooltips.
  - Update `IconButton` in `WorkspaceChrome.tsx` to support a `shortcut` prop and `.custom-tooltip` popup.
  - Adjust topbar container overflow to `overflow: visible` to prevent tooltip clipping.
- [ ] **Task 2.2: Unified Panel Focus Management (`UnifiedPanelShell.tsx`)**
  - Update `src/components/chrome/UnifiedPanelShell.tsx`.
  - Enforce WCAG 2.2 AA Focus Trapping (`useFocusTrap`), `aria-modal` attributes, and `Esc` key dismissal (`useEscapeToClose`).
  - Implement roving `tabIndex` (`tabIndex={selected ? 0 : -1}`) for arrow-key (`ArrowRight`, `ArrowLeft`, `Home`, `End`) navigation across panel tabs.
- [ ] **Task 2.3: Mobile Touch Targets & Hardware Acceleration (`MobileWorkspaceNav.tsx`)**
  - Update `src/components/shell/MobileWorkspaceNav.tsx` and `src/styles/app/responsive.css`.
  - Ensure minimum `44x44px` hit targets on all navigation buttons and drawer triggers.
  - Apply `will-change: transform` and `transform: translate3d(0, 0, 0)` to mobile drawer transitions (150ms-300ms easing).

---

### 🔄 Phase 3: Async State Matrix Standardization
*Driven by: `/frontend-design`, `/ecc-frontend-patterns`, `/frontend-ui-engineering`*

Implement the strict "4-State Matrix" (Loading, Empty, Error, Success) across all asynchronous data surfaces. No blank screens or generic infinite spinners.

- [ ] **Task 3.1: Git Panel State Matrix (`src/components/GitPanel.tsx`)**
  - **Loading State:** Animated skeleton shimmer cards (`vault-skeleton`).
  - **Empty State:** "Clean working tree" graphic with clean status indicator.
  - **Error State:** Actionable error boundary with explicit "Retry" trigger.
  - **Success State:** Populated staging/commit list with crisp diff view triggers.
- [ ] **Task 3.2: Plugin & MCP Panels (`src/components/PluginPanel.tsx`, `src/components/McpPanel.tsx`)**
  - Implement lazy-discovery skeleton cards during initial load.
  - Implement empty state graphics for unconfigured server/plugin states.
  - Provide inline status indicators and clear toggle affordances.

---

### ⚡ Phase 3.5: React Component & Architecture Performance Optimization
*Driven by: `/react-component-performance`, `/architecture-react-nextjs`, `/elite-frontend-architect`*

Isolate render hotspots, eliminate async waterfalls, and enforce strict React rendering doctrine across all workspace components.

- [ ] **Task 3.5.1: Render Hotspot Profiling & Re-render Isolation**
  - Capture render baselines with **React DevTools Profiler**; ensure no component re-renders take > `16ms`.
  - Isolate ticking state (timers, status indicators, live counters) into dedicated leaf components so parent panels do not churn.
  - Wrap leaf rows and list items (`GitPanel` items, file trees) with `React.memo` using stable keys (never array indices).
- [ ] **Task 3.5.2: Callback & Derived State Stabilization**
  - Stabilize event handlers and derived collections using `useCallback` and `useMemo` to prevent prop-reference churn.
  - Eliminate redundant state: compute derived values during render rather than duplicating in `useState` or syncing via `useEffect`.
- [ ] **Task 3.5.3: Component Tree Architecture & Falsy Guard Enforcement**
  - Push interactivity directives (`'use client'`) down to the deepest leaf nodes requiring state or effects.
  - Eliminate async waterfalls in data fetching using `Promise.all` for parallel execution.
  - Replace risky boolean render guards (`condition && <Component />`) with explicit ternaries (`condition ? <Component /> : null`) to avoid rendering `0` or `NaN`.

---

### 🔎 Phase 4: Swarm Review & 5-Axis Quality Gates
*Driven by: `/review-swarm`, `/code-review-and-quality`, `/auto-review-loop`*

No code from Phases 2 and 3 is merged into `main` without passing the strict multi-agent review pipeline. Change sizing must remain small (< 300 lines per PR).

- [ ] **Task 4.1: Launch Read-Only Review Swarm (`/review-swarm`)**
  - Trigger `/review-swarm` on the UI changes.
  - **Sub-Agent 1 (Intent):** Verify exact visual alignment with Phase 1 tokens.
  - **Sub-Agent 2 (Security):** Ensure no DOM injection vulnerabilities or untrusted `innerHTML` in panel renders.
  - **Sub-Agent 3 (Performance):** Verify no N+1 re-renders during state transitions (React DevTools Profiler).
  - **Sub-Agent 4 (Contracts):** Ensure no breaking changes to existing `Vault` type signatures.
- [ ] **Task 4.2: 5-Axis Code Quality Filter (`/code-review-and-quality`)**
  - **Correctness:** Does it pass Playwright E2E?
  - **Readability:** Are abstractions earning their complexity? Strip out unused `temp` vars and dead code (Dead Code Hygiene).
  - **Architecture:** Do changes stay within `src/components/` without leaking into `src/lib/` improperly?
  - **Security & Performance:** Bundle size impact assessed (< 300 lines diff).
- [ ] **Task 4.3: Auto-Review Loop Execution (`/auto-review-loop`)**
  - Trigger `/auto-review-loop` (Difficulty: Medium/Hard) until the Swarm Score hits `>= 8/10` and Verdict is `Ready`.
  - **Verification:** Log output to `review-stage/AUTO_REVIEW.md`.

---

### 🧹 Phase 4.5: Codebase AI Slop Cleanup & Smell Remediation
*Driven by: `/ai-slop-cleaner`*

Systematically audit and clean up AI-generated slop, dead code, masking fallbacks, and over-abstracted wrappers using a tests-first, smell-by-smell workflow.

- [ ] **Task 4.5.1: Regression Behavior Locking**
  - Identify non-negotiable component behavior and run/add targeted unit and E2E regression tests before editing candidate files.
- [ ] **Task 4.5.2: Fallback-Like Code Inventory & Classification**
  - Audit codebase for quick hacks, swallowed errors, silent defaults, and masking shims.
  - Classify findings into *Masking Fallback Slop* vs *Grounded Compatibility Fallbacks*. Repair root causes or replace silent defaults with explicit error boundaries.
- [ ] **Task 4.5.3: Sequential 4-Pass Smell Remediation**
  - **Pass 1 (Dead Code):** Delete unused exports, dead branches, and obsolete debug leftovers.
  - **Pass 2 (Duplication):** Deduplicate copy-paste helpers and repeated layout structures.
  - **Pass 3 (Naming & Error Boundaries):** Clean up ambiguous identifier names and normalize exception handling.
  - **Pass 4 (Test Reinforcement):** Ensure edge cases and boundary conditions are covered.
- [ ] **Task 4.5.4: AI Slop Cleanup Report Generation**
  - Produce an evidence-dense report logging all simplifications, quality gate checks (Lint, Typecheck, Security), and changed files at `docs/reports/AI_SLOP_CLEANUP.md`.

---

### 🏁 Phase 5: Final Visual Verification & Definition of Done
*Driven by: `/visual-verdict`, Playwright visual tests*

- [ ] **Task 5.1: Cross-Environment Playwright Snapshots**
  - Run visual regression tests across: 320px, 768px, 1024px, 1440px widths.
  - Test Dark Mode vs Light Mode contrast.
  - Manually audit at 200% zoom to ensure structural readability.
- [ ] **Task 5.2: Final TypeScript & Build Check**
  - Run: `node node_modules/typescript/bin/tsc --noEmit`. Expected: 0 errors.
  - Run: `npm run build` or `pnpm build`. Expected: Clean exit code 0.

---

## 📋 Pre-Delivery & Anti-Slop Checklist

- [ ] **No Emoji Icons:** Structural UI uses SVGs (Lucide React) exclusively.
- [ ] **Cursor Pointer:** Added `cursor-pointer` to all interactive/clickable elements.
- [ ] **Touch Target Bounds:** Minimum 44x44px for touch targets on mobile viewports.
- [ ] **Render Budget:** All component re-renders complete in `< 16ms`.
- [ ] **Ternary Render Guards:** All conditional renders use `condition ? <Comp /> : null` (no falsy `0` / `NaN` leaks).
- [ ] **Diff Size Discipline:** All PRs stay under 300 lines of code change.
- [ ] **Zero TypeScript Errors:** `node node_modules/typescript/bin/tsc --noEmit` returns 0 errors.
