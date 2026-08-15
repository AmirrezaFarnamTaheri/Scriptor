# Upstream Research: Tasks / Planning / Capture

Cluster survey of seven Obsidian-ecosystem repos, mapped onto Scriptor
(Tauri v2 + React 19 + Rust, `D:\GitHub\Scriptor`).

## Scriptor grounding (verified by reading the repo)

| Existing asset | Path | Relevance |
|---|---|---|
| DQL query engine (compound AND/OR, `path has #tag`, `title/body contains`, `path matches`, `links to [[x]]`) | `crates/indexer/src/dql.rs` | Base for a task query language; currently note-scoped only, no task rows |
| SQLite cache schema v4 (`notes`, `links`, `note_fts`, `citation_refs`, `recent_access`) | `crates/indexer/src/schema.rs` | Needs a `tasks` table + migration v4→v5 |
| JSON view filters (`ViewFilter`, `evaluate_view_filter`) | `crates/indexer/src/views.rs`, `crates/vault/src/views.rs` | Saved task views persistence |
| Inbox triage (period filter, next-entry cursor) | `src/lib/knowledge/inbox.ts`, `src/components/inbox/InboxPanel.tsx` | Thino-style capture stream host |
| Quick capture (append timestamped line to `inbox/inbox.md`) | `src/hooks/useQuickCapture.ts`, `src/components/portal/QuickCapturePanel.tsx` | QuickAdd "Capture" choice, minus format engine |
| Template expansion (`{{date}} {{time}} {{title}} {{cursor}}`) | `src/lib/knowledge/templateExpansion.ts` | QuickAdd formatter, minus prompts/macros |
| Daily-note token preview + date offset | `src/lib/knowledge/dailyNote.ts` | Day-planner daily timeline anchor |
| Canvas board with CRDT sync, undo/redo, debounced persist | `src/hooks/useCanvasBoard.ts`, `packages/canvas` | Kanban board host (drag/drop + persistence already solved) |
| Google Calendar sync hook | `src/hooks/useGoogleCalendarSync.ts` | Day-planner ICS/event overlay |
| Frontmatter scalar parse; Rust frontmatter ops | `src/lib/frontmatter.ts`, `crates/vault/src/frontmatter_ops.rs` | TaskNotes-style one-note-per-task |

**Gap confirmed:** no task, recurrence, kanban, or heatmap code exists anywhere in
`src/` or `crates/` (grep for `task`, `rrule`, `recurrenc`, `kanban` returns only
unrelated hits: Google Calendar, daemon ops, plugin author guide).

---

## 1. obsidian-tasks

**Purpose.** Inline-checkbox task management: tasks live as `- [ ] ...` list items
anywhere in the vault, are indexed globally, and are rendered through embedded
```tasks
```
query blocks.

**Standout architecture.**
- **Serializer abstraction.** `TaskSerializer` interface with two implementations —
  `DefaultTaskSerializer` (emoji signifiers: `📅 due`, `⏳ scheduled`, `🛫 start`,
  `➕ created`, `✅ done`, `❌ cancelled`, `🔁 recurrence`, `🆔 id`, `⛔ dependsOn`,
  `🏁 onCompletion`, `⏫🔼🔽🔺⏬` priority) and `DataviewTaskSerializer`
  (`[due:: 2026-08-10]` inline fields). Round-trip: `deserialize(line) → TaskDetails`,
  `serialize(task) → line`. Field order is driven by `TaskLayoutOptions`, so
  rendering and writing share one component list.
- **Recurrence on top of `rrule`.** `Recurrence` wraps an `RRule` plus a
  `baseOnToday` flag and an `Occurrence` (the due/scheduled/start triple).
  `next(today)` produces the *next* occurrence by shifting the whole date triple
  by the same delta, so `🔁 every week when done` and `🔁 every week` differ only in
  the reference date. Recurrence text is stored verbatim and re-parsed, which keeps
  the markdown human-editable.
- **Chrono-node date parsing.** `DateParser.parseDate(input, forwardDate)` plus
  `parseDateRange` for `due this week` / `due next month`; everything normalises to
  start-of-day moments so equality comparisons work.
- **Status registry.** `StatusRegistry` maps a checkbox character to a
  `StatusConfiguration { symbol, name, nextStatusSymbol, availableAsCommand, type }`
  where `type ∈ TODO | IN_PROGRESS | DONE | CANCELLED | NON_TASK`. Enables
  `[ ] → [/] → [x]` cycles and custom `[?]`, `[-]` symbols without code changes.
- **Query language.** `Query` parses a block line-by-line; each line is matched
  against an ordered list of `Field` objects (`FilterParser`), each of which owns its
  own regex, filter, sorter and grouper. Unrecognised lines become errors with the
  offending text. Supports `filter by function <js>` (`FunctionField`), boolean
  combinators (`AND`/`OR`/`NOT`/`XOR` with parentheses), `sort by`, `group by`,
  `limit`, `hide`/`show`, and `explain`.

**Extraction candidates.**

