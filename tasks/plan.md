# Implementation Plan: Scriptor Frontend UI/UX Architecture, Deslop & Performance Overhaul

## Overview
Transform Scriptor’s interface into an anti-slop, high-craft, "operate" workspace built on a brutalist Space Mono aesthetic with vibrant green accents (`#22C55E`). The plan spans CodeNav 4-axis reconnaissance, C4 architecture mapping, accessibility and touch targets, 4-state matrix async handling, React rendering performance optimizations, 4-subagent review swarms, 5-axis code quality filters, sequential AI slop cleanup passes, and visual Playwright snapshot verification.

## Design System & Architecture Principles
- **DFII Scorecard:** Score `+13 / 15` (Aesthetic Impact +4, Context Fit +4, Implementation Feasibility +3, Performance Safety +3, Consistency Risk -1).
- **Aesthetic Essence:** *"Minimal Technical Block-Based Workspace"* (Space Mono font `wght@400;700`, `#0F172A` background, `#22C55E` CTA accent).
- **Signature Move:** Monospace Code-Density HUD & Raw Brutalist Chrome featuring visible keyboard shortcut badges (`⌘K`, `⌘\`, `⌘I`, `⌘G`).
- **Color Matrix (60-30-10):** Dominant slate background (60%), structured surface/borders (30%), emerald operational accent (10%).
- **Architecture Mapping:** C4 Model (`docs/architecture/c4-context.md` & `c4-container.md`) and 4-Axis Navigation (`codenav`).
- **A11y Floor:** WCAG 2.2 AA focus trapping (`aria-modal`, `Esc` key, roving `tabIndex`), 44x44px mobile touch targets, `will-change: transform` hardware acceleration.
- **Performance Doctrine:** 16ms render budget (React DevTools Profiler), ticking state isolation, `useCallback`/`useMemo` callback stabilization, leaf-node `'use client'` push, and `Promise.all` waterfall elimination.
- **Async Matrix:** Explicit Loading (skeleton shimmers), Empty, Error, and Success states for all asynchronous panels.
- **Quality Gates:** 4-Subagent Review Swarms (Intent, Security, Performance, Contracts), 5-Axis Quality Filter (<300 lines/PR), and 4-pass AI Slop Cleanup (Dead Code, Duplication, Naming, Test Reinforcement).

---

## Phase Breakdown & Checkpoints

### Phase 0: Codebase Onboarding & 4-Axis Navigation Reconnaissance
- [x] **Task 0.1: 4-Axis Navigation Baseline (`/codenav`)**
- [x] **Task 0.2: Generate `ONBOARDING.md` / `GEMINI.md`**

### Checkpoint: Reconnaissance & Conventions
- [x] `GEMINI.md` is under 100 lines and accurately reflects React & Vite testing conventions.

---

### Phase 0.5: C4 Architecture Documentation
- [x] **Task 0.5.1: C4 Context Diagram & Persona Mapping (`docs/architecture/c4-context.md`)**
- [x] **Task 0.5.2: C4 Container & Component Specifications (`docs/architecture/c4-container.md`)**

### Checkpoint: System Documentation
- [x] Mermaid diagrams validate cleanly and `c4-context.md` / `c4-container.md` exist.

---

### Phase 1: Strategy, Token System & Anti-Slop Safeguards
- [x] **Task 1.1: Authoritative Token Matrix Sync**
- [x] **Task 1.2: Establish Anti-Slop Directives**

### Checkpoint: Design System
- [x] `design-system/scriptor/MASTER.md` persisted and verified.

---

### Phase 2: App Shell, Craft Layer & Accessibility Floor
- [x] **Task 2.1: Enhance Keyboard Shortcut Discoverability (`AppTopBar.tsx`)**
- [x] **Task 2.2: Unified Panel Focus Management (`UnifiedPanelShell.tsx`)**
- [x] **Task 2.3: Mobile Touch Targets & Hardware Acceleration (`MobileWorkspaceNav.tsx`)**

### Checkpoint: Accessibility & Interaction
- [x] All interactive elements have `cursor-pointer` and minimum `44x44px` touch targets.
- [x] `Esc` key dismisses open panels and focus remains trapped.

---

### Phase 3: Async State Matrix Standardization
- [x] **Task 3.1: Git Panel State Matrix (`src/components/GitPanel.tsx`)**
- [x] **Task 3.2: Plugin & MCP Panels (`src/components/PluginPanel.tsx`, `src/components/McpPanel.tsx`)**

### Checkpoint: State Matrix
- [x] No blank screens or generic spinners; skeleton shimmers and actionable error boundaries present.

---

### Phase 3.5: React Component & Architecture Performance Optimization
- [x] **Task 3.5.1: Render Hotspot Profiling & Re-render Isolation**
- [x] **Task 3.5.2: Callback & Derived State Stabilization**
- [x] **Task 3.5.3: Component Tree Architecture & Falsy Guard Enforcement**

### Checkpoint: Performance
- [x] No re-render exceeds 16ms during interaction profiling; zero falsy `0`/`NaN` DOM artifacts.

---

### Phase 4: Swarm Review & 5-Axis Quality Gates
- [x] **Task 4.1: Launch Read-Only Review Swarm (`/review-swarm`)**
- [x] **Task 4.2: 5-Axis Code Quality Filter (`/code-review-and-quality`)**
- [x] **Task 4.3: Auto-Review Loop Execution (`/auto-review-loop`)**

### Checkpoint: Review Swarm
- [x] Swarm Review Score `>= 8/10` logged to `review-stage/AUTO_REVIEW.md`.

---

### Phase 4.5: Codebase AI Slop Cleanup & Smell Remediation
- [x] **Task 4.5.1: Regression Behavior Locking**
- [x] **Task 4.5.2: Fallback-Like Code Inventory & Classification**
- [x] **Task 4.5.3: Sequential 4-Pass Smell Remediation**
- [x] **Task 4.5.4: AI Slop Cleanup Report Generation (`docs/reports/AI_SLOP_CLEANUP.md`)**

### Checkpoint: Slop Cleanup
- [x] Zero dead exports, duplicate helpers, or silent masking fallbacks remaining.

---

### Phase 5: Final Visual Verification
- [x] **Task 5.1: Cross-Environment Playwright Snapshots**
- [x] **Task 5.2: Final TypeScript & Build Check (`tsc --noEmit`)**

### Checkpoint: Complete Definition of Done
- [x] `tsc --noEmit` returns 0 errors.
- [x] Playwright E2E and visual regression tests pass cleanly.

---

## Risks & Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| Focus trapping breaking drawer navigation | High | Use WCAG tested `aria-modal` primitives and test with screen reader / keyboard. |
| React memoization busting state synchronization | Medium | Ensure all `memo` components receive immutable props or stable callbacks. |
| Scope creep across panel components | Medium | Strictly bound PRs to < 300 lines of diff and run `/review-swarm` gates. |

## Open Questions
- None. All architectural decisions, design tokens, and review protocols are locked.
