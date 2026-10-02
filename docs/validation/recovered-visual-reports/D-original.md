> Recovered authoring payload, not a fresh screenshot verification. Source trace: `session-2026-09-29-14-52-39-7f499b5b_001.jsonl`, line 137. Original path: `C:/Users/ACER/.penguin/data/default_project/agents/default_agent/scratchpad/session-2026-09-29-12-23-19-ea2f1a04/vr-review-D.md`.

# Visual QA Review — Batch D (settings / forms / customization, 14 images)

Reviewer: PenguinHarness subagent (visual QA). All findings below were read from the rendered PNGs at full size; four ambiguous regions were re-checked with 3× zoomed crops (`vr-crops/`). No image is judged from its filename. Capture artifacts (bottom-cropped screenshots, tight evidence crops) are noted but not scored as defects.

## visual-settings-appearance.png

- [MINOR] Section rhythm — action buttons sit far from the field above them but nearly touch the label below: "Manage color palettes" is separated from the "Light Modern" select by a wide gap, yet "Day / night appearance" begins almost immediately under the button; same pattern with "Reset appearance defaults" and the very next label "Editor font size (px)". The buttons read as belonging to the following unrelated row. → Use one consistent group gap (~16–20px) between a field/button and the next field label.
- [SUSPECT] Grouping after "Reset appearance defaults" — the button reads as an end-of-section reset, but "Editor font size (px)" continues as another appearance field directly beneath it with no section break. Uncertain whether a section heading is simply below the capture crop; if not, the editor-font group needs separation from the appearance group.

## visual-settings-shortcuts.png

- [MINOR] Table header alignment — in the header row, "COMMAND" and "SHORTCUT" sit slightly left of their column content ("Open inbox" / "Alt+I"), while "ACTIONS" is flush right with its content ("Default"). Header↔content alignment is inconsistent across the three columns. → Align each header to its column's content inset.
- [MINOR] Input chrome inconsistent on one page — every keybinding field ("Alt+I", "Alt+D", … "Unassigned") renders with a teal accent border, including rows whose ACTIONS cell says "Default", while the "Search commands..." field directly above uses a neutral gray border. An accent border normally signals focus/modified state; here it is the resting state of all rows. → Use neutral borders for key fields and reserve the accent for focus/modified rows.
- [SUSPECT] "ACTIONS" column — every row shows only the static text "Default" with no button, icon or other affordance. If this is a status column, the "ACTIONS" header oversells the content (a user scanning for per-row actions finds none). Either add a per-row reset affordance or rename the column (e.g. "STATE").

## visual-settings-workspace.png

- [MAJOR] Checkbox collision in "Workspace layout" — "Split preview" and "Show sticky notes layer" run inline with zero spacing: the second checkbox collides with the "w" of "preview" (verified in 3× zoom: "☑ Split preview☑ Show sticky notes layer"). Two independent options read as one mangled control. → Add ≥8px gap between inline checkbox items, or lay them on separate rows like other settings checkboxes.
- [MINOR] Control style mismatch — the checkboxes are native OS checkboxes (blue when checked) beside fully custom-styled rounded selects ("Docked side sheet"), inputs ("2") and bordered buttons ("Reset writing layout", "Apply"). → Style checkboxes to match the custom control language (teal accent, same radius/size).
- [SUSPECT] "Layout templates" row for "Author" — the active template is marked by a button-sized control reading "Active", sitting in the exact position of the other rows' "Apply" buttons. It looks clickable but is (presumably) a state. → Render the active state as a badge/pill (or disabled button w/ check) so status and action affordances are distinguishable.

## visual-settings-advanced.png

- [MINOR] Heading casing — the section heading "startup" renders all-lowercase while sibling headings on the same page are sentence case ("Desktop engine", "Updates", "Release quality dashboard"). If "startup" is a benchmark id from `pnpm bench:startup`, display it as a heading ("Startup benchmarks") or sentence-case it; keep ids in the card rows where "pnpm bench:startup" already lives.
- [MINOR] Inconsistent empty-state values in the "Release quality dashboard" cards — "Time to first edit", "Time to first export" and "Last index rebuild" show "—" while "Panel opens tracked" shows "0". Same metric family, two different empty representations. → Standardize (e.g. "—" for not-yet-measured everywhere, or "0"/"None" everywhere).
- [SUSPECT] Section divider policy — thin divider lines appear before "Updates" and before "Release quality dashboard", but not before "Background desktop engine" or "startup". Uncertain whether "Background desktop engine" is intentionally a subsection of "Desktop engine"; if all four are peer sections, dividers should be uniform.