| Upstream module | Scriptor target | Interface sketch |
|---|---|---|
| `TaskSerializer` + Default/Dataview | `packages/core/src/tasks/serializer.ts` | `interface TaskSerializer { deserialize(line: string): TaskDetails \| null; serialize(t: TaskFields): string }` with `emojiSerializer` and `inlineFieldSerializer` exports |
| `TaskRegularExpressions` | `packages/core/src/tasks/regex.ts` | frozen `RegExp` set: `listItem`, `checkbox`, `indentation`, `blockLink` |
| `Recurrence` | `packages/core/src/tasks/recurrence.ts` | `parseRecurrence(text): Recurrence \| null`; `nextOccurrence(r, ref: Occurrence, today: Date): Occurrence \| null` |
| `StatusRegistry` | `packages/core/src/tasks/statuses.ts` | `type StatusType = 'todo'\|'in_progress'\|'done'\|'cancelled'\|'non_task'`; `nextSymbol(sym): string` |
| `DateParser` | `packages/core/src/tasks/dateParser.ts` | `parseDate(input, {forward}): string \| null` (ISO), `parseDateRange(input): [string,string] \| null` |
| `Query`/`Field`/`FilterParser` | `crates/indexer/src/tql.rs` (Rust, primary) + `packages/core/src/tasks/tql.ts` (parser-only mirror for editor completions) | `pub fn execute_tql(cache, session, query: &str) -> Result<Vec<TaskRow>, IndexerError>` |

**Do not port:** `filter by function` (arbitrary JS eval) — it is the single largest
security hole in the design and conflicts with Scriptor's WASM-sandboxed plugin
model (`crates/wasm-runtime`). If scripted filters are wanted later, expose them as
a WASM plugin capability, not an `eval`.

---

## 2. tasknotes

**Purpose.** One Markdown note per task; all task data lives in YAML frontmatter.
Views (list, agenda, kanban, calendar, pomodoro, time-tracking) are projections over
frontmatter, and recent versions delegate view definition to Obsidian Bases.

**Standout architecture.**
- **Note-as-task.** Frontmatter fields: `title`, `status`, `priority`, `due`,
  `scheduled`, `contexts`, `projects`, `tags`, `timeEstimate`, `timeEntries[]`,
  `recurrence` (an RFC-5545 `RRULE` string), `complete_instances[]` (ISO dates of
  completed recurrence occurrences), `archived`.
