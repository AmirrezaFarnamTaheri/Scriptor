# Upstream research — themes / UI / workflow cluster

Scope: what Scriptor should extract from the Obsidian theme, style-settings, workspace-manager
and command-palette/hotkey ecosystem. Written against the code that exists today.

## Scriptor baseline (verified by reading the repo)

| Surface | File | Current state | Gap this doc targets |
|---|---|---|---|
| Theme tokens | `src/index.css` (865 lines) | 18 hand-written `[data-theme='…']` blocks, ~45 vars each, flat namespace (`--bg`, `--ink`, `--primary`, `--glass-blur`) | No base/semantic/component tiering; no per-theme override contract; duplication across 18 blocks |
| Theme runtime | `src/hooks/useAppTheme.ts` | `VALID_THEMES` Set + `CustomColorPalette` with exactly **6** colors; `applyCustomPaletteToElement` writes 11 inline props on `<html>` | Custom themes can only touch 6 of ~45 tokens; no CSS-snippet themes; localStorage only |
| Theme UI | `src/components/themes/ThemeCard.tsx`, `ThemeCustomizerModal.tsx` (372 lines) | Card gallery + 6-swatch editor | No manifest-driven controls, no import/export, no per-theme setting namespace |
| Component tokens | `src/styles/tokens/components.css` (14 lines) | 9 layout vars (`--scriptor-inspector-width`, `--scriptor-tab-height`, …) | Density/typography/spacing scales absent; nothing user-tunable |
| Layout presets | `src/lib/workspace/layoutPresets.ts` | 8 presets over a 4-field `WorkspaceLayout` (`splitPreview`, `showStickies`, `graphDepth`, `distractionFree`) | Not a real layout tree; no user-saved workspaces; no rename/delete/overwrite |
| Layout runtime | `src/hooks/useWorkspaceLayout.ts` | `Record<WorkspaceMode, WorkspaceLayout>` in versioned localStorage, 5 modes | Presets are apply-only; no capture of panel sizes, open tabs, sidebar widths, active note |
| Workspace store | `src/hooks/useWorkspaceStore.ts` + `@scriptor/portal` | `WorkspaceBundle` (portal + quickCapture) persisted to `VAULT_WORKSPACE_PATH` | Layout is *not* in the bundle — it lives in a separate localStorage key, so layouts don't travel with the vault |
| Commands | `src/lib/appCommandRegistry.ts`, `buildPaletteCommands.ts`, `commandShortcutRegistry.ts` (49 entries) | Static registry, `defaultShortcut` strings, context object with ~80 injected callbacks | No frecency, no scoped modes, no chorded hotkeys, no conflict detection, no user rebinding surface, no surface placement |
| Palette | `src/components/CommandPalette.tsx`, `src/hooks/useCommandPalette.ts` | Mod+K opens; single flat list | Substring-only match; no recency; no `>`/`#`/`@` prefixes |
| Hotkeys | `src/lib/keyboardShortcuts.ts` | `parseShortcut` with `Mod/Ctrl/Alt/Shift/Meta` + named keys, `matchesShortcut` | Single-chord only; no sequence support; no per-context keymap layers |
| Marketplace | `src/components/StorePanel.tsx` (746 lines) | Tabs incl. Layouts; installs presets/plugins | No themes tab backed by a manifest; no style-settings surface |

---

## 1. `kmaasrud/awesome-obsidian` — the curated index

**Purpose.** A hand-maintained index of themes, plugins, CSS snippets, workflows and third-party
tools. It is not code; it is a *coverage map*. Its value here is negative-space detection: it tells
us which categories of capability an Obsidian-class app is expected to have.

**Standout structure.** Categories are stable and map almost 1:1 onto product surfaces:
`Plugins → {Editor, Workflow, Appearance, Integration, Automation, Publishing}`,
`Themes`, `CSS Snippets`, `Tools (external)`, `Workflows (opinionated writeups)`.

**Extraction candidate — not a module, a schema.** The category taxonomy is the right spine for
`StorePanel`'s catalog. Today `StorePanel` has ad-hoc tabs; give it a typed catalog kind.

```ts
// src/lib/store/catalogTaxonomy.ts (new)
export type CatalogKind = 'theme' | 'snippet' | 'layout' | 'plugin' | 'template' | 'workflow'
export type CatalogCategory =
  | 'appearance' | 'editor' | 'workflow' | 'knowledge'
  | 'integration' | 'automation' | 'publishing'
export interface CatalogEntry {
  id: string
  kind: CatalogKind
  category: CatalogCategory
  name: string
  summary: string
  author?: string
  upstream?: { repo: string; license: string }   // provenance for ported ideas
  minAppVersion?: string
  tags: string[]
}
```

Lands in `StorePanel.tsx` as the single row type behind every tab, replacing per-tab shapes.
The triage list in §7 is the concrete backlog this index produces.

---

## 2. `kepano/obsidian-minimal` + Minimal Theme Settings

**Purpose.** The reference "quiet" theme. One CSS file, no chrome of its own, everything driven by
CSS custom properties; a companion plugin (`kepano/obsidian-minimal-settings`) toggles body classes
and writes variables.

**Standout architecture — three-tier token cascade.** This is the single most valuable idea in the
cluster and the thing Scriptor's `index.css` currently lacks:

