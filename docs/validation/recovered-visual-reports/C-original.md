> Recovered authoring payload, not a fresh screenshot verification. Source trace: `session-2026-09-29-14-52-24-57fe5839_001.jsonl`, line 217. Original path: `C:/Users/ACER/.penguin/data/default_project/agents/default_agent/scratchpad/session-2026-09-29-12-23-19-ea2f1a04/vr-review-C.md`.

# Visual QA — Batch C (knowledge / graph / canvas / kanban) — 13 images

Reviewer: PenguinHarness sub-reviewer C. All 13 images reviewed.

## Method & evidence note

The session's image-attachment channel was flaky: `read_file` repeatedly delivered
**recycled pixels from earlier reads** (e.g. the triage screenshot was attached to
reads of `visual-graph-dense-120.png`). Evidence integrity was preserved as follows:

1. PNG header dimensions + byte sizes were extracted programmatically for all 13
   files; every visual payload was matched to its true file by frame-size
   fingerprint (all frames are dimensionally distinct except 1392×734 / 1440×900
   pairs, which are content-distinct). The four knowledge-tab files are correctly
   named — the misdelivery was purely an attachment bug, not a capture bug.
2. The 7 images that had not been reliably seen directly
   (graph-dense-120, graph-disabled-recovery, canvas-empty, canvas-populated,
   canvas-export-menu, kanban-workspace, kanban-populated) were re-encoded to JPEG
   under new names and inspected by independent sub-inspectors with a
   stale-delivery recognition protocol; all 7 confirmed `DELIVERY: FRESH` and each
   scene matched its filename's semantics and frame size.

Findings below from direct review: collections, discover, tags, views,
triage-populated, graph-first-open-guidance. From independent sub-inspection: the
other 7 (marked `[sub]`).

---

## current--...--visual-knowledge-collections.png

- [MINOR] content area, status line vs detail pane — duplicated empty-result messaging: top line `0 note(s) matched "Research notes" in 5ms.` and the detail pane below the query chip both say the collection is empty (`No notes matched this collection.`) → keep one message (prefer the pane; drop or de-emphasize the top status line).
- [MINOR] left collection list — one-line chips `Research notes`, `Draft tags`, `Inbox folder` are spaced ~130px apart vertically, stretching three tiny rows over the full pane height → tighten row height (~40px) and let the list end where content ends.
- [MINOR] detail pane, top-right `Refresh` button — button is labeled `Refresh` but carries a play-triangle (▷) icon, i.e. a "run" affordance → use a reload/refresh icon, or rename the control to match the icon.
- [SUSPECT] trash buttons beside each collection chip — icon-only with no visible label; accessible name cannot be verified from the screenshot → confirm `aria-label` like "Delete collection Research notes".

## current--...--visual-knowledge-discover.png

- [MINOR] tab content — the Discover tab is nearly empty: one description line (`Navigate relationships, triage backlinks, and jump into graph-assisted curation.`), four buttons, and `Graph focus: Research Plan.md`; the right ~55% of the button row and everything below the focus line is dead space, and no actual discovery content (suggestions, tag cloud, graph preview) is offered → surface content or center the action block.
- [POLISH] `Graph focus: Research Plan.md` — the context line for the primary action `Open knowledge graph` is the faintest text on the surface; the note the action will target is easy to miss → fold the target into the primary button label or render it as a chip.

## current--...--visual-knowledge-tags.png

- [MINOR] tag list header — count is mis-pluralized: `1 tags` → pluralize by count (`1 tag`, `n tags`).
- [MINOR] right detail pane — empty state `Select a tag to see matching notes.` is a single small gray line at the top-left of an otherwise empty ~650×260 pane → center a proper empty state (icon + copy) or collapse the pane until a tag is selected.
- [POLISH] frame top edge — a clipped sliver of background text (`…and jump into graph-assisted curation.`) is visible above the modal header; the capture crops the underlying page mid-glyph → extend the capture region or fill the overlay background (same artifact in triage-populated).

## current--...--visual-knowledge-views.png