- **Recurrence as RRULE + completion set.** Instead of rewriting the task on each
  completion (obsidian-tasks' model), the task keeps one immutable RRULE and appends
  the completed date to `complete_instances`. This makes historical completion
  auditable and makes "did I do it on the 14th?" answerable — strictly better for
  habits and for heatmaps.
- **Time tracking.** `timeEntries: [{startTime, endTime, description}]` accumulated in
  frontmatter, plus a Pomodoro service writing sessions to the same array.
- **Instant conversion.** Command to convert an inline `- [ ]` checkbox into a task
  note, leaving a wikilink behind — the migration bridge between models 1 and 2.
- **ICS/webcal subscriptions** rendered alongside tasks in calendar views.

**Extraction candidates.**

| Upstream concept | Scriptor target | Interface sketch |
|---|---|---|
| Task frontmatter schema | `packages/core/src/contracts/task.ts` | `interface TaskNote { path: string; title: string; status: string; priority?: 1\|2\|3\|4\|5; due?: string; scheduled?: string; start?: string; done?: string; contexts: string[]; projects: string[]; tags: string[]; recurrence?: string; completeInstances: string[]; timeEntries: TimeEntry[]; archived: boolean }` |
| `complete_instances` recurrence completion | `packages/core/src/tasks/recurrence.ts` | `completeOccurrence(t: TaskNote, iso: string): TaskNote` (pure, returns new object per Scriptor immutability rule) |
| Time tracking | `src/hooks/useTaskTimer.ts` + `crates/vault/src/frontmatter_ops.rs` | `startTimer(path)`, `stopTimer(path, description?)`; writes via existing frontmatter ops so no new IO path |
| Checkbox → task-note conversion | `src/lib/knowledge/taskConvert.ts` | `convertCheckboxToNote(line, opts): { noteMarkdown: string; replacementLine: string }` |
| Bases-style declarative views | reuse `ViewFilter` in `crates/vault/src/views.rs` | extend the existing JSON filter enum with task fields rather than inventing a second view format |

---

## 3. obsidian-day-planner

**Purpose.** Turns a daily note's timestamped list into an interactive timeline;
drag to reschedule, and the markdown is rewritten in place.

**Standout architecture.**
- **Timestamp-prefixed list parsing.** `- 09:00 - 10:30 Deep work` (and `HH:mm` /
  `h:mm am` variants, plus a duration form). The parser produces
  `{ startTime, endTime, durationMinutes, text, position: {line, startCol, endCol} }`
  — the byte/column range is the key design decision, because writes are *surgical
  edits at known offsets*, not whole-file re-serialisation.
- **Redux + RxJS-ish derived state.** A normalised store of tasks-by-date with
  memoised selectors feeds a Svelte timeline. Drag interactions dispatch optimistic
  state updates, and a debounced writer flushes markdown.
- **Multi-day + weekly view** built from the same per-day selectors.
- **Clock-time overlay** ("now" line) and conflict/overlap layout (columns for
  overlapping blocks) — a genuinely non-trivial interval-packing algorithm.
- **Obsidian-Sync-safe writes:** re-reads and re-parses before applying an edit so a
  remote change does not get clobbered.

**Extraction candidates.**

| Upstream module | Scriptor target | Interface sketch |
|---|---|---|
| Timestamp parser | `packages/core/src/tasks/timeblock.ts` | `parseTimeBlocks(md: string): TimeBlock[]` where `TimeBlock = { start: string; end?: string; durationMin?: number; text: string; line: number; range: [number, number] }` |
| Surgical edit writer | `crates/vault/src/timeblock_edit.rs` (next to `patch_log.rs`) | `pub fn reschedule_block(path, line: usize, start: &str, end: Option<&str>) -> Result<PatchRecord, VaultError>` — reuses existing patch-log + conflict machinery |
| Overlap layout | `src/lib/planner/layoutIntervals.ts` | `layoutIntervals(blocks: TimeBlock[]): Array<TimeBlock & { column: number; columns: number }>` |
| Timeline component | `src/components/planner/PlannerTimeline.tsx` | props `{ date: string; blocks: LaidOutBlock[]; onReschedule(line, start, end): void; nowMinutes: number }` |
| Calendar overlay | extend `src/hooks/useGoogleCalendarSync.ts` | merge external events into `TimeBlock[]` as read-only blocks |

**Adaptation note.** Scriptor already has `crates/vault/src/patch_log.rs`,
`conflictMerge.ts` and `ExternalChangeBanner.tsx`; the "re-read before write" pattern
is therefore free — do not port day-planner's bespoke sync guard.

---

## 4. quickadd

**Purpose.** Four composable "choices" — Template, Capture, Macro, Multi — bound to
commands, the palette, and hotkeys. The most-copied capture architecture in the
ecosystem.

**Standout architecture.**
- **Choice tree.** `Multi` choices nest other choices, producing a hierarchical
  command menu from plain data. Every choice is a serialisable object; the UI is a
  pure function of it.
- **Format engine.** `{{DATE}}`, `{{DATE+3}}`, `{{DATE:YYYY-MM-DD}}`, `{{VALUE}}`,
  `{{VALUE:name}}` (named variables prompted once, reused), `{{NAME}}`, `{{TITLE}}`,
  `{{VDATE:name,format}}` (date-picker prompt), `{{FIELD:key}}` (pull an existing
  inline-field value from the vault), `{{MACRO:name}}`, `{{TEMPLATE:path}}`,
  `{{SELECTED}}`, `{{CLIPBOARD}}`, `{{MATH:expr}}`, `{{RANDOM:n}}`. Resolution is a
  **two-pass async formatter**: pass one collects prompts, pass two substitutes.
- **Capture targeting.** Append/prepend, "insert after `## heading`", capture to the
  active file, capture to a dated file with auto-create-from-template, "insert at
  cursor", plus `Capture format` toggles. This is the piece Scriptor's
  `useQuickCapture` lacks entirely.
- **Macro engine.** Ordered steps: user scripts, other choices, Obsidian commands,
  waits. Scripts receive an `QuickAdd` API object (`quickAddApi.inputPrompt`,
  `suggester`, `yesNoPrompt`, `executeChoice`, `utility.getClipboard`).
- **AI assistant steps** (optional) as just another macro step type.

**Extraction candidates.**

| Upstream module | Scriptor target | Interface sketch |
|---|---|---|
| Format engine | `packages/core/src/capture/formatter.ts` (supersedes `src/lib/knowledge/templateExpansion.ts`) | `interface FormatContext { title?: string; selected?: string; clipboard?: string; prompt(label: string, kind: 'text'\|'date'\|'suggest', opts?): Promise<string>; readField(key: string): Promise<string \| null> }`; `formatTemplate(raw: string, ctx: FormatContext): Promise<{ markdown: string; cursorOffset: number }>` |
| Capture target resolution | `packages/core/src/capture/target.ts` | `type CaptureTarget = { kind: 'append' \| 'prepend' \| 'afterHeading' \| 'cursor'; path: string \| { dated: string }; heading?: string; createIfMissing?: { template: string } }`; `applyCapture(existing: string, entry: string, target: CaptureTarget): string` |
| Choice model + Multi nesting | `packages/core/src/capture/choices.ts` | `type Choice = TemplateChoice \| CaptureChoice \| MacroChoice \| MultiChoice` (discriminated union, zod-validated via existing `src/lib/runtimeSchema.ts`) |
| Choice → command registration | `src/lib/appCommandRegistry.ts` + `src/lib/buildPaletteCommands.ts` | register each choice as a palette command; reuse `commandShortcutRegistry.ts` for hotkeys — no new plumbing needed |
| Macro steps | `packages/plugin-api` step contract, executed in `crates/wasm-runtime` | `type MacroStep = { kind: 'choice'; id: string } \| { kind: 'command'; id: string } \| { kind: 'wait'; ms: number } \| { kind: 'plugin'; pluginId: string; entry: string }` |

**Do not port:** raw user JS scripts with vault access. Route macro scripting through
the existing WASM plugin runtime (`crates/wasm-runtime`, `src/lib/runPluginCommand.ts`).

---

## 5. obsidian-kanban

**Purpose.** Kanban boards that *are* markdown files — a board is a note with
`kanban-plugin: board` frontmatter, `## Lane Name` headings, and `- [ ] Card` items.

**Standout architecture.**
- **Markdown-as-database.** Persistence format:

  ```markdown
  ---
  kanban-plugin: board
  ---

  ## Todo

  - [ ] Card text #tag @{2026-08-12}
    - subtask / nested content preserved verbatim

  ## Done

  **Complete**
  - [x] Finished card

  %% kanban:settings
  ```{"kanban-plugin":"board","lane-width":272,"show-checkboxes":true}```
  %%
  ```

  Every board setting lives in a trailing HTML-comment JSON blob, so the file stays a
  valid, diffable, human-editable note. This is the single most valuable idea in the
  cluster for Scriptor: **git-friendly board persistence with zero sidecar files.**
- **Parser pipeline.** `remark`/`mdast` → typed board AST (`Board → Lane[] → Item[]`),
  each node carrying its source position. Edits are applied to the AST and the file is
  re-stringified, with an "unhandled content" escape hatch that round-trips anything
  the parser does not understand.
- **Archive lane** appended under `***` / `## Archive` so completed cards leave the
  board without leaving the file.
- **Date/time in card text** via configurable trigger (`@{date}`, `@@{time}`) and a
  date-picker, plus "link dates to daily notes".
- **DnD** on a custom drag layer (lane reorder, cross-lane, card reorder) with
  virtualised lanes for large boards.

**Extraction candidates.**

| Upstream module | Scriptor target | Interface sketch |
|---|---|---|
| Board markdown parser/stringifier | `packages/core/src/kanban/boardFormat.ts` | `parseBoard(md: string): Board`; `stringifyBoard(b: Board): string`; `interface Board { settings: BoardSettings; lanes: Lane[]; archive: Item[]; unhandled: string[] }`, `interface Lane { title: string; complete: boolean; items: Item[] }`, `interface Item { text: string; checked: boolean; tags: string[]; dates: string[]; children: string[]; line: number }` |
| Settings-in-comment codec | same module | `readSettingsBlock(md): BoardSettings \| null`; `writeSettingsBlock(md, s): string` |
| Rust mirror for indexing | `crates/indexer/src/kanban.rs` | `pub fn index_board(md: &str) -> Option<BoardSummary>` so boards feed the `tasks` table and DQL |
| Board UI | `src/components/kanban/KanbanBoard.tsx`, reusing `useCanvasBoard.ts`'s history/debounced-persist pattern | `useKanbanBoard(path)` → `{ board, moveCard(from, to), addCard(lane, text), undo, redo, status }` |

**Risk.** Upstream is seeking maintainers; treat it as a format spec to reimplement,
not a dependency. The format itself is stable and widely adopted — implementing a
compatible reader/writer buys instant interop with existing Obsidian vaults, which
matters because Scriptor already ships `ObsidianImportDialog.tsx`.

---

## 6. Thino (obsidian-memos)

**Purpose.** Twitter-like micro-journaling inside a vault. Every thought is a
timestamped bullet appended to the daily note; a chronological feed view reads them
back.

**Standout architecture.**
- **Zero new storage.** Memos are `- HH:mm Text` lines under a configured heading in
  the daily note (or a single "multi-file" folder). The feed is a *view* over parsed
  daily notes — nothing to migrate, nothing to corrupt.
- **Type tagging by list state.** `- [ ]` = task memo, `- ` = journal memo,
  `- [x]` = done — the checkbox character doubles as a type discriminator, the same
  trick obsidian-tasks formalises in `StatusRegistry`.
- **Query + heatmap.** Tag/date filtering plus a contribution heatmap over memo
  counts, so capture volume is visible.
- **Daily review / "On this day"** resurfacing past memos.
- **Comment/reply threads** via nested list items, giving conversation structure
  without a database.

**Extraction candidates.**

| Upstream concept | Scriptor target | Interface sketch |
|---|---|---|
| Memo line format + parser | `packages/core/src/capture/memo.ts` | `parseMemos(md: string, heading: string): Memo[]` where `Memo = { time: string; text: string; kind: 'journal'\|'task'\|'done'; tags: string[]; line: number; children: string[] }` |
| Chronological feed | `src/components/inbox/CaptureStream.tsx` (sibling of existing `InboxPanel.tsx`) | props `{ memos: Memo[]; groupBy: 'day'\|'week'; onFilterTag(tag): void }` |
| "On this day" resurfacing | `src/lib/knowledge/resurface.ts` | `onThisDay(memos: Memo[], today: string): Memo[]` |
| Capture → daily note under heading | upgrade `src/hooks/useQuickCapture.ts` | add `target: CaptureTarget` (from QuickAdd extraction) so capture can hit `daily/{{date}}.md` under `## Journal` instead of only `inbox/inbox.md` |

---

## 7. heatmap-calendar

**Purpose.** A GitHub-style year heatmap rendered from a JS data array, driven by
Dataview queries in a codeblock.

**Standout architecture.**
- **Pure render contract.** The plugin exposes exactly one API:
  `renderHeatmapCalendar(el, { year, colors, entries: [{date, intensity, content, color}], showCurrentDayBorder, defaultEntryIntensity, intensityScaleStart, intensityScaleEnd })`.
  All data acquisition is the caller's problem. That separation is why it composes with
  everything — habit trackers, word counts, task completions.
- **Intensity bucketing.** Continuous `intensity` values are mapped onto N colour
  stops between `intensityScaleStart/End`, with automatic min/max detection when the
  bounds are omitted.
- **`content`** per cell allows arbitrary HTML (emoji, links) rather than only colour.

**Extraction candidates.**

| Upstream concept | Scriptor target | Interface sketch |
|---|---|---|
| Render contract | `src/components/planner/HeatmapCalendar.tsx` (SVG, no DOM mutation) | `interface HeatmapEntry { date: string; intensity?: number; content?: string; color?: string }`; props `{ year: number; entries: HeatmapEntry[]; palette: string[]; scale?: [number, number]; onSelectDay?(iso: string): void }` |
| Intensity bucketing | `src/lib/planner/heatmapScale.ts` | `bucketIntensities(values: number[], buckets: number, scale?: [number, number]): number[]` |
| Data source | `crates/indexer/src/tasks.rs` aggregate query | `pub fn completions_per_day(cache, vault_id, year: i32) -> Result<Vec<(String, i64)>, IndexerError>` — feeds from `complete_instances` + `done` dates |

**Note.** Implement as an SVG React component with `role="img"` and a per-cell
accessible label; the upstream imperative-DOM approach is not portable and the repo is
lightly maintained (several forks; original is `Richardsl/heatmap-calendar-obsidian`).

---

## Peer-feature comparison

### Storage model

| Repo | Task storage | Diff quality | Query cost | Verdict |
|---|---|---|---|---|
| obsidian-tasks | inline `- [ ]` line, metadata as emoji/inline-field suffix | excellent (one line per task) | needs a global index | best for ubiquitous capture |
| tasknotes | one note per task, YAML frontmatter | excellent, but 1 file per task | cheap (frontmatter index) | best for rich, long-lived tasks |
| day-planner | inline timestamped list in daily note | excellent | per-day only | best for scheduling |
| kanban | headings + list items + JSON settings comment | excellent | per-board | best for board state |
| Thino | inline bullet in daily note | excellent | per-day | best for capture |

**Recommendation — dual model, single index.** Support both inline tasks and task
notes, and index both into one `tasks` table. `TaskRow.source` discriminates
`inline { path, line, range }` from `note { path }`. Views, queries, boards and
heatmaps read the index, never the files. This is the only choice that lets a Kanban
card, a planner time block, and a query row be the *same* task.

### Task query language

| Approach | Syntax | Pros | Cons |
|---|---|---|---|
| obsidian-tasks `tasks` block | one directive per line: `not done`, `due before next week`, `priority is above medium`, `sort by due`, `group by filename`, `(A) AND (B OR C)` | readable; errors point at the offending line; `explain` mode | line-oriented; `filter by function` JS escape hatch |
| Dataview DQL | `TASK FROM #x WHERE due < date(today) SORT due` | SQL-ish, familiar | an entire second engine and type system |
| Scriptor DQL (existing `dql.rs`) | `path has #tag and body contains "x"` | already implemented, Rust, index-backed | note-scoped; no dates/priority/sort/group; no parentheses |

**Best of all worlds — TQL, an extension of `crates/indexer/src/dql.rs`:**
1. Keep the line-oriented directive grammar from obsidian-tasks — best diagnostics of
   the three, and each line maps cleanly to one SQL `WHERE` fragment.
2. Keep Scriptor's existing clause vocabulary (`path has #tag`, `title contains`,
   `body contains`, `path matches`, `links to [[x]]`) so note and task queries share
   one parser and one error type (`IndexerError::InvalidQuery`).
