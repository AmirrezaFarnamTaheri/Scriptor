> Recovered authoring payload, not a fresh screenshot verification. Source trace: `session-2026-09-29-14-56-11-60b36026_001.jsonl`, line 355. Original path: `C:/Users/ACER/.penguin/data/default_project/agents/default_agent/scratchpad/session-2026-09-29-12-23-19-ea2f1a04/vr-review-C.md`.

# Visual QA Review — Batch C (knowledge / graph / canvas / kanban) — 13 images

Reviewer: subagent visual QA pass. All images rendered and inspected; fine-detail claims re-verified
with zoomed crops (`vr-review-C-imgs2/`). PNG dimensions on disk were used to confirm
file→content attribution after an early tool-rendering shuffle; every finding below refers to the
file whose content was actually verified for it.

## visual-knowledge-collections.png
- [MINOR] Left collection list — rows "Research notes", "Draft tags", "Inbox folder" are single-line chips spaced ~125px apart vertically (rows at y≈282/408/533 of 610), so the list reads as scattered items with vast gaps while the right column is dense → tighten to a consistent list row height/rhythm.
- [MINOR] Query chip "path has #research" (x≈235) is misaligned with the content column it heads ("No notes matched this collection." at x≈253) and is detached from the "Research notes" row it belongs to → align to the column grid and anchor under the selected collection.
- [MINOR] Refresh control "▷ Refresh" uses a play-triangle icon instead of a refresh/reload glyph, and floats at the far right (x≈788) away from the query it refreshes → use a refresh icon and sit it next to the query chip.
- [POLISH] Status copy `0 note(s) matched "Research notes" in 5ms.` — "0 note(s)" is clunky and the timing is developer noise → "No notes matched "Research notes"".
- [POLISH] "New collection" form is separated from the selected-collection detail ("No notes matched this collection.") by whitespace alone → add a divider or stronger section header.
- [POLISH] The three trash buttons are heavy outlined squares, visually louder than the chips they act on → lighter icon buttons.

## visual-knowledge-discover.png
- [POLISH] Action row icon inconsistency: "Open knowledge graph" carries a graph icon while "Unresolved link inbox", "Smart collections", "Tag browser" have none → give all four buttons icons, or none.
- [SUSPECT] Panel height here (290px) is less than half of the sibling tabs (~500–620px). If the panel height follows tab content, switching tabs will make the whole workbench jump; cannot confirm from a single static capture → verify panel height is fixed across tabs.

## visual-knowledge-tags.png
- [MINOR] Modal overlay has no scrim: a sliver of the underlying document text is visible above the panel's top edge ("…h into graph-assisted curation." — the Discover subtitle, cut mid-line) with no background dimming behind the workbench panel → dim the background behind the modal.
- [MINOR] Count line reads "1 tags" → pluralization bug; use "1 tag" (dynamic plural).
- [POLISH] Right-pane hint "Select a tag to see matching notes." is top-aligned in a ~300px-tall empty pane → vertically center the empty-state hint.
- [POLISH] Tag row is sparse: "#research" at the far left and its count "1" pushed to the far right of the narrow column (divider at x≈245) → place the count near the tag name.

## visual-knowledge-views.png
- [MINOR] One button row mixes two control types, visually identical: view selectors ("Modified this week", "Inbox (unorganized)") and actions ("Save current...", "Save presets to vault") → separate the actions from the saved-view chips or style them differently.
- [MINOR] "Save current..." is ellipsized while "Save presets to vault" shows in full — inconsistent button labeling/width → spell out "Save current view" or widen the button.
- [SUSPECT] Filter inputs ("Tag has" = "project", "Path matches" = "notes/*", "Modified within days" = "7") render as gray text on gray fill, which reads as placeholder-or-disabled; if these are live values they are ambiguous next to an empty "Title contains" field → distinguish placeholder from entered value (and disable styling only when actually disabled).