- [MINOR] preset/action chip row — view presets `Modified this week`, `Inbox (unorganized)` and actions `Save current...`, `Save presets to vault` share identical pill styling in one row, so toggles and buttons are indistinguishable → separate the actions spatially or style them as buttons with icons.
- [SUSPECT] filter inputs `Tag has`, `Path matches`, `Modified within days` — the visible values `project`, `notes/*`, `7` are placeholders in empty inputs but read like active filters (status line says `0 notes match this view`) → use obvious example placeholders (e.g. italic/`e.g.` prefix) or render active filters as removable chips.
- [POLISH] chip label `Save current...` — the trailing ellipsis reads as text truncation in a button label → `Save current view` (ellipsis only where a dialog opens is fine, but the label should name the object).

## current--...--visual-knowledge-triage-populated.png

- [MINOR] triage cards (all 3) — huge dead middle band: title/path (`Research Plan` / `Research Plan.md`, `Field Notes with an intentionally long title for zoom coverage` / `Field Notes.md`, `2026-08-26` / `daily/2026-08-26.md`) hug the left while `in 12 · out 4` metrics and the button hug the right, leaving ~600px empty between → bring metrics next to the title block or use a compact row layout.
- [MINOR] metrics column — right-side elements are not aligned across cards: card 1's `in 12 · out 4` sits left of its `Next` button while cards 2–3 (`in 0 · out 9`, `in 0 · out 0`) sit flush right → put metrics in a fixed right-aligned column.
- [MINOR] `Next` button placement — the sequential control `Next` lives inside card 1's row (`Triage 1 of 3: Research Plan`) while cards 2–3 have no actions at all; a "go to next triage item" action reads as a per-card action where it sits → move `Next`/`Skip` to the `Triage 1 of 3` header row or a card-footer action bar present on every card.
- [MINOR] sub-pills `Orphans (3)`, `Dead ends (3)`, `Unresolved (0)` — styled identically to the main tab pills (`Repair`, `Views`, `Collections`, `Tags`, `Discover`), giving two indistinguishable pill tiers → differentiate sub-tabs (underline, smaller pills, or segmented control).
- [SUSPECT] card metrics `in 12 · out 4` — small light-gray text; contrast against the card background not measurable from the capture → verify ≥4.5:1 for the metric token.
- [POLISH] frame top edge — clipped background text sliver (`…and jump into graph-assisted curation.`) above the modal header (same as tags) → extend capture / fill overlay background.

## current--...--visual-graph-first-open-guidance.png

- [MAJOR] graph canvas, `Methodology` node label — the edge line between `Methodology` and `Research Plan` (with its arrowhead) passes straight through the label text, visibly striking through "Metho|dology" → offset labels from edge routes, or give labels a background pill/halo so edges never strike through text.
- [MINOR] legend strip — `Current note → Directed link` has no entry for the hollow nodes (`Methodology`, `Field Notes`), so the two node renderings are unexplained → add a swatch for "linked note" (hollow) alongside "current note".
- [MINOR] bottom status bar — chip row truncates mid-label: after `Diagnostics` and `Fresh` the next chip renders as `● Gr` and the rest is missing (the canvas-window capture shows `Graph`, `MCP`, `Watch`, `Git`, `Spell` in the same row) → fix chip-row overflow/truncation in this window state.
- [SUSPECT] edges `Research Plan ↔ Field Notes` — the bidirectional pair renders as two nearly parallel lines ~3–5px apart, reading as a doubled stroke rather than two directed links → bow/offset reciprocal edges or merge visually with dual arrowheads.
- [POLISH] controls row — `Graph depth` slider value `2` floats detached far right past the track end → bind the readout adjacent to the slider end (same in graph-dense-120).
- [POLISH] first-open card (`First time here` / `Knowledge graph navigation`) — anchored bottom-right directly over the canvas; harmless with 3 nodes but it will occlude graph content in denser vaults → reserve a corner margin in the layout or make the card collapsible.

Clean elsewhere: guidance card hierarchy (eyebrow `First time here`, title, body, `Open guide` / `Start tour` primary / `Not now`, footer `F1 opens contextual help · Shift+F1 starts the contextual tour.`) is well built; no node clipped at canvas edges.

## current--...--visual-graph-dense-120.png  [sub]

