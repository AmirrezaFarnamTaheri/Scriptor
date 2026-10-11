# Fresh image review — indices 55–90 — 2026-10-04

Reviewed all 36 assigned PNGs individually at their original resolution from `artifacts/verification/github-37202257159-visual/image-manifest.json`. Indices below are one-based manifest positions. Image paths are relative to `artifacts/verification/github-37202257159-visual/`.

This is an image and source inspection record, not baseline approval. No local browser, server, test, build, installation, or runtime verification was performed. A visible partial row or code block at a scrolling boundary is not treated as proof of unreachable content. Still images do not establish keyboard behavior or numeric contrast compliance.

## Findings

- **F1 — captured desktop footer clipping:** indices **69, 70, 79, 83** clip the trailing vault identity/status glyph at the right image edge. Index 79 also clips left-edge workspace chrome after a horizontal displacement; the still image does not establish its cause. The current source change in `src/styles/app/dock-settings.css:62` gives repository state an automatic final track and lets progress absorb the remaining width. This directly addresses the captured footer allocation problem, but these images predate the change and do not verify its rendered result. GitHub worker evidence is required.
- **F2 — scrolled text bleeds through sticky tabs:** index **76**, `images/current--visual-review-visual-revie-a33b7-ace-layout-presets-evidence--visual-layout-presets-bottom.png`, shows faint explanatory text (including “one action”) beneath the Inspector/Rendered output/Tools labels. The capture used a translucent sticky background. Root has since changed `src/styles/app/inspector.css:31` to a tinted gradient over the opaque themed `--bg` base. Source review finds that repair addresses the cause; its rendered result awaits GitHub worker evidence.

## Source review of the pending shared changes

No concrete blocker found in the reviewed diff:

- `src/styles/app/unified-panel-contract.css:50` gives shared bodies a 16px top inset. Removing the health/history/support per-panel top offsets avoids competing owners. Docked and mobile rules change inline or bottom padding while retaining the shared top inset.
- `src/styles/app/dock-settings.css:62` changes desktop summary tracks to `auto auto minmax(260px, 1fr) minmax(0, auto)`; existing compact, docked, and magnified allocation rules remain in place.
- The new source-only regression cases in `e2e/screenshot-polish-regressions.spec.ts` check first-child/header clearance and repository descendants against summary bounds in LTR and RTL. These are meaningful geometry checks, but were not executed during this review.

Follow-up source review also found no concrete regression in the skeleton stylesheet import and stronger themed background selector, coarse-pointer mobile tab inline padding adjustment, narrow/effective-mobile workspace readiness option, commit-message setup before Git confirmation, or first-page-header alignment in the publishing capture. These repairs and capture changes were inspected without local execution. No baseline approval is implied.

## Per-image ledger