## visual-settings-daemon-operations.png

- [MINOR] Toolbar iconography inconsistent — "Refresh status", "Start daemon", "Rebuild index" and "Health diagnostics" carry leading icons, while peer buttons "Show endpoint", "Count notes", "Backlinks (active)" and "Graph (active)" have none. → Pick one convention per button family.
- [MINOR] Runtime state embedded in action labels — "Backlinks (active)" and "Graph (active)" bake a live status into the button caption, unlike the pure verbs beside them ("Rebuild index", "Count notes"). Unclear whether clicking toggles or executes. → Keep verbs in labels; show "(active)" as a status dot/badge next to the button.
- [MINOR] Rhythm — "Daemon search" sits visibly closer to the second button row above it than the spacing used between the other groups on this page (e.g. between "Connected — v1.0.0-e2e" and the first button row), so the label looks attached to the toolbar instead of its field.
- [SUSPECT] "Search" button next to "Query indexed notes..." renders its label in gray like a disabled control, while the field shows a placeholder. If it is enabled, its text should match the other buttons; if it is disabled-until-typed, consider a clearer disabled style — the current gray-on-white is ambiguous.
- [SUSPECT] Status line "Connected — v1.0.0-e2e" — the version carries an "-e2e" build tag, which reads like a test-build artifact in a user-facing status. Uncertain if this suite runs on an e2e build by design; if not, surface the release version instead.

## visual-settings-release-quality.png

(Crop of the same Advanced surface as visual-settings-advanced.png, scrolled to the top; findings re-observed on this frame.)

- [MINOR] Heading casing — "startup" below "Reset journey metrics" is lowercase against sentence-case peers ("Desktop engine", "Updates", "Release quality dashboard"). → Sentence-case or rename to "Startup benchmarks".
- [MINOR] Empty-state inconsistency — metric cards "Time to first edit", "Time to first export", "Last index rebuild" show "—" while "Panel opens tracked" shows "0".
- [SUSPECT] Divider usage — divider lines separate "Updates" and "Release quality dashboard" but there is none before "startup" (and none visible before the daemon section in the sibling crop). Section-boundary styling is not self-consistent.

## visual-settings-backups.png

- [MINOR] Button casing — "Backup Now" uses Title Case while every other action in the settings surfaces is sentence case ("Reset all", "Refresh Pandoc discovery", "Reset journey metrics", "Manage color palettes", "Reset appearance defaults"). → "Backup now".
- [MINOR] Rhythm — the "Enable scheduled backups" checkbox row is crammed against the help paragraph above ("Verified recovery snapshots can stay inside the vault; disaster-recovery backups must use an absolute path on another disk or synced location."), with a noticeably smaller gap than the rows below it ("Backup interval (minutes)", "Max snapshots to keep"). → Give the checkbox row the standard row spacing.
- [SUSPECT] Dependent-field state — with "Enable scheduled backups" unchecked, "Backup interval (minutes)" (60) and "Max snapshots to keep" (10) render fully enabled (normal text/borders) and look actionable. Uncertain whether values are intentionally editable while the schedule is off; if they only take effect when enabled, add a subtle disabled/derived treatment or a hint.

## visual-settings-integrations-google.png

- [POLISH] Heading iconography — the "Google" section heading carries a calendar icon while the sibling heading "AI provider (optional)" has none. → Either icon both or neither.
- [SUSPECT] Footer button state — "Save vault config" renders in a muted gray-green fill that reads as disabled, while the footer text invites the action ("Vault configuration loaded. Save is explicit."). In the dark-theme General surface the same button renders as a vivid teal primary. Uncertain whether the muted state is the intentional disabled-until-changed look; if enabled, it needs primary-button treatment in light theme too.

## visual-settings-dark.png

