> Reconstructed authoring history, not a fresh screenshot verification. Source trace: `session-2026-09-29-14-53-15-49d201e6_001.jsonl`. Applied edits at lines 273, 349, 373, 375; every exact old-string precondition matched. Original scratchpad files are unavailable; tool-call reconstruction cannot establish the final historical file contents independently of those authoring calls.

# Visual QA Review — Batch F (docks/panels/help)

Reviewer: PenguinHarness subagent (batch F, 28 images). Evidence-based pass; uncertain items marked SUSPECT.

## visual-dock-jobs.png

- [SUSPECT] tab bar vs list body — tab badge reads "Jobs 0" while the panel body lists one job row ("Index rebuild" … "Ready"); if the badge counts all jobs the numbers contradict, if it counts only active jobs the label is misleading → clarify what the badge counts or show "1" here.
- [MINOR] job row (body) — "Index rebuild" (teal, left) and "Ready" (gray, far right) are separated by ~1200px of empty space with no column header or divider; "Ready" is plain text with no status chip, while Problems/Search rows use colored/monospace emphasis, so job status is the least legible of the docks → render status as a badge (color-coded) and constrain the name/status columns.
- [POLISH] tab bar — "Output" tab carries no count chip while siblings show "Problems 1", "Search Results 0", "Jobs 0"; inconsistent tab adornment across the same strip → give Output a count or drop the others'.

## visual-dock-output.png

- [MINOR] log body (two entries) — both entries are titled "Opened vault Research Vault" but the path lines disagree in style and content: "/ScriptorVault" (relative) vs "C:/Scriptor/fixtures/minimal" (absolute); identical event label over two different-looking paths is confusing → normalize path display (always absolute or always vault-relative) and/or differentiate the event labels.
- [MINOR] log body — paths render in the same proportional font as the prose ("Opened vault", timestamps); in an output/log dock, paths are the scan target and should be monospace like the Problems dock's "FOAM-MISSING-REFERENCE" → set path lines in monospace.
- [POLISH] header strip — body heading "Output" duplicates the active tab label "Output" (same duplication as "Problems (1)" vs tab "Problems 1") → drop the in-body heading or repurpose the row for controls.

## visual-dock-problems.png

- [MINOR] problem entry — the only problem ("FOAM-MISSING-REFERENCE", "Research Plan.md", "L15:5 · Missing link reference definition for [unresolved-reference]") is styled in the same teal accent the Output dock uses for routine events; no error/warn/info icon or color distinction exists anywhere in the panel → add severity icon + color (red/amber/gray) and keep the rule id monospace.
- [POLISH] header — "Problems (1)" repeats the tab count "Problems 1" in the same strip → collapse to one count.
- [SUSPECT] "Editor lint" row — the bulk action "Generate link references" button is placed in the group-label row of "Editor lint" without explanation of scope (fixes one rule? all refs?); reads like a toolbar orphaned next to a label → move to panel toolbar and/or add tooltip.

## visual-dock-search-results.png

- [MINOR] result 1 snippet — truncated at both ends with no ellipsis: "tes - Methodology Outline Collect sources due: 2026-06-30 Dr" starts mid-word ("tes") and ends mid-word ("Dr") → center-truncate around the match with "…" on both ends.
- [MINOR] result snippets — the query term "Methodology" is not highlighted in either snippet ("tes - Methodology Outline…", "Methodology Qualitative synthesis…") although the heading says "Search Results for "Methodology"" → highlight matched terms.
- [MINOR] result rows — no divider and no extra spacing between results: the gap between result 1's snippet and result 2's title ("Methodology") equals the within-row line spacing, so the two results read as one paragraph → group rows (divider or ≥1.5× gap).
- [POLISH] body heading — "Search Results" is bold while `for "Methodology"` is regular in the same line; mixed weight mid-phrase → style the query as bold/highlighted instead.

## visual-inbox-populated.png

- [SUSPECT] search field ("Search notes") — trailing hint is a lone "F" at the right edge of the input; unexplained (conventional hints are "/" or "⌘F") and reads as stray text → show the full accelerator ("Ctrl+F") or remove.
- [MINOR] note rows — each row shows the title and the identical filename ("Field Notes" / "Field Notes.md", "Research Plan" / "Research Plan.md"); the right-hand gray filename duplicates the title and eats the action column → show filename only when it differs from the title (or replace with date/preview).
- [POLISH] header area — "Inbox 2" tab badge and "Inbox (2)" section heading duplicate the same count within one screen → keep one.
- [SUSPECT] selected row "Research Plan" — gray filename "Research Plan.md" on the teal-tinted selected background appears lower-contrast than on the white row above → verify contrast (AA) of secondary text on the selected-row fill.
- [POLISH] bottom toolbar — three unlabeled icon buttons (an unclear glyph, trash, "+") float bottom-left with the rest of the strip empty; the first icon has no obvious meaning → add tooltips/labels and align to a defined toolbar slot.