## visual-knowledge-triage-populated.png
- [MINOR] Same scrim-less overlay as tags: underlying document text peeks above the panel top edge ("…ple-facing asset.", cut mid-line) → dim the background behind the modal.
- [MINOR] "Next" appears only on the first card ("Triage 1 of 3: Research Plan"), while the other two cards have no action, and it shifts that card's metrics left ("in 12 · out 4" ends x≈833 vs "in 0 · out 9" / "in 0 · out 0" at x≈888) → move "Next" to the "Triage 1 of 3" progress row (queue-level) or add the action to every card; align metrics consistently.
- [MINOR] Cards are sparse: short titles like "2026-08-26" leave ~600px of empty width before the right-side metrics → compact the rows or surface more metadata (links preview, dates).
- [POLISH] "Unresolved (0)" is styled like its non-empty siblings "Orphans (3)" and "Dead ends (3)" although it has zero items → gray out / disable the zero-count filter.

## visual-graph-first-open-guidance.png
- [MINOR] Guidance card "Knowledge graph navigation" floats over the bottom status strip and clips the right-side status chips mid-text (visible "Diagnostics · Fresh · Gr" cut at the card edge) → position the card above the status bar or offset it so status remains readable.
- [MINOR] Edge lines cross node labels (verified in 2× crop): the "Research Plan" label is crossed by the Research Plan→Field Notes edge, and the incoming edge to "Methodology" grazes the end of that label → add label halos or offset labels away from edges.
- [POLISH] Graph header controls read "Workbench | View | Neighborhood (depth 2) | Save views" — the bare "View" label floats between buttons and reads like a button, and sits next to the similar-sounding "Save views" → use one label "View: [Neighborhood (depth 2)]".
- [POLISH] Legend "Current note → Directed link" documents only the filled node and the edge; the white/ring node style used for "Methodology" and "Field Notes" is unexplained → add a legend entry for linked notes.

## visual-graph-dense-120.png
- [MAJOR] Focus-node label occluded (verified in 2× crop): "Research Plan" is overlapped on both ends by neighboring purple nodes (one covering the "R…" start, another the "…an" end) because nodes render above labels → render labels above nodes and/or apply label collision avoidance/halo.
- [MINOR] Legend swatch color does not match the rendered palette: legend shows a green dot for "Current note" while nodes are periwinkle with a cyan focus node → align legend swatches with actual node colors.
- [SUSPECT] At "120 nodes · 160 edges", only the focus node is labeled — all 119 others are bare dots. If labels are hover-only this may be intentional, but the static view is unidentifiable → consider zoom-dependent/degree-based label reveal.
- [POLISH] Dense regions show touching/overlapping node circles and uniform node size, which hides importance/degree → size nodes by degree or add spacing force.

## visual-graph-disabled-recovery.png
- [POLISH] Heading repeats the panel title: header "Knowledge Graph" then "Knowledge Graph is disabled" → shorten heading to "Graph is disabled".
- [SUSPECT] Body copy "Enable the Graph module for this vault to explore note relationships." is medium gray on the light panel — contrast looks borderline for small text (cannot measure from screenshot alone) → verify ≥4.5:1.

## visual-canvas-empty.png
- [MAJOR] Empty state is detached from the canvas it acts on: the plus icon, "Start your research board", "Add a card now, or choose a template or tool above." and "Add first card" sit centered in the space ABOVE the large gray canvas surface (empty state ends y≈190; canvas box spans y≈232–475), leaving the actual board blank with no affordance → center the empty state inside the canvas area.
- [MINOR] Copy promises affordances that don't exist in the toolbar: "choose a template or tool above" — the toolbar shows "New board", "0 blocks", "Undo", "Redo", "Export", "Link to active note", no template picker → reword the copy or add a template entry point.
- [MINOR] "0 blocks" is styled as a disabled pill among action buttons although it is a counter → render as plain status text (e.g. right-aligned in the toolbar).
- [MINOR] Zoom cluster ("−", "100%", "+", "Reset view") floats detached at the canvas top-left, between the empty state and the canvas, and zooming an empty board is pointless → pin it inside the canvas corner and hide when the board is empty.
- [POLISH] Empty-state copy wraps awkwardly ("…choose a template or / tool above.") in a ~170px measure → widen the text measure.