- [MINOR] focus node label `Research Plan` (lower-left) — label sits directly against the cyan node's halo and an edge passes behind the label text → add a label background pill or push the label a few px clear of node and edge.
- [MINOR] center-right cluster (~x620–1030, y280–520) — several indigo nodes touch/overlap into merged blobs at 120-node density → raise collision radius / repulsion in the force layout for large graphs.
- [MINOR] legend `Current note` — the swatch is a dark-teal dot while the actual current node is bright cyan with a dark ring; the legend's fill-vs-outline promise is not matched by what is drawn → align swatch with the rendered focus-node style.
- [SUSPECT] node labels — all ~120 non-focus labels are dropped (only `Research Plan` is labeled); this keeps the mesh legible and may be intentional decluttering, but no hover/zoom-reveal policy is visible in the frame → confirm the declutter policy; if unintentional, add progressive label reveal on zoom/hover.
- [SUSPECT] header vs view mode — header reads `120 nodes · 160 edges · focus Research Plan.md` while `View` is `Neighborhood (depth 2)` and `Graph depth` is `2`; a depth-2 neighborhood of one note spanning all 120 nodes is suspicious → verify the view filter matches its label (or relabel the view).
- [POLISH] `Graph depth` slider value `2` — detached readout far right of the track (same as graph-first-open-guidance) → bind readout to slider end.

Clean elsewhere: no nodes clipped at canvas edges (wide margins all around); controls/legend occupy their own header bands and do not float over the graph; edge (teal) vs node (indigo) contrast holds up at density; dense but still parseable.

## current--...--visual-graph-disabled-recovery.png  [sub]

- [SUSPECT] frame left edge, at the header/body rule (~1/3 down) — a small blue/teal fragment is visible at the very edge; unclear whether it is a clipped UI accent or a re-encode artifact → check the source PNG; if real, keep the accent inside the panel bounds.
- [SUSPECT] body sub-copy `Enable the Graph module for this vault to explore note relationships.` — muted gray text reads lighter than the heading and cannot be measured in the capture → verify the muted token meets ≥4.5:1 on the panel background.
- [POLISH] secondary action `Cancel` — on a state-recovery panel (`Knowledge Graph is disabled`) "Cancel" implies aborting an in-progress action; `Not now` / `Close` matches the semantics better.

Clean elsewhere: the disabled state is unambiguous (power icon + heading `Knowledge Graph is disabled`), the recovery action is obvious (`Enable Graph` primary dark-green button), the copy states cause and fix in one sentence, and nothing is truncated or clipped at 520×218.

## current--...--visual-canvas-empty.png  [sub]

- [MAJOR] canvas vertical composition — the empty state is not centered: the icon/copy/CTA block (`Start your research board` / `Add a card now, or choose a template or tool above.` / `Add first card`) hugs the top (~48px below the toolbar) while ~447px of the tinted board panel below the CTA is pure dead space → center the block in the board panel (or full canvas viewport) so top/bottom margins match.
- [MINOR] empty-state copy — `Add a card now, or choose a template or tool above.` points at a template picker that does not exist in the toolbar (`Research board`, `New board`, `0 blocks`, `Undo`, `Redo`, `Export`, `Link to active note`) → add the template entry point or reword to only name reachable actions.
- [SUSPECT] muted text `0 blocks`, `New board ready.` and the sub-copy, plus the thin `+` glyph — light gray/faint strokes near the readability boundary → verify 4.5:1 (text) / 3:1 (icon) and darken if failing.
- [POLISH] primary CTA `Add first card` — styled as a quiet outline button identical in weight to `Reset view`, so the only meaningful action on an empty screen reads as secondary → give it the primary treatment.
- [POLISH] zoom cluster `−` `100%` `+` `Reset view` — fully active on a board with `0 blocks`, detached at far-left → disable while empty or float it over the board panel.

## current--...--visual-canvas-populated.png  [sub]

