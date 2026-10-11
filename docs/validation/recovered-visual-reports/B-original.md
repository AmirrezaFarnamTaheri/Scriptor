> Recovered authoring payload, not a fresh screenshot verification. Source trace: `session-2026-09-29-14-52-06-226516e2_001.jsonl`, line 227. Original path: `C:/Users/ACER/.penguin/data/default_project/agents/default_agent/scratchpad/session-2026-09-29-12-23-19-ea2f1a04/vr-review-B.md`.

# Visual QA Review — Batch B (mobile / compact / overlay)

Reviewer: Batch B agent. All 12 assigned images located by `--<name>` suffix in `vr/images` and inspected at full size; edge/RTL/zoom claims verified with 4x crops (`vr-review-B-crops/`) and pixel probes (ink/structure columns near viewport edges).

## visual-mobile-320.png
(file: `current--visual-review-visual-revie-47fe2-h-mobile-workspace-evidence--visual-mobile-320.png`, 320x720)

- [MAJOR] Header, top-right action pill (moon / gear / help / sliders icons) — the pill container is clipped by the right viewport edge: its rounded right corner is sliced off, structural pixels run to x=318 of 320 while icon ink ends at x≈296 (pixel-probed). At 390px the same pill has a ~10px right margin, so this is overflow at 320, not design. → Fit the header row at 320 (shrink/merge the 4 icon buttons or allow the left cluster to give way) and restore the right margin so the corner renders.
- [MAJOR] Editor format toolbar (right of "Preview", icons "B I 🔗 …") — toolbar overflows the 320px viewport and the trailing icon is sliced mid-glyph at the right edge (ink detected at x=319, y=283/294); the remaining controls ("T", "+", more) are off-screen with no visible scroll or overflow affordance. → Collapse the format strip to the most-used buttons plus an overflow "⋯" menu below ~360px, or make it scrollable with a visible scroll cue/fade.
- [MINOR] Editor list line "- [ ] Collect sources due:" wraps to a bare second line "2026-06-30" with no hanging indent (line starts at the bullet's text column start) — reads as a second item at a glance. → Indent wrapped list continuations under the text (or accept as source-mode behavior; flag for consistency with the 390px shots where the line fits).

## visual-mobile-390.png
MISSING — no file with suffix `--visual-mobile-390.png` exists in `vr/images` (verified by full directory listing and a `390` name filter; only `visual-mobile-dark-390.png`, `visual-mobile-rtl-fa-390.png`, `visual-mobile-editor-390.png`, `visual-help-mobile-390.png` contain "390"). Not reviewed — the visual-review suite appears not to have produced the plain light 390px mobile shot. → Re-capture `visual-mobile-390` and re-review.

## visual-mobile-dark-390.png
(file: `current--visual-review-visual-revie-67f0c-k-mobile-workspace-evidence--visual-mobile-dark-390.png`, 390x844)

- [MINOR] Editor format toolbar right end (icons "B I 🔗 T + …") — trailing icon ("≡"-style glyph) is sliced by the right viewport edge (ink at x=389 = last column, pixel-probed at y=287). Same overflow as the 320px shots, just one control less lost. → Same fix: overflow menu or scroll affordance for the format strip.

Dark-mode audit otherwise clean: header pill has proper margin and dark-surface styling, theme toggle correctly swaps to the sun icon, "Writing" select / "Commands and notes" search / "Research Plan" tab chip all keep visible borders and adequate contrast on dark, status bar "19 words 198 characters 1 min read Markdown" is legible, bottom nav "Write" active state (teal fill + teal text) matches the light variant.

## visual-mobile-rtl-fa-390.png
(file: `current--visual-review-visual-revie-069c1-L-mobile-workspace-evidence--visual-mobile-rtl-fa-390.png`, 390x844)

- [MINOR] Row 2, history nav buttons (right of the folder button) — order is mirrored (back sits rightmost) but the chevron glyphs are not: the rightmost/back button still points left ("<"), forward points right (">"). RTL convention (Material, HIG) is for back to point right. → Mirror directional icons in RTL (logical icons or `scaleX(-1)`).
- [SUSPECT] Search field placeholder "فرمان‌ها و یاداشت‌ها" — the "notes" word reads "یاداشت‌ها" (one dal); standard Persian is "یادداشت‌ها". At 4x zoom the second dal is not visible, but glyph shaping could hide it. → Have a Persian reader confirm the string and fix if it is a copy typo.

RTL mirror audit (verified at 4x zoom, correct — no defect): "minimal" select chevron on the left with right-aligned Latin text; search magnifier at the right (reading-start) side; "Research Plan" tab chip mirrored (doc icon right, pin, "×" left); format-icon order mirrored (B I 🔗 T right-to-left); status-bar check icon at the far left opposite the LTR shot's right; bottom nav order mirrored with "Write" active; Western digits in "19 واژه 198 نویسه 1 دقیقه مطالعه مارک‌داون" flow correctly; markdown body correctly stays LTR in the editor. Toolbar groups at 390px fit without the clipping seen at 320px.

## visual-mobile-touch-320.png
(file: `current--visual-review-visual-revie-746fd-ts-and-top-actions-evidence--visual-mobile-touch-320.png`, 320x900)

- [MAJOR] Header, top-right action pill (moon / gear / help / sliders) — same clip as `visual-mobile-320`: container structure runs to x=318 of 320 with the rounded corner sliced (pixel-probed uniform to the edge across all pill rows y=12–59). For the touch-target variant this is the most visible defect. → Fit the cluster at 320 and restore the right margin.
- [MAJOR] Editor format toolbar ("B I 🔗 …") — the link icon is sliced mid-glyph by the right viewport edge (ink at x=319 at y=306/314; 4x crop shows the chain icon cut in half) and "T", "+", further controls are off-screen with no visible scroll affordance. → Overflow "⋯" menu or scrollable strip with a cue at ≤360px.
- [MINOR] Tab chip "Research Plan" — the pin and close "×" icon buttons are visually much smaller than the touch-sized header buttons in the same shot (header buttons ≈46px, chip height ≈36px with ~16px glyphs), i.e. likely under the 44px tap guideline, and pin sits immediately left of "×" (save/pin vs dismiss adjacency). → Give both ≥44px hit areas and a little more separation.

## visual-mobile-editor-390.png
(file: `current--visual-review-visual-revie-a03cf--compact-mobile-editor-pane--visual-mobile-editor-390.png`, 390x844)

- [MINOR] Editor format toolbar right end ("B I 🔗 T + …") — trailing icon sliced by the right viewport edge (ink at x=389, y=287; 4x crop shows a half "≡"-style glyph). Same overflow defect as the other mobile shots. → Overflow menu / scroll cue for the format strip.

Everything else clean: tab chip, "Source / Split / Preview" group, wrapped-free editor text at 390, status bar "19 words 198 characters 1 min read Markdown", bottom nav "Vault / Write / Inspector / Command" all fit with consistent spacing.

## visual-help-mobile-390.png
(file: `current--visual-review-visual-revie-c1b53-led-bounded-and-centralized--visual-help-mobile-390.png`, 390x~818)

- [MINOR] Guide body, bottom of panel — the line "Open Vault chooses a folder, an open vault appears in" is sliced mid-glyph by the scroll clip line directly above the "Reset guide progress" footer (4x crop shows the lower half of the glyphs cut). No fade mask and no visible scroll affordance, so it reads as a rendering glitch rather than "more below". → Add a scroll fade/mask above the footer and/or a scrollbar; keep line boxes from being cut mid-height at the boundary.
- [MINOR] "Search guides and questions" field — renders as an empty bordered box with a teal focus ring and no placeholder text, so the field reads as broken/blank rather than ready. → Add placeholder text ("Search guides and questions…") and don't show a focus ring on an untouched empty field in the captured state.
- [SUSPECT] Guide list rows — "Workspace essentials" (active) is a filled teal-tinted pill while "Vault navigation and files" and "Write, save, and switch editor views" are bare text rows with no shared chrome, so clickability is inconsistent across rows. → Give all rows one consistent row/button treatment with the active state expressed by fill+weight only.

Header ("Help & guides", "Offline product guidance. Searches stay here; no notes or credentials are read or sent."), "Guide category" select ("All categories"), and the "Guide / Questions & answers / Start tour" pills are laid out cleanly at 390.

## visual-quick-capture.png
(file: `current--visual-review-visual-revie-229e5-uick-capture-panel-evidence--visual-quick-capture.png`, 452x832)

- [MINOR] Panel bottom — from below the "Add sticky note" button (~y=575) to the panel bottom there is ~250px of empty white; the whole content block is top-loaded and the panel reads unfinished at this height. → Let the Scratchpad textarea flex to fill the panel or bottom-anchor the "Add sticky note" action.
- [MINOR] Todos row action cluster — the trash (delete) icon button sits immediately right of the "To note" button on the same right-aligned line: destructive control adjacent to a persist/keep action with only a small gap. → Move delete away (left end of the row, or into an overflow menu) and keep "To note" as the row's primary action.
- [POLISH] Button styling is inconsistent within one panel: "New inbox note" / "Insert in active" are white pills, "+ Add" is a gray pill, "Add sticky note" is dark-green filled — three treatments, and the dark green is off the app's teal accent seen elsewhere ("Write" active tab). → One secondary style + one accent (teal) for the primary action.
- [POLISH] Scratchpad textarea is ~250px tall for a single line of content ("Capture the release-review follow-up and turn the strongest point into a note.") — mostly empty box with a resize grip. → Auto-grow to content with a sensible max, or shorten when empty.

Structure otherwise sound: "Quick capture" header with "Scratchpad, todos, and sticky notes" subline and a well-placed "×" close; "Scratchpad" / "Todos" section headings align with their right-side actions; the todo checkbox + input row is clean.

## visual-sticky-note-overlay.png
(file: `current--visual-review-visual-revie-a5df9-ticky-note-overlay-evidence--visual-sticky-note-overlay.png`, 1440x891)

- [MINOR] Sticky note body — completely empty yellow area under the "Sticky" title (4x crop confirms blank body, no caret, no placeholder), so the overlay looks like failed rendering rather than a fresh note. → Auto-focus the body with a caret or show a placeholder ("Write a note…").
- [POLISH] Sticky close button — the "×" is a white default-looking button on the yellow card; reads as a foreign control. → Style as a ghost icon button tinted to the note surface.
- [SUSPECT] Spawn/placement — the note lands overlapping the left sidebar's "All notes" chip row and "Search" field (both partially covered in the shot; "Search" text visible at the card's left edge). Fine for a draggable note if this is just the capture position, but if it is the default spawn, every new sticky covers sidebar controls. → Spawn at a free area (e.g. canvas center-right) or restore the last note position.