- [MINOR] Native control in dark theme — "Enable inbox triage (`_organized` frontmatter)" uses an OS-native blue checkbox, which clashes with the app's teal accent (see "Save vault config") and the custom-styled dark inputs/selects around it. → Custom checkbox matching the accent token.
- [SUSPECT] Placeholder contrast — ".scriptor/templates/daily.md" in "Daily template path (optional)" renders mid-gray on the dark input fill and looks below 4.5:1. Placeholders are conventionally lower-contrast, but this one carries a path that users need to read; verify against the dark theme's contrast budget.
- [SUSPECT] Bottom clipping — "Inbox period" is cut exactly at the top edge of the sticky footer ("Vault configuration loaded. Save is explicit." / "Save vault config") with no visible content padding below the label, and its input is not visible at all. If the content pane scrolls under the footer this is fine; if not, the last row is permanently obscured. Verify scroll clearance at maximum content height.

## visual-theme-customizer.png

- [MINOR] Truncated value in "BORDER HIGHLIGHT" — the hex input shows "rgba(148, 163, 184," and the value is clipped mid-token at the input's right edge (closing paren and alpha hidden), with no ellipsis. Users cannot read the full color value. → Widen the input, allow the value to scroll into view on focus, or show an ellipsis plus the full value in a tooltip.
- [MINOR] Label convention — labels use trailing colons ("Theme Name:", "Theme Base Category:") while the settings surfaces use colon-free labels ("Color palette", "Backup interval (minutes)", "Provider"). → Pick one convention across surfaces.
- [MINOR] Button casing — "Create New Theme" and "Save & Apply Theme" are Title Case against settings' sentence-case actions ("Manage color palettes", "Reset journey metrics"). → Sentence case for consistency.
- [SUSPECT] Live preview clipping — the "Real-time Interactive Live Preview" card ("Document Title.md" / "Here is sample markdown text rendered with your customized palette.") has no visible bottom edge; it disappears behind the footer ("Cancel" / "Save & Apply Theme"). Either the preview is clipped by the footer or it is a scroll region with no scroll affordance — visually it reads as cut off.
- [SUSPECT] "ACTIVE" badge inside the preview — the teal "ACTIVE" pill sits in the preview document card's header next to "Document Title.md", reading like theme-status chrome embedded in the mock document rather than preview content. If it indicates the applied theme, place it outside the preview; if it is preview sample content, it is confusing.
- [POLISH] Dead space — the "SAVED CUSTOM THEMES (0)" sidebar is ~2/3 empty below "Dark Midnight (dark)" ("No custom themes saved yet." then blank), while the right panel is dense. Acceptable for an empty list, but the empty area could carry a hint (e.g. what creating a theme does) to balance the panel.

## visual-topbar-customizer.png

