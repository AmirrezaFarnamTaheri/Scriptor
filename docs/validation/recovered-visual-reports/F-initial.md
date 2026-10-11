> Recovered authoring payload, not a fresh screenshot verification. Source trace: `session-2026-09-29-14-53-15-49d201e6_001.jsonl`, line 99. Original path: `C:/Users/ACER/.penguin/data/default_project/agents/default_agent/scratchpad/session-2026-09-29-12-23-19-ea2f1a04/vr-review-F.md`.

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

