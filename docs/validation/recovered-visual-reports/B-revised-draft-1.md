> Recovered authoring payload, not a fresh screenshot verification. Source trace: `session-2026-09-29-14-55-44-5df973e9_001.jsonl`, line 248. Original path: `C:/Users/ACER/.penguin/data/default_project/agents/default_agent/scratchpad/session-2026-09-29-12-23-19-ea2f1a04/vr-review-B.md`.

# Visual QA — Batch B (mobile / compact / overlay)

Reviewed by: PenguinHarness visual QA pass, 2026-09-29.
Source dir: `.../session-2026-09-29-12-23-19-ea2f1a04/vr/images`

Note on file inventory: the batch lists 12 images, but `visual-mobile-390.png` does not
exist in the run's image directory and is absent from `vr/image-manifest.json` (the
manifest contains only visual-mobile-320, visual-mobile-dark-390, visual-mobile-editor-390,
visual-mobile-rtl-fa-390, visual-mobile-touch-320 among mobile captures). It was never
captured in this run — recorded as MISSING (not a UI defect; a capture/suite gap).

## visual-mobile-320.png

- [MAJOR] Editor formatting toolbar (row with "Source | Split | Preview" and B / I / link) — the toolbar's trailing control is clipped by the right viewport edge: only a ~4px sliver of the next glyph is visible (dark pixels at x=316–319, y=283–285, #47556A) and nothing scrolls it into view; controls after the link icon are unreachable at 320px → make the toolbar horizontally scrollable with an edge fade, or wrap/overflow the extra controls into a "⋯" menu at narrow widths.
- [MINOR] Editor top-right edge (toolbar/editor boundary) — a stray dark bar (#515253/#48494A, 2px tall) runs from x=307 to the right viewport edge at y=315–316 and is cut by the edge; likely a scrollbar thumb or fragment of a clipped control sitting flush against the edge → identify the element and inset it from the pane edge (identity uncertain — flagged from pixels).
- [MINOR] Nav stack row 2 ("minimal" select) vs rows below — the "minimal" dropdown ends at x=283 while the "Writing" dropdown and "Commands and notes" field below end at x=305–308, leaving a visibly ragged right edge on the control stack → make row-2 controls share the same right alignment as the full-width rows below.
- [MINOR] Editor gutter line numbers — inactive numbers render at (193,202,208) on a near-white gutter ≈ 1.5:1 contrast (only the active line's number "3" is dark (82,98,119)); "1", "2", "4", "5" are barely legible → darken inactive gutter numbers to at least ~4.5:1 (or accept <3:1 only for truly decorative use).
- [POLISH] Mixed corner radii in the same control stack — chevrons/folder/"minimal" select use ~10px rounded-rect corners while "Writing" and "Commands and notes" below are full pills → unify the radius language within the stack.
- [POLISH] Small tap targets at 320px — row-2 icon buttons (chevrons, folder ≈ 34×34px) and the document-tab pin/close icons (~24px) are below the 44px guideline → enlarge hit areas (visual size can stay).