3. Add task clauses: `done` / `not done`, `status is <symbol|type>`,
   `due|scheduled|start|created|done <before|after|on|in> <date-expr>`,
   `priority is [above|below] <lowest..highest>`, `has due date`, `no due date`,
   `recurring`, `heading includes <s>`, `tag includes #t`.
4. Add `sort by <field> [reverse]`, `group by <field>`, `limit N`, `explain`.
5. Add parentheses plus `AND`/`OR`/`NOT`/`XOR` as a filter-*combining* layer over
   directive lines — not a general expression language.
6. Compile to parameterised SQL; only regex clauses fall back to a bounded scan,
   reusing the existing `PATH_MATCH_SCAN_LIMIT = 5_000` guard.
7. **Reject `filter by function`.** Scripted predicates go through
   `crates/wasm-runtime` as a capability-gated plugin export instead.

### Recurrence rules

| Approach | Representation | Completion semantics | Auditability |
|---|---|---|---|
| obsidian-tasks | human text (`every week when done`) parsed to an `rrule` `RRule`; text stored verbatim in the line | on complete, writes a *new* task line for the next occurrence and marks the old one done | full history as done lines, but the line count grows |
| tasknotes | RFC-5545 `RRULE` string in frontmatter | appends the ISO date to `complete_instances[]`; the task itself is immutable | perfect — one record, full completion set |
| Thino / day-planner | none (manual re-entry) | n/a | n/a |

