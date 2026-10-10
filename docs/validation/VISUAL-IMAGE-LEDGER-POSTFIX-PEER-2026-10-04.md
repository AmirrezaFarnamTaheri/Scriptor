# Post-fix peer image review — 2026-10-04

Reviewed all **45 assigned images**, one-based manifest positions **46–90**, individually at original resolution from `artifacts/verification/github-37206096374-visual/image-manifest.json`. Also reviewed **position 16** individually as supplemental evidence for the specifically requested print-header correction.

Manifest schema: 2. Manifest generated UTC: `2026-10-04T13:43:26.3220167+00:00`. Total manifest images: 115. PNG paths below are exact paths relative to `artifacts/verification/github-37206096374-visual/`.

Only this ledger was edited. No code changes, local browser/server, tests, builds, or installations were performed. This record is not baseline approval.

## Concrete finding and repair status

**F3 — underlying formatting controls show through the narrow sticky view-mode selector.** Position **71**, `images/current--visual-review-visual-revie-869ad-or-zoom-comparison-evidence--visual-codemirror-375-default-100.png`, shows faint formatting icons under Source/Split/Preview. Source inspection confirmed `.editor-view-modes` at `src/styles/app/workspace-geometry-contract.css:68` was horizontally sticky with a translucent background at line 75.

Root has since changed that background to a tinted gradient over the opaque themed `--bg` base and added a 375px opacity regression case. The fresh artifact reviewed here **predates that final repair**. Source review finds no concrete blocker in the change; its rendered result still needs a newer capture.

Root also repaired the annotation-popover opacity problem reported in position 43, outside this ledger's assigned image range, by using `--dialog-bg` in `src/styles/components/reader-panel.css`. The CSS change and added visual opacity assertion were inspected without execution; no concrete blocker found. This artifact also predates that final annotation repair, and this ledger does not independently review image 43.

No other concrete visible flaw was found in the assigned images.

## Corrections supported by these fresh actuals

- **EPUB position:** position **57** shows **Section 1** in the Reader header instead of raw CFI text. Publication text is readable against its dark page. This image confirms presentation of the initial fixture section, not navigation across every section.
- **Held loading:** position **58** has visible themed skeleton bars contained within the vault rail.
- **Print header:** supplemental position **16** contains Page 1 and the Research Plan title beneath the shell header. The long paper continues through the scrolling body; this is not a claim about final native PDF pagination.
- **Sticky inspector tabs:** position **81** no longer shows the scrolled explanatory text seen in prior artifact `github-37202257159-visual` position 76.
- **Desktop footer:** positions **46, 47, 74, 75, 84, 88** show the full vault identity and final status glyph. Prior artifact positions 69, 70, 79, and 83 showed cropping in the corresponding import, rename, sticky, and writable-preview states. The left-edge workspace displacement previously visible in the sticky capture is absent at fresh position 84.
- **Shared body inset:** history positions **50–51** and health position **85** have clear separation between the shell header and first content.

## Limits

This is a review of rendered still images and the two scoped opacity repairs. It does not establish keyboard behavior, numeric contrast compliance, behavior of every scroll state, or a clean runtime check. Partial content at a scrolling boundary was not treated as unreachable content. The artifact predates the last two opacity repairs, so those repairs require fresh GitHub worker evidence before accepting their images.

## Assigned image ledger

