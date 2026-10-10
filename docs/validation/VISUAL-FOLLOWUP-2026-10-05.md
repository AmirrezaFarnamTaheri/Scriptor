# Visual follow-up — 2026-10-05

Revision inspected: `45f521f944459f5c47eb85a43f10516dba7a8f03`.
Artifacts: visual run `37232299727`, browser run `37232299661`, downloaded under
ignored `artifacts/verification/github-<run-id>-visual/` and
`artifacts/verification/github-37232299661-browser-evidence/`.

The previous ledgers individually cover all 115 unique images from run
`37206096374`. This follow-up reinspects six current visual images and all five
functional failure PNGs; it does not silently relabel the entire current corpus
as manually reviewed. The current visual manifest has 115 unique images.

| Current visual image suffix | Individual disposition |
|---|---|
| `screenshots-mcp-panel--mcp-panel-actual.png` | Title/actions and tabs remain contained; first card clears divider; ordinary-zoom reference change is intentional. |
| `screenshots-note-history-panel--note-history-actual.png` | Upper/lower panel borders remain in window; comparison and restoration controls are contained; first row clears header. |
| `screenshots-publish-center--publish-center-actual.png` | Both upper corners are visible near y24 in the 1440×900 frame; title/close have insets; long profile list uses the body scroller. |
| `screenshots-vault-health-dashboard--test-failed-1.png` | At ordinary zoom, healthy badge clears divider, metric grid and repair fields remain within the panel. Reference drift is intentional. |
| `51bce-annotation-popover-evidence--visual-reader-annotation.png` | Opaque annotation surface; underlying prose no longer shows through; comment/action controls remain contained. |
| `869ad-or-zoom-comparison-evidence--visual-codemirror-375-default-100.png` | Opaque sticky Source/Split/Preview control; underlying formatting icons no longer show through; note tab and mobile navigation remain contained. |

All suffixes identify manifest files beginning `images/current--`; the two
longer visual evidence names also contain `visual-review-visual-revie-`.

| Browser failure image directory prefix | Finding and disposition |
|---|---|
| `export-integrity-previewin-c65f1` | Export reported a tainted canvas. Preview could reinitialize shared Mermaid settings while export awaited rendering. Shared queue/source tests added; new hosted execution pending. |
| `research-workspaces-resear-ed28c` | Bibliography title fits but close/right content extends beyond the window under manually injected HTML zoom. Explicit effective bounds and real app-zoom regressions added; pending worker. |
| `screenshot-polish-regressi-9c354` | Git panel is visibly partway through opening. The 32px control measured 31.005px under the entrance transform. Wait for finite ancestor animations; original limit retained. |
| `tab-health-spacing-note-ta-1213f` | LTR 200% health badge gap reduced to 7.5 CSS pixels. Snapshot identifies lower Maintenance summary as initial focus. Focus reading context first; original 12–24px limits retained. |
| `tab-health-spacing-note-ta-4c86b` | Same initial-scroll defect under RTL 200%; shared health focus repair and unchanged clearance checks cover both directions. |

Source-pattern audit also identified translucent sticky Canvas table headings
and output dock headers. Opaque base repairs and computed pixel-alpha checks
were added; these are source-derived risks, not additional defects independently
observed in the images above. Computed background alpha does not prove every
sticky scroll/compositing state. No full local suite, build or application runtime
was used. Provider accounts, packaged devices, screen readers and broad platform
performance remain outside this artifact's proof.

Independent React review also caught a reachable empty-to-diagnostics focus loss
in the first repair: replacing the focused empty paragraph removed its DOM node.
The final introduction target persists across empty, healthy and issue states.
Four opt-in delayed native-response browser cases assert intro/Close focus stays
where the user left it, body scroll remains at zero, and Escape still dismisses.
This source-discovered defect is distinct from the image findings above; hosted
verification is pending.
