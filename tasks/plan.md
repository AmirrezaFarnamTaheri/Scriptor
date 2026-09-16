# Canonical Audit Backlog & Durability Remediation Implementation Plan

> **For agentic workers:** Sequential execution only; zero subagents (per project rules). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remediate verified P1 data-loss and state-race priorities (S-01, S-02, S-03), resolve critical authorization and layout defects (S-04, S-05), establish architectural disposition for disconnected features (S-06, S-07), and systematically fix responsive, viewport, and hierarchy defects established in the 184-item canonical audit backlog.

**Architecture:** Decouple pending persistence lifecycles from active view state using document-scoped write tracking (S-01) and synchronous flush guards on unmount (S-02); enforce monotonic generation tokens across asynchronous daemon and IPC boundaries to eliminate vault split-brain (S-03); repair component stylesheet imports and CSS grid column allocations (S-04, S-05); decouple prose word counting from raw Markdown syntax tokens; and reconcile responsive viewport ownership across desktop, 1024px tablet, and mobile screens.

**Tech Stack:** React 19.2.8, TypeScript 6.0.2, Vite 8.2.2, Tauri 2.5.0, Rust 1.96.0 (2024 edition), Playwright 1.63.0.

## Global Constraints

- **Execution Mode:** Sequential execution only. Subagents are strictly forbidden.
- **Completeness:** Zero placeholders, stubs, ellipses, or truncated code sections.
- **Line Budgets:** `src/App.tsx` must remain $\le 1950$ lines (baseline: 1903 lines).
- **Code Style & Integrity:** Preserve all existing comments and docstrings. Use existing architectural patterns (`coordinateNoteMutation`, `lifecycleGuardRef`, `usePersistedBoolean`, `UnifiedPanelShell`).
- **Safety Boundaries:**
  - *Always:* Run targeted tests and typecheck before marking tasks complete; maintain backward compatibility for persisted vault sessions.
  - *Ask First:* Modifying public IPC contracts in `crates/ipc/` or adding external dependencies.
  - *Never:* Commit credentials, delete public APIs, or suppress error diagnostics to force green test runs.

---

## Dependency Graph

```
[Phase 1: Critical Durability & State Safety]
  ├── Task 1.1: Document-Scoped Note Persistence Queue (S-01)
  ├── Task 1.2: Canvas Board Synchronous Flush on Unmount (S-02)
  └── Task 1.3: Monotonic Session Token for Headless Engine Vault Sync (S-03)
            │
            ▼
[Phase 2: Authorization & Layout Defects]
  ├── Task 2.1: MCP Authorization Stylesheet Wiring & High-Privilege Visual Hierarchy (S-04, P0-1, P0-2)
  ├── Task 2.2: Status Footer 3-Child Grid Alignment & Layout Stabilization (S-05, P1-6)
  └── Task 2.3: Bottom Dock Duplicate "Problems" & Tab Distribution (P1-4, P1-5, P2-9)
            │
            ▼
[Phase 3: Semantic Precision & Hierarchy Alignment]
  ├── Task 3.1: Semantic Prose Word Count & Reading Time Calculation (P1-38, P2-39)
  ├── Task 3.2: Extended Task State Checkbox Visual Semantics & Light Theme Contrast (P1-34, P2-36)
  ├── Task 3.3: Rendered Output vs. Inspector Rail Hierarchy Reordering (P1-23, P1-24, P2-25)
  └── Task 3.4: Disconnected Feature Disposition: Google Calendar & LaTeX (S-06, S-07)
            │
            ▼
[Phase 4: Viewport, Modal & Responsive Layout Overhaul]
  ├── Task 4.1: Tablet (1024px) 2-Rail Adaptive Recomposition (P1-14, P1-15, P1-16)
  ├── Task 4.2: Mobile Chrome Isolation & Touch Target Ergonomics (P1-10, P1-11, P1-12, P1-18)
  └── Task 4.3: Modal Viewport Bounds & Scroll Affordance: Settings & Publish Center (P1-69, P1-70, P1-87, P1-88)
            │
            ▼
[Phase 5: State Machine & Deep Investigation Hardening]
  ├── Task 5.1: Git Merge-Commit Exact Graph Reproduction Harness (S-08)
  └── Task 5.2: Backup-Restore Transactional Failure Injection & Recovery Verification (S-09)
```