| Index | PNG path | Observation |
| --- | --- | --- |
| 55 | `images/current--visual-review-visual-revie-72b09-rst-run-onboarding-evidence--visual-onboarding-dark.png` | Dark onboarding: title, progress, text, and actions fit; Next focus ring is contained. |
| 56 | `images/current--visual-review-visual-revie-742cc-pace-and-shortcuts-evidence--visual-settings-appearance.png` | Appearance settings: labels and controls align; the lower font field is a scroll-boundary crop. |
| 57 | `images/current--visual-review-visual-revie-742cc-pace-and-shortcuts-evidence--visual-settings-shortcuts.png` | Shortcut table: columns align; the partly visible final row is inside the scrolling body. |
| 58 | `images/current--visual-review-visual-revie-742cc-pace-and-shortcuts-evidence--visual-settings-workspace.png` | Workspace settings: cards and controls align; the lower card continues below the scrolling viewport. |
| 59 | `images/current--visual-review-visual-revie-746fd-ts-and-top-actions-evidence--visual-mobile-touch-320.png` | 320px mobile editor: navigation and editor content fit; the format toolbar continues horizontally. |
| 60 | `images/current--visual-review-visual-revie-7c25e--conflict-resolver-evidence--visual-conflict-resolver-dark.png` | Conflict resolver: choices, source comparisons, and merged preview remain bounded. |
| 61 | `images/current--visual-review-visual-revie-80af6--Output-states-stay-bounded--visual-dock-jobs.png` | Jobs dock: labels and status align; no captured clipping or overlap. |
| 62 | `images/current--visual-review-visual-revie-80af6--Output-states-stay-bounded--visual-dock-output.png` | Output dock: rows align; the partly visible bottom row is a scroll-boundary crop. |
| 63 | `images/current--visual-review-visual-revie-80af6--Output-states-stay-bounded--visual-dock-problems.png` | Problems dock: labels, filters, and empty-state content fit. |
| 64 | `images/current--visual-review-visual-revie-80ec8-ult-virtualization-evidence--visual-large-vault-bottom.png` | Large vault bottom: the distinguishing note-number suffixes remain visible; no overlapping rows. |
| 65 | `images/current--visual-review-visual-revie-822f1--compact-workspace-evidence--visual-workspace-de-1024.png` | German 1024px workspace: wrapped rail labels and compact controls fit. |
| 66 | `images/current--visual-review-visual-revie-869ad-or-zoom-comparison-evidence--visual-codemirror-375-default-100.png` | 375px CodeMirror workspace: editor and mobile navigation fit; no confirmed overlap defect. |
| 67 | `images/current--visual-review-visual-revie-8e074-dense-graph-canvas-evidence--visual-graph-dense-120.png` | Dense graph: nodes, selection ring, and controls fit; labels are intentionally sparse in this state. |
| 68 | `images/current--visual-review-visual-revie-927f1-Reader-PDF-surface-evidence--visual-reader-pdf.png` | Reader PDF: portrait page fits the reader width; header controls remain bounded. |
| 69 | `images/current--visual-review-visual-revie-959ef-ame-dialog-context-evidence--visual-obsidian-import-workspace.png` | F1: trailing desktop footer identity/status glyph is clipped at the right image edge. |
| 70 | `images/current--visual-review-visual-revie-959ef-ame-dialog-context-evidence--visual-rename-workspace.png` | F1: trailing desktop footer identity/status glyph is clipped; rename dialog controls are contained. |
| 71 | `images/current--visual-review-visual-revie-96af0--Typography-toolbar-popover--visual-typography-popover.png` | Typography popover: labels and selected/focused item fit; focus ring remains inside the crop. |
| 72 | `images/current--visual-review-visual-revie-a03cf--compact-mobile-editor-pane--visual-mobile-editor-390.png` | 390px mobile editor: content wraps and navigation fits; toolbar continues horizontally. |
| 73 | `images/current--visual-review-visual-revie-a1995-s-remain-readable-at-1024px--visual-inspector-metrics-1024.png` | 1024px inspector metrics: labels wrap inside their cells; no overlap. |
| 74 | `images/current--visual-review-visual-revie-a3216-00-percent-UI-zoom-evidence--visual-workspace-ui-zoom-200-editor.png` | 200% editor UI: reflowed controls and navigation fit; document continues within its scroll area. |
| 75 | `images/current--visual-review-visual-revie-a3216-00-percent-UI-zoom-evidence--visual-workspace-ui-zoom-200-inspector.png` | 200% inspector UI: visible outline controls fit; the next row continues below the scrolling viewport. |
| 76 | `images/current--visual-review-visual-revie-a33b7-ace-layout-presets-evidence--visual-layout-presets-bottom.png` | F2: scrolled explanatory text is visible through the sticky Inspector/Rendered output/Tools tab bar. |
| 77 | `images/current--visual-review-visual-revie-a33b7-ace-layout-presets-evidence--visual-layout-presets.png` | Layout presets initial state: tabs and preset cards fit; lower preset continues below the scrolling viewport. |
| 78 | `images/current--visual-review-visual-revie-a4faf-Bibliography-panel-evidence--visual-bibliography.png` | Bibliography: form labels, metadata, and reference rows fit. |
| 79 | `images/current--visual-review-visual-revie-a5df9-ticky-note-overlay-evidence--visual-sticky-note-overlay.png` | F1: footer end is clipped. The workspace is also horizontally displaced, clipping left-edge chrome; cause is not established by this still image. |
| 80 | `images/current--visual-review-visual-revie-aa902-t-health-dashboard-evidence--visual-vault-health-dashboard.png` | Health dashboard: first content is clear of the header; metric grid and maintenance controls fit. |
| 81 | `images/current--visual-review-visual-revie-ae237-arkdown-cheatsheet-evidence--visual-cheatsheet-bottom.png` | Cheatsheet bottom: header stays clear; the code example begins above the current scroll position. |
| 82 | `images/current--visual-review-visual-revie-ae237-arkdown-cheatsheet-evidence--visual-cheatsheet.png` | Cheatsheet initial state: columns and code blocks fit; lower example continues below the scrolling viewport. |
| 83 | `images/current--visual-review-visual-revie-aff5a-table-Preview-mode-evidence--visual-editor-writable-preview.png` | F1: trailing desktop footer identity/status glyph is clipped; writable preview and split output remain bounded. |
| 84 | `images/current--visual-review-visual-revie-b247c-ation-confirmation-evidence--visual-git-confirmation.png` | Git confirmation: message field, selected files, and distinct confirmation actions fit. |
| 85 | `images/current--visual-review-visual-revie-b247c-ation-confirmation-evidence--visual-git-status.png` | Git status: themed Preview diff and commit controls fit. |
| 86 | `images/current--visual-review-visual-revie-b4b35-k-settings-surface-evidence--visual-settings-dark.png` | Dark settings: labels and controls fit; the footer action remains bounded. |
| 87 | `images/current--visual-review-visual-revie-c1b53-led-bounded-and-centralized--visual-help-mobile-390.png` | 390px mobile help: search focus ring, category controls, and footer action fit. |
| 88 | `images/current--visual-review-visual-revie-c2579-r-palette-surfaces-evidence--visual-color-palettes.png` | Color palettes: cards, previews, filters, and actions align; further cards continue within the scrolling body. |
| 89 | `images/current--visual-review-visual-revie-c2579-r-palette-surfaces-evidence--visual-theme-customizer.png` | Theme customizer: sidebar, fields, contrast report, and footer actions fit; live preview continues within the scrolling body. |
| 90 | `images/current--visual-review-visual-revie-c2579-r-palette-surfaces-evidence--visual-topbar-customizer.png` | Topbar customizer: checkboxes, labels, and restore action fit. |