## visual-tasks-populated.png

- [MINOR] checkbox column — checkbox outlines are inconsistently colored between rows with no visible state difference: teal on "Draft methodology", "Verify panel mounts", "Wire palette command"; dark gray on "Collect sources", "Synthesize findings", "Draft release notes" → if the color encodes a state, label it; otherwise normalize the stroke color.
- [POLISH] task rows — a chevron "›" is glued to the right of each title ("Collect sources ›") instead of sitting in the right action column; it collides visually with long titles → right-align the chevron in the action slot.
- [POLISH] right column — the overdue row substitutes date text "2026-06-30" (red) for the calendar icon button every other row shows; slot content flips type row-to-row → keep the icon button and render the date beside it.
- [SUSPECT] filter row — the "All" status select shows a teal focus ring in this capture ("Status [All ▾]"); if the suite isn't intentionally capturing focus state it looks like a styling leak → blur before screenshot or accept as fixture artifact.

## visual-snippets.png

- [MAJOR] snippet list (left column) — row rhythm is broken: "literature-note" sits directly under "New snippet", then ~130px of empty space, then "method-check"; two list items are vertically spread apart as if stretched across the column → make the list a tight stack (fixed row height, gap ~4-8px).
- [MINOR] "Content" textarea — contains literal escape sequences in one line: "## ${1:Finding}\n\nSource: ${2:citation}\n\n${3:Notes}" inside a tall multi-line field; `\n` is not rendered as line breaks, so the editor height promises multiline editing the value doesn't have → render real newlines (or make it a single-line JSON field).
- [POLISH] footer — the form edits the selected snippet (Name/Description/Content of "literature-note") but the primary button reads "Save catalog"; scope mismatch between form and CTA → rename to "Save snippet" (or "Save changes").

## visual-template-picker.png

- [POLISH] list row — the selected "Blank note" row is highlighted in neutral gray while every other selection in the app is teal (active dock tab underline, "Inbox 2" pill, preset pills); selection color inconsistent across surfaces → use the teal selection treatment here too.
- [POLISH] "Filter templates…" input — filled dark-gray placeholder field, while the same app uses white inputs elsewhere (e.g. "Search notes" in the inbox panel) → unify input styles across surfaces.

## visual-writing-targets.png

- [MAJOR] "Recent history" chart vs list — bar heights contradict the data list below them for every day: list "2026-09-19: 620 words" but the 09-19 bar tops out between the 500 and 600 gridlines (~530); "2026-09-20: 540 words" bar ≈ 470 (below the 500 line); "2026-09-21: 198 words" bar ≈ 165 (below the 200 line); all bars ≈ 0.85× their listed values → fix the chart scale/series mapping so bars plot the same numbers the list shows.
- [MAJOR] chart target line — the dashed orange "Target" line sits at ~450 (between the 400–500 gridlines) while "Daily word target" reads "500"; the line does not match the configured target → plot the target line at the input's value (500).
- [MINOR] chart + list — the same seven days are presented twice (bar chart and a bullet list "2026-09-21: 198 words" …) and currently disagree; redundant paired views that must be manually reconciled → keep one view, or make the list the hover/tooltip detail of the chart.
- [SUSPECT] "Recent history" range — latest entry is "2026-09-21" while the app's current date elsewhere is "Today · 2026-09-29" and this panel shows "Today: 19 / 500 words" — an 8-day gap between "today" and "recent" history → confirm whether the history should include 09-22…09-29.

## visual-performance-hud.png

- [POLISH] panel title — "Perf" is the only abbreviated panel title in the batch ("Writing targets", "Built-in modules", "Snippet catalog" are spelled out) → rename to "Performance".
- [POLISH] metric rows — missing metrics render as bare em-dashes ("Vault open —", "Last search —", "Graph nodes —") with no unit column; when values do appear ("Tabs 1", "Sections 1") the unit is also absent → add units ("ms", "nodes") or a right-aligned unit label.

## visual-built-in-modules.png