---

## Phase 1: Critical Data Durability & State Safety

### Task 1.1: Document-Scoped Note Persistence Queue (S-01)

**Description:** In `src/hooks/useWorkspaceEditor.ts`, autosave timers and active note state are tied directly to active view refs (`activePathRef`, `activeNoteRef`, `draftMarkdownRef`). When switching notes via tabs, search, or wikilinks while typing, `loadNote` increments `navigationGenerationRef.current` and overwrites the active refs before debounced persistence completes. The scheduled callback later fails `isSaveRequestCurrent()` and silently drops the pending keystrokes. This task introduces an immutable document write queue where each pending write is keyed by `(vaultId, notePath)`. Tab switching or note unloading will either flush the pending write synchronously or transfer it to an active queue that persists independently of the visible note view.

**Acceptance Criteria:**
- [ ] Typing in Note A and immediately clicking Tab B within 100ms guarantees Note A's pending markdown is written to disk and indexed.
- [ ] Switching between Note A -> Note B -> Note A in rapid succession does not overwrite newer drafts with older in-flight responses.
- [ ] Closing a dirty tab immediately flushes the pending draft before tab removal or warns if save fails.
- [ ] `isSaveRequestCurrent` checks document identity `(vaultId, path, draftRevision)` rather than global `navigationGenerationRef`.

**Verification:**
- [ ] Unit/Integration test: `node --test scripts/validation/note-persistence-race.test.mjs` passes with concurrent typing, rapid tab switching, and delayed bridge responses.
- [ ] Typecheck: `pnpm check:contracts` succeeds.
- [ ] `pnpm check:governance` passes.

**Dependencies:** None.

**Files Likely Touched:**
- `src/hooks/useWorkspaceEditor.ts`
- `src/hooks/useTabStore.ts`
- `scripts/validation/note-persistence-race.test.mjs`

**Estimated Scope:** Medium (2-3 files).

---

### Task 1.2: Canvas Board Synchronous Flush on Unmount (S-02)

**Description:** In `src/hooks/useCanvasBoard.ts`, lines 61-67 cancel `saveTimer.current` on component unmount without saving. Closing the spatial canvas modal (`setCanvasOpen(false)`) within 400ms of adding, moving, or editing a card causes the pending modifications to be permanently discarded. This task updates `useCanvasBoard.ts` so that unmount invokes an immediate flush of any pending canvas document snapshot before disposal, and exposes a `flushPendingSave(): Promise<void>` method called by the modal close handler.

**Acceptance Criteria:**
- [ ] Adding or moving a card on the canvas followed by an immediate modal close preserves the updated board JSON on disk.
- [ ] Unmount cleanup executes `canvasSaveDocument` for any pending uncommitted dirty snapshot.
- [ ] If save fails during unmount or close, an activity log error is recorded and unmount is safely completed.
- [ ] CRDT pending edits flush synchronously on board teardown.

**Verification:**
- [ ] Unit/Integration test: `node --test scripts/validation/canvas-persistence-flush.test.mjs` passes with simulated rapid close after board mutations.
- [ ] Canvas suite: `pnpm check:canvas` passes.

**Dependencies:** None.

**Files Likely Touched:**
- `src/hooks/useCanvasBoard.ts`
- `src/components/CanvasPanel.tsx`
- `scripts/validation/canvas-persistence-flush.test.mjs`

**Estimated Scope:** Small (2 files).

---

