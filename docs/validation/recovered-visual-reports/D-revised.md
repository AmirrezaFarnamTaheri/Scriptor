> Recovered authoring payload, not a fresh screenshot verification. Source trace: `session-2026-09-29-14-56-25-76e25ba2_001.jsonl`, line 425. Original path: `C:/Users/ACER/.penguin/data/default_project/agents/default_agent/scratchpad/session-2026-09-29-12-23-19-ea2f1a04/vr-review-D.md`.

# Visual QA Review — Batch D (settings / forms / customization)

Reviewer: Batch D agent · Date: 2026-09-29 · Source: `vr/images/current--visual-review-...--<name>` (14 files)

Note on evidence: mid-review the image renderer began returning stale frames (same image for different files). Every affected file was re-verified via re-encoded copies / magnified crops, and doubtful text was checked at 4–8× zoom before asserting. All 14 files were seen at least once at full fidelity.

## visual-settings-appearance.png

- [MINOR] Form rhythm, "Day / night appearance" row — the label sits directly under the "Manage color palettes" button (~6–8px gap) while labels below selects get ~28px, breaking the vertical rhythm ("Color palette" / "Manage color palettes" / "Day / night appearance") → apply one spacing token between a control and the next field label regardless of control type.
- [MINOR] Section middle, between "Glassmorphism backdrop blur" and "Editor font size (px)" — "Reset appearance defaults" floats mid-form between two field rows instead of at the end of the appearance group → move the reset action to the end of its group (or attach it to the section header).

## visual-settings-shortcuts.png

- [MINOR] Shortcuts table, SHORTCUT column — shortcut inputs ("Alt+I", "Alt+D", …) occupy a narrow ~120px band with a large empty gap before the right-aligned "Default" in ACTIONS → rebalance column widths (widen the shortcut column or move ACTIONS closer).
- [MINOR] Rows "Open reader" / "Open tasks panel" — an extra "Disabled" caption under the "Unassigned" input makes those rows taller than assigned rows ("Alt+I" etc.), so row rhythm breaks across the table → reserve a fixed caption line in every row or move the state into the ACTIONS column.
- [SUSPECT] ACTIONS column — "Default" renders as plain text with no button/link affordance; unclear whether it is a status or a clickable "reset to default" → if actionable, style it as a link/button; if status, label the column STATE.
- [POLISH] Table header row — "SHORTCUT" header starts slightly left of the shortcut input boxes' left edge, while "COMMAND" aligns exactly with its text → align the header to its column's content edge.

## visual-settings-workspace.png

- [MAJOR] Checkbox row under "Saved layout for writing mode. Switch modes in the top bar to configure each layout." — the two checkbox groups collide: the "Show sticky notes layer" checkbox is flush against the end of "Split preview" ("Split preview☑Show sticky notes layer", verified at 4× zoom) → add horizontal gap/margin between inline checkbox-label pairs (or stack them).
- [MINOR] Layout templates list, "Author" card — the active template's state is shown as an "Active" button chrome identical to the sibling "Apply" buttons (same size/border/radius), reading like a disabled button rather than a selected state → mark the active card (accent border/badge) and render "Active" as a state chip, not button chrome.
- [POLISH] Same checkbox row — checkboxes use the native blue accent while buttons/tabs/primary actions use the teal accent → theme the checkbox accent to the palette's primary color.

## visual-settings-advanced.png

- [MINOR] Section heading "startup" — lowercase while sibling headings are title case ("Desktop engine", "Background desktop engine", "Updates", "Release quality dashboard") → use consistent heading capitalization ("Startup").
- [MINOR] Section boundaries — dividers separate "Updates" from its neighbors, but "startup" follows "Release quality dashboard" with only whitespace and no divider → use one section-separator rule consistently.
- [POLISH] "Pandoc" info pair — "3.1.11" sits in a narrow left column and "C:/Program Files/Pandoc/pandoc.exe" in a fixed right column, leaving a wide dead gap between them → tighten the two-column split or flow values inline after labels.

## visual-settings-daemon-operations.png

- [MINOR] Second button row — "Backlinks (active)" and "Graph (active)" are styled identically to plain commands ("Count notes"); the toggle state exists only as label text → give active toggles a pressed/selected visual state and drop "(active)" from the label.
- [MINOR] Button cluster — "Refresh status", "Start daemon", "Rebuild index", "Health diagnostics" carry leading icons while "Show endpoint", "Count notes", "Backlinks (active)", "Graph (active)" have none → use one icon policy per button group.
- [MINOR] "Daemon search" row — the "Search" button is visibly shorter than the input it belongs to → match the button height to the input height.
- [SUSPECT] Row 1 — "Start daemon" is offered while the status line reads "Connected — v1.0.0-e2e"; a start action for an already-connected daemon is contradictory → disable/replace with "Restart daemon" when connected.