**Best of all worlds — hybrid:**
- **Canonical form is `RRULE`** (RFC 5545) so external tooling and ICS export work.
- **Authoring form is human text** (`every 2 weeks on Monday when done`) parsed with a
  small hand-written recogniser over `rrule`'s `RRule.fromText`, and the original text
  is preserved alongside the RRULE so round-trips never mangle user intent.
- **`when done` becomes a flag** (`baseOnToday` in obsidian-tasks terms), stored as an
  `X-SCRIPTOR-BASE=DONE` RRULE extension or a sibling field — not encoded into the
  RRULE itself.
- **Completion uses tasknotes' `complete_instances` set** for task notes (auditable,
  heatmap-ready) and obsidian-tasks' next-line-generation for inline tasks (because an
  inline list item has nowhere to store a set). One `Recurrence` module serves both:

```ts
// packages/core/src/tasks/recurrence.ts
export interface Recurrence {
  text: string          // authored form, preserved verbatim
  rrule: string         // canonical RFC-5545 RRULE
  baseOnDone: boolean   // "when done"
}
export function parseRecurrence(text: string): Recurrence | null
export function nextOccurrence(
  r: Recurrence,
  dates: OccurrenceDates,   // { due?, scheduled?, start? }
  today: string,
): OccurrenceDates | null    // shifts the whole triple by one delta
export function completeOccurrence(t: TaskNote, iso: string): TaskNote
```