## visual-canvas-populated.png
- [MINOR] Title-only cards are oversized: "Research question", "Evidence", "Synthesis", "Methodology.md", "Research Plan.md" each occupy a card roughly 2–3× their content height (verified crop: canvas surface extends below the cards — no overflow/clipping issue) → shrink cards to content or show body text.
- [MINOR] Spacing rhythm is uneven: the row gap (~100px) far exceeds the horizontal gaps (~55px), and row-2 columns ("Methodology.md", "Research Plan.md") don't align with row-1 columns → snap to a grid or even out spacing.
- [SUSPECT] No connector lines between the five blocks in a "research board" ("Research question → Evidence → Synthesis", "Methodology.md", "Research Plan.md") — if links are meant to render on the canvas they are missing here → verify connector rendering.

## visual-canvas-export-menu.png
- [MINOR] Status bar leaks an internal ID: "Added sticky-note: 4c3e08e1-769d-4f4d-af84-933763c357fce" → show the note title/first line instead of the UUID.
- [MINOR] Bottom-right status chips are clipped mid-label at the panel edge ("…Git · Spe", presumably "Spell") → ellipsize with "…" or wrap the chip row.
- [MINOR] The single canvas card ("Res…", title partly behind the menu) is oversized versus its title-only content → same fix as canvas-populated.
- [POLISH] Export menu items ("Export SVG", "Export PNG", "Export PDF") have no icons although the "Export" trigger carries a download icon → add matching icons. (Menu placement itself is correct: directly under the trigger, not clipped.)

## visual-kanban-workspace.png
- [MINOR] Sprint Board modal columns+cards stop at ~70% of the modal width ("Todo/Doing/Done" end at x≈565; modal ends x≈788) — the right ~30% is empty → stretch columns to fill the modal width.
- [MINOR] Left-rail truncations cut mid-word: "New from t" (button) and "Today · 202" (header) → ellipsize cleanly ("New from template…") or widen the rail.
- [MINOR] Kanban cards are ~2× content height: title row, dead space, then the "‹ ›" buttons at the card bottom → compact the card or move the buttons into the title row.
- [MINOR] No scrim behind the modal — the editor renders at full brightness behind it; separation relies on shadow only → dim the background.
- [MINOR] Bottom-right status chips clipped at the panel edge ("…Git · Spe") — same defect as canvas-export-menu → same fix.
- [SUSPECT] Done column move-button state (verified 2× crop): "Wire palette command" shows "‹" greyed and "›" darker, i.e. disabled on the wrong side — Done is the last column, so "›" should be disabled and "‹" enabled (move back to Doing); the populated capture shows BOTH greyed → verify and fix disabled-state logic; expected per column: first "‹" disabled, last "›" disabled.
- [SUSPECT] Inspector stats area shows "Plan assets" with its left side clipped behind the "Good" card row (top-right inspector) → verify overlap/clipping of that row.
- [POLISH] Column count badges ("1") are gray-on-gray pills, low contrast → darken.

## visual-kanban-populated.png
- [MAJOR] Columns fill only the left ~55% of the board: columns/cards end at x≈605 of a 1080-wide panel — the right ~45% is dead space → stretch columns to fill available width.
- [MAJOR] Done column's move buttons are BOTH greyed (verified 2× crop: "Wire palette command" card, "‹" and "›" both light gray): a completed card cannot be moved back to Doing, and the disabled state is on the wrong control ("›" is the one that should be disabled at the right boundary) → fix move-button disabled logic (expected: "‹" active in Done, "›" disabled).
- [MINOR] Cards carry dead space: title row then a gap then the "‹ ›" button row, ~2× content height → compact.
- [POLISH] Count badges ("1") gray-on-gray low contrast; Done title "Wire palette command" is greyed (~borderline contrast) though paired with a green check → darken completed-state text slightly.