## visual-settings-release-quality.png

- [MINOR] Section heading "startup" (bottom third) — lowercase vs title-case siblings ("Updates", "Release quality dashboard") → "Startup".
- [MINOR] Between "Reset journey metrics" and "startup" — no section divider here though other sections are divided → consistent separator rule.
- [POLISH] Stat cards ("Time to first edit —", "Time to first export —", "Last index rebuild —", "Panel opens tracked 0") — first card is wider than the other three and empty values mix "—" with "0" → equalize card widths and use one empty-value convention (or explain the counter vs metric difference).

## visual-settings-backups.png

- [MINOR] "Backup interval (minutes)" = "60" and "Max snapshots to keep" = "10" — dependent fields render fully enabled while the master checkbox "Enable scheduled backups" is unchecked → visibly disable (or group under) dependent fields when the feature is off.
- [POLISH] "Backup Now" button — title case while every other settings button is sentence case ("Reset all", "Reset journey metrics", "Save vault config") → "Backup now" (or standardize all).

## visual-settings-integrations-google.png

- [SUSPECT] "AI provider (optional)" block — with Provider = "Off", the "Endpoint" and "API key" fields render in normal enabled state (placeholders "https://api.openai.com/v1/chat/completions" / "Paste API key") → likely should be disabled while the provider is off (same disabled-state pattern as backups); if intentionally always-editable, mark SUSPECT resolved.

## visual-settings-dark.png

- [MINOR] "Inbox workflow" — checked checkbox "Enable inbox triage (`_organized` frontmatter)" uses the native bright blue fill, a light-theme leftover next to the dark palette and teal accents ("Save vault config", active "General" tab) → theme the checkbox accent for dark mode.
- [MINOR] Dashed preview strip — "Today's daily note: daily/2026-09-29.md — title 2026-09-29" is dim gray on the dark strip, borderline contrast for secondary text → raise the secondary text contrast on dark surfaces.
- [SUSPECT] Bottom edge — the "Inbox period" label is half-clipped behind the sticky footer bar in this capture with no visible scroll affordance → confirm the content area scrolls and consider a fade/scroll shadow at the footer boundary.

## visual-theme-customizer.png

- [MAJOR] "BORDER HIGHLIGHT" hex input (bottom-right swatch card) — value truncated mid-token: "rgba(148, 163, 184," with the closing values/paren cut off → widen the field or accept/truncate rgba() with an ellipsis and a tooltip; validate by showing the full canonical value.
- [MINOR] Label treatment within one dialog — "Theme Name:" / "Theme Base Category:" use title case + trailing colons while the left column uses uppercase letter-spaced labels ("SAVED CUSTOM THEMES (0)", "LOAD FROM PRESET TEMPLATE"), and Settings pages use plain labels ("Color palette") → pick one label style per surface family.
- [SUSPECT] Live preview card at the bottom — "Here is sample markdown text rendered with your customized palette." is the last visible line and the card is cut by the footer, so the preview cannot be fully seen; no scroll affordance is visible → ensure the preview fits the dialog or scrolls with a visible cue.
- [POLISH] Left column below the preset select ("Dark Midnight (dark)") — a large empty area under "No custom themes saved yet." → fill with help copy or tighten the column.
- [POLISH] Preview heading "Real-time Interactive Live Preview" — "real-time", "interactive" and "live" are redundant → shorten (e.g., "Live preview").

## visual-topbar-customizer.png

- [MINOR] Checkbox list ("Workbench" … "Color palettes") — native blue checkboxes against the app's teal accent (compare "Layouts" pill and primary buttons elsewhere) → theme the checkbox accent.
- [POLISH] Item list — navigational actions ("Workbench", "Publish", "Portal", "Capture", "Graph", "Canvas", "Color palettes") are interleaved with status chips ("1 changed file", "MCP read-only", "Support Scriptor") in one flat list → group items by kind with small subheads.

## visual-color-palettes.png

- [MINOR] Swatch strips on palette cards — pale/white chips (Light Modern's 3rd/4th chips; Dark Midnight's 5th chip) have no border and read as empty slots on the white card → add a hairline border to all swatch chips.
- [MINOR] Light Modern card footer — "✓ Installed & Active" renders as very light gray text on a pale green control, lower contrast than the "Install & Activate Palette" CTAs it parallels → style the active state as a confident badge (accent border + accent text).
- [POLISH] Category badges — "LIGHT" is amber and "DARK" is gray-blue; the colors don't communicate light/dark → use neutral chips or color-code by category semantics.
- [SUSPECT] Dracula card — description promises "purple, pink, and cyan highlights" but the five chips show pink, orange, dark, dark, cream (no purple/cyan visible) → verify the swatch strip samples the palette's real accents.

