# UI and visual review — 24 September 2026

This review covers the browser UI after the visual remediation. The [nine contact sheets](contact-sheets/sheet-01.png) index every available capture from the review run; [inventory.txt](inventory.txt) maps the numbered tiles to their screenshot names. Fourteen full-resolution screenshots preserve states that earlier documentation did not show, including touch at 320px, dark mobile, populated Reader and Kanban workspaces, import, Persian RTL Help, high zoom, and high contrast.

## Scope and result

- The 103-case visual workflow produced 102 passes and one blank-page failure before the dark-mobile app booted. That exact state passed five consecutive isolated reruns on one worker. The initial default-port attempt could not bind and ran no tests. These are workflow reliability limits, not a clean 103-case pass.
- All 128 current-run captures were scanned in eight indexed contact sheets, then RTL, Help, Reader, minimum-width, high-zoom, modal, and theme states were checked at full resolution. A ninth sheet contains the additional touch-specific capture, for 129 images indexed overall.
- The responsive matrix covered 320, 375, 768, 1024, and 1440px, plus desktop dark mode, dark Settings, narrow dark Help, and narrow dark Kanban. It found no page-level horizontal overflow. The selected six axe rules reported no automatically classified violations, but numerous contrast and ARIA nodes were marked incomplete. This does not establish WCAG conformance.
- A second 320px run enabled a coarse pointer and touch emulation. It revealed top-bar Settings and Help targets around 30×36px, a 28×36px toolbar customizer, and a 30×30px tab-close target. The design floor is 44×44px. The controls were enlarged, the redundant top inspector action was hidden in the narrow reflow, and a browser regression now measures the key targets. See the [corrected touch capture](screenshots/visual-mobile-touch-320.png).

## Additional full-resolution evidence

| State | Capture |
| --- | --- |
| Minimum-width touch workspace | [320px touch](screenshots/visual-mobile-touch-320.png) |
| Dark mobile workspace | [390px dark](screenshots/visual-mobile-dark-390.png) |
| Populated Reader | [PDF workspace](screenshots/visual-reader-pdf-workspace.png), [EPUB](screenshots/visual-reader-epub.png) |
| Kanban in workspace | [Board context](screenshots/visual-kanban-workspace.png) |
| Import in workspace | [Obsidian import](screenshots/visual-obsidian-import-workspace.png) |
| High zoom | [200% inspector](screenshots/visual-workspace-ui-zoom-200-inspector.png) |
| Bidirectional text | [Persian Help](screenshots/visual-help-rtl-fa.png), [Persian mobile](screenshots/visual-mobile-rtl-fa-390.png) |
| Narrow Help and workspace | [390px Help](screenshots/visual-help-mobile-390.png), [320px workspace](screenshots/visual-mobile-320.png) |
| Theme and localization | [Dark split editor](screenshots/visual-editor-split-dark.png), [high contrast](screenshots/visual-workspace-high-contrast.png), [German 1024px](screenshots/visual-workspace-de-1024.png) |

The captures also show a stable writing/inspector hierarchy, filled Reader viewports, distinguishable Kanban state icons, opaque dialogs, and bounded settings, Help, graph, canvas, publish, task, plugin, and RTL surfaces. Narrow desktop views remain at 100% scale. The 200% inspector places the note outline before health metrics.

## Remaining limits

- “Default inspector layout.” above the outline is low-value default copy, especially at 200% zoom. Removing or improving it is a minor design refinement; it was not treated as a behavioral failure.
- Persian Help explicitly marks its English guide body as `lang=en` and LTR, but full Persian guide translation remains incomplete.
- Browser screenshots cannot settle actual screen-reader reading order, native WebView behavior, or real-device tap precision. The incomplete axe nodes require manual assessment. The intermittent blank preview page merits investigation if it recurs with one worker.