### Task 1.3: Monotonic Session Token for Headless Engine Vault Sync (S-03)

**Description:** In `src/hooks/useHeadlessEngine.ts`, `useEffect` triggers `ensureDaemonReady().then(() => daemonOpenVault(vaultRootPath))` whenever `vaultRootPath` changes. During fast vault switching (Vault A -> Vault B), `cancelled = true` only guards the trailing `setDaemonVersion` call; `daemonOpenVault(vaultA)` is already dispatched and can resolve after `daemonOpenVault(vaultB)`. Furthermore, `src/bridge/commands/daemon.ts::daemonOpenVault` lacks promise serialization. This task adds a monotonic request ID and promise tail to `daemonOpenVault`, ensuring earlier vault openings cannot overwrite the active daemon vault out of order.

**Acceptance Criteria:**
- [ ] Switching rapidly between Vault A and Vault B guarantees the daemon opens Vault B last.
- [ ] `daemonOpenVault` in `src/bridge/commands/daemon.ts` serializes calls via a promise tail (`daemonOpenTail`).
- [ ] `useHeadlessEngine.ts` checks a monotonic session generation before and after every daemon operation.
- [ ] Unmount or rapid navigation aborts/ignores obsolete daemon responses.

**Verification:**
- [ ] Unit/Integration test: `node --test scripts/validation/headless-vault-race.test.mjs` passes under simulated network/IPC delays.
- [ ] Headless runner: `pnpm check:headless` passes.

**Dependencies:** None.

**Files Likely Touched:**
- `src/hooks/useHeadlessEngine.ts`
- `src/bridge/commands/daemon.ts`
- `scripts/validation/headless-vault-race.test.mjs`

**Estimated Scope:** Small (2-3 files).

---

## Checkpoint: Critical Durability & State Safety
- [ ] All 3 data durability regression test suites pass (`note-persistence-race`, `canvas-persistence-flush`, `headless-vault-race`).
- [ ] `pnpm check:contracts` and `pnpm check:governance` pass cleanly.
- [ ] Manual check: verify switching tabs while typing does not drop characters.

---

## Phase 2: Authorization & Layout Defects

### Task 2.1: MCP Authorization Stylesheet Wiring & High-Privilege Visual Hierarchy (S-04, Backlog P0-1, P0-2, P0-3)

**Description:** `src/styles/components/mcp-panel.css` defines the full grid layout for `.mcp-authorization`, `.mcp-mode-row`, and `.mcp-mode-option`, but is never imported into the application bundle. This causes authority level cards to render unstyled, fusing label and description into `OffNo MCP tool...`, `Read onlyTools...`, and `Approved writesApproved...`. In addition, `Approved writes` lacks appropriate visual gravity for a high-privilege write state, and narrow drawers suffer horizontal clipping. This task imports `mcp-panel.css` in `src/components/McpPanel.tsx`, fixes the active selection visual hierarchy, adds clear danger/accent tokens for `write-approved`, and enforces `min-width: 0` / responsive stacking for narrow drawers.

**Acceptance Criteria:**
- [ ] `mcp-panel.css` is imported in `src/components/McpPanel.tsx`.
- [ ] Authority option cards cleanly separate Title, Status Badge, and Description across all 4 modes (`off`, `read-only`, `draft`, `write-approved`).
- [ ] `write-approved` mode displays unambiguous visual gravity with high-contrast active styling (amber/red danger accent and explicit radio indicator).
- [ ] At narrow widths (<500px), MCP authority cards and metric grids stack cleanly without horizontal overflow.

**Verification:**
- [ ] Component test: `pnpm check:mcp` passes.
- [ ] Visual review: `pnpm exec playwright test e2e/mcp.spec.ts` passes without regressions.
- [ ] `pnpm check:frontend-quality` passes.

**Dependencies:** None.

**Files Likely Touched:**
- `src/components/McpPanel.tsx`
- `src/styles/components/mcp-panel.css`