Workspace chrome around it is clean: top bar (Writing/Knowledge/Publish/Review/Automation chips, search, icon cluster), file list with "Research Plan.md" selected, editor + toolbar, Inspector "Outline" ("Research Plan H1", "Outline H2") and "Vault health" ("→ Good", tiles all single-line labels with aligned values here at full width), status bar chips ("Diagnostics Fresh | Graph | MCP | Watch | Git | Spell"), bottom dock "Problems 0 | Output | Search Results 0 | Jobs 0".

## visual-onboarding-dark.png
(file: `current--visual-review-visual-revie-72b09-rst-run-onboarding-evidence--visual-onboarding-dark.png`, 440x246)

- [POLISH] Dialog uses two different greens: the step-progress fill is bright mint while the "Next" CTA is dark green with a teal border — reads as two accent ramps in one small dialog. → Use one accent ramp (e.g. same teal family) for progress fill, CTA fill and CTA border.

Otherwise this one is in good shape: fully dark surfaces with no light components left over; "Step 1 of 7" progress fill measured at 47/326px ≈ 14.4% ≈ 1/7 (correct, verified numerically); "Your vault" heading and body copy "Scriptor works with a folder of Markdown notes. Open Vault chooses a folder; an open vault appears in the left sidebar. Keep important work backed up independently." render complete with no truncation; CTA hierarchy is right ("Skip tour" subdued at left, "Next" filled and prominent at right); spacing rhythm is even.