- [MINOR] canvas interior — sparse two-row layout leaves a ~130px dead band across the middle and an empty lower-left quadrant (`Research question`, `Evidence`, `Synthesis` top; `Methodology.md`, `Research Plan.md` bottom) → pack default placements tighter or auto-fit the view to content bounds.
- [MINOR] bottom-row cards `Methodology.md`, `Research Plan.md` — flush against (or a hair past) the canvas surface's bottom boundary while the top row keeps a ~10px inset → consistent card margins from the canvas edges / clamp placement to a padding inset.
- [POLISH] bottom pair `Methodology.md` + `Research Plan.md` — spans x≈358–1157 vs the centered top row, so the pair reads right-of-center → center rows on the canvas midpoint.
- [POLISH] card sizing — all five cards (`Research question`, `Evidence`, `Synthesis`, `Methodology.md`, `Research Plan.md`) are large boxes with single-line titles and empty bodies; note cards (~365px) and stickies (~300px) differ in width without content reason → size cards to content or show body preview text.
- [SUSPECT] connectors — no connector lines at all although the set reads as a workflow (`Research question` → `Evidence` → `Synthesis`); if the fixture expects links between cards this is a missing render → confirm whether connectors should appear on a populated board.

Clean elsewhere: no card overlaps, no z-order occlusion, no truncation/clipping at card boundaries, card and toolbar text contrast reads cleanly.

## current--...--visual-canvas-export-menu.png  [sub]

- [MINOR] canvas panel footer — a raw internal identifier is shown to the user: `Added sticky-note. 4c3e60e1-7696-4f4d-af84-9337633c5cfe` → replace the UUID with a friendly label (note title / "just now"; keep the id in a tooltip).
- [SUSPECT] export menu vs canvas card — the open menu's bottom edge slices the glyph tops of the card title `Research Plan` (menu ≈x417–636, bottom ≈y238; title ≈y220–248), which reads like truncation of the only content on the board → if considered a defect, offset/resize the menu so the title stays legible; popover-over-content is otherwise standard.
- [SUSPECT] menu anchoring — the menu's left edge sits a few px left of the `Export ⌄` trigger's left edge while extending well past its right edge; could be measurement noise from the re-encode → verify the menu is anchored flush to the trigger.
- [POLISH] export menu rows — panel is ~220px wide while labels (`Export SVG`, `Export PNG`, `Export PDF`) use ~80px, leaving a dead right area with no icons or shortcut hints → narrow the menu to content width or add right-aligned key hints.

Clean elsewhere: no clipping at window edges; item rows evenly spaced (~34px) with consistent left alignment; no truncation in items; visible drop shadow separates the menu from the pale canvas; `Export` is clearly the active trigger.

## current--...--visual-kanban-workspace.png  [sub]

- [MAJOR] Sprint Board modal, column area — the three columns (`Todo`/`Doing`/`Done`) span only x≈220–906 of a modal body running to x≈1240: the right third (~330px) of the board area is blank, so the board looks wrong-sized → let columns flex to fill the modal width (or size the modal to the board).
- [MINOR] cards, all columns — ~40px dead vertical band in every card between the title row (`Draft release notes`, `Verify panel mounts`, `Wire palette command`) and the `‹ ›` buttons pinned bottom-right → collapse card height to content or move buttons inline with the title.
- [MINOR] cards, all columns — no drag affordance anywhere (no grip, dots, hover hint); the only move mechanism visible is the `‹ ›` buttons → add a visible grip handle if drag-and-drop is supported.
- [MINOR] `‹ ›` move buttons — icon-only, no visible tooltip/label; meaning of each chevron is not discoverable from the screen → add tooltips + accessible names ("Move left"/"Move right").
- [MINOR] `‹ ›` disabled state — inconsistent across board ends: `Done`'s `›` is visibly lighter (disabled), but `Todo`'s `‹` (nowhere to move left) renders with a solid border and dark chevron, indistinguishable from an enabled control (confirmed on the populated-board capture too) → apply identical disabled styling to both board ends.
- [SUSPECT] left sidebar rows — labels read `New from t…` and `Today · 202…` where the modal's left edge cuts across them; `…` may be real truncation or an artifact of the modal occluding the row → re-check in an unobstructed capture.
- [SUSPECT] board presentation — the kanban surface is a floating modal (~1070×325, frame-centered) over the markdown editor (`kanban-plugin: basic` visible behind it) rather than a docked pane; margins are symmetric so it looks deliberate, but if the design intent is an embedded board this is wrong → confirm intended placement.