**Estimated Scope:** Small (2 files).

---

### Task 2.2: Status Footer 3-Child Grid Alignment & Layout Stabilization (S-05, Backlog P1-6)

**Description:** In `src/styles/app/workspace-geometry-contract.css:378`, `.job-progress.is-done` declares `grid-template-columns: 18px auto;` (2 columns). However, `src/components/shell/WorkspaceStatusFooter.tsx:191-199` renders 3 children: `<CheckCircle2 />` (icon), `<strong>Index ready</strong>` (label), and `<small>4 notes</small>` (count). The third child wraps to row 2 in column 1 (18px), causing the text "4 notes" to break vertically and inflate the footer height. This task modifies the CSS and markup to group the text semantically (`.job-progress-text` or a 3-column track `18px auto auto`) with `white-space: nowrap` and flexible alignment.

**Acceptance Criteria:**
- [ ] `.job-progress.is-done` accommodates all 3 elements on a single horizontal row without vertical fragmentation.
- [ ] "Index ready" and "4 notes" stay horizontally aligned across all desktop, tablet, and mobile viewports.
- [ ] Height of `.job-progress.is-done` is strictly bounded to $\le 28$px.
- [ ] Layout scales properly when `lastRebuildMs` telemetry is displayed.

**Verification:**
- [ ] Verify rendered layout in test: `node --test scripts/validation/status-footer-grid.test.mjs`.
- [ ] Visual snapshot check: `pnpm exec playwright test e2e/screenshots.spec.ts --grep "workspace-ready"` passes.

**Dependencies:** None.

**Files Likely Touched:**
- `src/styles/app/workspace-geometry-contract.css`
- `src/styles/app/dock-settings.css`
- `src/components/shell/WorkspaceStatusFooter.tsx`

**Estimated Scope:** Small (2-3 files).

---

### Task 2.3: Bottom Dock Duplicate "Problems" & Tab Distribution (Backlog P1-4, P1-5, P2-7, P2-9)

**Description:** The bottom status bar currently renders "Problems 1" twice: once in the top summary trigger button (`jobs-button`), and again in the tab bar of `StatusDockPanel`. In addition, when Output is empty, the empty drawer consumes persistent layers, the standalone chevron lacks clear semantics, and drawer tabs have uneven distribution. This task refactors `WorkspaceStatusFooter.tsx` and `StatusDockPanel.tsx` to unify the problems indicator into a single semantic location, balance tab distribution, and auto-collapse empty output panels.

**Acceptance Criteria:**
- [ ] "Problems" badge appears once in the dock header/tab hierarchy, eliminating redundant adjacent counts.
- [ ] Empty output panels collapse gracefully rather than displaying an oversized blank area.
- [ ] Tab buttons (`Problems`, `Output`, `Search Results`, `Jobs`) use unified flex/grid spacing without excessive dead space.
- [ ] Chevron controls have explicit aria labels and unambiguous toggle ownership.

**Verification:**
- [ ] Run Playwright dock tests: `pnpm exec playwright test e2e/status-dock.spec.ts`.
- [ ] Governance checks: `pnpm check:governance`.

**Dependencies:** Task 2.2.

**Files Likely Touched:**
- `src/components/shell/WorkspaceStatusFooter.tsx`
- `src/components/StatusDockPanel.tsx`
- `src/styles/app/dock-settings.css`

**Estimated Scope:** Medium (3 files).

---

## Checkpoint: Authorization & Layout Defects
- [ ] MCP panel renders separate titles, descriptions, and high-contrast write-approved badge.
- [ ] Completed index status renders "Index ready · 4 notes" on one line without 18px column wrapping.
- [ ] No duplicate "Problems 1" in status footer.
- [ ] `pnpm check:governance` and visual reviews pass.

---

## Phase 3: Semantic Precision & Hierarchy Alignment

