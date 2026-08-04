# Tasks Todo List: Scriptor Frontend UI/UX Architecture, Deslop & Performance

## Task 0.1: 4-Axis Navigation Baseline (`/codenav`)

**Description:** Execute a 4-axis codebase navigation audit across temporal, structural, semantic, and precision dimensions to map workspace components.

**Acceptance criteria:**
- [x] Temporal axis: Git commit history surveyed for recent architectural changes.
- [x] Structural axis: Component hierarchy mapped using AST exploration.
- [x] Precision axis: Key component locations (`UnifiedPanelShell`, `GitPanel`, `MobileWorkspaceNav`) verified.

**Verification:**
- [x] `GEMINI.md` / `ONBOARDING.md` created with accurate project structural map.

**Dependencies:** None

**Files likely touched:**
- `GEMINI.md`

**Estimated scope:** Small (1 file)

---

## Task 0.2: Generate `ONBOARDING.md` / `GEMINI.md` (`/codebase-onboarding`)

**Description:** Generate a concise onboarding document for Scriptor outlining React conventions, folder structure, and testing scripts.

**Acceptance criteria:**
- [x] `GEMINI.md` created and under 100 lines.
- [x] Documents React 18, Vite, and Playwright verification scripts.

**Verification:**
- [x] File exists at project root and passes line count check.

**Dependencies:** Task 0.1

**Files likely touched:**
- `GEMINI.md`

**Estimated scope:** Small (1 file)

---

## Task 0.5.1: C4 Context Diagram & Persona Mapping (`/architecture-c4-model`)

**Description:** Document Scriptor system context, personas, external integrations, and high-level user journeys using Mermaid `C4Context` syntax.

**Acceptance criteria:**
- [x] User personas (Developer, Technical Writer, Agentic Auditor) defined.
- [x] External platform integrations (Git remotes, MCP servers, FS) mapped.
- [x] `docs/architecture/c4-context.md` contains valid Mermaid `C4Context` diagram.

**Verification:**
- [x] File `docs/architecture/c4-context.md` exists and Mermaid syntax renders cleanly.

**Dependencies:** Task 0.2

**Files likely touched:**
- `docs/architecture/c4-context.md`

**Estimated scope:** Small (1 file)

---

## Task 0.5.2: C4 Container & Component Specifications (`/architecture-c4-model`)

**Description:** Detail Scriptor's deployable containers and internal component boundaries using Mermaid `C4Container` diagrams.

**Acceptance criteria:**
- [x] Deployable units (Vite/React Frontend, MCP Gateway, Local Storage) documented.
- [x] Internal component boundaries (`AppShell`, `ChromeManager`, `PanelControllers`) detailed.
- [x] `docs/architecture/c4-container.md` created.

**Verification:**
- [x] File `docs/architecture/c4-container.md` exists and passes syntax validation.

**Dependencies:** Task 0.5.1

**Files likely touched:**
- `docs/architecture/c4-container.md`

**Estimated scope:** Small (1 file)

---

## Task 2.1: Enhance Keyboard Shortcut Discoverability (`/frontend-ui-engineering`)

