# Remediation Task Checklist

## Phase 1: Critical Data Durability & State Safety

- [x] **Task 1.1: Document-Scoped Note Persistence Queue (S-01)**
  - [x] Implement document-scoped write tracking by `(vaultId, notePath)` in `src/hooks/useWorkspaceEditor.ts`
  - [x] Flush or preserve dirty drafts on tab switch / note navigation
  - [x] Add `scripts/validation/note-persistence-race.test.mjs` test harness
  - [x] Verify: `node --test scripts/validation/note-persistence-race.test.mjs`
  - [x] Verify: `pnpm check:contracts`

- [x] **Task 1.2: Canvas Board Synchronous Flush on Unmount (S-02)**
  - [x] Update `src/hooks/useCanvasBoard.ts` unmount cleanup to flush pending saves
  - [x] Expose and call `flushPendingSave` in `src/components/CanvasPanel.tsx` on modal close
  - [x] Add `scripts/validation/canvas-persistence-flush.test.mjs` test harness
  - [x] Verify: `pnpm check:canvas` and `node --test scripts/validation/canvas-persistence-flush.test.mjs`

- [x] **Task 1.3: Monotonic Session Token for Headless Engine Vault Sync (S-03)**
  - [x] Add monotonic request ID guards to `src/hooks/useHeadlessEngine.ts`
  - [x] Add `daemonOpenTail` promise serialization in `src/bridge/commands/daemon.ts`
  - [x] Add `scripts/validation/headless-vault-race.test.mjs` test harness
  - [x] Verify: `pnpm check:headless` and `node --test scripts/validation/headless-vault-race.test.mjs`

- [x] **Checkpoint: Durability Gate**
  - [x] All Phase 1 tests pass
  - [x] `pnpm check:governance` passes

---

## Phase 2: Authorization & Layout Defects

- [x] **Task 2.1: MCP Authorization Stylesheet Wiring & High-Privilege Visual Hierarchy (S-04, P0-1, P0-2, P0-3)**
  - [x] Import `src/styles/components/mcp-panel.css` in `src/components/McpPanel.tsx`
  - [x] Separate Title, Status Badge, and Description layout in `.mcp-mode-option`
  - [x] Enhance `write-approved` visual gravity with danger/warning tokens
  - [x] Fix narrow-width horizontal clipping in `src/styles/components/mcp-panel.css`
  - [x] Verify: `pnpm check:mcp` and `pnpm exec playwright test --config playwright.e2e.config.ts e2e/mcp.spec.ts`

- [x] **Task 2.2: Status Footer 3-Child Grid Alignment & Layout Stabilization (S-05, P1-6)**
  - [x] Fix `.job-progress.is-done` CSS grid in `src/styles/app/workspace-geometry-contract.css`
  - [x] Group label and count into single row with `white-space: nowrap`
  - [x] Verify: `node --test scripts/validation/status-footer-grid.test.mjs` and `pnpm exec playwright test --config playwright.e2e.config.ts e2e/shell-remediation.spec.ts`

- [x] **Task 2.3: Bottom Dock Duplicate "Problems" & Tab Distribution (P1-4, P1-5, P2-7, P2-9)**
  - [x] Remove duplicate "Problems 1" badge in `src/components/shell/WorkspaceStatusFooter.tsx`
  - [x] Collapse empty output panels in `src/components/StatusDockPanel.tsx`
  - [x] Normalize tab spacing and chevron controls in `src/styles/app/dock-settings.css`
  - [x] Verify: `node --test scripts/validation/status-footer-grid.test.mjs` and `pnpm exec playwright test --config playwright.e2e.config.ts e2e/frontend-polish-regressions.spec.ts`

- [x] **Checkpoint: Authorization & Layout Gate**
  - [x] MCP mode titles and descriptions are distinct and styled
  - [x] "Index ready · 4 notes" renders horizontally without wrapping
  - [x] Problems counter is unified and singular

---

## Phase 3: Semantic Precision & Hierarchy Alignment

- [x] **Task 3.1: Semantic Prose Word Count & Reading Time Calculation (P1-38, P2-39)**
  - [x] Implement Markdown formatting token stripper in `packages/editor/src/adapter.ts`
  - [x] Update `countWords()` to count semantic prose words instead of syntax tokens
  - [x] Verify reading time calculation in `src/hooks/useNoteDraftStats.ts`
  - [x] Verify: `pnpm check:editor` and unit tests in `packages/editor/src/adapter.test.ts`

- [x] **Task 3.2: Extended Task State Checkbox Visual Semantics & Light Theme Contrast (P1-34, P2-36, P2-37)**
  - [x] Add `data-task-state="in-progress"` attribute in `packages/renderer/src/pipeline.ts`
  - [x] Add distinct indeterminate/in-progress styling in `src/styles/components/markdown-preview.css`
  - [x] Boost light-theme checkbox border contrast to $\ge 3:1$
  - [x] Verify: `pnpm check:renderer`

- [x] **Task 3.3: Rendered Output vs. Inspector Rail Hierarchy Reordering (P1-23, P1-24, P2-25)**
  - [x] Prioritize preview panel at the top of `src/components/InspectorRail.tsx` when Rendered Output is active
  - [x] Subordinate shared health cards to avoid burying the preview
  - [x] Verify: `pnpm exec playwright test --config playwright.e2e.config.ts e2e/screenshot-geometry.spec.ts` and `e2e/preview-resilience.spec.ts`