1. **Tier 1 — raw palette.** Colour ramps only, no semantics: `--mono-0 … --mono-100`,
   `--accent-h/-s/-l` stored as *separate HSL channels* so derived colours can be computed rather
   than hand-authored (`hsl(var(--accent-h), var(--accent-s), calc(var(--accent-l) + 10%))`).
2. **Tier 2 — semantic role tokens.** `--background-primary`, `--background-secondary`,
   `--background-modifier-border`, `--text-normal`, `--text-muted`, `--text-faint`,
   `--text-accent`, `--interactive-accent`, `--interactive-hover`.
3. **Tier 3 — component tokens.** `--font-text-size`, `--line-width`, `--max-width`,
   `--nav-item-size`, `--sidebar-width`, `--table-width`, `--header-height`.

Dark/light are *not* two duplicated blocks: `.theme-light` / `.theme-dark` redefine **only Tier 1**
and a handful of Tier 2 overrides. Everything else inherits. Scriptor's 18 blocks × 45 vars is the
opposite pattern and is why adding a theme means writing 45 lines.

**Standout feature — body-class feature flags.** Minimal ships behaviour toggles as classes, not
variables: `.minimal-focus-mode`, `.hider-ribbon`, `.borders-none`, `.colorful-headings`,
`.image-grid`, `.links-int-on`, `.full-width-media`, `.minimal-status-off`, `.trim-cols`. The
plugin's only job is `document.body.classList.toggle(...)` plus persistence. Zero CSS knowledge is
needed to add a toggle.

**Extraction candidates.**

| Upstream idea | Scriptor landing | Interface sketch |
|---|---|---|
| Three-tier cascade | rewrite `src/index.css` → `src/styles/tokens/{palette.css,semantic.css,component.css}`, imported by `index.css` | see §6 schema |
| HSL-channel accent | `src/styles/tokens/palette.css` | `--accent-h: 174; --accent-s: 72%; --accent-l: 40%;` + `--primary: hsl(var(--accent-h) var(--accent-s) var(--accent-l))` |
| Body-class feature flags | new `src/lib/theme/appearanceFlags.ts` + applied in `useAppTheme` | below |

```ts
// src/lib/theme/appearanceFlags.ts (new)
export interface AppearanceFlag {
  id: string                       // 'focus-mode'
  bodyClass: string                // 'scriptor-focus-mode'
  label: string
  description?: string
  default: boolean
  group: 'chrome' | 'typography' | 'media' | 'density'
}
export const APPEARANCE_FLAGS: AppearanceFlag[] = [/* … */]
export function applyAppearanceFlags(el: HTMLElement, values: Record<string, boolean>): void
```

Wire `applyAppearanceFlags(document.body, flags)` into the existing `useEffect` in
`src/hooks/useAppTheme.ts` alongside `root.dataset.theme`, and render the list in
`src/components/AppearanceSettingsSection.tsx` (197 lines today — this is where it belongs, not in
`ThemeCustomizerModal`).

---

## 3. `mgmeyers/obsidian-style-settings` — the manifest format

**Purpose.** Lets a theme or snippet *declare its own settings UI* inside a CSS comment. The plugin
parses the comment, renders controls, and writes the resulting values as CSS custom properties into
a single injected `<style>` element. It is the reason Obsidian themes are configurable without any
theme author writing TypeScript.

**Standout architecture.** A YAML block inside a CSS comment marked `@settings`:

```css
/* @settings

name: Scriptor Minimal
id: scriptor-minimal
settings:
  -
    id: typography-heading
    title: Typography
    type: heading
    level: 2
    collapsed: true
  -
    id: editor-font-size
    title: Editor font size
    description: Base size for the editing surface
    type: variable-number-slider
    default: 16
    min: 12
    max: 24
    step: 1
    format: px
  -
    id: accent
    title: Accent colour
    type: variable-themed-color
    format: hsl-split
    opacity: false
    default-light: '#0f766e'
    default-dark: '#2dd4bf'
  -
    id: scriptor-borders-none
    title: Hide panel borders
    type: class-toggle
    default: false
  -
    id: scriptor-density
    title: Density
    type: class-select
    default: comfortable
    options: [comfortable, compact, dense]
*/
```

**Setting types (the complete useful set).** `heading`, `info-text`, `class-toggle`,
`class-select`, `variable-text`, `variable-number`, `variable-number-slider`, `variable-select`,
`variable-color`, `variable-themed-color`.

Key attributes: `id` (doubles as the CSS variable name for `variable-*`, and as the body class for
`class-toggle`), `title`, `description`, `default` / `default-light` / `default-dark`, `format`
(`px`, `em`, `%`, `hex`, `rgb`, `hsl`, `hsl-split`, `rgb-split`), `opacity`,
`allowEmpty`, `min`/`max`/`step`, `options` (string or `{label,value}`), `level`, `collapsed`.

**Application model.** All values collapse into one stylesheet:
`body.css-settings-manager { --editor-font-size: 16px; --accent: … }`, plus toggled body classes.
`hsl-split` additionally emits `--accent-h/-s/-l`, which is exactly what Minimal's Tier 1 consumes —
the two projects are designed to compose. Values are persisted as a flat
`Record<"<themeId>@@<settingId>", string | number | boolean>`, namespaced by theme id, and the whole
record is JSON export/importable.