Clean elsewhere: column widths equal (~220px, ~13px gutters); header text and count badges (`1`/`1`/`1`) aligned consistently; no card text truncation; nothing clipped at frame/column edges.

## current--...--visual-kanban-populated.png  [sub]

- [MINOR] `Todo` card (`Draft release notes`) — its `‹` button renders fully enabled (solid border, dark chevron) although the leftmost column has nowhere to move left, while the mirror case in `Done` is visibly disabled → apply the same disabled styling/behavior to `‹` in the first column as to `›` in the last.
- [MINOR] `Done` card (`Wire palette command`) — the disabled `›` is nearly invisible (no border, chevron almost matches the background), so it reads as a missing control rather than a disabled one → keep a visible border, use a clear disabled tint (~50% opacity) and `aria-disabled`.
- [MINOR] cards, all three (`Draft release notes`, `Verify panel mounts`, `Wire palette command`) — 35–45px dead band between the title row and the bottom-right `‹ ›` buttons for single-line titles → move the buttons onto the title row or shrink card height.
- [MINOR] board area — the columns fill only ~2/3 of the frame width and stop ~60px above the panel's bottom edge, leaving an L-shaped empty region in the short/wide frame → stretch columns to fill / size the panel to the board's height (same defect as the workspace capture).
- [SUSPECT] cards — no drag grip handles visible; `‹ ›` is the only move affordance → add a grip if drag is supported; fine if buttons are the sole mechanism.

Clean elsewhere: `Sprint Board` / `3 columns` header with `Refresh` + `×` is consistent; count badges `1`/`1`/`1` aligned across columns; `Wire palette command` strikethrough + check icon clearly marks the Done card.

## Cross-image notes

- Tab strip consistency (collections / discover / tags / views / triage): consistent — same pill geometry and order (`Repair`, `Views`, `Collections`, `Tags`, `Discover`), same active treatment (teal outline + teal text), same header block (`Knowledge workbench` / `Repair queues, saved views, and tag discovery in one place.`). No defect.
- [POLISH] knowledge workbench modal — panel height jumps between tabs (290px on Discover → 496–622px on the others): the surface resizes per tab, so the modal visibly reflows when switching → pick a stable panel height (or min-height) across tabs.

## Coverage

| File | Status | Issues |
|---|---|---|
| visual-knowledge-collections.png | reviewed (direct) | 4 |
| visual-knowledge-discover.png | reviewed (direct) | 2 |
| visual-knowledge-tags.png | reviewed (direct) | 3 |
| visual-knowledge-views.png | reviewed (direct) | 3 |
| visual-knowledge-triage-populated.png | reviewed (direct) | 6 |
| visual-graph-first-open-guidance.png | reviewed (direct, re-read verified) | 6 |
| visual-graph-dense-120.png | reviewed (sub-inspection, fresh) | 6 |
| visual-graph-disabled-recovery.png | reviewed (sub-inspection, fresh) | 3 |
| visual-canvas-empty.png | reviewed (sub-inspection, fresh) | 5 |
| visual-canvas-populated.png | reviewed (sub-inspection, fresh) | 5 |
| visual-canvas-export-menu.png | reviewed (sub-inspection, fresh) | 4 |
| visual-kanban-workspace.png | reviewed (sub-inspection, fresh) | 7 |
| visual-kanban-populated.png | reviewed (sub-inspection, fresh) | 5 |

13/13 reviewed. No image was CLEAN. Severity totals: 0 BLOCKER · 3 MAJOR · 28 MINOR · 15 SUSPECT · 14 POLISH (incl. 1 cross-image) = 60.

## Issue summary