### Task 3.1: Semantic Prose Word Count & Reading Time Calculation (Backlog P1-38, P2-39)

**Description:** `packages/editor/src/adapter.ts::countWords()` currently counts maximal non-whitespace runs (`split(/\s+/)`), counting Markdown symbols like `#`, `---`, `* * *`, `|---|---|` as words. This inflates word count (e.g. `31 words` on a 15-word note) and distorts reading time in `useNoteDraftStats.ts`. This task implements a fast semantic word counter that strips Markdown formatting tokens (headings, horizontal rules, table fences, formatting markers) before counting alphanumeric word clusters, maintaining $O(N)$ single-pass performance.

**Acceptance Criteria:**
- [ ] Markdown headings (`# Title`), list markers (`- `, `1. `), blockquotes (`> `), horizontal rules (`---`), and table fences are not counted as prose words.
- [ ] CJK and alphanumeric words are accurately counted according to Unicode word boundaries.
- [ ] Single-pass performance is preserved without allocating large intermediate token arrays.
- [ ] `useNoteDraftStats.ts` derives reading time accurately from the semantic word count.

**Verification:**
- [ ] Test suite: `pnpm check:editor` passes.
- [ ] Unit test: `node --test packages/editor/src/adapter.test.ts` validates word count across complex Markdown fixtures.

**Dependencies:** None.

**Files Likely Touched:**
- `packages/editor/src/adapter.ts`
- `packages/editor/src/adapter.test.ts`
- `src/hooks/useNoteDraftStats.ts`

**Estimated Scope:** Small (2-3 files).

---

### Task 3.2: Extended Task State Checkbox Visual Semantics & Light Theme Contrast (Backlog P1-34, P2-36, P2-37)

**Description:** Extended task lists like `[/] In progress` are preprocessed in `packages/renderer/src/pipeline.ts:234` into `[ ] _In progress_ — ${body}`, rendering an unchecked standard checkbox that visually misrepresents the task as unstarted. Furthermore, light-theme checkboxes have faint borders. This task updates the renderer pipeline and CSS to assign an explicit data attribute or custom checkbox representation (`data-task-state="in-progress"` / indeterminate pseudo-class) and increases light-theme checkbox border contrast to meet WCAG AA (3:1 minimum against background).

**Acceptance Criteria:**
- [ ] `[/] task` renders with an in-progress/indeterminate visual indicator rather than a blank unchecked box.
- [ ] Source markdown remains unmutated; conversion is strictly presentation-only.
- [ ] Checkbox borders in light theme have a measured contrast ratio of at least 3:1 against the document background.
- [ ] Native markdown task toggling still targets the exact source line correctly.

**Verification:**
- [ ] Renderer test: `pnpm check:renderer` passes.
- [ ] Contrast check: computed styles verified via Playwright spec `e2e/accessibility.spec.ts`.

**Dependencies:** None.

**Files Likely Touched:**
- `packages/renderer/src/pipeline.ts`
- `src/styles/components/markdown-preview.css`
- `packages/renderer/src/validate-runner.ts`

**Estimated Scope:** Small (2-3 files).

---

### Task 3.3: Rendered Output vs. Inspector Rail Hierarchy Reordering (Backlog P1-23, P1-24, P2-25)

**Description:** In `src/components/InspectorRail.tsx`, selecting the `Rendered output` tab renders shared Inspector health/readiness cards *above* the actual preview content. Users selecting Rendered Output see Inspector diagnostics first, burying the preview below the fold. This task refactors `InspectorRail.tsx` so that tabpanel content is top-level and first in visual priority: when `Rendered output` is active, the document preview is immediately visible at the top, and shared summary metrics are relocated or subordinated to an expandable section.

