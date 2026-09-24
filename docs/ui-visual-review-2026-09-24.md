# UI visual review — 2026-09-24

This review covers the user-supplied close-ups and the documentation screenshot gallery. The gallery is static evidence from a sample vault, so items below describe what is visible; they do not imply that every workflow was exercised against a live vault.

The refreshed gallery contains 35 PNGs. All were inspected in contact sheets after the visual run; the empty-note and tablet captures were also inspected at full resolution. All 108 visual states passed after the final changes, alongside targeted regressions for tablet geometry, top-bar toggles, and the empty card.

## Corrected in this change

| Surface | Evidence | Finding and correction |
| --- | --- | --- |
| Empty editor | User close-up of “Start a new note” | The decorative outline ended above the two buttons and tagline. The whole empty state now lives in one content-sized card; the ambient gradient was removed. A browser geometry test checks the card at desktop and tablet widths. |
| History and vault controls | User close-up of back/forward, folder, and vault selector | The surrounding pill and inner scrolling created two clipped-looking ends around an already crowded control cluster. The redundant enclosing border/background and inner horizontal scroller are removed, leaving each control's own boundary intact. |
| Top-bar panel actions | User report of Git and Quick Capture | The same icon repeatedly issued an open-only action. Top-bar actions now toggle their own panel; deep links and command actions still explicitly open. A docked browser test checks repeat clicks on Git and Capture. |
| Support | User top-bar screenshot | The heart existed but was hidden by the default toolbar configuration. It is visible by default on desktop; only an unchanged prior default hidden-action set is migrated, preserving customized sets. The narrow mobile bar keeps it available through the command palette so the remaining controls retain 44px targets. |
| Top-bar hints | User cropped screenshot of tooltip over sidebar | A custom tooltip could escape its button and cover the workspace under the bar. Top-bar icon controls now use native titles and accessible names instead of positioned tooltips. |
| Tablet rail, daily note, and top bar | `workspace-tablet.png` | Narrow Inspector tabs clipped their names, the full “Today · date” label overflowed its center button, and the mode strip overlapped the vault selector after the history frame was removed. Rail tabs may wrap, the daily control shows its date while retaining the full accessible name and title, and tablet mode navigation uses a compact select. A geometry test checks labels and nonoverlap. |

## Deeper findings from the three repeated close-ups

1. **Empty state:** The main defect was the border/content mismatch. The message also wrapped to two lines because of a deliberately narrow text measure; that is acceptable at the shown width. The button pair remains readable and has distinct primary/secondary hierarchy. The small “Local-first…” tagline is low priority, but its contrast should be checked at 200% zoom and in dark mode during the next screenshot capture.
2. **History cluster:** The back and forward buttons are separate navigation controls; the folder button opens a vault and the selector switches recent vaults. The former pill implied that all four controls were one field, while the selector itself already had a border. Removing the outer pill makes this distinction clearer. Verify at 320, 375, 768, 1024, and 1440 pixels because the top bar still has a horizontal overflow policy.
3. **Source versus Preview:** The shown note begins `[@citekey]---`, followed by `_organized: true`. Valid YAML frontmatter must start with `---` on its own first line. The renderer intentionally preserves malformed frontmatter rather than silently hiding user content. In addition, center **Preview** and the right side of **Split** are editable CodeMirror visual Markdown surfaces, so they do not run the full HTML pipeline. The Inspector’s **Rendered output** uses the sanitized renderer and is the fidelity check for raw HTML, citations, imports, and other advanced Markdown. Calling the editable surface simply “Preview” overstates its fidelity. A future change should either make full rendering compatible with direct editing or rename it to “Visual edit” and provide a clear route to Rendered output. Do not hide malformed source as a visual patch.

The later close-up of the Outline card does not show a clipped heading, overlapping border, or missing affordance; the captured spacing is consistent with the other inspector cards. The marked tablet top-bar image does show the history/mode overlap, now corrected by the compact mode selector.

The **T Typography** action should keep its text label. Its menu includes typography transforms and cleanup, not font selection alone; “Font” would misdescribe it, and a bare “F” would be ambiguous beside Insert and Tools. If narrow layouts need space, an icon with the current accessible name is preferable to changing the meaning of the control.

## Gallery review and remaining follow-up

| Screenshots | Visual observation | Priority |
| --- | --- | --- |
| `workspace-light`, `workspace-dark`, `inspector-preview`, `workspace-rendered`, `editor-preview` | Source, editable Preview, and Inspector Rendered output use similar labels but different rendering engines. The screenshot examples look coherent for ordinary Markdown, yet the naming does not explain the HTML fidelity difference. | High |
| `workspace-tablet` | The tab/date clipping is corrected above. The status area still wraps into a tall footer; no data is hidden in the captured frame, but its hierarchy merits a focused redesign. | Medium |
| `graph`, `canvas` | Sparse data occupies a very large blank canvas. Graph nodes are small relative to the available viewport; the empty canvas board gives most space to an uninformative pale rectangle. Scale/fit and first-action placement deserve live interaction review. | Medium |
| `mcp-tools`, `plugin-permissions`, `plugins-installed` | Dense right-dock controls use small explanatory text and tightly stacked choices. Check keyboard focus order, 200% zoom, and whether the primary authorization decision stays visible when scrolling. | Medium |
| `publish-center`, `settings`, `settings-appearance` | Long modal forms rely heavily on scrolling. Sticky headers/footers preserve actions, but the captured settings pane shows many similar full-width fields with little sectional differentiation. | Medium |
| `knowledge-workbench`, `note-history`, `vault-health` | Empty, comparison, and status states are legible. The workbench empty state could bring its recovery or next action closer to the headline; history has ample unused width beside the revision list. | Low |
| `command-palette`, `conflict-resolver` | Selected command and conflict choices are visible. Conflict resolution has multiple code panes and actions that need a narrow-width, zoom, and keyboard-only pass before changing their layout. | Medium |

The supplied gallery images show one state per workflow. The visual run covers narrow desktop, tablet, mobile, dark mode, and 200% zoom. Editable Preview with raw HTML and docked versus modal panel presentation still need a dedicated live interaction review before claiming rendering parity or universal layout coverage.