### Date parsing

| Approach | Engine | Handles | Cost |
|---|---|---|---|
| obsidian-tasks | `chrono-node` + `moment`, normalised to start-of-day; `DateRange` for `this week` / `next month` | `tomorrow`, `in 3 days`, `next friday`, `2026-08-10`, ranges | ~40 KB gz for chrono; `moment` is legacy |
| tasknotes | plain ISO in frontmatter, `date-fns` for arithmetic | ISO only | tiny |
| day-planner | bespoke `HH:mm` / `h:mm a` regex + duration | times only | trivial |
| kanban | date-picker writes a configured format | one format | trivial |

**Best of all worlds:**
- **Storage is always ISO 8601** (`YYYY-MM-DD`, and `YYYY-MM-DDTHH:mm` for time blocks)
  — matches Scriptor's existing convention in `dailyNote.ts`, `inbox.ts` and
  `NoteIndexSummary.modified_at`, and keeps SQLite string comparison valid as date
  comparison (already relied on by `filterInboxEntries`).
- **Input accepts natural language** via `chrono-node` at the *edge only* (quick-add
  bar, date-field editors), producing ISO immediately. Never store natural language.
- **No `moment`.** Use `date-fns` (tree-shakeable) or `Temporal` where available;
  arithmetic in Rust uses `chrono`/`time` already present via the workspace.
- **Ranges** (`due in this week`) resolve to a `[startIso, endIso]` pair inside the TQL
  compiler, so the SQL stays `due >= ?1 AND due <= ?2`.
- **Times** reuse day-planner's regex tier — a separate, cheap `parseTimeOfDay`; do not
  route `09:00` through chrono.

```ts
// packages/core/src/tasks/dateParser.ts
export function parseDate(input: string, opts?: { forward?: boolean }): string | null
export function parseDateRange(input: string): [string, string] | null
export function parseTimeOfDay(input: string): { minutes: number } | null
```

### Board persistence

| Approach | Where board state lives | Git diff | Interop |
|---|---|---|---|
| obsidian-kanban | the note itself: frontmatter marker + `## Lane` headings + list items + `%% kanban:settings %%` JSON comment | clean, line-per-card | reads as a normal note in any editor |
| tasknotes kanban view | derived from `status` frontmatter across task notes; column order in plugin settings | clean, but board layout is not in the vault | portable data, non-portable layout |
| Scriptor canvas (`useCanvasBoard.ts`) | `CanvasDocument` JSON via `canvasSaveDocument` | JSON blob — noisy diffs | Scriptor-only |

**Best of all worlds — markdown board with a derived-column escape hatch:**
1. **Adopt the obsidian-kanban file format verbatim** as Scriptor's board format. It
   gives clean git diffs, human editability, and free interop with vaults imported via
   `ObsidianImportDialog.tsx`. Board *settings* go in the trailing
   `%% scriptor:board %%` JSON comment (same mechanism, own key, and keep reading
   `%% kanban:settings %%` for compatibility).
2. **Card position is document order**; lane is the heading. No IDs required, so a
   hand-edited board is still a valid board.
3. **Preserve unknown content.** Port the "unhandled content" list from the upstream
   parser — anything the parser does not recognise round-trips byte-for-byte. This is
   the single most important robustness property and the reason a naive
   parse/re-stringify implementation will corrupt user files.