- [MINOR] Header style mismatch — "CUSTOMIZE TOP BAR ACTIONS" is uppercase letter-spaced small-caps (matching the theme builder's sidebar headers), while settings section titles are bold sentence case ("Appearance & layout", "Workspace layout"). → One heading language per surface family.
- [POLISH] List composition — a single flat checklist mixes navigation actions ("Workbench", "Publish", "Portal", "Capture", "Graph", "Canvas", "Color palettes") with status widgets ("1 changed file", "MCP read-only", "Support Scriptor"), with no grouping or type hint; a reader cannot tell what kind of item each row toggles. → Group into "Actions" and "Status widgets" or annotate rows.
- [POLISH] Native OS checkboxes (blue when checked: "Capture", "1 changed file", "MCP read-only", "Support Scriptor") against an otherwise custom-styled panel — same control-language mismatch as the other surfaces.

## visual-color-palettes.png

- [MINOR] Near-white swatch invisible on white card — in the "Light Modern" card the 4th swatch (white fill) survives only on a hairline border and reads as an empty gap in the swatch row (verified in 3× zoom). → Give all swatches a consistent 1px neutral stroke or inset shadow so light colors stay visible.
- [MINOR] Button casing — "Create Custom Palette" and "Install & Activate Palette" are Title Case vs settings' sentence case ("Manage color palettes"). → Sentence case.
- [POLISH] Label convention — "Category Filter:" carries a trailing colon; settings labels are colon-free. → Harmonize with the rest of the app.
- [POLISH] Selected-state subtlety — "Light Modern" (the active palette) is distinguished from its siblings only by a thin teal border plus the CTA swap to "✓ Installed & Active"; at a glance the grid looks uniformly unselected. → Add a subtle tint or a checkmark chip on the selected card.

## visual-layout-presets.png

- [MINOR] Same feature, two button styles — the "Apply" buttons here are teal-outlined with teal text on transparent fill, while Settings → Workspace renders the identical preset rows (Zen / Author / Researcher / Reviewer / Atlas) with gray-bordered, dark-text "Apply" buttons. → Use one button style for this action across both surfaces.
- [MINOR] Opposite active-state chrome in adjacent rows — the tab row marks the active "Tools" tab as a WHITE filled pill on a tinted strip, while the toolbar directly below marks the active "Layouts" item as a DARK TEAL filled pill with white text ("Plugins", "MCP", "Features" being borderless text+icon). Two different selected-state languages in one panel. → Standardize the active treatment.
- [POLISH] Identical icons — every preset card (Zen … Draft sprint) shows the same generic layout icon; the icons differentiate nothing. → Use per-preset schematic glyphs (1 pane / editor+preview / graph-heavy) or drop the icon.
- [SUSPECT] Toolbar chrome — "Plugins", "MCP", "Features" are borderless icon+label buttons and only "Layouts" gets a pill. If these four are peer tabs/views, they should share one container and style; as rendered, three look like disabled/inactive text.

## visual-layout-presets-bottom.png

- [MINOR] Content bleeds above the sticky tab bar — scrolled content is visible as ghosted text fragments in the sliver between the panel's top edge and the "Inspector | Rendered output | Tools" strip (verified in 3× zoom). → Give the sticky header an opaque background (or clip content strictly beneath it).
- [MINOR] "Apply" button style mismatch vs Settings → Workspace (teal outline here, gray border there) for the same preset actions — same defect as the unscrolled frame.
- [POLISH] Same generic layout icon repeated on every card (Zen, Author, Researcher, Reviewer, Atlas, Canvas, Draft sprint, Synthesis) — no per-preset differentiation.

## Coverage

| # | File | Status |
|---|------|--------|
| 1 | visual-settings-appearance.png | reviewed — 2 issues (1 MINOR, 1 SUSPECT) |
| 2 | visual-settings-shortcuts.png | reviewed — 3 issues (2 MINOR, 1 SUSPECT) |
| 3 | visual-settings-workspace.png | reviewed — 3 issues (1 MAJOR, 1 MINOR, 1 SUSPECT) |
| 4 | visual-settings-advanced.png | reviewed — 3 issues (2 MINOR, 1 SUSPECT) |
| 5 | visual-settings-daemon-operations.png | reviewed — 5 issues (3 MINOR, 2 SUSPECT); tight evidence crop (no tab bar/footer visible) |
| 6 | visual-settings-release-quality.png | reviewed — 3 issues (2 MINOR, 1 SUSPECT); crop of the Advanced surface |
| 7 | visual-settings-backups.png | reviewed — 3 issues (2 MINOR, 1 SUSPECT); tight evidence crop |
| 8 | visual-settings-integrations-google.png | reviewed — 2 issues (1 POLISH, 1 SUSPECT); "Scriptor" spelling in the callout verified correct via zoom (no finding) |
| 9 | visual-settings-dark.png | reviewed — 3 issues (1 MINOR, 2 SUSPECT) |
| 10 | visual-theme-customizer.png | reviewed — 6 issues (3 MINOR, 2 SUSPECT, 1 POLISH) |
| 11 | visual-topbar-customizer.png | reviewed — 3 issues (1 MINOR, 2 POLISH) |
| 12 | visual-color-palettes.png | reviewed — 4 issues (2 MINOR, 2 POLISH) |
| 13 | visual-layout-presets.png | reviewed — 4 issues (2 MINOR, 1 POLISH, 1 SUSPECT) |
| 14 | visual-layout-presets-bottom.png | reviewed — 3 issues (2 MINOR, 1 POLISH) |

No image was CLEAN; no image was UNREADABLE. Totals: 47 findings — 1 MAJOR, 24 MINOR, 14 SUSPECT, 8 POLISH, 0 BLOCKER.

## Issue summary

| Severity | Image | Location | Issue | Fix |
|----------|-------|----------|-------|-----|
| MAJOR | visual-settings-workspace.png | "Workspace layout", inline checkbox row | "Split preview" and "Show sticky notes layer" collide — second checkbox overlaps the first label's last character | ≥8px gap between inline items, or stack on separate rows |
| MINOR | visual-settings-appearance.png | after "Manage color palettes" / "Reset appearance defaults" | Buttons ~20px from the field above but nearly touching the next label ("Day / night appearance", "Editor font size (px)") | Uniform group spacing between button and next field label |
| MINOR | visual-settings-shortcuts.png | table header row | "COMMAND"/"SHORTCUT" misaligned with content; "ACTIONS" flush right | Match header insets to content insets |
| MINOR | visual-settings-shortcuts.png | shortcut inputs vs search input | Teal accent borders on all key fields incl. "Default" rows; gray border on "Search commands..." | Neutral resting border; accent only for focus/modified |
| MINOR | visual-settings-workspace.png | checkbox row | Native blue OS checkboxes beside custom-styled selects/buttons | Custom checkbox matching design tokens |
| MINOR | visual-settings-advanced.png | "startup" heading | Lowercase vs sentence-case siblings ("Desktop engine", "Updates") | Sentence-case or rename to "Startup benchmarks" |
| MINOR | visual-settings-advanced.png | "Release quality dashboard" cards | "—" on three metrics vs "0" on "Panel opens tracked" | One empty-state convention |
| MINOR | visual-settings-daemon-operations.png | daemon button toolbar | Icon+label and icon-less buttons mixed in one row | Consistent iconography per button family |
| MINOR | visual-settings-daemon-operations.png | "Backlinks (active)", "Graph (active)" | Live state baked into action labels | Verbs in labels; state as badge/dot |
| MINOR | visual-settings-daemon-operations.png | under second button row | "Daemon search" label too close to toolbar vs other group gaps | Standard group spacing |
| MINOR | visual-settings-release-quality.png | "startup" heading | Lowercase section heading | Sentence-case |
| MINOR | visual-settings-release-quality.png | metric cards | "—" vs "0" empty-state inconsistency | Standardize empty values |
| MINOR | visual-settings-backups.png | "Backup Now" button | Title Case vs sentence case elsewhere ("Reset all", "Refresh Pandoc discovery") | "Backup now" |
| MINOR | visual-settings-backups.png | "Enable scheduled backups" row | Checkbox crammed against help paragraph above | Standard row spacing |
| MINOR | visual-settings-dark.png | "Enable inbox triage (`_organized` frontmatter)" | Native blue checkbox clashes with teal accent on dark | Custom checkbox with accent token |
| MINOR | visual-theme-customizer.png | "BORDER HIGHLIGHT" hex input | Value clipped mid-token: "rgba(148, 163, 184," | Widen input / ellipsis + tooltip with full value |
| MINOR | visual-theme-customizer.png | "Theme Name:", "Theme Base Category:" | Trailing-colon labels vs colon-free settings labels | Harmonize label convention |
| MINOR | visual-theme-customizer.png | "Create New Theme", "Save & Apply Theme" | Title Case buttons vs settings sentence case | Sentence case |
| MINOR | visual-topbar-customizer.png | "CUSTOMIZE TOP BAR ACTIONS" header | Uppercase letter-spaced header vs settings' sentence-case headings | One heading language per surface family |
| MINOR | visual-color-palettes.png | "Light Modern" swatch row | White swatch readable only via hairline border; reads as empty slot (zoom-verified) | Consistent stroke/inset shadow on all swatches |
| MINOR | visual-color-palettes.png | "Create Custom Palette", "Install & Activate Palette" | Title Case vs settings sentence case | Sentence case |
| MINOR | visual-layout-presets.png | preset "Apply" buttons | Teal-outline style here vs gray-border style in Settings → Workspace | One button style for the action |
| MINOR | visual-layout-presets.png | "Tools" tab vs "Layouts" toolbar item | White-pill active state vs dark-teal-pill active state in adjacent rows | Standardize active-state chrome |
| MINOR | visual-layout-presets-bottom.png | panel top edge above tab strip | Scrolled content ghosts through above the sticky "Inspector / Rendered output / Tools" bar (zoom-verified) | Opaque sticky header or strict clip |
| MINOR | visual-layout-presets-bottom.png | preset "Apply" buttons | Same teal-vs-gray button mismatch as the unscrolled frame | One button style |
| SUSPECT | visual-settings-appearance.png | after "Reset appearance defaults" | "Editor font size (px)" continues below a section-reset button with no section break | Verify section grouping; separate groups |
| SUSPECT | visual-settings-shortcuts.png | "ACTIONS" column | Only static "Default" text — no action affordance | Add per-row action or rename column to STATE |
| SUSPECT | visual-settings-workspace.png | "Author" template row | "Active" rendered as button-like control beside "Apply" buttons | Status badge/pill instead of button chrome |
| SUSPECT | visual-settings-advanced.png | section dividers | Dividers before "Updates"/"Release quality dashboard" but not before "Background desktop engine"/"startup" | Uniform section-boundary styling |
| SUSPECT | visual-settings-daemon-operations.png | "Search" button | Gray label reads disabled beside placeholder input | Align with enabled/disabled button styles |
| SUSPECT | visual-settings-daemon-operations.png | "Connected — v1.0.0-e2e" | e2e build tag in user-facing version string | Show release version (unless test build by design) |
| SUSPECT | visual-settings-release-quality.png | section dividers | No divider before "startup" though peers have them | Uniform dividers |
| SUSPECT | visual-settings-backups.png | "Backup interval (minutes)" / "Max snapshots to keep" | Dependent fields look enabled while "Enable scheduled backups" is unchecked | Disabled/derived treatment or hint text |
| SUSPECT | visual-settings-integrations-google.png | footer "Save vault config" | Muted gray-green fill reads disabled; dark-theme twin is vivid teal | Confirm state; enabled button needs primary styling |
| SUSPECT | visual-settings-dark.png | "Daily template path (optional)" placeholder | ".scriptor/templates/daily.md" gray-on-dark looks below 4.5:1 | Verify placeholder contrast in dark token set |
| SUSPECT | visual-settings-dark.png | bottom, at footer edge | "Inbox period" clipped exactly at the sticky footer, input not visible | Verify scroll clearance under footer |
| SUSPECT | visual-theme-customizer.png | live preview card | Card has no visible bottom edge — clipped behind footer or unscrolled region | Ensure preview fits or shows scroll affordance |
| SUSPECT | visual-theme-customizer.png | preview header | Teal "ACTIVE" pill inside mock document chrome — semantics unclear | Move to theme status area or remove from preview |
| SUSPECT | visual-layout-presets.png | "Plugins", "MCP", "Features" | Borderless text buttons while "Layouts" is a pill — peer tabs look inactive | Shared tab container/style |
| POLISH | visual-settings-integrations-google.png | section headings | Icon on "Google" but none on "AI provider (optional)" | Icon both or neither |
| POLISH | visual-theme-customizer.png | left sidebar | Large dead space under "Dark Midnight (dark)" select | Empty-state hint to balance panel |
| POLISH | visual-topbar-customizer.png | action checklist | Actions and status widgets ("1 changed file", "MCP read-only", "Support Scriptor") in one flat list | Group by item type |
| POLISH | visual-topbar-customizer.png | checkboxes | Native OS checkboxes vs custom panel styling | Custom checkboxes |
| POLISH | visual-color-palettes.png | "Category Filter:" | Trailing colon vs colon-free settings labels | Harmonize |
| POLISH | visual-color-palettes.png | "Light Modern" card | Selected state is only a thin teal border | Tint or checkmark chip for selection |
| POLISH | visual-layout-presets.png | preset cards | Identical generic icon on every preset | Per-preset glyphs or drop icons |
| POLISH | visual-layout-presets-bottom.png | preset cards | Same repeated generic icons | Per-preset glyphs or drop icons |

