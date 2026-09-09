# Visual remediation — 2026-09-09

This checklist tracks the second native-vision review of the Windows workspace and related surfaces. It is intentionally kept in the implementation branch so each remediation can be landed and verified incrementally.

## P1 — shell and editor information architecture

- [ ] Collapse the persistent three-row editor toolbar into one primary row with progressive disclosure for secondary tools.
- [ ] Remove semantic duplication between Source/Preview/Split and editor-option icons.
- [ ] Make active-mode, toggle, and momentary-command states visually and semantically distinct.
- [ ] Reduce global top-bar command density and consolidate duplicate entry points.
- [ ] Clarify global search, note search, and command-palette scopes.
- [ ] Remove redundant `Vault`/recent-note navigation and clarify sidebar utility actions.
- [ ] Reduce split-mode chrome and preserve usable editor/preview widths.
- [ ] Simplify the two-tier bottom status/output chrome; remove duplicate Jobs affordances and completed-progress noise.
- [ ] Promote actual problems above passive subsystem status.

## P1 — trust, state, and naming

- [ ] Reconcile inspector citation metrics and clarify note-level versus vault-level metrics.
- [ ] Consolidate overlapping Note Health / Note quality concepts and naming.
- [ ] Remove the Preview naming collision between editor surface mode and inspector tab.
- [ ] Clarify Inspector profile pills (Balanced / Research / Publishing / Cleanup).
- [ ] Fix Publish Center terminology, profile label/path separation, and export action hierarchy.
- [ ] Make onboarding state-aware and non-blocking so highlighted targets remain operable.
- [ ] Replace raw/ambiguous merge terminology and require explicit hunk resolution before apply.

## P2 — individual surfaces

- [ ] Rework Settings into navigable sections with an explicit persistence model and less implementation jargon.
- [ ] Separate plugin marketplace browsing from installed-plugin and permission management; prevent wrapped nested tabs.
- [ ] Make MCP authorization levels read as security states, not ordinary tabs, and clarify vault scope.
- [ ] Turn Vault Health's healthy state into a positive summary and demote maintenance actions.
- [ ] Make Note History comparison-first and restore-second with consistent timestamps.
- [ ] Make Knowledge Workbench empty states positive and non-redundant.
- [ ] Improve Graph direction, reciprocal-edge visibility, focus labeling, legend, controls, and canvas utilization.
- [ ] Simplify Git rail actions, status wording, and commit workflow hierarchy.
- [ ] Make the conflict resolver visually diff-first, consistently closable, and safe by default.
- [ ] Clarify command-palette scope, categories, shortcut alignment, and consequential actions.
- [ ] Give blank Canvas an obvious first action; demote export controls until content exists and remove developer CLI leakage.
- [ ] Implement a real keyboard-shortcuts management surface instead of reusing Settings.

## P2 — accessibility, responsive, themes, localization

- [ ] Preserve 44px coarse-pointer targets through the final CSS cascade.
- [ ] Verify keyboard semantics for Canvas, graph, toolbar menus, virtualized Git rows, and security-state controls.
- [ ] Verify dark mode for every reviewed dialog/panel, not only the main workspace.
- [ ] Add smaller-window, Windows scaling, RTL/Persian, German expansion, long-name, large-data, loading, error, and destructive-confirmation visual cases.
- [ ] Remove hard-coded implementation/theme colors where semantic tokens are required.

## Verification

Every checked item must have at least one of: a focused unit/component test, an E2E interaction assertion, an accessibility assertion, or a visual baseline covering the affected state. Screenshot tests must fail when the intended feature is absent rather than silently capturing a fallback surface.