- [MINOR] preset pill row — two pills look simultaneously active: "Scientific" has a teal border and "Complete" has a teal border plus teal text → one selected state only; distinguish hover/focus from selection.
- [SUSPECT] module toggles — all five toggles ("Spatial Canvas", "CSL Citations", "Pandoc & Typst Export Engine", "Interactive Knowledge Graph", "Model Context Protocol (MCP)") show a pale track with a dark teal knob on the right; the track never fills with accent, so the on-state reads weakly (and off-state would look nearly identical) → fill the track with the accent when on.
- [POLISH] top strip — "Open runtime plugin marketplace" is a full-width text-only strip with no button border, unlike the bordered pill buttons directly below it; unclear it is clickable → give it link styling or button chrome.

## visual-support.png

- [POLISH] action cards vs "Donate" — the three cards ("Star on GitHub", "Report an issue", "Contact maintainer") have bordered card chrome, while "Donate" is a flat pale row with a "▶" glyph; the play-triangle suggests expand/collapse, not a donation link → give Donate the same card treatment and a donation-appropriate icon.
- [POLISH] card icons — right-side glyphs mix semantics without pattern: external-link arrows on the two link rows, envelope on "Contact maintainer"; fine individually but the left icon (star, broken-link, envelope) vs right icon pairing is noisy → standardize one icon side per row type.

## visual-bibliography.png

- [POLISH] header subtitle — "1 of 1 entries" reads like a paginated range; for a single record "1 entry" is the standard phrasing → change to "N entries" pluralization.
- [POLISH] toolbar row — "Import from Zotero" sits alone at the far left of a 720px-wide row with ~550px of empty toolbar to its right; no companion actions (add entry, export) balance the row → add the missing entry actions or left-anchor a compact toolbar group.
- [SUSPECT] entry card ("smith2024" / "Smith, Jane (2024). Research Methods.") — the card exposes no visible actions (copy key, cite, locate file) and its right half is empty; if the whole card is the click target the interaction is undiscoverable → add explicit per-entry actions or a hover affordance.

## visual-portal.png