## visual-layout-presets.png

- [MINOR] Card list (Zen … Draft sprint) — every card shows an identical "Apply" button with no indication of the current layout, while the twin list in Settings > Workspace marks its active template ("Active") → show the active/current layout here too (badge or disabled "Active" chip).
- [MINOR] Tab rows — the active top tab "Tools" is a white pill with border while the active sub-tab "Layouts" is a dark teal filled pill; two different active-state treatments stacked in one panel → use one active-state style for tabs.
- [POLISH] "Reviewer" card — description wraps leaving an orphan word: "Source beside the writable visual preview, no / stickies." → adjust copy or card width to avoid one-word last lines.

## visual-layout-presets-bottom.png

- [MINOR] Scrolled card list (Zen … Synthesis) — same as above: all cards show "Apply" only; no card carries the current-layout state ("Draft sprint", "Synthesis" etc. indistinguishable from inactive) → add an active-state marker.
- [SUSPECT] Top of the panel — the sticky tab bar ("Inspector | Rendered output | Tools") covers the Zen card mid-height with only a hairline divider, no shadow/fade → consider an elevation cue so scrolled content reads as passing under the bar.

## Coverage

| # | File | Status | Issues |
|---|------|--------|--------|
| 1 | visual-settings-appearance.png | reviewed | 2 (MINOR×2) |
| 2 | visual-settings-shortcuts.png | reviewed | 4 (MINOR×2, SUSPECT×1, POLISH×1) |
| 3 | visual-settings-workspace.png | reviewed | 3 (MAJOR×1, MINOR×1, POLISH×1) |
| 4 | visual-settings-advanced.png | reviewed | 3 (MINOR×2, POLISH×1) |
| 5 | visual-settings-daemon-operations.png | reviewed | 4 (MINOR×3, SUSPECT×1) |
| 6 | visual-settings-release-quality.png | reviewed | 3 (MINOR×2, POLISH×1) |
| 7 | visual-settings-backups.png | reviewed | 2 (MINOR×1, POLISH×1) |
| 8 | visual-settings-integrations-google.png | reviewed | 1 (SUSPECT×1) |
| 9 | visual-settings-dark.png | reviewed | 3 (MINOR×2, SUSPECT×1) |
| 10 | visual-theme-customizer.png | reviewed | 5 (MAJOR×1, MINOR×1, SUSPECT×1, POLISH×2) |
| 11 | visual-topbar-customizer.png | reviewed | 2 (MINOR×1, POLISH×1) |
| 12 | visual-color-palettes.png | reviewed | 4 (MINOR×2, POLISH×1, SUSPECT×1) |
| 13 | visual-layout-presets.png | reviewed | 3 (MINOR×2, POLISH×1) |
| 14 | visual-layout-presets-bottom.png | reviewed | 2 (MINOR×1, SUSPECT×1) |

Totals: BLOCKER 0 · MAJOR 2 · MINOR 22 · POLISH 10 · SUSPECT 7 (41 findings across 14 images).

## Issue summary