**Extraction candidates.**

```ts
// packages/core/src/contracts/styleSettings.ts (new — contract, so plugins can ship manifests)
export type StyleSettingType =
  | 'heading' | 'info-text'
  | 'class-toggle' | 'class-select'
  | 'variable-text' | 'variable-number' | 'variable-number-slider'
  | 'variable-select' | 'variable-color' | 'variable-themed-color'
export type StyleValueFormat = 'px' | 'em' | 'rem' | '%' | 'hex' | 'rgb' | 'hsl' | 'hsl-split'
export interface StyleSetting {
  id: string
  title: string
  description?: string
  type: StyleSettingType
  default?: string | number | boolean
  defaultLight?: string
  defaultDark?: string
  format?: StyleValueFormat
  min?: number; max?: number; step?: number
  options?: Array<string | { label: string; value: string }>
  opacity?: boolean
  level?: 1 | 2 | 3
  collapsed?: boolean
}
export interface StyleSettingsManifest {
  id: string            // namespace for persisted values
  name: string
  version?: string
  settings: StyleSetting[]
}
export type StyleSettingsValues = Record<string, string | number | boolean> // key = `${manifestId}@@${settingId}`
```

Supporting modules:

- `src/lib/theme/parseStyleSettings.ts` — `parseStyleSettings(css: string): StyleSettingsManifest[]`.
  Extract `/* @settings … */` blocks, parse the YAML. **Do not add a YAML dependency for this**:
  ship manifests as JSON/TS objects for built-ins, and only parse YAML for user CSS snippets. If
  YAML is required, `yaml` is already the smallest safe option; validate through
  `src/lib/runtimeSchema.ts` (`expectRecord` is already used by `useWorkspaceLayout`).
- `src/lib/theme/applyStyleSettings.ts` —
  `applyStyleSettings(values: StyleSettingsValues, manifests: StyleSettingsManifest[]): void`.
  Writes **one** `<style id="scriptor-style-settings">` element rather than the 11 inline
  `el.style.setProperty` calls currently in `useAppTheme.ts`; that inline approach cannot express
  `class-toggle` and cannot be diffed or exported.
- `src/components/settings/StyleSettingsForm.tsx` — renders a manifest. One `switch` on
  `setting.type`, one control per case. Mounted inside `AppearanceSettingsSection.tsx`.
- Export/import: `serializeStyleSettings()` / `parseStyleSettingsExport()` next to the existing
  `versionedStorage` helpers; persist through `writeVersionedStorage('scriptor:style-settings', 1, …)`
  so it inherits the migration path already used for layouts.

**Net effect on Scriptor.** `CustomColorPalette` (6 colours) is replaced by a manifest with as many
tokens as the theme chooses to expose, and `ThemeCustomizerModal.tsx` becomes a thin host for
`StyleSettingsForm` instead of six hard-coded colour inputs.

---

## 4. `phibr0/obsidian-commander` — command surfaces

**Purpose.** Lets users put *any* registered command anywhere in the chrome: ribbon, titlebar,
statusbar, page header, editor context menu, file context menu, left/right sidebar tabs. Also hides
unwanted commands from the palette and supports macros (ordered command sequences with delays).

**Standout architecture.** A single flat array of *command bindings* decoupled from the command
registry. Each binding names a target surface plus presentation, and the surface renderers are
generic — adding a surface is one component, not N features.

```ts
// src/lib/commands/commandSurfaces.ts (new)
export type CommandSurface =
  | 'ribbon' | 'titlebar' | 'statusbar' | 'page-header'
  | 'editor-menu' | 'file-menu' | 'sidebar-tab'
export type CommandDeviceMode = 'any' | 'desktop' | 'mobile'

export interface CommandBinding {
  id: string                     // binding id, not command id
  commandId: AppCommandId | string
  surface: CommandSurface
  icon?: string
  name?: string                  // user override of the command label
  mode: CommandDeviceMode
  order: number
  hidden?: boolean
}
export interface CommandMacroStep { commandId: string; delayMs?: number }
export interface CommandMacro {
  id: string
  name: string
  icon?: string
  steps: CommandMacroStep[]
}
```

**Extraction candidates → Scriptor paths.**

- `src/lib/commands/commandSurfaces.ts` — the types above plus
  `bindingsForSurface(bindings, surface, platform): CommandBinding[]`. Platform comes from the
  existing `src/platform.ts`, and mobile chrome already exists under `src/mobile/`, so `mode` is
  immediately useful rather than speculative.
- `src/components/commands/CommandSurfaceHost.tsx` — `<CommandSurfaceHost surface="statusbar" />`.
  Resolves bindings against `appCommandRegistry`, dispatches through the **existing**
  `runPluginCommand` / `buildPaletteCommands` execution path. No second dispatch mechanism.
- `hidden` closes a real gap: `buildPaletteCommands` currently returns everything it is given, and
  the palette list is already long (49 shortcut-registry entries plus per-note, per-template and
  per-plugin commands). Filter in `buildPaletteCommands` right before returning.
- Macros: `src/lib/commands/runMacro.ts` — `runMacro(macro, dispatch): Promise<void>`. Keep it
  sequential and abortable; register each macro as a synthetic `PaletteCommand` so it appears in the
  palette for free.