- [x] **Task 3.4: Disconnected Feature Disposition: Google Calendar & LaTeX (S-06, S-07)**
  - [x] Wire `useLatexCompiler.ts` into note export/tools actions
  - [x] Connect `useGoogleCalendarSync.ts` toggle to `src/components/VaultConfigSettingsSection.tsx`
  - [x] Verify: `pnpm check:contracts` and `pnpm check:governance`
  - [x] Verify: `src/App.tsx` remains $\le 1950$ lines (1904 lines)

- [x] **Checkpoint: Semantic Precision Gate**
  - [x] All Phase 3 unit tests pass
  - [x] Visual hierarchy confirmed in Inspector rail

---

## Phase 4: Viewport, Modal & Responsive Layout Overhaul

- [x] **Task 4.1: Tablet (1024px) 2-Rail Adaptive Recomposition (P1-14, P1-15, P1-16)**
  - [x] Implement adaptive 2-rail grid at 1024px breakpoint in `src/styles/app/responsive.css`
  - [x] Prevent date picker control wrapping in `src/components/chrome/WorkspaceTopBar.tsx`
  - [x] Fix `Rendered output` tab label wrapping
  - [x] Verify: `pnpm exec playwright test e2e/responsive.spec.ts`

- [x] **Task 4.2: Mobile Chrome Isolation & Touch Target Ergonomics (P1-10, P1-11, P1-12, P1-18)**
  - [x] Hide desktop diagnostics dock and telemetry on mobile viewports (<820px)
  - [x] Guarantee scroll clearance above mobile bottom nav
  - [x] Enforce 44x44px touch targets across mobile file rows and buttons
  - [x] Verify: `pnpm exec playwright test e2e/mobile.spec.ts`

- [x] **Task 4.3: Modal Viewport Bounds & Scroll Affordance: Settings & Publish Center (P1-69, P1-70, P1-87, P1-88)**
  - [x] Implement sticky footer action bar for "Save vault config" in `src/components/SettingsPanel.tsx`
  - [x] Add visible scroll overflow cues in `src/styles/components/settings-panel.css`
  - [x] Bound Publish Center format list with sticky export action bar in `src/components/PublishCenter.tsx`
  - [x] Verify: `pnpm exec playwright test e2e/settings.spec.ts e2e/publish.spec.ts`

- [x] **Checkpoint: Viewport & Responsive Gate**
  - [x] Tablet (1024px) and Mobile visual layouts verified clean
  - [x] Settings and Publish Center modal viewports verified accessible

---

## Phase 5: Deep Investigations & Hardening

- [x] **Task 5.1: Git Merge-Commit Exact Graph Reproduction Harness (S-08, P1-05)**
  - [x] Create isolated test harness `scripts/validation/git-merge-repro.mjs`
  - [x] Validate parent hashes and commit graph consistency across merge operations
  - [x] Document findings in `tasks/git-merge-report.md`
  - [x] Verify: `cargo test -p scriptor-native-git`

- [x] **Task 5.2: Backup-Restore Transactional Failure Injection & Recovery Verification (S-09, P0-02, P0-03, P1-10, P1-11)**
  - [x] Create fault injection test `scripts/validation/backup-restore-fault.test.mjs`
  - [x] Validate atomic rollback and clean journal recovery on simulated failure
  - [x] Connect `recover_interrupted_restore` in `vault_open`
  - [x] Verify: `cargo test -p scriptor-vault` and desktop backup tests

- [x] **Task 5.3: Application-Level Vault Restore State Refresh (P1-09)**
  - [x] In `useVaultBackup.ts`: call `await indexerRebuild()`, emit `scriptor:vault-restored`, fire `onRestored?.()`
  - [x] In `useVaultWorkspace.ts`: listen for `scriptor:vault-restored` and trigger `refreshVault()`
  - [x] Verify: `scripts/validation/backup-restore-fault.test.mjs`

- [x] **Task 5.4: Remove Version-Specific Localization Release Automation (P1-13, Section 20)**
  - [x] Removed version-specific `.github/workflows/release-after-localization.yml` to ensure all release gates are generic and SHA/version-derived
  - [x] Verify: `pnpm check:governance` and `pnpm check:release-hardening`

- [x] **Task 5.5: Dead Frontend Module Cleanup & Verification (P2-09)**
  - [x] Remove dead modules: `EditorStructureMenu.tsx`, `EditorToolsMenu.tsx`, `useEditorRequestStore.ts`, `useLinkDecay.ts`, `useLinkDecayIndicators.ts`, `useNoteNavigationStore.ts`, `useProseAutosuggest.ts`, `useTabStore.ts`, `updaterConfig.ts`
  - [x] Verify: `pnpm check:contracts` and `pnpm check:bundle` (455 KB gzip, well under 921 KB budget)

---

## Final Project Sign-Off
- [x] Full test suite green: `pnpm check:source` (250 tests across 12 suites pass)
- [x] Full desktop & vault tests green: `cargo test -p scriptor-vault`, `cargo test -p scriptor-native-git`, desktop backup tests
- [x] Visual and responsive regression tests green: Playwright E2E suites pass (27 passed)
- [x] Line budget check: `src/App.tsx` $\le 1950$ lines (current: 1904 lines)
- [x] Clean working tree and no lingering debug artifacts