| Position | PNG path | Observation |
| --- | --- | --- |
| 46 | `images/current--visual-review-visual-revie-57bd3-Canvas-export-menu-evidence--visual-canvas-export-menu.png` | Canvas export menu and actions fit; the desktop footer identity and final status glyph are fully visible. |
| 47 | `images/current--visual-review-visual-revie-5ef8c--workspace-context-evidence--visual-kanban-workspace.png` | Kanban columns and controls fit; first content clears the header and the desktop footer identity is fully visible. |
| 48 | `images/current--visual-review-visual-revie-5ef8c--workspace-context-evidence--visual-reader-pdf-workspace.png` | Docked PDF Reader shows Page 1, bounded controls, and a complete portrait page; compact footer controls fit beside the dock. |
| 49 | `images/current--visual-review-visual-revie-602cd-sian-RTL-workspace-evidence--visual-workspace-rtl-fa.png` | Persian RTL workspace: mixed-direction labels, outline controls, metrics, and compact footer remain contained. |
| 50 | `images/current--visual-review-visual-revie-6071d-store-confirmation-evidence--visual-history-restore-confirmation.png` | History restore confirmation: content clears the header divider; confirmation actions are distinct and comparison blocks remain contained. |
| 51 | `images/current--visual-review-visual-revie-6071d-store-confirmation-evidence--visual-note-history-comparison.png` | History comparison: shared header inset is visible; diff and side-by-side text fit, with lower content continuing inside the scrolling body. |
| 52 | `images/current--visual-review-visual-revie-61572-pen-graph-guidance-evidence--visual-graph-first-open-guidance.png` | Graph guidance card, graph controls, and nodes are contained; guidance remains separate from the header. |
| 53 | `images/current--visual-review-visual-revie-64540-lbar-customization-evidence--visual-editor-toolbar-customizer.png` | Toolbar customizer: checkbox labels, move controls, width fields, and footer actions align without clipping. |
| 54 | `images/current--visual-review-visual-revie-66ea9-ps-centralized-Help-bounded--visual-help-ui-zoom-200.png` | 200% Help: search focus ring, categories, article tabs, and footer action fit; article continues inside its scrolling body. |
| 55 | `images/current--visual-review-visual-revie-67f0c-k-mobile-workspace-evidence--visual-mobile-dark-390.png` | Dark 390px mobile workspace: editor text, controls, and navigation are readable and contained; toolbar continues horizontally. |
| 56 | `images/current--visual-review-visual-revie-6a070-d-direction-content-bounded--visual-help-rtl-fa.png` | Persian RTL Help: article, categories, search focus ring, and footer action fit; lower article content continues inside the scrolling body. |
| 57 | `images/current--visual-review-visual-revie-6d13d-eader-EPUB-surface-evidence--visual-reader-epub.png` | EPUB correction visible: Section 1 replaces raw CFI in readable header chrome; document text has clear contrast against the dark page. |
| 58 | `images/current--visual-review-visual-revie-6ec2a-slow-vault-loading-evidence--visual-vault-loading.png` | Held vault loading correction visible: themed skeleton bars are distinct from the rail background and remain within the rail width. |
| 59 | `images/current--visual-review-visual-revie-71d99-me-dry-run-rewrite-evidence--visual-rename-preview.png` | Rename dry-run: labels, filename field, link-update choice, actions, and result summary fit. |
| 60 | `images/current--visual-review-visual-revie-72b09-rst-run-onboarding-evidence--visual-onboarding-dark.png` | Dark onboarding: progress, explanatory text, and actions fit; Next focus ring remains contained. |
| 61 | `images/current--visual-review-visual-revie-742cc-pace-and-shortcuts-evidence--visual-settings-appearance.png` | Appearance settings: labels and controls align; lower editor-font field continues inside the scrolling body. |
| 62 | `images/current--visual-review-visual-revie-742cc-pace-and-shortcuts-evidence--visual-settings-shortcuts.png` | Shortcut settings: table columns and shortcut fields align; lower rows continue inside the scrolling body. |
| 63 | `images/current--visual-review-visual-revie-742cc-pace-and-shortcuts-evidence--visual-settings-workspace.png` | Workspace settings: checkboxes, numeric field, and layout cards fit; lower layout continues inside the scrolling body. |
| 64 | `images/current--visual-review-visual-revie-746fd-ts-and-top-actions-evidence--visual-mobile-touch-320.png` | 320px touch mobile workspace: tab icon/title/pin/close remain balanced and bounded; navigation labels fit and editor text wraps. |
| 65 | `images/current--visual-review-visual-revie-7c25e--conflict-resolver-evidence--visual-conflict-resolver-dark.png` | Dark conflict resolver: choices, comparisons, preview, and bottom actions fit; raw preview continues in its own scroll area. |
| 66 | `images/current--visual-review-visual-revie-80af6--Output-states-stay-bounded--visual-dock-jobs.png` | Jobs dock: tab labels, job label, and Ready status are contained. |
| 67 | `images/current--visual-review-visual-revie-80af6--Output-states-stay-bounded--visual-dock-output.png` | Output dock: rows and labels fit; bottom log entry is a scrolling-boundary crop. |
| 68 | `images/current--visual-review-visual-revie-80af6--Output-states-stay-bounded--visual-dock-problems.png` | Problems dock: problem details, Generate link references action, and close control remain contained. |
| 69 | `images/current--visual-review-visual-revie-80ec8-ult-virtualization-evidence--visual-large-vault-bottom.png` | Large-vault scrolled state: note-number suffixes remain distinguishable; editor, inspector, and active-index footer controls fit. |
| 70 | `images/current--visual-review-visual-revie-822f1--compact-workspace-evidence--visual-workspace-de-1024.png` | German 1024px workspace: wrapped rail labels, abbreviated inspector tabs, editor, and compact footer fit. |
| 71 | `images/current--visual-review-visual-revie-869ad-or-zoom-comparison-evidence--visual-codemirror-375-default-100.png` | F3: faint underlying formatting icons show through the horizontally sticky Source/Split/Preview group. Source confirms a translucent sticky background; reported to root. |
| 72 | `images/current--visual-review-visual-revie-8e074-dense-graph-canvas-evidence--visual-graph-dense-120.png` | Dense graph: nodes, selected-note ring/label, and header controls fit; other node labels are intentionally sparse. |
| 73 | `images/current--visual-review-visual-revie-927f1-Reader-PDF-surface-evidence--visual-reader-pdf.png` | Mobile PDF Reader shows Page 1 and the complete portrait page; header controls and page edges are contained. |
| 74 | `images/current--visual-review-visual-revie-959ef-ame-dialog-context-evidence--visual-obsidian-import-workspace.png` | Obsidian import dialog: field focus ring, options, and actions fit; corrected trailing footer identity/status glyph is fully visible. |
| 75 | `images/current--visual-review-visual-revie-959ef-ame-dialog-context-evidence--visual-rename-workspace.png` | Rename workspace dialog: content and actions fit; corrected trailing footer identity/status glyph is fully visible. |
| 76 | `images/current--visual-review-visual-revie-96af0--Typography-toolbar-popover--visual-typography-popover.png` | Typography popover: menu labels fit and the first item focus ring remains fully contained. |
| 77 | `images/current--visual-review-visual-revie-a03cf--compact-mobile-editor-pane--visual-mobile-editor-390.png` | 390px mobile editor: document text wraps and navigation fits; toolbar continues horizontally. |
| 78 | `images/current--visual-review-visual-revie-a1995-s-remain-readable-at-1024px--visual-inspector-metrics-1024.png` | 1024px inspector metrics: labels wrap inside their cells and controls remain contained. |
| 79 | `images/current--visual-review-visual-revie-a3216-00-percent-UI-zoom-evidence--visual-workspace-ui-zoom-200-editor.png` | 200% editor UI: reflowed controls and navigation fit; document continues inside its scroll area. |
| 80 | `images/current--visual-review-visual-revie-a3216-00-percent-UI-zoom-evidence--visual-workspace-ui-zoom-200-inspector.png` | 200% inspector UI: tabs and visible outline controls fit; lower outline row continues below the scrolling viewport. |
| 81 | `images/current--visual-review-visual-revie-a33b7-ace-layout-presets-evidence--visual-layout-presets-bottom.png` | Inspector opacity correction visible: scrolled explanatory text no longer shows through the sticky tab bar; lower presets and actions fit. |
| 82 | `images/current--visual-review-visual-revie-a33b7-ace-layout-presets-evidence--visual-layout-presets.png` | Layout presets initial state: tabs and card actions fit; lower cards continue inside the rail scroll area. |
| 83 | `images/current--visual-review-visual-revie-a4faf-Bibliography-panel-evidence--visual-bibliography.png` | Bibliography: fields, reference metadata, and actions fit. |
| 84 | `images/current--visual-review-visual-revie-a5df9-ticky-note-overlay-evidence--visual-sticky-note-overlay.png` | Sticky note remains bounded; the previous left-edge workspace displacement and right footer clipping are absent in this fresh capture. |
| 85 | `images/current--visual-review-visual-revie-aa902-t-health-dashboard-evidence--visual-vault-health-dashboard.png` | Health dashboard: badge and body content clear the header; metric grid, repair controls, and disclosures fit. |
| 86 | `images/current--visual-review-visual-revie-ae237-arkdown-cheatsheet-evidence--visual-cheatsheet-bottom.png` | Cheatsheet bottom: header remains clear; upper code block is cropped by the current scroll position and lower examples fit. |
| 87 | `images/current--visual-review-visual-revie-ae237-arkdown-cheatsheet-evidence--visual-cheatsheet.png` | Cheatsheet initial state: syntax and template columns fit; lower class example continues within the scrolling body. |
| 88 | `images/current--visual-review-visual-revie-aff5a-table-Preview-mode-evidence--visual-editor-writable-preview.png` | Writable preview and rendered output fit; corrected trailing footer identity/status glyph is fully visible. |
| 89 | `images/current--visual-review-visual-revie-b247c-ation-confirmation-evidence--visual-git-confirmation.png` | Git confirmation: message and selected-file details fit; Cancel and Confirm are distinct and spaced. |
| 90 | `images/current--visual-review-visual-revie-b247c-ation-confirmation-evidence--visual-git-status.png` | Git status: themed Preview diff, message field, and commit action fit. |

## Supplemental requested correction

| Position | PNG path | Observation |
| --- | --- | --- |
| 16 | `images/current--visual-review-visual-revie-0a825-t-and-print-layout-evidence--visual-publish-print-preview.png` | Supplemental print correction: Page 1 header and Research Plan heading are visible together below the shell header; the long paper continues inside the scrolling body. |