| Severity | Image | Location | Issue | Fix |
|----------|-------|----------|-------|-----|
| MAJOR | visual-settings-workspace.png | checkbox row under help text | "Split preview" label collides with the "Show sticky notes layer" checkbox (zero gap) | add spacing between inline checkbox-label pairs |
| MAJOR | visual-theme-customizer.png | BORDER HIGHLIGHT hex input | value truncated mid-token: "rgba(148, 163, 184," | widen field / ellipsize + tooltip; show full canonical value |
| MINOR | visual-settings-appearance.png | "Day / night appearance" row | label crowded under "Manage color palettes" button vs 28px rhythm elsewhere | one spacing token control→label |
| MINOR | visual-settings-appearance.png | mid-section | "Reset appearance defaults" floats between field rows | move to end of appearance group |
| MINOR | visual-settings-shortcuts.png | SHORTCUT/ACTIONS columns | narrow shortcut inputs + wide empty gap before "Default" | rebalance column widths |
| MINOR | visual-settings-shortcuts.png | "Open reader"/"Open tasks panel" rows | "Disabled" caption makes rows taller than assigned rows | fixed caption line or move state to ACTIONS |
| MINOR | visual-settings-workspace.png | "Author" template card | "Active" state rendered as button chrome identical to "Apply" | active card border/badge + state chip |
| MINOR | visual-settings-advanced.png | "startup" heading | lowercase vs title-case sibling headings | "Startup" |
| MINOR | visual-settings-advanced.png | section boundaries | divider before "Updates" but none before "startup" | consistent separators |
| MINOR | visual-settings-daemon-operations.png | second button row | "Backlinks (active)"/"Graph (active)" state only in label text | pressed/selected toggle styling |
| MINOR | visual-settings-daemon-operations.png | button cluster | mixed icon / no-icon buttons in one group | one icon policy |
| MINOR | visual-settings-daemon-operations.png | "Daemon search" row | "Search" button shorter than its input | match heights |
| MINOR | visual-settings-release-quality.png | "startup" heading | lowercase heading | "Startup" |
| MINOR | visual-settings-release-quality.png | before "startup" | missing section divider | consistent separators |
| MINOR | visual-settings-backups.png | backup fields | "60"/"10" inputs enabled while "Enable scheduled backups" unchecked | disable dependent fields |
| MINOR | visual-settings-dark.png | "Enable inbox triage" checkbox | native blue checkbox = light-theme leftover in dark palette | theme checkbox accent |
| MINOR | visual-settings-dark.png | dashed preview strip | "Today's daily note: daily/2026-09-29.md — title 2026-09-29" too dim on dark | raise secondary text contrast |
| MINOR | visual-theme-customizer.png | labels | colon labels ("Theme Name:") vs ALL-CAPS ("SAVED CUSTOM THEMES (0)") in one dialog | one label style |
| MINOR | visual-topbar-customizer.png | checkbox list | native blue checkboxes vs teal accent | theme checkbox accent |
| MINOR | visual-color-palettes.png | swatch strips | pale/white chips borderless, read as empty slots | hairline borders on chips |
| MINOR | visual-color-palettes.png | Light Modern footer | "✓ Installed & Active" low-contrast disabled-looking state | confident active badge |
| MINOR | visual-layout-presets.png | card list | no current-layout state; all cards show "Apply" | active-state marker |
| MINOR | visual-layout-presets.png | tab rows | "Tools" white pill vs "Layouts" teal filled pill for active states | one active-tab style |
| MINOR | visual-layout-presets-bottom.png | card list | same: no active-layout marker on scrolled cards | active-state marker |
| POLISH | visual-settings-shortcuts.png | table header | "SHORTCUT" header misaligned vs input column edge | align header to content edge |
| POLISH | visual-settings-workspace.png | checkbox row | blue checkbox accent vs teal UI accent | palette-consistent accent |
| POLISH | visual-settings-advanced.png | Pandoc/Executable pair | wide dead gap between short value and path column | tighten columns |
| POLISH | visual-settings-release-quality.png | stat cards | uneven card widths; "—" vs "0" empty values | equalize; one empty convention |
| POLISH | visual-settings-backups.png | "Backup Now" button | title case vs sentence-case buttons elsewhere | "Backup now" |
| POLISH | visual-theme-customizer.png | left column | dead space under preset select | help copy or tighter column |
| POLISH | visual-theme-customizer.png | preview heading | "Real-time Interactive Live Preview" redundant | "Live preview" |
| POLISH | visual-topbar-customizer.png | item list | actions mixed with status chips flat list | group by kind |
| POLISH | visual-color-palettes.png | category badges | "LIGHT" amber / "DARK" gray-blue not semantic | neutral or semantic chips |
| POLISH | visual-layout-presets.png | "Reviewer" card | orphan wrap "…no / stickies." | adjust copy/width |
| SUSPECT | visual-settings-shortcuts.png | ACTIONS column | "Default" plain text, affordance unclear | link/button or rename column |
| SUSPECT | visual-settings-daemon-operations.png | "Start daemon" button | shown while status "Connected — v1.0.0-e2e" | disable or "Restart daemon" |
| SUSPECT | visual-settings-integrations-google.png | Endpoint/API key fields | enabled while Provider = "Off" | disable when off (verify intent) |
| SUSPECT | visual-settings-dark.png | bottom edge | "Inbox period" clipped behind footer, no scroll cue | scroll affordance check |
| SUSPECT | visual-theme-customizer.png | live preview card | clipped at footer; preview not fully visible | fit or scroll with cue |
| SUSPECT | visual-color-palettes.png | Dracula card | description cites "purple, pink, and cyan" but chips show pink/orange/dark/dark/cream | verify swatch sampling |
| SUSPECT | visual-layout-presets-bottom.png | sticky tab bar | covers Zen card with only hairline, no elevation cue | shadow/fade under sticky bar |