4. **Add a `query:` lane kind** for derived columns (tasknotes' strength): a lane whose
   items come from a TQL query instead of literal list items. Rendered read-only for
   drag purposes unless the target field is writable (dragging into
   `query: status is in_progress` performs a status write).
5. **Reuse the canvas board plumbing, not its format** — `useCanvasBoard.ts` already
   solves undo/redo stacks, debounced persistence, and CRDT sync; `useKanbanBoard`
   should mirror that hook's shape with `parseBoard`/`stringifyBoard` swapped in for
   JSON serialisation.

### Cross-cutting feature matrix

| Feature | tasks | tasknotes | day-planner | quickadd | kanban | Thino | heatmap | Scriptor today |
|---|---|---|---|---|---|---|---|---|
| Inline checkbox tasks | ✅ | convert-only | ✅ | — | ✅ | ✅ | — | ❌ |
| Task-as-note | — | ✅ | — | ✅ (creates) | — | — | — | ❌ |
| Query language | ✅ | via Bases | — | — | — | filters | Dataview | DQL (notes only) |
| Recurrence | ✅ text→rrule | ✅ RRULE | — | — | — | — | — | ❌ |
| NL date parsing | ✅ chrono | — | times only | `{{DATE+n}}` | picker | — | — | tokens only |
| Time blocking | — | estimates | ✅ | — | — | — | — | ❌ |
| Time tracking | — | ✅ | — | — | — | — | — | ❌ |
| Board view | — | ✅ derived | — | — | ✅ markdown | — | — | canvas (JSON) |
| Capture engine | — | — | — | ✅ | — | ✅ | — | append-only |
| Template prompts | — | — | — | ✅ | — | — | — | ❌ |
| Status registry | ✅ | frontmatter | — | — | complete-lane | checkbox | — | ❌ |
| Dependencies (`id`/`dependsOn`) | ✅ | projects | — | — | — | — | — | ❌ |
| Heatmap | — | — | — | — | — | ✅ | ✅ | ❌ |
| Calendar/ICS | — | ✅ | ✅ | — | — | — | — | Google only |

---

## Prioritized backlog

Effort is engineer-days for one engineer including tests (Scriptor requires 80%
coverage) and docs. "Blocks" names the items that cannot start until this lands.

### P0 — foundations (nothing else works without these)

| # | Item | Files | Effort | Blocks |
|---|---|---|---|---|
| P0-1 | **Task contracts + inline serializer.** `TaskFields`, `TaskSource`, both serializers (emoji + inline-field), `TaskRegularExpressions`, round-trip property tests | `packages/core/src/tasks/{contracts,serializer,regex}.ts` | 4 | everything |
| P0-2 | **Status registry.** symbol → `{name, nextSymbol, type}`, defaults for `[ ] [/] [x] [-] [?]`, settings-driven customs | `packages/core/src/tasks/statuses.ts`, `src/lib/settingsDefaults.ts` | 2 | P0-4, P1-2 |
| P0-3 | **Date layer.** `parseDate`, `parseDateRange`, `parseTimeOfDay`; ISO-only storage; drop `moment`, use `date-fns` | `packages/core/src/tasks/dateParser.ts` | 2 | P0-5, P1-1 |
| P0-4 | **`tasks` table + indexing.** schema v4→v5 migration; parse tasks during note indexing; incremental update on save | `crates/indexer/src/{schema,migration,tasks,parse}.rs` | 5 | P0-5, P1-3, P1-4, P2-2 |
| P0-5 | **TQL engine.** extend `dql.rs`: directive lines, task clauses, `sort by`/`group by`/`limit`, parentheses + AND/OR/NOT/XOR, `explain`, parameterised SQL | `crates/indexer/src/tql.rs`, `crates/ipc` command | 8 | P1-1, P1-3, P2-1 |
| P0-6 | **Task list panel.** run a TQL query, render grouped results, toggle status in place (surgical line edit through `patch_log`) | `src/components/tasks/TaskListPanel.tsx`, `src/hooks/useTaskQuery.ts`, `crates/vault/src/task_edit.rs` | 5 | P1-2, P1-5 |

**P0 total: ~26 days.** Deliverable: inline tasks are indexed, queryable, and
completable from a panel.

### P1 — the differentiating features

| # | Item | Files | Effort | Depends on |
|---|---|---|---|---|
| P1-1 | **Recurrence.** hybrid text↔RRULE module, `nextOccurrence` triple-shift, `completeOccurrence` set append, next-line generation for inline tasks | `packages/core/src/tasks/recurrence.ts`, `crates/vault/src/task_edit.rs` | 5 | P0-1, P0-3, P0-5 |
| P1-2 | **Capture engine (QuickAdd port).** two-pass async formatter, `CaptureTarget` resolution, choice model, palette/hotkey registration; supersede `templateExpansion.ts` and upgrade `useQuickCapture` | `packages/core/src/capture/*`, `src/hooks/useQuickCapture.ts`, `src/lib/appCommandRegistry.ts` | 8 | P0-2 |
| P1-3 | **Kanban board.** format parser/stringifier with unhandled-content round-trip, `useKanbanBoard` (undo/redo + debounced persist modelled on `useCanvasBoard`), DnD, archive lane, Obsidian compat read | `packages/core/src/kanban/boardFormat.ts`, `src/components/kanban/*`, `crates/indexer/src/kanban.rs` | 10 | P0-1, P0-4 |
| P1-4 | **Task notes.** `TaskNote` frontmatter schema, checkbox→note conversion, index note-tasks into the same table | `packages/core/src/contracts/task.ts`, `src/lib/knowledge/taskConvert.ts`, `crates/indexer/src/tasks.rs` | 5 | P0-4 |
| P1-5 | **Day planner timeline.** `parseTimeBlocks` with source ranges, `layoutIntervals` overlap packing, drag-to-reschedule via surgical edit, "now" line, Google Calendar overlay | `packages/core/src/tasks/timeblock.ts`, `src/lib/planner/layoutIntervals.ts`, `src/components/planner/PlannerTimeline.tsx`, `crates/vault/src/timeblock_edit.rs` | 9 | P0-3, P0-6 |

**P1 total: ~37 days.**

### P2 — depth and polish

| # | Item | Files | Effort | Notes |
|---|---|---|---|---|
| P2-1 | **Saved task views.** extend `ViewFilter` with task fields; persist TQL queries as saved views | `crates/vault/src/views.rs`, `src/components/SavedViewsPanel.tsx`, `SmartCollectionsPanel.tsx` | 3 | reuses existing UI |
| P2-2 | **Heatmap calendar.** SVG component, `bucketIntensities`, `completions_per_day` aggregate, accessible per-cell labels | `src/components/planner/HeatmapCalendar.tsx`, `src/lib/planner/heatmapScale.ts`, `crates/indexer/src/tasks.rs` | 3 | best value/effort in P2 |
| P2-3 | **Capture stream (Thino).** memo parser, chronological feed beside `InboxPanel`, "on this day" resurfacing, nested reply threads | `packages/core/src/capture/memo.ts`, `src/components/inbox/CaptureStream.tsx`, `src/lib/knowledge/resurface.ts` | 4 | needs P1-2 `CaptureTarget` |
| P2-4 | **Time tracking.** `timeEntries` frontmatter writes, start/stop timer, Pomodoro, per-project roll-up | `src/hooks/useTaskTimer.ts`, `crates/vault/src/frontmatter_ops.rs` | 4 | task notes only |
| P2-5 | **Dependencies.** `id` / `dependsOn`, blocked/blocking filters, cycle detection, "unblocked next actions" | `packages/core/src/tasks/deps.ts`, `crates/indexer/src/tql.rs` | 4 | reuse `graph.rs` traversal |
| P2-6 | **Macro steps via WASM.** `MacroStep` contract, plugin-provided TQL predicates and capture steps, capability gating | `packages/plugin-api`, `crates/wasm-runtime` | 6 | replaces upstream JS `eval` |
| P2-7 | **ICS/webcal subscriptions.** read-only external events merged into planner views | extend `src/hooks/useGoogleCalendarSync.ts` | 3 | — |
| P2-8 | **TQL editor affordances.** Monaco completions + inline diagnostics using the TS parser mirror | `src/lib/monaco-completions.ts`, `packages/core/src/tasks/tql.ts` | 4 | needs P0-5 grammar |

**P2 total: ~31 days. Grand total ≈ 94 engineer-days.**

---

## Decisions worth recording

1. **One index, two storage models.** Inline tasks and task notes both land in
   `tasks`; `source` discriminates. Never build a second query path.
2. **TQL extends `dql.rs`.** No second query engine, no Dataview clone, no `eval`.
3. **ISO 8601 everywhere on disk**; natural-language dates are an input-edge concern.
4. **RRULE is canonical, authored text is preserved.** `when done` is a flag, not
   RRULE syntax.
5. **Kanban uses the obsidian-kanban file format**, including its unhandled-content
   round-trip guarantee, plus a Scriptor-only `query:` lane kind.
6. **All scripting goes through `crates/wasm-runtime`.** obsidian-tasks'
   `filter by function` and QuickAdd's user JS are the two features to deliberately
   not port as-is.
7. **Reuse existing plumbing:** `patch_log.rs` + `conflictMerge.ts` for safe writes,
   `useCanvasBoard.ts` for board history/persistence shape, `appCommandRegistry.ts` +
   `commandShortcutRegistry.ts` for capture-choice commands, `ViewFilter` for saved
   views. No new IO, command, or persistence mechanism is required by this cluster.

## Sources

Repos read at HEAD (Aug 2026): `obsidian-tasks-group/obsidian-tasks`
(`src/Task/{Task,Recurrence}.ts`, `src/DateTime/DateParser.ts`, `src/Query/{Query,FilterParser}.ts`,
`src/TaskSerializer/{Default,Dataview}TaskSerializer.ts`, `src/Statuses/StatusRegistry.ts`),
`callumalpass/tasknotes`, `ivan-lednev/obsidian-day-planner`, `chhoumann/quickadd`,
`mgmeyers/obsidian-kanban`, `Quorafind/Obsidian-Thino`,
`Richardsl/heatmap-calendar-obsidian`.
Scriptor grounding: `crates/indexer/src/{dql,schema,views}.rs`,
`crates/vault/src/`, `src/lib/knowledge/*`, `src/hooks/{useQuickCapture,useCanvasBoard,useGoogleCalendarSync}.ts`,
`src/types/vault.ts`.