- Settings UI: a "Commands" section in `SettingsPanel.tsx` (560 lines, already sectioned) —
  surface picker, drag-order, hide toggles, macro editor.

**Deliberate non-adoption.** Commander's per-device *specific device id* targeting is over-scoped
for Scriptor; `'any' | 'desktop' | 'mobile'` is enough.

---

## 5. Workspace managers — core Workspaces + `Vinzent03/obsidian-workspaces-plus`

**Purpose.** Core Workspaces snapshots the entire window layout under a name and restores it.
Workspaces Plus adds a modal quick-switcher over those snapshots: fuzzy filter, save-new, rename,
delete, overwrite-on-switch ("sticky"/auto-save), and a status-bar indicator of the active workspace.

**Standout architecture — a recursive layout tree, not a flag bag.** `workspaces.json` is
`Record<workspaceName, WorkspaceSnapshot>` where the snapshot is:

```ts
// src/lib/workspace/workspaceSnapshot.ts (new)
export type PaneNodeType = 'split' | 'tabs' | 'leaf'
export interface PaneNode {
  id: string
  type: PaneNodeType
  direction?: 'horizontal' | 'vertical'   // split only
  width?: number                          // fractional weight
  children?: PaneNode[]                   // split | tabs
  state?: { view: string; params?: Record<string, unknown> } // leaf only
  currentTab?: number                     // tabs only
}
export interface SidebarState { node: PaneNode | null; collapsed: boolean; width: number }
export interface WorkspaceSnapshot {
  schemaVersion: 1
  name: string
  main: PaneNode
  left: SidebarState
  right: SidebarState
  active: string | null       // active leaf id
  mtime: number
}
export interface WorkspaceSnapshotStore {
  snapshots: Record<string, WorkspaceSnapshot>
  lastActive: string | null
  autoSave: boolean
}
```

**How this lands in Scriptor — and the honest gap.** Scriptor's `WorkspaceLayout` has four
booleans/numbers and `LAYOUT_PRESETS` are eight combinations of them. That is a *mode* system, not a
layout system. Two stages, so nothing is thrown away:

- **Stage A (cheap, high value).** Keep `WorkspaceLayout` as the payload but add user-authored named
  snapshots with full CRUD. New `src/lib/workspace/savedWorkspaces.ts`:

```ts
export interface SavedWorkspace {
  id: string
  name: string
  mode: WorkspaceMode
  layout: WorkspaceLayout
  activePath?: string | null
  mtime: number
}
export interface SavedWorkspaceStore {
  workspaces: SavedWorkspace[]
  lastActiveId: string | null
  autoSaveOnSwitch: boolean
}
export function saveWorkspace(store: SavedWorkspaceStore, input: Omit<SavedWorkspace, 'id' | 'mtime'>): SavedWorkspaceStore
export function renameWorkspace(store: SavedWorkspaceStore, id: string, name: string): SavedWorkspaceStore
export function deleteWorkspace(store: SavedWorkspaceStore, id: string): SavedWorkspaceStore
```

  Persist inside the existing `WorkspaceBundle` in `@scriptor/portal` (add a `workspaces` field
  beside `portal` and `quickCapture`) rather than a new localStorage key — that is what makes saved
  workspaces travel with the vault through `VAULT_WORKSPACE_PATH`. `LAYOUT_PRESETS` become the seed
  values, so the Store's Layouts tab keeps working unchanged.

- **Stage B.** Widen `WorkspaceLayout` toward `PaneNode` as the shell gains real splitting. Keep a
  `migrate` in `readVersionedStorage` (the hook already passes one) mapping the 4-field shape into a
  degenerate single-leaf tree.

- **Switcher UI.** `src/components/workspace/WorkspaceSwitcher.tsx` — reuse the palette modal shell
  and the scoring from §6 instead of a second fuzzy implementation. `src/styles/app/foundation.css`
  already has a `.workspace-switcher` block to grow into.
- **Auto-save on switch.** On switch, snapshot the current layout back into the outgoing workspace
  before applying the incoming one. Workspaces Plus's most-appreciated behaviour, ~10 lines.
- **Status indicator.** Render the active workspace name via the §4
  `CommandSurfaceHost surface="statusbar"` mechanism.

---

## 6. Command-palette & hotkey enhancers

Repos surveyed: `tadashi-aikawa/obsidian-another-quick-switcher`, `scambier/obsidian-omnisearch`,
`moolmanruan/obsidian-sequence-hotkeys`, `pjeby/hotkey-helper`, `pjeby/pane-relief`,
`kepano/obsidian-hider`, `ryanpcmcquen/obsidian-focus-mode`, `deathau/obsidian-vimrc-support`.

| Plugin | Capability beyond a stock palette | Worth adopting? |
|---|---|---|
| Another Quick Switcher | **Scoped search modes** invoked by prefix or dedicated hotkey (recent / backlinks / in-folder / headings / grep), each with its own sort. Fuzzy scoring weights title > path > heading; recent-file boost. | **Yes** — highest value/effort ratio in the cluster |
| Omnisearch | Full-text BM25-ish ranking over note bodies, excerpt highlighting, "switcher" bridge | Partly — ranking ideas only; Scriptor has its own Rust index |
| Sequence Hotkeys | **Chorded/leader hotkeys** — `g` then `d`, with a timeout buffer, so a small keyspace addresses many commands | **Yes** — direct upgrade to `keyboardShortcuts.ts` |
| Hotkey Helper | **Conflict detection** + jump-to-hotkey-from-plugin-list; shows which commands share a binding | **Yes** — pure win, ~60 lines |
| Pane Relief | Per-pane back/forward **navigation history** and pane-numbered focus (`Mod+1…9`) | Yes (P1) |
| Hider / Focus Mode | Chrome-hiding toggles | Already covered by §2 appearance flags |
| Vimrc support | Remapping DSL / modal editing | No — Monaco already ships a vim mode; don't reimplement |