| Severity | Image | Location | Issue | Fix |
|---|---|---|---|---|
| MAJOR | visual-canvas-empty | canvas vertical composition | Empty state hugs the top (~48px gap) with ~447px dead space below `Add first card` | Center icon/copy/CTA in the board panel |
| MAJOR | visual-kanban-workspace | Sprint Board modal column area | Columns span x≈220–906 of a body to x≈1240; right third blank | Flex columns to fill modal width |
| MAJOR | visual-graph-first-open-guidance | graph canvas, `Methodology` label | Edge line + arrowhead strike through the node label text | Offset labels from edge routes / label halo |
| MINOR | visual-knowledge-collections | status line vs detail pane | Duplicated empty messaging (`0 note(s) matched "Research notes" in 5ms.` + `No notes matched this collection.`) | Keep one message |
| MINOR | visual-knowledge-collections | left collection list | ~130px vertical gaps between one-line chips | Tighten row rhythm |
| MINOR | visual-knowledge-collections | `Refresh` button | Play-triangle ▷ icon on a `Refresh` control | Reload icon or rename to run/query |
| SUSPECT | visual-knowledge-collections | chip trash buttons | Icon-only delete with unknown accessible name | Verify `aria-label` per collection |
| MINOR | visual-knowledge-discover | tab content | Near-empty tab, right ~55% + lower half dead space | Add discovery content or center block |
| POLISH | visual-knowledge-discover | `Graph focus: Research Plan.md` | CTA context is the faintest text on the page | Strengthen or fold into primary button |
| MINOR | visual-knowledge-tags | tag list header | `1 tags` wrong pluralization | `1 tag` / `n tags` |
| MINOR | visual-knowledge-tags | right detail pane | One gray line in a ~650×260 empty pane | Centered empty state or collapse pane |
| POLISH | visual-knowledge-tags | frame top edge | Clipped background text sliver above modal | Extend capture / fill overlay bg |
| MINOR | visual-knowledge-views | preset/action chip row | Presets and actions share identical pill styling | Separate or restyle actions |
| SUSPECT | visual-knowledge-views | filter inputs | Placeholder values (`project`, `notes/*`, `7`) read as active filters | Example-styled placeholders or filter chips |
| POLISH | visual-knowledge-views | `Save current...` chip | Ellipsis reads as truncation | Name the object (`Save current view`) |
| MINOR | visual-knowledge-triage-populated | triage cards | ~600px dead middle band between title block and metrics | Compact row layout |
| MINOR | visual-knowledge-triage-populated | metrics column | `in 12 · out 4` misaligned vs `in 0 · out 9` / `in 0 · out 0` | Fixed right-aligned metrics column |
| MINOR | visual-knowledge-triage-populated | `Next` button | Sequential control inside card 1; cards 2–3 have none | Move to `Triage 1 of 3` header / footer bar |
| MINOR | visual-knowledge-triage-populated | sub-pills vs main tabs | `Orphans (3)` etc. styled like `Repair`/`Views`/… tabs | Differentiate sub-tabs |
| SUSPECT | visual-knowledge-triage-populated | `in 12 · out 4` | Small light-gray metric text, contrast unverified | Check ≥4.5:1 |
| POLISH | visual-knowledge-triage-populated | frame top edge | Clipped background text sliver | Extend capture / fill overlay bg |
| MINOR | visual-graph-first-open-guidance | legend | No legend entry for hollow nodes | Add "linked note" swatch |
| MINOR | visual-graph-first-open-guidance | bottom status bar | Chips truncate mid-label (`● Gr`) vs full `Graph`/`MCP`/… elsewhere | Fix chip-row overflow |
| SUSPECT | visual-graph-first-open-guidance | `Research Plan ↔ Field Notes` edges | Reciprocal pair renders as doubled stroke ~3–5px apart | Bow/offset reciprocal edges |
| POLISH | visual-graph-first-open-guidance | `Graph depth` slider | Value `2` detached from track end | Bind readout to slider |
| POLISH | visual-graph-first-open-guidance | first-open card | Guidance card overlays canvas (occludes at density) | Reserved corner margin / collapsible |
| MINOR | visual-graph-dense-120 | `Research Plan` label | Label touches node halo and an edge | Label pill / offset |
| MINOR | visual-graph-dense-120 | center-right cluster | Nodes merge into blobs at 120-node density | Raise collision radius |
| MINOR | visual-graph-dense-120 | legend `Current note` | Swatch (teal dot) ≠ rendered focus node (cyan + ring) | Match swatch to node style |
| SUSPECT | visual-graph-dense-120 | node labels | All ~120 non-focus labels dropped | Confirm declutter policy; hover/zoom reveal |
| SUSPECT | visual-graph-dense-120 | header vs `View` | `120 nodes · 160 edges` under `Neighborhood (depth 2)` | Verify view filter matches label |
| POLISH | visual-graph-dense-120 | `Graph depth` slider | Value `2` detached from track | Bind readout to slider |
| SUSPECT | visual-graph-disabled-recovery | left frame edge | Small blue/teal fragment at header/body rule | Check source PNG; clip accent |
| SUSPECT | visual-graph-disabled-recovery | sub-copy | Muted gray contrast unverified | Verify ≥4.5:1 |
| POLISH | visual-graph-disabled-recovery | `Cancel` button | "Cancel" semantics wrong on recovery panel | `Not now` / `Close` |
| MAJOR | visual-canvas-empty | canvas vertical composition | Empty state not centered; ~447px dead space below CTA | Center block in board panel |
| MINOR | visual-canvas-empty | empty-state copy | Promises a template picker that doesn't exist | Add entry point or reword |
| SUSPECT | visual-canvas-empty | muted text + `+` icon | `0 blocks`, `New board ready.` near readability floor | Verify contrast ratios |
| POLISH | visual-canvas-empty | `Add first card` | Primary CTA styled like secondary `Reset view` | Primary treatment |
| POLISH | visual-canvas-empty | zoom cluster | Zoom/reset active on `0 blocks` board | Disable while empty / re-anchor |
| MINOR | visual-canvas-populated | canvas interior | ~130px dead band + empty lower-left quadrant | Tighter placement / auto-fit |
| MINOR | visual-canvas-populated | bottom-row cards | Flush to canvas bottom edge vs 10px top inset | Consistent edge margins |
| POLISH | visual-canvas-populated | bottom card pair | Right-of-center vs centered top row | Center rows |
| POLISH | visual-canvas-populated | all 5 cards | Oversized empty-bodied cards; two widths | Size to content / show preview |
| SUSPECT | visual-canvas-populated | connectors | No connector lines on workflow-like set | Confirm expected rendering |
| MINOR | visual-canvas-export-menu | panel footer | Raw UUID `Added sticky-note. 4c3e60e1-…` shown to user | Friendly label; id in tooltip |
| SUSPECT | visual-canvas-export-menu | menu vs card title | Menu bottom slices glyph tops of `Research Plan` | Offset/resize menu |
| SUSPECT | visual-canvas-export-menu | menu anchoring | Menu edge misaligned with `Export` trigger | Verify flush anchoring |
| POLISH | visual-canvas-export-menu | menu rows | ~220px menu vs ~80px labels, dead right area | Narrow menu or add key hints |
| MAJOR | visual-kanban-workspace | modal column area | Columns fill only ~2/3 of modal body | Flex columns / resize modal |
| MINOR | visual-kanban-workspace | cards | ~40px dead band between title and `‹ ›` | Inline buttons / shrink cards |
| MINOR | visual-kanban-workspace | cards | No drag affordance visible | Add grip if drag supported |
| MINOR | visual-kanban-workspace | `‹ ›` buttons | Icon-only, no labels/tooltips | Tooltips + accessible names |
| MINOR | visual-kanban-workspace | `‹ ›` disabled state | `Todo` `‹` looks enabled while `Done` `›` is disabled | Uniform disabled styling |
| SUSPECT | visual-kanban-workspace | sidebar rows | `New from t…` / `Today · 202…` — truncation vs occlusion | Re-check unobstructed |
| SUSPECT | visual-kanban-workspace | board presentation | Floating modal over editor, not docked pane | Confirm intent |
| MINOR | visual-kanban-populated | `Todo` card `‹` | Enabled look though nothing is left of `Todo` | Match disabled styling of `Done` `›` |
| MINOR | visual-kanban-populated | `Done` card `›` | Disabled control nearly invisible | Visible border + disabled tint + aria |
| MINOR | visual-kanban-populated | cards | 35–45px dead band under titles | Inline `‹ ›` / shrink cards |
| MINOR | visual-kanban-populated | board area | Columns fill ~2/3 width; L-shaped dead space | Stretch columns / size panel |
| SUSPECT | visual-kanban-populated | cards | No drag grips | Add if drag supported |
| POLISH | knowledge tabs (all 4) | modal height | Panel height jumps 290–622px between tabs | Stable min-height across tabs |

