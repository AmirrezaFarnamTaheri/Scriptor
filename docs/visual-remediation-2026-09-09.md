# Visual remediation — 2026-09-09

This checklist tracks the second native-vision review of the Windows workspace and related surfaces. It is intentionally kept in the implementation branch so each remediation can be landed and verified incrementally.

## P1 — shell and editor information architecture

- [x] Collapse the persistent three-row editor toolbar into one primary row with progressive disclosure for secondary tools.
- [x] Remove semantic duplication between Source/Preview/Split and editor-option icons.
- [x] Make active-mode, toggle, and momentary-command states visually and semantically distinct.
- [x] Reduce global top-bar command density and consolidate duplicate entry points.
- [x] Clarify global search, note search, and command-palette scopes: the global trigger is explicitly `Commands and notes`, the sidebar is note-only, and the palette explains when note search begins.
- [x] Remove redundant `Vault`/recent-note navigation and clarify sidebar utility actions.
- [x] Reduce split-mode chrome and preserve usable editor/preview widths.
- [x] Simplify the two-tier bottom status/output chrome; remove duplicate Jobs affordances and completed-progress noise.
- [x] Promote actual problems above passive subsystem status.

## P1 — trust, state, and naming

- [x] Reconcile inspector citation metrics and clarify note-level versus vault-level metrics.
- [x] Replace overlapping Note Health / Note quality wording with vault-scoped health and note-scoped Publish readiness.
- [x] Remove the Preview naming collision between editor surface mode and inspector tab (`Rendered output`).
- [x] Clarify Inspector profiles as a single-choice control and surface the selected profile description without requiring a tooltip.
- [x] Fix Publish Center terminology, profile label/path separation, and export action hierarchy.
- [x] Make onboarding state-aware and avoid instructing users to operate blocked background controls.
- [x] Replace raw/ambiguous merge terminology and require explicit hunk resolution before apply.

## P2 — individual surfaces

- [x] Rework Settings into navigable sections with an explicit persistence model and less implementation jargon.
- [x] Separate installed-plugin/permission management from marketplace browsing, while keeping the four top-level Store tabs on one row.
- [x] Make MCP authorization levels read as security states, not ordinary tabs, and clarify vault scope.
- [x] Turn Vault Health's healthy state into a positive summary and demote maintenance actions.
- [x] Make Note History comparison-first and restore-second with consistent timestamps and fail-closed preview reads.
- [x] Make Knowledge Workbench empty states positive and non-redundant.
- [x] Improve Graph direction, reciprocal-edge visibility, focus labeling, controls, keyboard navigation, and canvas utilization.
- [x] Simplify Git rail actions, status wording, pull strategy, confirmations, and commit workflow hierarchy.
- [x] Make the conflict resolver visually diff-first, consistently closable, and safe by default.
- [x] Clarify command-palette categories, shortcut alignment, and consequential actions.
- [x] Give blank Canvas an obvious first action; demote export controls until content exists and remove developer CLI leakage.
- [x] Implement a real keyboard-shortcuts management surface instead of reusing Settings.

## P2 — accessibility, responsive, themes, localization

- [x] Preserve 44px coarse-pointer targets through the final CSS cascade.
- [x] Verify keyboard semantics for Canvas, graph, toolbar menus, virtualized Git rows, and security-state controls.
- [x] Verify dark mode for every reviewed dialog/panel, not only the main workspace. Automated coverage includes Settings, MCP, Graph, Knowledge Workbench, Note History, Canvas, Plugins, Git/conflicts, Export & publish, Vault Health, and first-run onboarding, with explicit dark-surface assertions.
- [x] Complete the visual matrix for Windows scaling, long names, large data, loading/error states, and destructive confirmations. Coverage now includes Windows visual regression, 125% device scale and app zoom, compact/mobile/tablet widths, large virtualized vaults with long filenames, slow-loading skeletons, editor/preview failures, destructive confirmations, Persian RTL, and German expansion.
- [x] Remove remaining hard-coded implementation/theme colors where semantic tokens are required. The final repository sweep normalized application chrome, status colors, editor warnings, reader surfaces, error overlays, and primary-action foregrounds onto semantic/theme tokens. Literal colors that remain are intentional palette definitions, user/content colors, export/print output colors, data-visualization/category palettes, or fallback values behind semantic variables.

## Correctness and trust issues found during the detour

- [x] Remove heuristic merge-ancestor reconstruction and fail closed on unresolved/incomplete conflict blocks.
- [x] Fix initial-vault refreshes that read stale React state immediately after `setVault`.
- [x] Make plugin consent least-privilege: required permissions only by default, additive per-vault grants, and vault-scoped revoke.
- [x] Serialize vault configuration mutation paths and preserve runtime-owned MCP state during Settings saves.
- [x] Route LanguageTool through the supported desktop network path and surface service failures instead of silently reporting no issues.
- [x] Render extended task states consistently with the task parser.
- [x] Disable Note History restore when either the selected revision or current-note comparison cannot be read.
- [x] Expose the Git pull strategy supported by the native layer instead of hard-coding fast-forward behavior.

## Verification

Every checked item has at least one of: a focused unit/component test, an E2E interaction assertion, an accessibility assertion, or a visual contract covering the affected state. Screenshot tests are being tightened so an absent feature fails instead of silently capturing a fallback surface.

The latest recovery pass also removed the second `splitPreview` UI authority: `chrome.editorSurfaceMode` now drives Source/Split/Rendered state, layout presets and palette toggles route through that authority, and the inspector receives the same effective state. E2E workspace-chrome fixtures now use the production versioned-storage envelope, so tests no longer silently fall back to default chrome when they intended to exercise a custom layout. Stale accessible-name and overly broad locators discovered by the prior CI run were repaired at the same time.

The temporary branch-only write workflow used to atomically apply that large cross-file recovery removed itself after the successful commit; it is not part of the proposed product/CI surface.

The PR remains draft until current-head CI, desktop compile, and visual-review runs are green and the unchecked items above are either implemented or explicitly split into follow-up scope with evidence.