**Extraction candidate A — scoring.** Replace substring matching in `CommandPalette.tsx` with a
scored matcher, and give it recency:

```ts
// src/lib/commands/paletteScore.ts (new)
export interface ScoredMatch { score: number; ranges: Array<[number, number]> }
/** Subsequence fuzzy match. Bonuses: prefix +30, word-boundary +15, consecutive +8, camelCase +10;
 *  penalties: -1 per skipped char, -3 leading-gap. Returns null when not all needle chars match. */
export function fuzzyScore(needle: string, haystack: string): ScoredMatch | null

/** frecency = hits * 2^(-ageDays / halfLifeDays); halfLife 7d. Added to fuzzyScore before sort. */
export interface CommandUsage { commandId: string; hits: number; lastUsedAt: number }
export function frecency(usage: CommandUsage | undefined, now?: number): number
```

Usage counters persist via `writeVersionedStorage('scriptor:command-usage', 1, …)`. Field weights
live in `buildPaletteCommands.ts` where each `PaletteCommand` already knows its label and group.

**Extraction candidate B — scoped modes.** Prefixes parsed in the palette input, dispatching to
existing data already threaded through `PaletteCommandContext`:

```ts
// src/lib/commands/paletteModes.ts (new)
export type PaletteMode = 'commands' | 'files' | 'headings' | 'tags' | 'recent' | 'workspaces'
export interface PaletteModeSpec { mode: PaletteMode; prefix: string; label: string; placeholder: string }
export const PALETTE_MODES: PaletteModeSpec[] = [
  { mode: 'commands',   prefix: '>', label: 'Commands',   placeholder: 'Run a command…' },
  { mode: 'files',      prefix: '',  label: 'Files',      placeholder: 'Open a note…' },
  { mode: 'headings',   prefix: '#', label: 'Headings',   placeholder: 'Jump to heading…' },
  { mode: 'tags',       prefix: '@', label: 'Tags',       placeholder: 'Filter by tag…' },
  { mode: 'recent',     prefix: '~', label: 'Recent',     placeholder: 'Recently opened…' },
  { mode: 'workspaces', prefix: '$', label: 'Workspaces', placeholder: 'Switch workspace…' },
]
export function parsePaletteQuery(raw: string): { mode: PaletteMode; query: string }
```

`recentNotes`, `templatePaths`, `noteTypes` and `openRecentNote` are already in
`PaletteCommandContext`, so `recent` and `files` are wiring, not new plumbing. `workspaces` reuses §5.

**Extraction candidate C — sequences and conflicts.** `src/lib/keyboardShortcuts.ts` already has
`parseShortcut` / `matchesShortcut` / `isValidShortcut`. Extend rather than replace:

```ts
// additions to src/lib/keyboardShortcuts.ts
export type ShortcutSequence = string[]                  // ['Mod+G','D'] — space-separated when serialized
export function parseSequence(value: string): ShortcutSequence | null
export interface SequenceMatcher { feed(event: ShortcutEventLike): 'pending' | 'matched' | 'miss'; reset(): void }
export function createSequenceMatcher(sequence: ShortcutSequence, timeoutMs?: number): SequenceMatcher

// src/lib/commands/shortcutConflicts.ts (new)
export interface ShortcutConflict { shortcut: string; commandIds: string[] }
export function findShortcutConflicts(bindings: Record<string, string>): ShortcutConflict[]
```

`findShortcutConflicts` should also run as a unit test over `COMMAND_SHORTCUT_REGISTRY` so a
duplicate default can never ship — that registry has 49 entries today and is edited by hand.

**Extraction candidate D — user rebinding.** There is currently no UI to change a shortcut; only
`getDefaultShortcut()`. Add `src/lib/commands/shortcutBindings.ts` with
`Record<commandId, string | null>` overrides (null = unbound), resolved as
`override ?? getDefaultShortcut(id)`, plus a "Hotkeys" section in `SettingsPanel.tsx` with a capture
input, conflict badges, and reset-to-default.

---

## 7. Peer comparison — theme token / CSS-variable schema

| Dimension | Scriptor today | Obsidian core vars | Minimal | AnuPpuccin / Things / Prism |
|---|---|---|---|---|
| Tiering | 1 tier (flat, per-theme block) | 2 (semantic + component) | 3 (palette → semantic → component) | 3 + per-flavour palette file |
| Cost to add a theme | ~45 lines × new block | n/a | ~8 Tier-1 vars | palette file only |
| Accent derivation | 2 literal hex values | `--accent-h/-s/-l` | HSL channels + `calc()` | HSL channels |
| Light/dark | 18 sibling blocks | `.theme-light` / `.theme-dark` | Tier-1 override only | class + `@media` |
| User-tunable | 6 colours | none | via Minimal Settings | via Style Settings |
| Naming | `--bg`, `--ink`, `--amber` (brand-flavoured) | `--background-primary`, `--text-normal` (role-named) | role-named | role-named |