## visual-inspector-metrics-1024.png
(file: `current--visual-review-visual-revie-a1995-s-remain-readable-at-1024px--visual-inspector-metrics-1024.png`, 238x742)

- [MINOR] "Vault health" metric grid, rows 2–3 — labels wrap unevenly ("Invalid / frontmatter", "Unresolved / citations" on two lines vs one-line siblings) so the values in a row are not baseline-aligned: "0" under "Duplicate titles" sits visibly higher than "0" under "Invalid frontmatter"; "4" under "Indexed notes" sits higher than "0" under "Unresolved citations" (4x crop confirms). → Bottom-align values within each tile (or reserve two label lines in every tile) so values scan as a column.

Readable and otherwise clean at 1024: tabs "Inspector / Rendered output / Tools" fit; chips "Balanced / Research / Publishing / Cleanup" wrap in two even rows; "Outline" card rows ("Research Plan H1", "Outline H2") with 36px+ edit buttons; numbers don't truncate ("0", "4", "520", "Fresh"); "→ Good" chip fits on the "Vault health" title line here.

## visual-vault-loading.png
(file: `current--visual-review-visual-revie-6ec2a-slow-vault-loading-evidence--visual-vault-loading.png`, 1040x777)

- [MAJOR] Inspector, "Vault health" card — while the status chip reads "→ Loading…", the metric tiles already display definitive values ("Broken links 0", "Orphan assets 0", "Duplicate titles 0", "Invalid frontmatter 0"). Placeholder zeros read as real measurements ("0 broken links") during load, and there is no spinner or skeleton anywhere in the card. → Show skeletons or "—" in the tiles (and a spinner in the chip) until the numbers are real.
- [MINOR] Inspector, "Vault health" card header — the title wraps to two lines ("Vault" / "health") because the wider "→ Loading…" chip squeezes it (4x crop confirms; the same card renders one-line "Vault health" with "→ Good" in `visual-inspector-metrics-1024`). → Keep the title on one line: let the chip shrink/shorten ("Loading") or give the title `nowrap`.
- [MINOR] Sidebar, "All notes" chip — its label wraps to two lines ("All" / "notes") while the adjacent "Inbox" chip is one line, making the two chips look mis-sized at the narrow sidebar width. → Keep chip labels on one line (widen the chip, shorten to "All", or reduce padding).
- [SUSPECT] Sidebar date pill — shows "📅 2026-09-29" here but the same control shows "📅 Today · 2026-09-29" in the full workspace shot, with no ellipsis on either; either intentional responsive label or a truncation bug. → Verify the label logic at narrow widths; if truncating, show "Today · 2…" or a tooltip.
- [POLISH] Sidebar search field — placeholder reads "Search note:" (stray colon, singular) with a lone "F" keycap hint at the right; "F" alone is cryptic (presumably Ctrl/Cmd+F). → "Search notes…" placeholder and a proper modifier combo in the hint.