**Acceptance Criteria:**
- [ ] When `Rendered output` is selected, the rendered document preview starts at the top of the rail without needing to scroll past health cards.
- [ ] When `Inspector` is selected, backlinks, outline, and health cards are immediately visible.
- [ ] Clear conceptual differentiation in copy and icons between Editor Split Preview and Inspector Rendered Output.
- [ ] Tab navigation follows standard ARIA tabpanel semantics.

**Verification:**
- [ ] Visual review: `pnpm exec playwright test e2e/screenshots.spec.ts --grep "inspector|preview"`.
- [ ] Component check: `pnpm check:frontend-quality`.

**Dependencies:** None.

**Files Likely Touched:**
- `src/components/InspectorRail.tsx`
- `src/styles/app/inspector.css`

**Estimated Scope:** Small (2 files).

---

### Task 3.4: Disconnected Feature Disposition: Google Calendar & LaTeX (S-06, S-07)

**Description:** `useGoogleCalendarSync.ts` and `useLatexCompiler.ts` exist with backend Tauri commands but have no caller in the application graph. Leaving disconnected code in the repository without explicit disposition invites architectural rot. This task establishes explicit architectural status:
1. Wire LaTeX compilation as an actionable menu option in the Export/Publish workflow (or note action menu) where users can trigger Tectonic/LaTeX builds for academic notes.
2. Formally document Google Calendar sync as an opt-in integration hook in settings/config with a clear toggle in `VaultConfigSettingsSection.tsx`, or isolate it behind an experimental flag with end-to-end caller wiring.

**Acceptance Criteria:**
- [ ] `useLatexCompiler` is connected to the note export or tools action menu with clear state feedback (idle, compiling, completed, error).
- [ ] Google Calendar sync hook is connected to Vault Settings with an explicit enable/disable toggle, or gated behind experimental settings.
- [ ] Zero disconnected root hooks remain unreferenced in `src/`.

**Verification:**
- [ ] Integration validation: `pnpm check:contracts` and `pnpm check:governance`.
- [ ] Bundle verification: `pnpm check:bundle` passes without orphaned root hooks.

**Dependencies:** None.

**Files Likely Touched:**
- `src/components/VaultConfigSettingsSection.tsx`
- `src/components/PublishCenter.tsx`
- `src/hooks/useLatexCompiler.ts`
- `src/hooks/useGoogleCalendarSync.ts`
- `src/App.tsx` (preserving $\le 1950$ line limit)

**Estimated Scope:** Medium (4 files).

---

## Checkpoint: Semantic Precision & Hierarchy Alignment
- [ ] Word count accurately reflects prose words without Markdown punctuation inflation.
- [ ] In-progress tasks have distinct visual styling from unchecked tasks.
- [ ] Rendered output displays preview at the top of the rail.
- [ ] LaTeX compiler and Calendar sync have explicit UI callers and clear documentation.

---

## Phase 4: Viewport, Modal & Responsive Layout Overhaul

### Task 4.1: Tablet (1024px) 2-Rail Adaptive Recomposition (Backlog P1-14, P1-15, P1-16, P2-17)

**Description:** At 1024px width (tablet), `src/styles/app/responsive.css` maintains all 3 desktop columns (sidebar, editor, inspector rail). This squeezes the editor down to ~350px, causes date controls to wrap into multiple broken lines (`Today · 2026-09- \n 16`), clips the right rail, and expands the bottom dock. This task updates responsive breakpoints between 820px and 1200px so that the workspace adopts an adaptive 2-rail layout (collapsing the right rail into a toggleable overlay drawer or hiding the sidebar by default), preventing column squeeze and date fragmentation.

**Acceptance Criteria:**
- [ ] At 1024px viewport width, the editor maintains a readable width ($\ge 580$px).
- [ ] Date picker control (`Today · YYYY-MM-DD`) renders on a single line without wrapping.
- [ ] Tab text for `Rendered output` does not wrap onto multiple lines.
- [ ] Right rail slides in as an overlay drawer or tab rather than crowding the main grid.