**Best of all worlds.** Three files under `src/styles/tokens/`, imported in order by `src/index.css`:

1. `palette.css` — Tier 1. `--accent-h/-s/-l`, `--mono-0…--mono-100`, signal hues
   (`--hue-danger`, `--hue-success`, `--hue-warning`). The *only* file a new theme writes.
2. `semantic.css` — Tier 2, authored **once**, never per-theme. Derives everything from Tier 1 with
   `hsl()` / `color-mix()`: `--background-primary`, `--background-secondary`,
   `--background-modifier-border`, `--text-normal`, `--text-muted`, `--text-faint`,
   `--interactive-accent`, `--interactive-hover`, `--overlay`, `--focus-ring`.
3. `component.css` — Tier 3. Extends today's 9 vars with density/type scales: `--font-text-size`,
   `--line-height`, `--line-width`, `--max-width`, `--radius-{sm,md,lg}`, `--space-{1..6}`, plus the
   existing `--scriptor-*` widths.

Keep current names as **aliases** in `semantic.css` (`--bg: var(--background-primary)`,
`--ink: var(--text-normal)`, `--primary: var(--interactive-accent)`) so none of the ~50 component
stylesheets change. Non-breaking: `index.css` drops from 865 lines to ~18 small Tier-1 blocks.

---

## 8. Peer comparison — user-configurable style-settings manifests

| Dimension | Scriptor `ThemeCustomizerModal` | Style Settings | Minimal Settings |
|---|---|---|---|
| Declaration site | hard-coded TSX (6 inputs) | YAML in a CSS comment | TS in the plugin |
| Control types | colour only | 10 types incl. sliders, selects, toggles | toggles + selects + a few numbers |
| Themed defaults | single value | `default-light` / `default-dark` | per-mode |
| Application | 11 inline props on `<html>` | one injected `<style>` + body classes | body classes + vars |
| Namespacing | none | `themeId@@settingId` | plugin-scoped |
| Export / import | none | JSON round-trip | no |
| Third-party authorship | impossible | any CSS snippet or theme | no |

**Best of all worlds.** Adopt Style Settings' **type system and namespaced value store**, but
Minimal's **typed-object declaration** for built-ins:

- Built-in themes ship `StyleSettingsManifest` objects in TS (typed, tree-shaken, no parser cost).
- User CSS snippets and plugins may ship a `/* @settings */` block, parsed by
  `src/lib/theme/parseStyleSettings.ts` and validated through `src/lib/runtimeSchema.ts`.
- One writer: `applyStyleSettings()` emits a single `<style id="scriptor-style-settings">`, replacing
  the inline `setProperty` calls in `useAppTheme.ts`.
- Values keyed `` `${manifestId}@@${settingId}` `` in `writeVersionedStorage('scriptor:style-settings', 1, …)`;
  JSON export/import buttons in `AppearanceSettingsSection.tsx`.
- `StorePanel.tsx` gains a **Themes** tab whose rows are `CatalogEntry { kind: 'theme' }` (§1);
  selecting a theme reveals its manifest form inline. This makes themes a first-class Store artifact
  alongside the existing Layouts tab.

---

## 9. Peer comparison — workspace layout save / restore

| Dimension | Scriptor `layoutPresets.ts` | Core Workspaces | Workspaces Plus | Commander |
|---|---|---|---|---|
| Payload | 4 flags (`splitPreview`, `showStickies`, `graphDepth`, `distractionFree`) | recursive `split/tabs/leaf` tree + both sidebars | same, via core | n/a |
| Named user snapshots | no — 8 built-ins only | yes | yes + fuzzy switcher | n/a |
| CRUD | apply-only | save / load / delete | save / rename / delete / overwrite | n/a |
| Auto-save on switch | no | no | **yes** (sticky mode) | n/a |
| Restores open tabs / active note | no | yes | yes | n/a |
| Persistence scope | `localStorage`, per mode | `.obsidian/workspaces.json` (travels with vault) | same | plugin data |
| Discoverability | Store "Layouts" tab | command only | palette + status bar | any chrome surface |

**Best of all worlds.**

1. Keep `WorkspaceMode` × `WorkspaceLayout` defaults as the *baseline* — mode-scoped defaults are a
   genuinely good idea Obsidian lacks, and `DEFAULT_WORKSPACE_LAYOUTS` already exists.
2. Add named user snapshots (`SavedWorkspace`, §5) with save / rename / delete / overwrite, seeded
   from `LAYOUT_PRESETS` so the Store tab is unchanged.
3. Move persistence into the vault-backed `WorkspaceBundle` (`@scriptor/portal`) so workspaces travel
   with the vault like `workspaces.json`, instead of being stranded in `localStorage`.
4. Extend the payload with `activePath` now and the `PaneNode` tree later, gated by
   `readVersionedStorage`'s existing `migrate` hook.
5. Adopt Workspaces Plus's **auto-save-on-switch** flag and status-bar indicator; surface the switcher
   as palette mode `$` (§6) rather than a bespoke modal.

---

## 10. Triage — remaining high-value awesome-obsidian plugins