Empty/loading staging otherwise intentional: "No note open" top strip, disabled format toolbar, centered "Open your writing workspace" card with "Open vault" CTA and "Local-first · Markdown-native · Your files stay yours" footnote, "0 words 0 characters — Markdown" status bar, "📁 No vault open" bottom-left.

## Coverage

| # | File | Status |
|---|------|--------|
| 1 | visual-mobile-320.png | reviewed — 3 issues (2 MAJOR, 1 MINOR) |
| 2 | visual-mobile-390.png | NOT REVIEWED — file missing from `vr/images` |
| 3 | visual-mobile-dark-390.png | reviewed — 1 issue (MINOR) |
| 4 | visual-mobile-rtl-fa-390.png | reviewed — 2 issues (1 MINOR, 1 SUSPECT) |
| 5 | visual-mobile-touch-320.png | reviewed — 3 issues (2 MAJOR, 1 MINOR) |
| 6 | visual-mobile-editor-390.png | reviewed — 1 issue (MINOR) |
| 7 | visual-help-mobile-390.png | reviewed — 3 issues (2 MINOR, 1 SUSPECT) |
| 8 | visual-quick-capture.png | reviewed — 4 issues (2 MINOR, 2 POLISH) |
| 9 | visual-sticky-note-overlay.png | reviewed — 3 issues (1 MINOR, 1 POLISH, 1 SUSPECT) |
| 10 | visual-onboarding-dark.png | reviewed — 1 issue (POLISH) |
| 11 | visual-inspector-metrics-1024.png | reviewed — 1 issue (MINOR) |
| 12 | visual-vault-loading.png | reviewed — 5 issues (1 MAJOR, 2 MINOR, 1 POLISH, 1 SUSPECT) |

11 of 12 images reviewed (1 missing on disk). Severity totals: BLOCKER 0 · MAJOR 5 · MINOR 12 · POLISH 5 · SUSPECT 4 (26 findings).

## Issue summary