**Verification:**
- [ ] Responsive Playwright test at 1024x768: `pnpm exec playwright test e2e/responsive.spec.ts`.
- [ ] Visual regression snapshot update for tablet breakpoint.

**Dependencies:** Task 2.2.

**Files Likely Touched:**
- `src/styles/app/responsive.css`
- `src/styles/app/foundation.css`
- `src/components/chrome/WorkspaceTopBar.tsx`

**Estimated Scope:** Medium (3 files).

---

### Task 4.2: Mobile Chrome Isolation & Touch Target Ergonomics (Backlog P1-10, P1-11, P1-12, P1-18, P1-20)

**Description:** At mobile viewports (<820px), desktop chrome (the entire diagnostics dock and telemetry strip) leaks into the mobile view directly above the mobile navigation bar (`Vault / Write / Lens / Command`), creating two competing bottom navigation layers. Additionally, backlinks and editor content are obscured by the overlapping bottom stack, and touch targets across file rows and buttons are desktop-sized (<36px). This task suppresses desktop bottom chrome on mobile viewports, establishes clean viewport height reservations (`dvh` and safe-area insets), and ensures all interactive touch targets meet the 44x44px minimum recommendation.

**Acceptance Criteria:**
- [ ] Desktop diagnostics footer and dock are hidden on mobile viewports; mobile bottom navigation operates exclusively.
- [ ] Content areas (Editor, Inspector Backlinks) have full scroll clearance above the mobile navigation bar.
- [ ] File rows, sidebar actions, and toolbar icon buttons have minimum 44px touch target boundaries.
- [ ] 4-column health grid on mobile collapses into a 2x2 or 1-column responsive card layout.

**Verification:**
- [ ] Playwright mobile suite: `pnpm exec playwright test e2e/mobile.spec.ts` (iPhone / Android emulation).
- [ ] Accessibility check: `pnpm check:frontend-quality`.

**Dependencies:** Task 4.1.

**Files Likely Touched:**
- `src/styles/app/responsive.css`
- `src/styles/app/mobile.css`
- `src/components/shell/WorkspaceStatusFooter.tsx`
- `src/components/VaultSidebar.tsx`

**Estimated Scope:** Medium (3-4 files).

---

### Task 4.3: Modal Viewport Bounds & Scroll Affordance: Settings & Publish Center (Backlog P1-69, P1-70, P1-87, P1-88)

**Description:** In `src/components/SettingsPanel.tsx` and `src/components/PublishCenter.tsx`, modal content exceeds the viewport height without adequate scrolling affordance. In Settings, the "Save vault config" button is hidden below the fold with no visible scroll indicator, leading to the mistaken conclusion that settings cannot be saved. In Publish Center, the format grid overflows and cuts off Reveal.js. This task refactors modal containers to use sticky footer action bars for primary actions (Save, Export), explicit `max-height: min(90vh, 800px)`, and visible scroll shadows to indicate scrollable content.

**Acceptance Criteria:**
- [ ] Settings modal has a sticky footer with the "Save vault config" button and save status indicator always visible.
- [ ] Publish Center has a fixed action bar ensuring all export/publish triggers are accessible regardless of format list length.
- [ ] Scrollable modal bodies feature subtle top/bottom scroll fade indicators when overflow is present.
- [ ] Keyboard navigation (Tab/Shift+Tab) smoothly traverses form controls into the footer without trapping.

**Verification:**
- [ ] Component tests: `pnpm check:frontend-quality`.
- [ ] Visual review: `pnpm exec playwright test e2e/settings.spec.ts e2e/publish.spec.ts`.

**Dependencies:** None.

**Files Likely Touched:**
- `src/components/SettingsPanel.tsx`
- `src/components/VaultConfigSettingsSection.tsx`
- `src/components/PublishCenter.tsx`
- `src/styles/components/settings-panel.css`
- `src/styles/components/publish-center.css`