Excludes the six other clusters (sync/git, graph/canvas, editor/markdown extensions, plugin
API/sandboxing, publishing/export, AI/LLM). Value judged for a Tauri + React + Rust desktop app.

### Tasks & structured views

| Plugin | What it does | Value |
|---|---|---|
| `obsidian-tasks-group/obsidian-tasks` | Inline `- [ ]` tasks with due/scheduled/recurring metadata + a query language | **High** — pairs with existing `smart-collections` (DQL) |
| `blacksmithgu/obsidian-dataview` | Query notes/frontmatter as tables/lists (DQL + JS API) | High — Scriptor already has DQL smart collections; extend, don't duplicate |
| `mgmeyers/obsidian-kanban` | Markdown-backed Kanban board view | Med — good demo of "alternate view over a markdown file" |
| `marcusolsson/obsidian-projects` | Table/board/calendar views over frontmatter | Med |
| `davish/obsidian-full-calendar` | Calendar view from events in notes | Low/Med |
| `lynchjames/obsidian-day-planner` | Timeline from a daily-note schedule | Low |

### Capture, templating, periodic notes

| Plugin | What it does | Value |
|---|---|---|
| `SilentVoid13/Templater` | Templates with JS expressions, cursor placeholders, prompts, file-creation hooks | **High** — Scriptor has `templatePaths` + `open-templates`; the missing piece is dynamic tokens |
| `chhoumann/quickadd` | Capture/macro/template "choices" bound to a single palette entry | **High** — composes with §4 macros and existing `quick-capture` |
| `liamcain/obsidian-periodic-notes` | Daily/weekly/monthly/quarterly note scaffolding | High — Scriptor has daily only (`open-daily-note`) |
| `liamcain/obsidian-calendar-plugin` | Month grid tied to periodic notes | Med |
| `argenos/nldates-obsidian` | Natural-language date parsing (`@tomorrow`) | Med — small, delightful |
| `mirnovov/obsidian-homepage` | Deterministic startup view | Med — pairs with §5 `lastActiveId` |

### Metadata & properties

| Plugin | What it does | Value |
|---|---|---|
| `mdelobelle/metadatamenu` | Typed frontmatter fields with per-field UI (select, multi, date, lookup) | **High** — a `FieldDefinition` schema is the natural companion to `src/lib/frontmatter.ts` |
| `Vinzent03/obsidian-advanced-uri` | Deep links into notes/commands/headings | High — a `scriptor://` URI handler is a Tauri-native win |
| `SkepticMystic/breadcrumbs` | Hierarchy from frontmatter fields + navigation trail | Med — `doc-breadcrumbs.css` and `toggle-breadcrumbs` already exist |
| `pjeby/tag-wrangler` | Rename/merge tags vault-wide | Med — belongs in the existing tags view |

### Reading, annotation, references

| Plugin | What it does | Value |
|---|---|---|
| `elias-sundqvist/obsidian-annotator` | Annotate PDFs/EPUBs, highlights stored in markdown | Med |
| `mgmeyers/obsidian-zotero-integration` | Zotero citations + annotation import | Med — bibliography/CSL already present (`citeprocClient.ts`) |
| `readwiseio/obsidian-readwise` | Sync highlights from Readwise | Low |
| `nothingislost/obsidian-dynamic-highlights` | Persistent user-defined highlight rules | Med — regex + CSS only, cheap |

### Media & diagramming

| Plugin | What it does | Value |
|---|---|---|
| `zsviczian/obsidian-excalidraw-plugin` | Hand-drawn diagrams embedded as notes | Med — overlaps Scriptor's canvas |
| `lynchjames/obsidian-mind-map` | Render a note's outline as a mind map | Med — cheap on top of `tocFromMarkdown.ts` |
| `noy-b/obsidian-image-toolkit` | Zoom/pan/rotate images in a lightbox | Med — small, immediately noticeable |
| `noatpad/obsidian-media-extended` | Timestamped media links | Low |

### Writing & editing UX

| Plugin | What it does | Value |
|---|---|---|
| `tgrosinger/advanced-tables-obsidian` | Table formatting, navigation, sorting, formulas | **High** — top-requested markdown ergonomic |
| `vslinko/obsidian-outliner` | Outliner list editing: fold, move, zoom, list ops | High |
| `kevboh/longform` | Multi-scene manuscript compilation | Med — fits Scriptor's authoring positioning |
| `tgrosinger/recent-files-obsidian` | Recent files pane | Low — `recentNotes` exists; use palette `~` |
| `oliveryh/obsidian-emoji-shortcodes` | `:smile:` shortcodes | Low |
| `deathau/cm-editor-syntax-highlight-obsidian` | Fenced-block highlighting | Covered by Monaco |

---

## 11. Prioritized backlog

Effort in engineer-days for one engineer including tests. "Touches" lists the primary files.

### P0 — foundational, unblocks everything else