- [MINOR] "New item" form — the pin checkbox is a bare square centered mid-panel with its label "Pin for quick invoke bar and shortcut palette" centered on the line below it; every other control (Title, Body, Action, Shortcut) is a left-aligned full-width field, so this row breaks the form's alignment rhythm → left-align the checkbox with an inline label.
- [SUSPECT] "Pinned" list vs "Invoke pinned (1)" — the "Invoke pinned (1)" button counts one pinned item but two cards render under the "📌 Pinned" heading ("Scriptor docs" and "Meeting notes"); either the count or the section grouping is wrong → show the true pinned count or move "Meeting notes" out of the Pinned section.
- [SUSPECT] "Meeting notes" body preview — "## Attendees ## Agenda ## Notes" renders as one run of text; if the stored body contains line breaks the preview collapses them (same literal-markup look as the snippet catalog's `\n` escapes) → preview real line breaks.
- [POLISH] bottom fold — the capture ends slicing the label "Pin for quick invoke bar and shortcut palette" mid-line with the "Add item" CTA below the fold and no scroll affordance in the panel → fade/scroll-shadow at the panel's scroll edge.

## visual-portal-form.png

- [MINOR] scrolled state — the sticky category chips row ("Snippets | Links | Templates | Custom") clips the scrolling pinned card mid-title: the "Scriptor docs" card is sliced horizontally right through its text (renders as "Criptor docs") with no divider or shadow separating sticky chrome from scrolling content → add a bottom border/shadow to the sticky chips row and/or mask the scroll edge.
- [POLISH] "Shortcut (e.g. mod+shift+1)" input — the field placeholder repeats the label's example verbatim ("mod+shift+1"); one or the other should carry the example → keep the hint in the label only.

## visual-help-mcp-guide.png

- [MINOR] content fold — the pane cuts exactly at the "Questions & answers" section heading with no content beneath it and no scrollbar/edge fade; the section is left as an orphaned heading at the boundary → render scroll affordance (fade or scrollbar) and avoid slicing at a heading.
- [POLISH] key-value table — the label column is narrow enough that "Scope and consequences" wraps to two lines while "Where to open" / "Before you start" stay on one; value column start is fixed → widen the label column to fit the longest label.
- [POLISH] toolbar pills — the row mixes a view toggle ("Guide", "Questions & answers") with an action ("Start tour") in identical pill chrome → style the tour action differently from the view tabs.
- [POLISH] search input ("Search guides and questions") — empty field with a captured focus ring and no placeholder; reads as an unstyled blank at rest → add placeholder text and/or blur before capture.

## visual-help-rtl-fa.png

- [MINOR] key-value rows — RTL chrome is translated but the values stay English ("First launch, Help & guides, or F1.", "No vault or external account is needed to read this introduction.", "Tours explain controls. They never create, send, execute, delete, or publish…"), producing Persian-label/English-value rows throughout the guide → localize guide content or mark the mixed-language state deliberately.
- [MINOR] right sidebar — the Persian label "جست‌وجوی راهنماها و پرسش‌ها" is right-aligned while the guide list below it ("Workspace essentials", "Vault navigation and files", "Write, save, and switch editor views", …) is left-aligned Latin; the column has ragged edges on both sides → set list items right-aligned (dir=rtl container) with LTR embedding per string.
- [POLISH] breadcrumb — "Workspace" above the title stays Latin/English amid otherwise-Persian chrome ("راهنما و آموزش", "راهنما", "پرسش و پاسخ") → translate or keep consistent with the content-language policy.
- (Positive: RTL direction itself is correct — close button top-left, select chevron on the left, footer "بازنشانی پیشرفت راهنماها" bottom-left.)

## visual-help-ui-zoom-200.png

- [MINOR] 200% zoom fold — both panes slice content mid-line with no scroll affordance: the sidebar item "Vault navigation and files" is cut horizontally through its text and the "Scope and consequences" value ends mid-sentence ("…delete, or publish") → add scroll shadows/scrollbars so the fold is legible at zoom.
- [POLISH] table labels at zoom — "Scope and consequences" wraps to two lines ("Scope and / consequences") making the bold label column ragged → allow a wider label column at large text sizes.
- (Positive: no horizontal clipping at 200% — chips row "Guide / Questions & answers / Start tour", title and close button all fit.)

> Method note: images 19–28 below were reviewed via OCR text+bounding boxes, pixel sampling and ink-density maps after the vision channel stopped delivering new images (it replayed a stale frame for every subsequent read; reads were retried with original PNGs, PNG/JPEG composites and unique filenames). Text- and geometry-level evidence is solid; purely color/shape-level defects in these ten may be underreported, and uncertain items are marked SUSPECT.

## visual-help-direct-answers.png

- [MINOR] dialog vs body — the sentence "Offline product guidance. Searches stay here; no notes or credentials are read or sent." is printed twice on one screen: as the dialog subtitle (top) and again directly under the "Quick answers" heading → drop one copy.
- [MINOR] search input (left column) — the query "Does a layout preset change my note?" fills the field end-to-end and runs into the clear "✕" control at the right edge (text box ends x≈234 where the ✕ sits) with no gap or ellipsis → truncate the query with ellipsis and reserve padding for the clear button.
- [SUSPECT] "Matching guides: 104" — a highly specific active query reports 104 matching guides while the sidebar list below looks unfiltered ("Frontmatter and note metadata", "Canvas board and spatial notes", "Conflicts and changed-on-disk recovery", …) and only 3 quick answers appear → clarify whether the query filters the guide list or only Quick answers.
- (Positive: answer cards are consistent — category label, bold question, answer line, "Open guide" button.)

## visual-command-palette.png

- [SUSPECT] NOTES group rows — with query "notes", the rows "Research Plan" (Research Plan.md) and "Sprint Board" (Sprint Board.md) show no visible relation to the query (neither title nor filename contains it) and the row subtitle is only the filename; only "Field Notes" obviously matches → add match-context snippets to note rows or explain content matching.
- (Positives verified by pixel probe: the selected row "Import Obsidian vault" has a distinct tinted background (≈RGB 219,234,232) vs unselected rows (≈242–248 gray) — selected-row visibility is fine; group headers COMMANDS/NOTES align with row text; command rows sit at an even 54–56px pitch, notes rows likewise; the shortcut hint "Ctrl+ALt+H" is right-aligned in its row.)

## visual-cheatsheet.png

- [MINOR] three columns — snippet styling is inconsistent: the SYNTAX column's snippets ("**bold** / *italic*", "[[Note Title]]", "![[Note Title#Section]]", "[@citekey]", "#tag", "> [!NOTE] > Callout text", "```dql path has #tag```", "Ctrl+F / Ctrl+H") sit on the plain page background (≈RGB 248,251,250) while MERMAID and MATH snippets sit in tinted code blocks (≈RGB 229,239,237) → give the SYNTAX snippets the same code-block treatment.
- [POLISH] column balance — the MATH column ends at ~y320 while SYNTAX runs to y568 and MERMAID past y720; the lower-right third of the dialog is empty dead space → rebalance content across columns or let the short column flow.
- (Positive: SYNTAX item rhythm is even (~55px per item) and all three column headers share one baseline.)

## visual-cheatsheet-bottom.png

- [SUSPECT] bottom of scroll — the Mermaid Gantt block ends with "Design :a2, after a1, 5d" at y650–666 and no closing "```" fence is rendered before the dialog's bottom edge (fences are rendered for the other blocks) → confirm the Gantt block's closing fence is not clipped at the scroll end.
- [POLISH] scrolled state — with SYNTAX finished (ends "Ctrl+F / Ctrl+H" at y286–302) and MATH long gone, the entire right half of the dialog below y~460 is empty while MERMAID continues alone → same column-balance issue as the top state.

## visual-vault-health-dashboard.png

- [MINOR] "Maintenance tools" (y405–420) — the section heading is the last ink in the panel: the band below it (to the 468px capture edge) contains no controls at all (verified by ink map) → either the maintenance buttons fail to render in this state or the section is clipped at the panel bounds; show the tools or remove the empty heading.
- [POLISH] metric naming — this dashboard says "Total words 520" while the Inspector's vault-health widget (command-palette view) labels the same metric "Vault words 520" → use one label everywhere.
- (Positives: 3×3 stat grid has consistent label-over-value stacking and per-column alignment; status line "Vault looks healthy" + "No broken health checks were found in the current diagnostic snapshot." reads well.)

## visual-vault-health-dashboard-720.png

- [MINOR] "Maintenance tools" (y405–419) — same dead/empty section heading as the wide dashboard (no controls beneath it before the capture edge) → same fix.
- (Positive compact-width behavior: at 720px the 3-column stat grid is preserved, every label fits one line ("Unresolved citations", "Invalid frontmatter"), no text exceeds the 678px content width, and the subtitle stays on one line — no wrap or overflow defects.)

## visual-large-vault-bottom.png

- [MAJOR] sidebar note list — nine consecutive rows all truncate to the identical string "Generated research n..." (rows at y387, 420, 451, 483, 515, 547, 579, 611, 644; verified in the ink map), so the distinguishing tail of every note name is cut and the rows are visually indistinguishable → truncate from the middle or preserve the distinguishing suffix (e.g. "Generated research…-12.md") and add a full-name tooltip.
- [MINOR] sidebar filter pills — at this window width the first pill's label wraps to two centered lines ("All" over "notes") while its sibling "Inbox" stays on one line (verified by ink map and crop OCR) → keep pill labels on one line (ellipsis or wider sidebar).
- (Positive: list row pitch is even (32–33px) and the folder row "Vault" right-aligns its "606" count consistently.)

## visual-gmail-disconnected.png

- [MINOR] disconnected state — a live "Search messages" field with placeholder "Search Gmail (for example, is:unread or from:colleague)…" sits above the empty state "Gmail is not connected"; the control cannot function until connected → disable or hide search while disconnected.
- (Positives: the empty state is properly centered — "Gmail is not connected", "Connect your Google account in the Account tab to read, import, and send mail." and the "Connect Gmail account" CTA all center on x≈460 in the 920px panel; tab spacing is even.)

## visual-mcp-sharing-inventory.png

- [SUSPECT] stat cards — the second-row left card reads value "1" over the label "AgentStack-managed" (x1039–1169), a bare adjective where the sibling labels are noun phrases ("confirmed apps and CLIs", "installed resources", "redundant duplicate groups"); the label may be truncated from a longer string at card width → verify and restore the full label (with ellipsis if needed).
- (Positives verified: all four stat cards show values ("1", "1", "1", "0"); the "Codex CLI" row lays out name → "CONFIRMED" badge → right-aligned "Sync" action without collision (15px gap measured); tab strip "Recipes | Tools | Drafts | Audit | Sharing & sync" is evenly spaced.)

## visual-mcp-sharing-table.png

- [MAJOR] third table row — the row renders only "contained copy" in the State column; its "Canonical resource" and "Target" cells are empty (ink map shows no glyphs left of x≈270 for that row while rows 1–2 fill all three columns) → populate the row identity or drop the orphan row.
- [MINOR] State column — "MANAGED" and "VALID" render as inset badges (left edge x≈278) while "contained copy" is plain text starting at the column edge (x≈270, same as the "State" header) → wrap all states in the same badge treatment.

## Coverage

| # | file | method | status |
|---|------|--------|--------|
| 1 | visual-dock-jobs.png | vision | reviewed — 3 findings (1 SUSPECT, 1 MINOR, 1 POLISH) |
| 2 | visual-dock-output.png | vision | reviewed — 3 findings (2 MINOR, 1 POLISH) |
| 3 | visual-dock-problems.png | vision | reviewed — 3 findings (1 MINOR, 1 POLISH, 1 SUSPECT) |
| 4 | visual-dock-search-results.png | vision | reviewed — 4 findings (3 MINOR, 1 POLISH) |
| 5 | visual-inbox-populated.png | vision | reviewed — 5 findings (1 MINOR, 2 SUSPECT, 2 POLISH) |
| 6 | visual-tasks-populated.png | vision | reviewed — 4 findings (1 MINOR, 2 POLISH, 1 SUSPECT) |
| 7 | visual-snippets.png | vision | reviewed — 3 findings (1 MAJOR, 1 MINOR, 1 POLISH) |
| 8 | visual-template-picker.png | vision | reviewed — 2 findings (2 POLISH) |
| 9 | visual-bibliography.png | vision | reviewed — 3 findings (2 POLISH, 1 SUSPECT) |
| 10 | visual-writing-targets.png | vision | reviewed — 4 findings (2 MAJOR, 1 MINOR, 1 SUSPECT) |
| 11 | visual-performance-hud.png | vision | reviewed — 2 findings (2 POLISH) |
| 12 | visual-built-in-modules.png | vision | reviewed — 3 findings (1 MINOR, 1 SUSPECT, 1 POLISH) |
| 13 | visual-portal.png | vision | reviewed — 4 findings (1 MINOR, 2 SUSPECT, 1 POLISH) |
| 14 | visual-portal-form.png | vision | reviewed — 2 findings (1 MINOR, 1 POLISH) |
| 15 | visual-support.png | vision | reviewed — 2 findings (2 POLISH) |
| 16 | visual-help-mcp-guide.png | vision | reviewed — 4 findings (1 MINOR, 3 POLISH) |
| 17 | visual-help-ui-zoom-200.png | vision | reviewed — 2 findings (1 MINOR, 1 POLISH) |
| 18 | visual-help-rtl-fa.png | vision | reviewed — 3 findings (2 MINOR, 1 POLISH) |
| 19 | visual-help-direct-answers.png | OCR+geometry | reviewed — 3 findings (2 MINOR, 1 SUSPECT) |
| 20 | visual-command-palette.png | OCR+pixel probe | reviewed — 1 finding (1 SUSPECT) |
| 21 | visual-cheatsheet.png | OCR+pixel probe | reviewed — 2 findings (1 MINOR, 1 POLISH) |
| 22 | visual-cheatsheet-bottom.png | OCR+pixel probe | reviewed — 2 findings (1 SUSPECT, 1 POLISH) |
| 23 | visual-vault-health-dashboard.png | OCR+ink map | reviewed — 2 findings (1 MINOR, 1 POLISH) |
| 24 | visual-vault-health-dashboard-720.png | OCR+ink map | reviewed — 1 finding (1 MINOR) |
| 25 | visual-large-vault-bottom.png | OCR+ink map | reviewed — 2 findings (1 MAJOR, 1 MINOR) |
| 26 | visual-gmail-disconnected.png | OCR+geometry | reviewed — 1 finding (1 MINOR) |
| 27 | visual-mcp-sharing-inventory.png | OCR+ink map | reviewed — 1 finding (1 SUSPECT) |
| 28 | visual-mcp-sharing-table.png | OCR+ink map | reviewed — 2 findings (1 MAJOR, 1 MINOR) |

All 28 reviewed; none fully CLEAN (every image carries at least one POLISH-or-higher item). Totals: 5 MAJOR, 26 MINOR, 14 SUSPECT, 28 POLISH (73 findings).

## Issue summary

| severity | image | location | issue | fix |
|----------|-------|----------|-------|-----|
| MAJOR | visual-writing-targets.png | chart vs "Recent history" list | bar heights contradict the list for every day (e.g. "2026-09-19: 620 words" bar < 600; "2026-09-21: 198 words" bar ≈ 165) | fix chart scale/series mapping |
| MAJOR | visual-writing-targets.png | chart target line | dashed "Target" at ~450 vs "Daily word target" input "500" | plot line at the configured target |
| MAJOR | visual-snippets.png | snippet list | ~130px gap between "literature-note" and "method-check" breaks row rhythm | tight fixed-height list rows |
| MAJOR | visual-large-vault-bottom.png | sidebar note list | 9 rows all truncate to identical "Generated research n..." | suffix-preserving/middle truncation + tooltip |
| MAJOR | visual-mcp-sharing-table.png | table row 3 | only "contained copy" in State; Canonical resource/Target empty | populate identity or drop row |
| MINOR | visual-dock-output.png | log body | same event "Opened vault Research Vault" with inconsistent paths ("/ScriptorVault" vs "C:/Scriptor/fixtures/minimal") | normalize path display |
| MINOR | visual-dock-output.png | log body | paths not monospace in a log dock | monospace path lines |
| MINOR | visual-dock-problems.png | problem entry | no severity styling; rule id teal like routine Output events | severity icon + color |
| MINOR | visual-dock-search-results.png | result 1 snippet | truncated both ends without ellipsis ("tes - Methodology Outline Collect sources due: 2026-06-30 Dr") | ellipsis both ends around match |
| MINOR | visual-dock-search-results.png | snippets | query term "Methodology" not highlighted | highlight matches |
| MINOR | visual-dock-search-results.png | result rows | no divider/gap between results; rows merge into one paragraph | group rows |
| MINOR | visual-inbox-populated.png | note rows | title and identical filename duplicated ("Field Notes" / "Field Notes.md") | show filename only when different |
| MINOR | visual-tasks-populated.png | checkbox column | teal vs dark outlines across rows with no visible state meaning | normalize or label the state |
| MINOR | visual-snippets.png | Content textarea | literal `\n` escapes in one line inside a multiline field | render real newlines |
| MINOR | visual-writing-targets.png | chart + list | same data shown twice and currently disagreeing | keep one view |
| MINOR | visual-built-in-modules.png | preset pills | "Scientific" and "Complete" both look active | single selection state |
| MINOR | visual-portal.png | New item form | centered bare checkbox with label below breaks form alignment | left-align with inline label |
| MINOR | visual-portal-form.png | sticky chips row | clips "Scriptor docs" card mid-title ("Criptor docs"), no seam | sticky border/shadow + scroll mask |
| MINOR | visual-help-mcp-guide.png | content fold | cut at "Questions & answers" heading, no scroll affordance | scroll fade/scrollbar |
| MINOR | visual-help-rtl-fa.png | key-value rows | Persian labels with untranslated English values | localize or mark mixed state |
| MINOR | visual-help-rtl-fa.png | right sidebar | right-aligned Persian label vs left-aligned Latin list items (ragged column) | rtl container with LTR embeds |
| MINOR | visual-help-ui-zoom-200.png | panes at 200% | fold slices text mid-line ("Vault navigation and files", "…delete, or publish") | scroll affordance |
| MINOR | visual-help-direct-answers.png | subtitle + Quick answers | same sentence printed twice on one screen | drop one copy |
| MINOR | visual-help-direct-answers.png | search input | query runs into the clear ✕ with no gap/ellipsis | truncate + reserve button space |
| MINOR | visual-cheatsheet.png | three columns | SYNTAX snippets untinted while Mermaid/Math use tinted code blocks | uniform code-block styling |
| MINOR | visual-vault-health-dashboard.png | "Maintenance tools" | heading followed by no visible controls | render tools or remove heading |
| MINOR | visual-vault-health-dashboard-720.png | "Maintenance tools" | same empty section heading | same fix |
| MINOR | visual-large-vault-bottom.png | filter pills | "All notes" wraps to two lines while "Inbox" stays one | one-line pill labels |
| MINOR | visual-gmail-disconnected.png | search field | live "Search messages" input above the disconnected state | disable/hide until connected |
| MINOR | visual-mcp-sharing-table.png | State column | "MANAGED"/"VALID" badges vs plain "contained copy" | uniform badge treatment |
| SUSPECT | visual-dock-jobs.png | tab badge | "Jobs 0" while the panel lists "Index rebuild … Ready" | clarify badge count semantics |
| SUSPECT | visual-dock-problems.png | "Editor lint" row | scope of "Generate link references" unclear next to the label | move to toolbar + tooltip |
| SUSPECT | visual-inbox-populated.png | search field | lone "F" hint, unexplained | full accelerator or remove |
| SUSPECT | visual-inbox-populated.png | selected row | gray filename on teal fill may fail contrast | verify AA contrast |
| SUSPECT | visual-tasks-populated.png | filter row | "All" select captured with focus ring | blur before capture or fixture artifact |
| SUSPECT | visual-bibliography.png | entry card | no visible actions on "smith2024" card | explicit per-entry actions |
| SUSPECT | visual-portal.png | Pinned section | "Invoke pinned (1)" vs two cards under "📌 Pinned" | fix count or grouping |
| SUSPECT | visual-portal.png | "Meeting notes" preview | "## Attendees ## Agenda ## Notes" may collapse line breaks | preview real breaks |
| SUSPECT | visual-writing-targets.png | Recent history | latest entry 2026-09-21 vs app date 2026-09-29 ("Today: 19") | confirm history window |
| SUSPECT | visual-built-in-modules.png | toggles | pale track, dark knob at right; on-state weak | accent-filled track when on |
| SUSPECT | visual-help-direct-answers.png | "Matching guides: 104" | query active but list looks unfiltered | clarify filter semantics |
| SUSPECT | visual-command-palette.png | NOTES rows | "Research Plan"/"Sprint Board" show no link to query "notes", no match context | add match snippets |
| SUSPECT | visual-cheatsheet-bottom.png | Gantt block | no closing fence before the bottom edge | confirm not clipped |
| SUSPECT | visual-mcp-sharing-inventory.png | stat card label | bare "AgentStack-managed" may be truncated | restore full label |
| POLISH | visual-dock-jobs.png | tab strip | "Output" has no count chip while siblings do | consistent tab adornment |
| POLISH | visual-dock-output.png | header strip | body heading "Output" duplicates the tab | drop duplicate heading |
| POLISH | visual-dock-problems.png | header | "Problems (1)" vs tab "Problems 1" | one count |
| POLISH | visual-dock-search-results.png | body heading | mixed weight mid-line | style the query instead |
| POLISH | visual-inbox-populated.png | header area | "Inbox 2" badge vs "Inbox (2)" heading | keep one |
| POLISH | visual-inbox-populated.png | bottom toolbar | unlabeled icons floating bottom-left | tooltips/labels |
| POLISH | visual-tasks-populated.png | task rows | chevron glued to titles instead of action column | right-align chevron |
| POLISH | visual-tasks-populated.png | right column | date text replaces calendar button on overdue row | uniform slot content |
| POLISH | visual-snippets.png | footer | "Save catalog" CTA for a per-snippet form | "Save snippet" |
| POLISH | visual-template-picker.png | selected row | gray selection vs teal selection elsewhere | teal selection |
| POLISH | visual-template-picker.png | filter input | filled gray input vs white inputs elsewhere | unify input styles |
| POLISH | visual-performance-hud.png | title | "Perf" abbreviated vs spelled-out titles | "Performance" |
| POLISH | visual-performance-hud.png | metric rows | bare "—" placeholders, no units | units or unit label |
| POLISH | visual-support.png | "Donate" row | flat row with "▶" glyph vs card chrome; wrong icon semantics | card chrome + donation icon |
| POLISH | visual-support.png | card icons | noisy left/right icon pairings | one icon side per row type |
| POLISH | visual-bibliography.png | subtitle | "1 of 1 entries" reads as a range | "1 entry" |
| POLISH | visual-bibliography.png | toolbar | "Import from Zotero" alone with ~550px dead toolbar | balance actions |
| POLISH | visual-portal.png | bottom fold | label sliced mid-line, "Add item" below fold | scroll-edge affordance |
| POLISH | visual-portal-form.png | Shortcut input | placeholder duplicates the label's example | hint in one place |
| POLISH | visual-help-mcp-guide.png | table | "Scope and consequences" wraps in narrow label column | widen label column |
| POLISH | visual-help-mcp-guide.png | toolbar pills | action "Start tour" mixed with view tabs | distinct styling |
| POLISH | visual-help-mcp-guide.png | search input | empty field, no placeholder, captured focus ring | placeholder + blur |
| POLISH | visual-help-rtl-fa.png | breadcrumb | "Workspace" stays English amid Persian chrome | translate/consistent policy |
| POLISH | visual-help-ui-zoom-200.png | table labels | "Scope and / consequences" wraps, ragged label column | wider label column at zoom |
| POLISH | visual-cheatsheet.png | columns | MATH column ends early, lower-right dead space | rebalance columns |
| POLISH | visual-cheatsheet-bottom.png | scrolled state | right half empty while MERMAID continues | rebalance columns |
| POLISH | visual-vault-health-dashboard.png | metric naming | "Total words" here vs "Vault words" in Inspector | one label |
| POLISH | visual-built-in-modules.png | top strip | "Open runtime plugin marketplace" is text-only full-width strip, unclear it's clickable | link or button chrome |