**Estimated Scope:** Medium (4-5 files).

---

## Checkpoint: Viewport, Modal & Responsive Layout Overhaul
- [ ] Tablet (1024px) view is clean, readable, and free of date wrapping.
- [ ] Mobile view has zero competing bottom nav layers and full scroll clearance.
- [ ] Settings modal Save button is sticky and unmistakable.
- [ ] All modals have visible scroll affordance.

---

## Phase 5: Deep Investigations & Hardening

### Task 5.1: Git Merge-Commit Exact Graph Reproduction Harness (S-08)

**Description:** The audit reported a potential Git merge-commit defect where parents or commit trees might be improperly constructed during automated sync or conflict resolution. However, the exact failure mechanism was unconfirmed. This task builds an isolated end-to-end Git test harness in `scripts/validation/git-merge-repro.mjs` that creates an actual temporary Git repository, injects divergent branches with both fast-forward and 3-way merge commits, triggers the desktop command bridge (`git_merge` / `git_commit`), and asserts that parents, tree hash, reflog, and commit graph remain strictly intact.

**Acceptance Criteria:**
- [ ] Automated reproduction script creates reproducible branching graphs (divergent, octopus, fast-forward, conflict).
- [ ] Verifies exact parent hash assignments on merge commits.
- [ ] Documents any discovered edge cases in `tasks/git-merge-report.md`.
- [ ] If defects exist, prescribes surgical fix in `crates/git/` or `apps/desktop/src-tauri/src/commands/git.rs`.

**Verification:**
- [ ] Execute harness: `node scripts/validation/git-merge-repro.mjs`.
- [ ] Git check: `pnpm test:rust:product` passes.

**Dependencies:** None.

**Files Likely Touched:**
- `scripts/validation/git-merge-repro.mjs`
- `crates/git/` (if fix required)
- `tasks/git-merge-report.md`

**Estimated Scope:** Medium (2 files).

---

### Task 5.2: Backup-Restore Transactional Failure Injection & Recovery Verification (S-09)

**Description:** The audit noted that backup-restore could potentially leave partial state if interrupted midway through extraction or replacement. This task creates a transactional failure injection suite (`scripts/validation/backup-restore-fault.test.mjs`) that simulates process crashes / IO errors at each phase of backup restoration (unzip, staging directory swap, metadata write), verifying that the target vault is either completely restored or cleanly rolled back to its pre-restore state without partial file leakage.

**Acceptance Criteria:**
- [ ] Failure injection before staging swap leaves existing vault 100% intact.
- [ ] Failure injection during atomic directory rename restores rollback backup cleanly.
- [ ] Corrupted backup ZIP archives are rejected before any filesystem modification.
- [ ] Rollback journal cleans up temporary files on subsequent startup.

**Verification:**
- [ ] Run fault injection suite: `node --test scripts/validation/backup-restore-fault.test.mjs`.
- [ ] Backup unit tests: `cargo test -p scriptor-vault backup`.

**Dependencies:** None.

**Files Likely Touched:**
- `scripts/validation/backup-restore-fault.test.mjs`
- `apps/desktop/src-tauri/src/commands/backup.rs`
- `crates/vault/src/backup.rs`

**Estimated Scope:** Medium (2-3 files).

---

## Final Quality Gate & Verification Checklist

Before marking the entire remediation complete:
- [ ] All unit, contract, and governance tests pass:
  - `pnpm check:contracts`
  - `pnpm check:governance`
  - `pnpm check:source`
- [ ] Rust crates compile and pass tests:
  - `pnpm check:rust`
  - `pnpm test:rust`
- [ ] Playwright visual review tests pass:
  - `pnpm screenshots:capture:web` or `npx playwright test e2e/screenshots.spec.ts --update-snapshots=none`
- [ ] `src/App.tsx` stays strictly $\le 1950$ lines.
- [ ] Zero placeholders or stubs exist across all touched files.