| # | Item | Effort | Touches |
|---|---|---|---|
| P0-1 | Three-tier token refactor with back-compat aliases | 3d | `src/styles/tokens/{palette,semantic,component}.css`, `src/index.css` |
| P0-2 | `StyleSettingsManifest` contract + `applyStyleSettings` single-stylesheet writer | 3d | `packages/core/src/contracts/styleSettings.ts`, `src/lib/theme/applyStyleSettings.ts`, `src/hooks/useAppTheme.ts` |
| P0-3 | `StyleSettingsForm` + manifests for the 18 built-in themes; retire the 6-colour `CustomColorPalette` | 4d | `src/components/settings/StyleSettingsForm.tsx`, `ThemeCustomizerModal.tsx`, `AppearanceSettingsSection.tsx` |
| P0-4 | Palette fuzzy scoring + frecency | 2d | `src/lib/commands/paletteScore.ts`, `CommandPalette.tsx`, `buildPaletteCommands.ts` |
| P0-5 | Named saved workspaces (CRUD) persisted in `WorkspaceBundle`; seed from `LAYOUT_PRESETS` | 3d | `src/lib/workspace/savedWorkspaces.ts`, `useWorkspaceLayout.ts`, `@scriptor/portal` |
| P0-6 | User hotkey rebinding + conflict detection (incl. a registry test) | 2d | `src/lib/commands/{shortcutBindings,shortcutConflicts}.ts`, `SettingsPanel.tsx` |

### P1 — high leverage, builds on P0

| # | Item | Effort | Touches |
|---|---|---|---|
| P1-1 | Scoped palette modes (`>` `#` `@` `~` `$`) | 3d | `src/lib/commands/paletteModes.ts`, `CommandPalette.tsx` |
| P1-2 | Appearance feature flags (body classes: focus mode, borderless, density, full-width media) | 2d | `src/lib/theme/appearanceFlags.ts`, `AppearanceSettingsSection.tsx` |
| P1-3 | Command surfaces + `hidden` filtering (ribbon / statusbar / titlebar / context menus) | 4d | `src/lib/commands/commandSurfaces.ts`, `src/components/commands/CommandSurfaceHost.tsx`, `SettingsPanel.tsx` |
| P1-4 | Workspace switcher UI + auto-save-on-switch + status indicator | 2d | `src/components/workspace/WorkspaceSwitcher.tsx`, `savedWorkspaces.ts` |
| P1-5 | Sequence (leader) hotkeys | 2d | `src/lib/keyboardShortcuts.ts` |
| P1-6 | Store catalog taxonomy + **Themes** tab | 2d | `src/lib/store/catalogTaxonomy.ts`, `StorePanel.tsx` |
| P1-7 | Style-settings JSON export / import | 1d | `src/lib/theme/applyStyleSettings.ts`, `AppearanceSettingsSection.tsx` |
| P1-8 | Command macros (ordered command sequences) | 2d | `src/lib/commands/runMacro.ts`, `buildPaletteCommands.ts` |
| P1-9 | Pane/tab navigation history (back / forward, `Mod+1…9`) | 3d | shell components, `commandShortcutRegistry.ts` |
| P1-10 | Periodic notes (weekly/monthly/quarterly) generalizing `open-daily-note` | 3d | `src/lib/vaultPresets.ts`, `appCommandRegistry.ts` |
| P1-11 | Dynamic template tokens (date math, cursor, prompt) | 3d | template pipeline, `promptText` in `PaletteCommandContext` |
| P1-12 | `scriptor://` URI handler (open note / run command / jump to heading) | 2d | Tauri `crates/`, `src/bridge/commands.ts` |

### P2 — valuable, not on the critical path

| # | Item | Effort | Touches |
|---|---|---|---|
| P2-1 | User CSS-snippet loading + `/* @settings */` YAML parsing | 3d | `src/lib/theme/parseStyleSettings.ts`, vault `.scriptor/snippets/` |
| P2-2 | Advanced-tables editing ergonomics (format, navigate, sort) | 5d | Monaco commands, `applyEditorTransform` |
| P2-3 | Outliner list operations (fold, move, zoom) | 4d | Monaco commands |
| P2-4 | Typed frontmatter field definitions + per-field editors | 5d | `src/lib/frontmatter.ts`, inspector |
| P2-5 | Tasks-style query syntax layered onto existing DQL smart collections | 5d | `src/lib/knowledge/`, `smart-collections` |
| P2-6 | Kanban / board view over a markdown file | 5d | new view + `PaneNode.state.view` |
| P2-7 | Full `PaneNode` layout tree (Stage B of §5) | 8d | shell, `workspaceSnapshot.ts`, migration |
| P2-8 | Image lightbox (zoom / pan) | 2d | `markdown-preview.css`, preview component |
| P2-9 | Dynamic user highlight rules | 2d | preview + Monaco decorations |
| P2-10 | Mind-map view from `tocFromMarkdown` | 3d | new view, `forceGraph.ts` reuse |
| P2-11 | Natural-language date parsing | 1d | template + capture inputs |
| P2-12 | Startup homepage / restore-last-workspace | 1d | `savedWorkspaces.ts`, `settingsDefaults.ts` |

### Sequencing note

P0-1 → P0-2 → P0-3 must run in order (tokens before manifests before UI). P0-4/P0-6 and P0-5 are
independent and can run in parallel. P1-1, P1-4 and P1-8 all depend on P0-4's scorer; do not start
them before it lands or you will get a second fuzzy implementation.

### Explicit non-goals

Vim-style remap DSL (Monaco covers it), per-device-id command targeting, a JS-evaluating template
engine (sandboxing cost exceeds value — use declarative tokens), and reimplementing Dataview's JS
API. Prefer extending Scriptor's existing DQL smart collections.