## Coverage
| File | Status |
|---|---|
| visual-knowledge-collections.png | reviewed — 6 issues |
| visual-knowledge-discover.png | reviewed — 2 issues |
| visual-knowledge-tags.png | reviewed — 4 issues |
| visual-knowledge-views.png | reviewed — 3 issues |
| visual-knowledge-triage-populated.png | reviewed — 4 issues |
| visual-graph-first-open-guidance.png | reviewed — 4 issues |
| visual-graph-dense-120.png | reviewed — 4 issues |
| visual-graph-disabled-recovery.png | reviewed — 2 issues |
| visual-canvas-empty.png | reviewed — 5 issues |
| visual-canvas-populated.png | reviewed — 3 issues |
| visual-canvas-export-menu.png | reviewed — 4 issues |
| visual-kanban-workspace.png | reviewed — 8 issues |
| visual-kanban-populated.png | reviewed — 4 issues |

All 13 reviewed; no image CLEAN. Totals: 4 BLOCKER… none. MAJOR 4, MINOR 27, POLISH 15, SUSPECT 7 (53 findings).

## Issue summary
| Severity | Image | Location | Issue | Fix |
|---|---|---|---|---|
| MAJOR | visual-graph-dense-120.png | focus node label | "Research Plan" label overlapped on both ends by neighboring nodes (nodes draw above labels) | labels above nodes + collision offset/halo |
| MAJOR | visual-canvas-empty.png | canvas area | empty state ("Start your research board" / "Add first card") sits above the canvas surface, canvas itself blank | center empty state inside canvas |
| MAJOR | visual-kanban-populated.png | board width | columns fill only left ~55% (end x≈605 of 1080) | stretch columns to fill |
| MAJOR | visual-kanban-populated.png | Done card "‹ ›" | both move buttons greyed — Done card can't move back; disabled on wrong control | "‹" active in Done, "›" disabled |
| MINOR | visual-knowledge-collections.png | left list | rows ~125px apart for single-line chips | consistent list rhythm |
| MINOR | visual-knowledge-collections.png | query chip | "path has #research" misaligned (~18px) and detached from its row | align to column; anchor to selection |
| MINOR | visual-knowledge-collections.png | Refresh button | play-triangle icon "▷ Refresh", floats far right | refresh icon; next to query |
| MINOR | visual-knowledge-tags.png | overlay top | no scrim; underlying text peeks ("…h into graph-assisted curation.") | dim background behind modal |
| MINOR | visual-knowledge-tags.png | count line | "1 tags" pluralization | "1 tag" (dynamic plural) |
| MINOR | visual-knowledge-views.png | button row | selectors and actions mixed, identical styling ("Modified this week", "Save presets to vault") | separate or style differently |
| MINOR | visual-knowledge-views.png | "Save current..." | truncated label next to full "Save presets to vault" | "Save current view" / widen |
| MINOR | visual-knowledge-triage-populated.png | overlay top | no scrim; underlying text peeks ("…ple-facing asset.") | dim background |
| MINOR | visual-knowledge-triage-populated.png | card 1 ("Research Plan") | "Next" only on first card; shifts "in 12 · out 4" left vs other rows | move to "Triage 1 of 3" row; align metrics |
| MINOR | visual-knowledge-triage-populated.png | cards | short titles ("2026-08-26") + ~600px dead width | compact rows / more metadata |
| MINOR | visual-graph-first-open-guidance.png | guidance card | overlaps status strip, clips chips ("…Fresh · Gr") | place above status bar |
| MINOR | visual-graph-first-open-guidance.png | graph labels | edges cross "Research Plan" / graze "Methodology" | label halos / offset labels |
| MINOR | visual-graph-dense-120.png | legend | green "Current note" swatch vs periwinkle/cyan nodes | match legend to palette |
| MINOR | visual-canvas-empty.png | copy | "choose a template or tool above" — no template control exists | reword or add templates |
| MINOR | visual-canvas-empty.png | toolbar | "0 blocks" counter styled as disabled button | plain status text |
| MINOR | visual-canvas-empty.png | canvas top-left | zoom cluster floats detached; pointless when empty | pin in corner; hide when empty |
| MINOR | visual-canvas-populated.png | all 5 cards | title-only cards ~2–3× content height | shrink to content / show body |
| MINOR | visual-canvas-populated.png | rows | ~100px row gap vs ~55px column gap; row-2 grid shifted | even spacing / grid snap |
| MINOR | visual-canvas-export-menu.png | status bar | UUID leak: "Added sticky-note: 4c3e08e1-…-933763c357fce" | show note title |
| MINOR | visual-canvas-export-menu.png | status chips | clipped mid-label ("…Git · Spe") | ellipsize / wrap |
| MINOR | visual-canvas-export-menu.png | canvas card | oversized title-only card ("Res…") | shrink to content |
| MINOR | visual-kanban-workspace.png | modal width | columns stop at ~70% (x≈565 of x≈788) | stretch columns |
| MINOR | visual-kanban-workspace.png | left rail | "New from t", "Today · 202" cut mid-word | clean ellipsis / widen |
| MINOR | visual-kanban-workspace.png | cards | ~2× content height; "‹ ›" stranded at bottom | compact cards |
| MINOR | visual-kanban-workspace.png | modal overlay | no scrim behind modal | dim background |
| MINOR | visual-kanban-workspace.png | status chips | clipped ("…Git · Spe") | ellipsize / wrap |
| MINOR | visual-kanban-populated.png | cards | dead space between title and button row | compact |
| POLISH | visual-knowledge-collections.png | status line | "0 note(s) matched … in 5ms." clunky/dev-facing | "No notes matched "Research notes"" |
| POLISH | visual-knowledge-collections.png | New collection | only whitespace separates detail and create form | divider / section header |
| POLISH | visual-knowledge-collections.png | trash buttons | heavier than the chips they act on | lighter icon buttons |
| POLISH | visual-knowledge-discover.png | action row | icon on "Open knowledge graph" only | consistent icons |
| POLISH | visual-knowledge-tags.png | right pane | hint top-aligned in tall empty pane | vertical centering |
| POLISH | visual-knowledge-tags.png | tag row | "#research" and count "1" at opposite ends | move count near name |
| POLISH | visual-knowledge-triage-populated.png | "Unresolved (0)" | zero-count filter styled as active | disable / gray |
| POLISH | visual-graph-first-open-guidance.png | header controls | bare "View" label reads like a button | "View: [dropdown]" |
| POLISH | visual-graph-first-open-guidance.png | legend | ring-style linked nodes unexplained | add legend entry |
| POLISH | visual-graph-dense-120.png | node layout | touching nodes, uniform size hides degree | size by degree / spacing |
| POLISH | visual-graph-disabled-recovery.png | heading | "Knowledge Graph is disabled" under "Knowledge Graph" header | "Graph is disabled" |
| POLISH | visual-canvas-empty.png | empty-state copy | wraps awkwardly ("…template or / tool above.") | wider measure |
| POLISH | visual-canvas-export-menu.png | export menu | items lack icons vs icon'd trigger | add icons |
| POLISH | visual-kanban-workspace.png | count badges | "1" gray-on-gray | darken |
| POLISH | visual-kanban-populated.png | badges / Done title | low-contrast badge and greyed completed title | darken |
| SUSPECT | visual-knowledge-discover.png | panel height | 290px vs ~500–620px siblings — possible tab-switch jump (static shot can't confirm) | verify fixed panel height |
| SUSPECT | visual-knowledge-views.png | filter fields | gray-on-gray values ("project", "notes/*", "7") ambiguous placeholder vs disabled vs value | clarify input states |
| SUSPECT | visual-graph-dense-120.png | labels | 119/120 nodes unlabeled — may be hover-by-design | zoom/degree-based labels |
| SUSPECT | visual-graph-disabled-recovery.png | body copy | gray-on-light contrast borderline (unmeasurable from screenshot) | verify ≥4.5:1 |
| SUSPECT | visual-canvas-populated.png | connectors | no lines between blocks despite link-rich content | verify connector rendering |
| SUSPECT | visual-kanban-workspace.png | Done "‹ ›" | "‹" greyed / "›" active-looking — disabled on wrong side (populated shot shows both greyed) | fix disabled-state logic, consistent |
| SUSPECT | visual-kanban-workspace.png | inspector stats | "Plan assets" left side clipped behind "Good" card row | verify overlap |