**Description:** Add visible keyboard shortcut badges (`⌘K`, `⌘\`, `⌘I`, `⌘G`) to tooltips in `AppTopBar.tsx`.

**Acceptance criteria:**
- [x] Tooltips on top bar actions render stylized shortcut badges.
- [x] No visual regression or overflow in top bar layout.

**Verification:**
- [x] Manual verification in browser; `npm run build` passes cleanly.

**Dependencies:** Task 0.2

**Files likely touched:**
- `src/components/shell/AppTopBar.tsx`

**Estimated scope:** Small (1-2 files)

---

## Task 2.2: Unified Panel Focus Management (`/architecture-frontend-design`)

**Description:** Enforce WCAG 2.2 AA Focus Trapping, `aria-modal` attributes, `Esc` key dismissal, and roving `tabIndex` in `UnifiedPanelShell.tsx`.

**Acceptance criteria:**
- [x] Open panel traps keyboard focus; `Esc` key closes panel.
- [x] Roving `tabIndex` allows arrow key navigation across panel tabs.

**Verification:**
- [x] Keyboard navigation test (`Tab`, `Shift+Tab`, `ArrowKeys`, `Esc`).

**Dependencies:** Task 2.1

**Files likely touched:**
- `src/components/chrome/UnifiedPanelShell.tsx`

**Estimated scope:** Small (1-2 files)

---

## Task 2.3: Mobile Touch Targets & Hardware Acceleration (`/ui-ux-pro-max`)

**Description:** Ensure minimum 44x44px hit targets and apply hardware acceleration (`will-change: transform`, `transform: translate3d(0, 0, 0)`) in `MobileWorkspaceNav.tsx`.

**Acceptance criteria:**
- [x] All touch targets meet 44x44px minimum bounds.
- [x] Mobile drawer transitions render smoothly with hardware acceleration.

**Verification:**
- [x] Browser DevTools element inspection at 375px viewport width.

**Dependencies:** Task 2.2

**Files likely touched:**
- `src/components/shell/MobileWorkspaceNav.tsx`
- `src/styles/app/responsive.css`

**Estimated scope:** Small (2 files)

---

## Task 3.1: Git Panel State Matrix (`src/components/GitPanel.tsx`)

**Description:** Implement the 4-State Matrix (Loading skeleton, Empty clean tree, Error boundary with retry, Success state) in `GitPanel.tsx`.

**Acceptance criteria:**
- [x] Skeleton shimmer renders while loading Git status.
- [x] "Clean working tree" graphic renders when no changes exist.
- [x] Error boundary provides a working "Retry" trigger.

**Verification:**
- [x] Test GitPanel in loading, empty, error, and populated states.

**Dependencies:** Task 2.3

**Files likely touched:**
- `src/components/GitPanel.tsx`

**Estimated scope:** Medium (2-3 files)

---

## Task 3.2: Plugin & MCP Panels (`src/components/PluginPanel.tsx`, `src/components/McpPanel.tsx`)

**Description:** Implement 4-state matrix with lazy-discovery skeleton cards and empty state graphics for unconfigured server states.

**Acceptance criteria:**
- [x] Skeleton cards render during server/plugin discovery.
- [x] Empty state graphics appear for unconfigured MCP servers.

**Verification:**
- [x] Manual inspection of Plugin & MCP panels.

**Dependencies:** Task 3.1

**Files likely touched:**
- `src/components/PluginPanel.tsx`
- `src/components/McpPanel.tsx`

**Estimated scope:** Medium (3-4 files)

---

## Task 3.5.1: Render Hotspot Profiling & Re-render Isolation (`/react-component-performance`)

**Description:** Profile render hotspots with React DevTools; isolate ticking state into leaf components and wrap list rows with `React.memo`.

**Acceptance criteria:**
- [x] Component re-renders remain under 16ms during interaction profiling.
- [x] Leaf rows (`GitPanel` items, file lists) use `React.memo` with stable keys.

**Verification:**
- [x] Record Flamegraph trace in React DevTools; confirm < 16ms render duration.

**Dependencies:** Task 3.2

**Files likely touched:**
- `src/components/GitPanel.tsx`
- `src/components/chrome/UnifiedPanelShell.tsx`

**Estimated scope:** Medium (3-5 files)

---

## Task 3.5.2: Callback & Derived State Stabilization (`/architecture-react-nextjs`)

**Description:** Stabilize event handlers and derived collections using `useCallback` and `useMemo`; compute derived state during render.

**Acceptance criteria:**
- [x] Handler props maintain stable reference identity.
- [x] Zero redundant `useState` / `useEffect` synchronization loops.

**Verification:**
- [x] DevTools Profiler confirms zero unnecessary re-renders on parent state changes.

**Dependencies:** Task 3.5.1

**Files likely touched:**
- `src/components/shell/AppTopBar.tsx`
- `src/components/chrome/UnifiedPanelShell.tsx`

**Estimated scope:** Medium (3-4 files)

---

## Task 3.5.3: Component Tree Architecture & Falsy Guard Enforcement

**Description:** Push interactivity directives down to leaf nodes, parallelize async calls with `Promise.all`, and replace `&&` with ternary guards.

**Acceptance criteria:**
- [x] All boolean render guards use `condition ? <Comp /> : null`.
- [x] Zero `0` or `NaN` strings rendered into DOM.

**Verification:**
- [x] DOM inspection; automated component tests pass.

**Dependencies:** Task 3.5.2

**Files likely touched:**
- `src/components/**/*.tsx`

**Estimated scope:** Medium (4-5 files)

---

## Task 4.1: Launch Read-Only Review Swarm (`/review-swarm`)

**Description:** Trigger read-only review swarm across 4 axes (Intent, Security, Performance, Contracts) on completed UI changes.

**Acceptance criteria:**
- [x] Review Swarm sub-agents evaluate Phase 2-3 code.
- [x] All security and contract findings logged.

**Verification:**
- [x] Review Swarm report output generated.

**Dependencies:** Task 3.5.3

**Files likely touched:**
- None (Read-only analysis)

**Estimated scope:** Small (0 files)

---

## Task 4.2: 5-Axis Code Quality Filter (`/code-review-and-quality`)

**Description:** Evaluate changes against Correctness, Readability, Architecture, Security, and Performance. Enforce PR size < 300 lines.

**Acceptance criteria:**
- [x] Code changes verified against 5-axis criteria.
- [x] PR diff size stays under 300 lines.

**Verification:**
- [x] `git diff --stat` check.

**Dependencies:** Task 4.1

**Files likely touched:**
- Workspace files under review

**Estimated scope:** Small

---

## Task 4.3: Auto-Review Loop Execution (`/auto-review-loop`)

**Description:** Run automated review loop until Swarm Score hits `>= 8/10` and log output to `review-stage/AUTO_REVIEW.md`.

**Acceptance criteria:**
- [x] Swarm Score reaches `>= 8/10`.
- [x] `review-stage/AUTO_REVIEW.md` generated.

**Verification:**
- [x] Check `review-stage/AUTO_REVIEW.md` score and verdict.

**Dependencies:** Task 4.2

**Files likely touched:**
- `review-stage/AUTO_REVIEW.md`

**Estimated scope:** Small (1 file)

---

## Task 4.5.1: Regression Behavior Locking & Slop Inventory (`/ai-slop-cleaner`)

**Description:** Lock component behavior with targeted regression tests and inventory fallback-like code for remediation.

**Acceptance criteria:**
- [x] Behavioral regression tests added and passing.
- [x] Fallback-like code inventoried and classified.

**Verification:**
- [x] `npm test` passes cleanly before edits.

**Dependencies:** Task 4.3

**Files likely touched:**
- `tests/**/*.test.tsx`

**Estimated scope:** Medium (3-5 files)

---

## Task 4.5.2: Sequential 4-Pass Smell Remediation & Report (`/ai-slop-cleaner`)

**Description:** Execute 4 cleanup passes (Dead code, Duplication, Naming, Tests) and write `docs/reports/AI_SLOP_CLEANUP.md`.

**Acceptance criteria:**
- [x] Dead exports and duplicate helpers removed.
- [x] Silent masking fallbacks replaced with explicit error boundaries.
- [x] `docs/reports/AI_SLOP_CLEANUP.md` created with full audit summary.

**Verification:**
- [x] `npm test`, `npm run lint`, `tsc --noEmit` pass 100%.

**Dependencies:** Task 4.5.1

**Files likely touched:**
- `src/**/*.tsx`
- `docs/reports/AI_SLOP_CLEANUP.md`

**Estimated scope:** Medium (4-6 files)

---

## Task 5.1: Cross-Environment Playwright Snapshots & Final TypeScript Audit (`/visual-verdict`)

**Description:** Run Playwright visual regression snapshots across 320px–1440px viewports and verify 0 errors on `tsc --noEmit`.

**Acceptance criteria:**
- [x] Playwright visual tests pass across all target resolutions.
- [x] `node node_modules/typescript/bin/tsc --noEmit` returns 0 errors.

**Verification:**
- [x] Executed build and test commands pass with exit code 0.

**Dependencies:** Task 4.5.2

**Files likely touched:**
- `tests/e2e/*.spec.ts`

**Estimated scope:** Small (1-2 files)
