> Reconstructed authoring history, not a fresh screenshot verification. Source trace: `session-2026-09-29-14-55-44-5df973e9_001.jsonl`. Applied edits at lines 313, 441, 481, 503, 539, 553, 637, 706, 720; every exact old-string precondition matched. Original scratchpad files are unavailable; tool-call reconstruction cannot establish the final historical file contents independently of those authoring calls.

# Visual QA — Batch B (mobile / compact / overlay)

Reviewed by: PenguinHarness visual QA pass, 2026-09-29.
Source dir: `.../session-2026-09-29-12-23-19-ea2f1a04/vr/images`

Note on file inventory: the batch lists 12 images, but `visual-mobile-390.png` does not
exist in the run's image directory and is absent from `vr/image-manifest.json` (the
manifest contains only visual-mobile-320, visual-mobile-dark-390, visual-mobile-editor-390,
visual-mobile-rtl-fa-390, visual-mobile-touch-320 among mobile captures). It was never
captured in this run — recorded as MISSING (a capture/suite gap, not a UI defect).

## visual-mobile-320.png

- [MAJOR] Editor formatting toolbar (row with "Source | Split | Preview" and B / I / link) — the toolbar's trailing control is clipped by the right viewport edge: only a ~4px sliver of the next glyph is visible (dark pixels at x=316–319, y=283–285, #47556A) and nothing scrolls it into view; controls after the link icon are unreachable at 320px → make the toolbar horizontally scrollable with an edge fade, or wrap/overflow the extra controls into a "⋯" menu at narrow widths.
- [MINOR] Editor top-right edge (toolbar/editor boundary) — a stray dark bar (#515253/#48494A, 2px tall) runs from x=307 to the right viewport edge at y=315–316 and is cut by the edge; likely a scrollbar thumb or fragment of a clipped control sitting flush against the edge → identify the element and inset it from the pane edge (identity uncertain — flagged from pixels).
- [MINOR] Nav stack row 2 ("minimal" select) vs rows below — the "minimal" dropdown ends at x=283 while the "Writing" dropdown and "Commands and notes" field below end at x=305–308, leaving a visibly ragged right edge on the control stack → make row-2 controls share the same right alignment as the full-width rows below.
- [MINOR] Editor gutter line numbers — inactive numbers render at (193,202,208) on a near-white gutter ≈ 1.5:1 contrast (only the active line's number "3" is dark (82,98,119)); "1", "2", "4", "5" are barely legible → darken inactive gutter numbers to at least ~4.5:1 (or accept <3:1 only for truly decorative use).
- [POLISH] Mixed corner radii in the same control stack — chevrons/folder/"minimal" select use ~10px rounded-rect corners while "Writing" and "Commands and notes" below are full pills → unify the radius language within the stack.
- [POLISH] Small tap targets at 320px — row-2 icon buttons (chevrons, folder ≈ 34×34px) and the document-tab pin/close icons (~24px) are below the 44px guideline → enlarge hit areas (visual size can stay).

## visual-mobile-editor-390.png

- [MAJOR] Formatting toolbar ("B I 🔗 T +" row right of "Source | Split | Preview") — the trailing control after "+" is clipped by the right viewport edge (partial ≡-like glyph visible at the edge; dark pixels touch x=386–389, y=284–293); same overflow defect as visual-mobile-320, now at 390px → same fix: scrollable toolbar with edge fade or "⋯" overflow menu.
- [MINOR] Editor top-right edge — same stray 2px dark bar (#515253/#48494A) as visual-mobile-320, running from x=382 to the right viewport edge at y=315–316 and clipped by the edge (verified by pixel scan) → inset/fix the element.
- [MINOR] Nav stack row 2 ("minimal" select) — the select ends far short of the right edge while the "Writing" and "Commands and notes" pills below run to the standard margin; at 390px the ragged gap is ~90px wide and reads as a layout error → make row-2 controls share the right alignment of the rows below (or give the select flex-grow).

## visual-mobile-rtl-fa-390.png

- [MINOR] Search field ("فرمان‌ها و یادداشت‌ها") — the magnifier icon stays on the LEFT end and the placeholder sits left-of-center, i.e. the field keeps its LTR internal layout while the surrounding chrome mirrors (tabs, nav, bottom bar all mirror) → mirror the field: icon at the right (leading) edge, text right-aligned.
- [MINOR] Nav row chevrons (back/forward) — positions mirror (chevrons at the right end of the row) but the glyph directions do not: the rightmost "back" button still shows a left-pointing "‹" and "forward" a right-pointing "›"; in an RTL UI back should point right and forward left → flip the chevron glyphs with direction.
- [MINOR] Dropdown caret inconsistency — the full-width "نوشتن" select mirrors its caret to the LEFT end (correct for RTL), but the "minimal" select in the row above keeps its caret at the RIGHT end → mirror the "minimal" select's caret too.
- [MINOR] Editor top-right edge — the stray 2px dark bar (#515253) appears at y=315–316 running to the RIGHT viewport edge (x=384→389): it is not mirrored even though the rest of the layout is → same fix as the LTR captures; also decide whether it should follow direction.
- [SUSPECT] Formatting toolbar shows only four icon clusters (B / I / link / T at x=10–125, verified by pixel scan) with no "+" and no overflow affordance, while the LTR captures at the same width show "B I 🔗 T +" plus a clipped extra control — the RTL toolbar appears to lose controls; unclear if by design.
- Verified correct (no finding): status bar bidi order ("19 واژه 198 نویسه 1 دقیقه مطالعه مارک‌داون" renders segments right-to-left with the green check at the far left), mode tabs mirror ("متن منبع" rightmost), bottom nav mirrors ("Command … Vault" with Write active), document-tab pin/close mirror to the left.

## visual-quick-capture.png

- [POLISH] Panel bottom — the content ends at the "Add sticky note" button (~2/3 of the panel height) and the remaining ~230px below it is empty; the panel reads half-finished at this height → size the panel to its content or give the empty region a purpose (e.g. recent captures list).
- [POLISH] Todo row ("Review visual evidence before release") — the checkbox is checked but the text carries no done-state styling (no strike-through/dim), so the completed state is easy to miss → dim or strike completed todo text.
- [POLISH] Todo row actions — the destructive trash icon button sits directly adjacent to the "To note" action in the same right-aligned cluster → separate destructive from productive actions (or de-emphasize the trash).
- [SUSPECT] Backdrop/elevation behavior — the capture is cropped to the panel itself (no app frame or scrim visible), so backdrop dimming, shadow/elevation and panel placement cannot be verified from this screenshot.

## visual-vault-loading.png

- [MINOR] "Vault health" card (right panel) — the header chip reads "→ Loading…" while the metric tiles below already show "0" values ("Broken links 0", "Orphan assets 0", "Duplicate titles 0", "Invalid frontmatter 0"); zeros read as measured results while the data is still loading → show skeletons or "—" placeholders until the values arrive.
- [MINOR] "Vault health" card header (right panel) — the title wraps to two lines ("Vault" / "health") because the "→ Loading…" chip crowds it, unlike the single-line "Outline" heading above → keep the card title on one line (shrink the chip, or move it to its own line).
- [MINOR] Sidebar filter chips (left panel) — the "All notes" chip wraps its label to two lines ("All" / "notes") while the adjacent "Inbox" chip is one line, making the row ragged → widen the chip or shorten the label ("All").
- [POLISH] "Vault health" card bottom — the second tile row ("Duplicate titles" / "Invalid frontmatter") is clipped by the panel's bottom edge with no visible scroll affordance → let the panel scroll visibly (edge fade/scrollbar) or fit the card.
- [SUSPECT] The editor toolbar ("Source | Split | Preview" + B/I/link/T/sliders) renders above the "No note open" empty state in a grayed/disabled style; acceptable as a disabled affordance, but it adds chrome to an empty screen — consider hiding it when no note is open.

## visual-mobile-dark-390.png

- [MAJOR] Formatting toolbar ("B I 🔗 T +" row) — trailing control clipped by the right viewport edge exactly as in the light captures: light glyph pixels touch x=386–389 at y=284–293 (pixel-verified), leaving a partial glyph cut by the edge with no scroll affordance → same fix: scrollable toolbar with edge fade or "⋯" overflow menu.
- [MINOR] Editor top-right edge — the same stray 2px bar (#515253 on light / light-gray on dark) runs at y=315–316 from x=384 to the right viewport edge and is clipped (pixel-verified) → identify and inset the element; consistent defect across all workspace captures.
- [MINOR] Nav stack row 2 ("minimal" select) — same ragged right edge as the light captures: the select ends at ≈x=283 while the "Writing" pill and "Commands and notes" field below run to ≈x=372 → align row-2 controls with the rows below.
- [POLISH] Tap targets — top-bar icon buttons render ≈32–34px square (e.g. sidebar toggle, sun, gear, help, sliders) below the 44px guideline → enlarge hit areas.
- Verified correct (no finding): full dark theming with no light-mode leftovers in the top region (dark #0F1420 surfaces, visible thin borders, light text/icons), theme-toggle icon switches to a sun, teal accent on the logo/active states, editor and status regions render consistently dark.

## visual-mobile-touch-320.png

- [MAJOR] Formatting toolbar ("Source | Split | Preview" + B / I / link) — with the larger touch sizing the overflow gets worse than in visual-mobile-320: only B, I and link fit and the link/next glyph is cut mid-icon at the right viewport edge (dark pixels at x=314–318, y=306–319; the chain glyph visibly clipped in the 3x zoom of y=280–390), with the remaining formatting controls unreachable → same fix as the other captures (scrollable toolbar / "⋯" overflow), sized for the touch variant.
- [MINOR] Editor top-right edge — the stray 2px dark bar again runs to the right viewport edge at y=345–346 (pixel-verified) and is visible in the toolbar zoom → same fix as the other workspace captures.
- [POLISH] Top-bar icon buttons measure ≈42px wide (button boxes at x=12–54, 62–116, 121–163, 168–210, 215–257, 262–304 via border-step scan) — just under the 44px touch guideline despite this being the touch-targets variant → grow hit areas a few pixels.

## visual-help-mobile-390.png

- [MINOR] Guide content bottom ("1. Your vault" section) — the body text is sliced mid-line at the panel's bottom edge ("…Open Vault chooses a folder; an open vault appears in" is cut) and the floating "Reset guide progress" button overlays the cut line with no scrim/gradient, so text runs visibly under the button → add bottom padding plus a fade/mask under the floating action (or make the footer solid).
- [POLISH] Search form row ("Search guides and questions" / "Guide category") — the search input and the "All categories" select have mismatched heights (input ≈46px vs select ≈35px) and their top/bottom edges don't align in the same row → give both controls the same height and baseline.
- Verified correct (no finding): header "Help & guides" with "×" close button and the trust line ("Offline product guidance. Searches stay here; no notes or credentials are read or sent."), labeled search + "Guide category" select row, clear selected state on the "Workspace essentials" result row, "Guide / Questions & answers / Start tour" tabs, generous row spacing and readable contrast throughout.

## visual-sticky-note-overlay.png

- [MINOR] Sticky note placement (overlay over the left sidebar) — the note (≈290×210px, x≈95–385, y≈145–355) lands on top of interactive sidebar rows, half-covering the "All notes" / "Inbox" chips, the "Search" field and the two filter inputs ("All"/"Searc…" only peek out at the left) → if this is the default spawn position, place it over the editor/empty area instead of interactive controls.
- [SUSPECT] Note body — below the "Sticky" title the note is entirely blank yellow with no body text and no placeholder ("Write something…" style hint); if this is a new note, the empty-body placeholder appears to be missing.
- [SUSPECT] Editor gutter — line numbers "3" and "10" render noticeably darker than "1", "2", "4"–"9", "11"–"13" without any visible line highlight on those rows; unclear whether this marks wrapped lines, selection endpoints, or a styling bug.
- Verified correct (no finding): the note has rounded corners, a subtle drop shadow/elevation, a visible "×" close affordance in a bordered button at its top-right, dark-on-yellow text contrast, and it does not overlap the editor pane (right edge abuts the pane divider) nor clip the viewport; at this desktop width the editor toolbar ends in a proper "⋯" overflow button — the mobile toolbar clipping is a narrow-width regression of the same row.