| Severity | Image | Location | Issue | Fix |
|----------|-------|----------|-------|-----|
| MAJOR | visual-mobile-320.png | Header top-right action pill | Pill container clipped at right viewport edge, rounded corner sliced (struct to x=318/320) | Fit cluster at 320px; restore right margin |
| MAJOR | visual-mobile-320.png | Editor format toolbar ("B I 🔗 …") | Overflow at 320px; trailing glyph sliced at x=319, "T/+/more" off-screen, no overflow affordance | Overflow "⋯" menu or scrollable strip with cue |
| MAJOR | visual-mobile-touch-320.png | Header top-right action pill | Same corner-slice clip at the 320px edge in the touch variant | Fit cluster at 320px; restore right margin |
| MAJOR | visual-mobile-touch-320.png | Editor format toolbar ("B I 🔗 …") | Link icon sliced mid-glyph at x=319; further controls off-screen | Overflow menu / scroll cue at ≤360px |
| MAJOR | visual-vault-loading.png | Inspector "Vault health" tiles | Tiles show "0" values while chip reads "→ Loading…"; no skeleton/spinner | Skeleton/“—” placeholders until data is real |
| MINOR | visual-mobile-320.png | Editor list wrap ("due:" / "2026-06-30") | Wrapped continuation lacks hanging indent | Indent wrapped list continuations |
| MINOR | visual-mobile-dark-390.png | Editor format toolbar right end | Trailing "≡"-style icon sliced at x=389 | Overflow menu / scroll cue |
| MINOR | visual-mobile-rtl-fa-390.png | Row-2 history nav buttons | Order mirrored but chevrons not: back "<" still points left in RTL | Mirror directional icons (scaleX(-1)/logical) |
| MINOR | visual-mobile-touch-320.png | Tab chip "Research Plan" pin + "×" | Small icon-only targets (~28px) vs 46px header buttons; pin adjacent to dismiss | ≥44px hit areas; separate the two |
| MINOR | visual-mobile-editor-390.png | Editor format toolbar right end | Trailing icon sliced at x=389 | Overflow menu / scroll cue |
| MINOR | visual-help-mobile-390.png | Guide body bottom ("Open Vault chooses a folder, an open vault appears in") | Line sliced mid-glyph at scroll clip line; no fade/scroll affordance | Fade mask + visible scroll; avoid mid-line cuts |
| MINOR | visual-help-mobile-390.png | "Search guides and questions" field | Empty input, focus ring, no placeholder | Add placeholder; no focus ring on untouched field |
| MINOR | visual-quick-capture.png | Panel bottom (~250px under "Add sticky note") | Large dead space; content top-loaded | Flex the textarea or bottom-anchor actions |
| MINOR | visual-quick-capture.png | Todos row ("To note" + trash) | Destructive delete adjacent to keep/persist action | Move delete to row start or overflow menu |
| MINOR | visual-sticky-note-overlay.png | Sticky note body | Empty body, no caret/placeholder — looks broken | Auto-focus with caret or placeholder |
| MINOR | visual-inspector-metrics-1024.png | "Vault health" tiles rows 2–3 | Wrapped labels ("Invalid frontmatter", "Unresolved citations") misalign values within rows | Bottom-align values / reserve 2 label lines |
| MINOR | visual-vault-loading.png | "Vault health" card title | Title wraps to "Vault" / "health" beside "→ Loading…" chip | Title nowrap; chip shrink/shorten |
| MINOR | visual-vault-loading.png | Sidebar "All notes" chip | Label wraps to "All / notes" vs one-line "Inbox" chip | One-line chip labels |
| POLISH | visual-quick-capture.png | Panel buttons | Three button treatments; dark green "Add sticky note" off the teal accent | Unify secondary style; one accent |
| POLISH | visual-quick-capture.png | Scratchpad textarea | ~250px box for one line of content | Auto-grow with max height |
| POLISH | visual-sticky-note-overlay.png | Sticky "×" button | White default button on yellow card | Ghost icon button on note surface |
| POLISH | visual-onboarding-dark.png | Progress fill vs "Next" CTA | Two different greens in one dialog | Single accent ramp |
| POLISH | visual-vault-loading.png | Sidebar search field | Placeholder "Search note:" + cryptic lone "F" keycap | "Search notes…" + real modifier hint |
| SUSPECT | visual-mobile-rtl-fa-390.png | Search placeholder "فرمان‌ها و یاداشت‌ها" | "notes" appears as "یاداشت‌ها" (one dal; correct is "یادداشت‌ها") — shaping may hide the second dal | Persian reviewer confirms; fix copy if typo |
| SUSPECT | visual-help-mobile-390.png | Guide list rows | Active row is filled pill, siblings bare text — inconsistent clickability | Uniform row treatment |
| SUSPECT | visual-sticky-note-overlay.png | Sticky spawn position | New sticky covers sidebar "All notes" chip + "Search" field | Spawn in free area / remember position |
| SUSPECT | visual-vault-loading.png | Sidebar date pill | "2026-09-29" here vs "Today · 2026-09-29" elsewhere, no ellipsis | Verify responsive label vs truncation |

