# Hosted screenshot refresh and individual inspection

Source: `f915ce83a82f78af5c1e2ad4a4b8b337fbad1f88`.
[Designated refresh worker](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/37776797146).
Screenshot-only commit: `5597d0e4967df18c7220e6c14152eda2eecb3835`.
Artifact: `documentation-screenshots-1` (11551080381).

The worker passed its 30 capture cases and four supplementary cases, then
passed the 30 stable comparison cases against its regenerated references.
It updated 35 gallery PNGs and 18 Windows reference PNGs. No local browser,
build, installation or test was run. All 35 gallery images were individually
opened; the table distinguishes intended scrolling from actual presentation
findings. This is an inspection of these captures, not a claim that every
possible state or packaged platform has been visually verified.

All filenames below are under `docs/assets/screenshots/`.

| Image | Individual inspection |
|---|---|
| canvas.png | Centered card, contained toolbar/footer, balanced close inset; empty board whitespace is intentional. |
| command-palette.png | Search ring, result text and shortcuts fit; a partial next result belongs to the scrollport, rather than a clipped control. |
| conflict-resolver.png | Choices and footer fit; merged source continues in its own scrollport. |
| editor-preview.png | Split bounds and controls fit. Source review confirmed the editable CodeMirror preview intentionally retains active-line heading, wiki-link and task markers. |
| editor-recovery.png | Compact recovery message, accent and focused action fit its component capture. |
| empty-note.png | Centered empty state, contained actions and intentionally disabled editing controls. |
| git-panel.png | Dock starts below the app bar; close, tabs and commit controls fit. |
| graph.png | Overlay, toolbar, slider, legend and labels fit; sparse graph whitespace is intentional. |
| inspector-preview.png | Preview/citation/task text fits; references continue below the dock's visible area. |
| keyboard-shortcuts.png | Header, tabs, search and table columns fit; remaining shortcuts scroll. |
| knowledge-workbench.png | Card is centered, close inset is even, tabs and repair empty state fit. |
| mcp-audit.png | Authorization cards, radios, selected treatment, disclosure and audit rows fit. |
| mcp-panel.png | Header and close have clear insets; tabs, authority cards and workflow rows fit the scrolling dock. |
| mcp-sharing-inventory.png | Resource controls, metrics and disclosure fit; lower inventory sections scroll. Fixture date differs from the frozen Today control. |
| mcp-tools.png | Selector, JSON editor, invoke/copy actions and result heading fit; long results scroll. |
| mobile-inspector.png | Full-width selector/search and bottom navigation fit; inspector content scrolls. Duplicate inner mode-selector frame referred for repair. |
| mobile-vault.png | Vault header/actions/search/calendar and note rows fit; bottom navigation is separated. Duplicate mode frame referred for repair. |
| note-history.png | Complete outer border, even close inset, compare/restore actions and both source columns fit. Sparse retained-day data is intentional. |
| onboarding-tour.png | Initial card is centered, progress and heading fit, Next focus ring stays inset. Final steps are covered separately by the new zoom cases. |
| plugin-permissions.png | Warning, confirmation, metadata and actions align; lower permissions continue in the inspector scroller. |
| plugins-installed.png | Enabled/reviewed states and controls align; additional installed entries scroll. |
| plugins.png | Dense list dividers, badges and actions fit; bottom continuation is intentional. |
| publish-center.png | Full card corners, even header close inset and export actions fit; remaining profiles scroll. |
| settings-appearance.png | Header/close/tabs and appearance controls align; next field is partly visible in the modal scrollport. |
| settings.png | Sticky Save footer is separated from the scrolling form and retains its full allocation. |
| task-list-preview.png | Three task states and checkbox baselines fit; tight boundary belongs to the component capture. |
| toolbar-insert.png | Focused row, labels and padding remain inset within the menu capture. |
| toolbar-typography.png | Focused row, arrows and edge padding fit the menu capture. |
| vault-health.png | Summary opens at the top with clear badge/divider spacing; metrics, maintenance disclosure and repair controls fit. |
| workspace-dark.png | Columns, controls and status bars align; lower Publish readiness content is in the inspector scrollport. |
| workspace-light.png | Same geometry as dark, with readable states and clear health-card spacing. |
| workspace-mobile.png | Header/editor/status/bottom navigation fit; workspace tabs intentionally scroll horizontally. Duplicate mode frame referred for repair. |
| workspace-rendered.png | Editable center and fully rendered inspector controls fit; source markers remain intentional in the center, while lower references scroll. |
| workspace-selector.png | Focused vault selector has even inset and balanced vertical alignment. |
| workspace-tablet.png | Dense columns fit; partially revealed workspace tab and lower sidebar/inspector rows belong to their scroll regions. Mode selector frame referred for repair. |

The shared mode-selector repair removes the ordinary inner border while
retaining the select's own border where high zoom removes the parent frame.
That change and the separately reviewed top-bar popup placement patch were
authored after this capture source. Their fresh hosted checks and captures
must be inspected before attributing this worker's results to those changes.

The four historical MCP/History/Publish/Health reference differences were
inspected before refreshing. No screenshot threshold was widened. This worker
proves the refreshed references reproduce at its source revision; a fresh PR
visual worker must verify the integrated branch.

The apparent preview difference was traced through `EditorWorkspace.tsx`
(editable `wysiwyg` CodeMirror adapter), `wysiwyg-decorations.ts` (active caret
line syntax), `wikilink-decorations.ts` (marking rather than replacing authored
wiki links), and `InspectorRail.tsx` (full `MarkdownPreview` renderer).
`e2e/editor-markup-truth.spec.ts` requires extended task markers to remain in
the editable surface. The existing distinction is recorded in
`docs/ui-visual-review-2026-09-24.md` and `docs/validation/REPORT-REVIEW.md`.
This follow-up does not claim the editable view is identical to rendered output.
