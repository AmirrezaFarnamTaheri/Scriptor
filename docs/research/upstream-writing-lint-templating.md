# Upstream research: writing / lint / templating cluster

Scope: `obsidian-linter`, `Templater`, `QuickAdd` (template side), `obsidian-vimrc-support`, `obsidian-latex-suite`.
Target: Scriptor (Tauri v2 + React 19 + Rust monorepo, `D:\GitHub\Scriptor`).

## Scriptor baseline (verified on disk)

| Area | Existing code | Gap |
|---|---|---|
| Template discovery | `src/lib/knowledge/templates.ts` (36 lines) — `discoverTemplatePaths`, `planDailyNotePreview` | flat name list only; no metadata, no folder/tag targeting |
| Template expansion | `src/lib/knowledge/templateExpansion.ts` (73 lines) — 6 fixed `{{var}}` tokens, single `{{cursor}}` | no functions, no prompts, no date arithmetic, no sandbox |
| Template UI | `src/components/TemplatePicker.tsx` — filter + arrow/Enter modal | no prompt/suggester chaining, no preview |
| Markdown lint | `packages/editor/src/remark-lint.ts` (226 lines, hand-rolled line scanner) + `markdown-lint.ts` (28 lines, CM6 `linter()` adapter) | rules hardcoded in one loop; no registry, no per-rule config, no fixes, no ignore-ranges |
| Vault lint | `packages/plugins/vault-lint/src/index.ts` — manifest + `summarizeLintIssues` | separate model from editor lint; no shared rule ids |
| Snippets | `snippet-parser.ts` (321), `snippets.ts` (190, tabstop StateField), `snippet-catalog.ts`, `snippet-catalogs.ts`, `snippet-autocomplete.ts` (`:name` trigger) | manual trigger only; no auto-expand, no regex triggers, no syntax-scoped (math/code) gating, no visual snippets |
| Vim | `packages/editor/src/vim-mode.ts` (58 lines) — `@replit/codemirror-vim`, 3 ex commands, `Compartment` toggle | no vimrc file, no `map`/`exmap`, no command bridge, no layering contract with app keymap |
| Sandbox primitives | `crates/wasm-runtime` (capabilities.rs, `wasmtime-backend` feature flag), `packages/plugin-api/src/sandbox.ts`, `wasm-host.ts` | not wired to templates |

---

## 1. obsidian-linter

**Purpose.** Deterministic markdown formatter/normalizer for a vault: lint-on-save, lint-on-file-change, lint whole folder/vault, plus paste-time rules.

**Standout architecture.** A first-class `Rule` object rather than a switch statement. Verified from `src/rules.ts`:

```ts
class Rule { constructor(nameKey, descriptionKey, settingsKey, alias, type: RuleType,
  applyAfterIgnore: ApplyFunction, examples: Example[], options: Option[] = [],
  hasSpecialExecutionOrder = false, ignoreTypes: IgnoreType[] = [],
  disableConflictingOptions?) }
enum RuleType { YAML, HEADING, FOOTNOTE, CONTENT, SPACING, PASTE }
```

Four ideas worth stealing verbatim:

1. **`applyAfterIgnore` + `ignoreTypes`.** The engine masks out regions (code fences, math, YAML, links, tags, inline code) *before* the rule body runs, then restores them. Rules become naive string transforms and can never corrupt a code block. This is exactly the bug class in Scriptor's current `inFence` boolean in `remark-lint.ts`.
2. **`examples` on the rule itself** — doubles as the docs generator *and* the test corpus (`README.md` is machine-generated from them).
3. **Per-rule `options` schema** (`BooleanOption`, dropdown, text) → settings UI and `.md` frontmatter overrides are derived, not written twice.
4. **Rule disabling from the note itself** — frontmatter `disabled rules: [all]` / a list of aliases, resolved by `getExactDisabledRuleValue`. Per-note escape hatch with no global state.

**Extraction candidates.**

| Module to port | Scriptor file path | Notes |
|---|---|---|
| `IgnoreType` + `ignoreListOfTypes` masking | `packages/editor/src/lint/ignore-ranges.ts` (new) | pure fn; reuse the existing lezer-markdown tree from `src/markdown/markdown-language.ts` instead of regex where possible |
| `Rule` / `RuleType` / `Option` | `packages/editor/src/lint/rule.ts` (new) | see interface below |
| Rule registry + ordering | `packages/editor/src/lint/registry.ts` (new) | replaces the monolithic loop in `remark-lint.ts` |
| Existing checks in `remark-lint.ts` | `packages/editor/src/lint/rules/*.ts` | one file per rule, keeps 800-line cap |
| Frontmatter rule disabling | `packages/editor/src/lint/rule-config.ts` (new) | reuse `frontmatter.ts::analyzeFrontmatter` |
| Paste rules (`RuleType.PASTE`) | wire into existing `packages/editor/src/paste-handler.ts` | linter's paste rules (double list marker, ellipsis, blockquote indentation) map 1:1 |

Interface sketch — `packages/editor/src/lint/rule.ts`:

```ts
export type RuleCategory = 'frontmatter' | 'heading' | 'footnote' | 'content' | 'spacing' | 'paste'
export type RuleSeverity = 'error' | 'warning' | 'info'
export type IgnoreType = 'code' | 'math' | 'frontmatter' | 'link' | 'wikilink' | 'tag' | 'html'

export interface RuleFix { from: number; to: number; insert: string }

export interface RuleDiagnostic {
  ruleId: string
  message: string
  severity: RuleSeverity
  from: number            // absolute doc offsets, not line/col — CM6-native
  to: number
  fix?: RuleFix           // undefined = report-only
}

export interface RuleContext {
  text: string
  offsetOf: (maskedIndex: number) => number   // supplied by ignore-ranges
  options: Readonly<Record<string, string | number | boolean>>
}

export interface LintRule {
  id: string                       // stable alias, e.g. 'no-trailing-spaces'
  category: RuleCategory
  defaultSeverity: RuleSeverity
  ignoreTypes: readonly IgnoreType[]
  options?: readonly RuleOptionSpec[]
  runsLast?: boolean               // linter's hasSpecialExecutionOrder
  /** Runs against masked text; offsets translated back by the engine. */
  check: (ctx: RuleContext) => RuleDiagnostic[]
}
```

`packages/editor/src/lint/registry.ts`:

```ts
export function registerRule(rule: LintRule): void
export function allRules(): readonly LintRule[]
export function runRules(text: string, config: RuleConfig): RuleDiagnostic[]
export function applyFixes(text: string, diagnostics: RuleDiagnostic[]): string   // format-on-save
```

`markdown-lint.ts` then shrinks to a `linter()` + `codemirror/lint` action adapter that maps `RuleFix` → CM6 quick-fix `actions`. `packages/plugins/vault-lint` reuses the same `LintRule[]` for whole-vault runs so editor and CLI ids never diverge — the Rust CLI (`crates/cli`) can call the same registry through the existing `vault.lint` command contract, or a Rust mirror of the pure rules if we want vault-scale throughput.

---

## 2. Templater

**Purpose.** A templating *language* for notes: `<% %>` interpolation and `<%* *%>` JavaScript execution, with modules for file, date, frontmatter, system prompts, web, and user-defined functions.

**Standout architecture.**

- **Two syntaxes, one parser.** `<% expr %>` = interpolate; `<%* stmts *%>` = execute for side effects (output suppressed). Whitespace control (`<%-`, `-%>`) prevents template scaffolding from leaving blank lines. This split is what makes non-trivial templates readable.
- **Namespaced module objects** rather than a flat variable bag: `tp.file.title`, `tp.file.creation_date()`, `tp.date.now("YYYY-MM-DD", -7)`, `tp.frontmatter.<key>`, `tp.system.prompt()`, `tp.system.suggester()`, `tp.user.<fn>`. Discoverable, versionable, and each namespace maps to a distinct capability.
- **Async-first evaluation.** Templates await user input mid-expansion (`tp.system.prompt`), so the whole pipeline is `async`. Scriptor's `expandTemplateVariables` is sync — this is the single biggest refactor implied by this cluster.
- **Dynamic vs. startup templates.** Templates can run on note creation, on folder creation (folder→template mapping), on startup, or be re-evaluated continuously in a preview.
- **Explicit, unresolved security posture.** The README says it plainly: *"Templater allows you to execute arbitrary JavaScript code and system commands. It can be dangerous… Only run code / commands that you understand, from trusted sources."* There is no sandbox — trust is delegated to the user. Scriptor must not copy this.

**Extraction candidates.**

| Module | Scriptor file path | Notes |
|---|---|---|
| Two-mode tag parser (`<% %>` / `<%* *%>`, whitespace trim) | `src/lib/knowledge/template/parse.ts` (new) | pure lexer → `TemplateNode[]`; no eval |
| Namespaced function registry (`tp.date`, `tp.file`, …) | `src/lib/knowledge/template/namespaces/*.ts` | each namespace declares required capabilities |
| `tp.date.now(format, offset)` | `src/lib/knowledge/template/namespaces/date.ts` | supersedes the 6 hardcoded tokens in `templateExpansion.ts` |
| `tp.system.prompt` / `suggester` | `src/components/TemplatePrompt.tsx` + `TemplateSuggester.tsx` | reuse `TemplatePicker`'s focus-trap/escape hooks and keyboard model |
| Folder→template mapping | extend `src/lib/knowledge/templates.ts` with `resolveTemplateForPath()` | reads config, not code |
| Frontmatter access | reuse `packages/editor/src/frontmatter.ts` | already parses YAML safely |

Interface sketch — `src/lib/knowledge/template/index.ts`:

```ts
export type TemplateNode =
  | { kind: 'text'; value: string }
  | { kind: 'interpolate'; expr: string; trimBefore: boolean; trimAfter: boolean }
  | { kind: 'exec'; body: string; trimBefore: boolean; trimAfter: boolean }
  | { kind: 'cursor'; index: number }        // {{cursor}} / $0-style tabstop

export function parseTemplate(raw: string): TemplateNode[]        // pure, sync, no eval

export interface TemplateCapabilities {
  readonly vaultRead: boolean
  readonly vaultWrite: boolean
  readonly prompt: boolean          // may show UI / block on user input
  readonly clock: boolean
  readonly network: false           // never granted in v1
  readonly shell: false             // never granted; Templater's tp.system.command is out of scope
}

export interface TemplateHost {
  namespaces: Record<string, Record<string, (...args: unknown[]) => unknown | Promise<unknown>>>
  capabilities: TemplateCapabilities
  timeoutMs: number                 // hard wall-clock budget, default 2000
}

export interface TemplateResult {
  markdown: string
  tabStops: Array<{ index: number; from: number; to: number }>
  diagnostics: Array<{ node: number; message: string }>
}

export function expandTemplate(nodes: TemplateNode[], host: TemplateHost): Promise<TemplateResult>
```

**Sandbox decision (this is the load-bearing recommendation).** Do not put `new Function`/`eval` on the main thread. Scriptor already owns the two pieces needed:

- `packages/plugin-api/src/sandbox.ts` + `wasm-host.ts` (TS side)
- `crates/wasm-runtime` with `capabilities.rs` and a `wasmtime-backend` feature flag (Rust side)

Three tiers, shipped in order:

1. **Tier 0 — expression-only, no eval.** Interpret `<% ... %>` as `namespace.fn(args)` against a whitelist parsed by our own mini-grammar (identifier path + string/number/bool literals). Covers ~90% of real templates (`tp.date.now("YYYY-MM-DD", -1)`, `tp.file.title`). Zero attack surface. This is the P0.
2. **Tier 1 — `<%* *%>` in a Worker.** A dedicated Web Worker with no `importScripts`, no `fetch` (deleted from `self` at boot), structured-clone-only message passing, a wall-clock `timeoutMs` enforced by the host that `terminate()`s the worker, and namespace calls proxied back over `postMessage` so every capability check happens on the host side. Templates from the vault are *untrusted input*, so capability grants are per-template and surfaced in the UI before first run.
3. **Tier 2 — WASM for third-party template packs.** Route through `crates/wasm-runtime`; fuel-metered, memory-capped, capabilities from `capabilities.rs`. Only needed if templates ship through the plugin marketplace (`packages/plugin-api/src/marketplace.ts`).

Explicitly rejected: Templater's `tp.system.command` equivalent (shell execution). If a user needs it, it belongs behind the plugin permission system, not the template engine.

---

## 3. QuickAdd (template side)

**Purpose.** Turns note creation into declarative, composable "choices". Verified from the README: *"QuickAdd is a powerful combination of four tools (called choices): templates, captures, macros, and multis."*

**Standout architecture.** The **choice** abstraction, and specifically that a choice is *data*, not code:

- **Template choice** — template file + destination folder(s) + filename format + post-create behaviour (open in new tab/split, append link).
- **Capture choice** — append/prepend text to an *existing* target note (daily note, a specific file, or the active file), with insert-after-a-line-matching-regex anchoring. This is the piece Scriptor is missing entirely: `src/lib/knowledge/inbox.ts` and `dailyNote.ts` exist but there is no generic "capture into an anchored position" primitive.
- **Macro choice** — chains other choices plus user scripts into one hotkey ("create the note, add a link to it in the index, and log it in today's daily note").
- **Multi choice** — a nested menu of choices; the UI is generated from the tree.
- **Format syntax** shared across all choices: `{{DATE:format}}`, `{{VALUE}}`, `{{VALUE:name}}` (named inputs prompt once and reuse), `{{NAME}}`, `{{TEMPLATE:path}}`, `{{MACRO:name}}`, `{{FIELD:frontmatter-key}}`, `{{SELECTED}}`, `{{CLIPBOARD}}`.

The lesson for Scriptor: **the same format-string resolver must serve filenames, folder paths, titles, and body text.** Today `templateExpansion.ts` handles body text and `planDailyNotePreview`/`previewDailyTokens` separately handle filenames — two token vocabularies that will drift.

**Extraction candidates.**

| Module | Scriptor file path | Notes |
|---|---|---|
| `Choice` union + validation | `src/lib/knowledge/choices/types.ts` (new) | serialize into vault config, not code |
| Capture with regex/line anchoring | `src/lib/knowledge/choices/capture.ts` (new) | generalizes `inbox.ts` + `dailyNote.ts` |
| Macro chaining | `src/lib/knowledge/choices/macro.ts` (new) | sequential, each step gets prior outputs |
| Unified format resolver (`{{VALUE:name}}`, `{{DATE:fmt}}`) | fold into `src/lib/knowledge/template/namespaces/*` | one vocabulary for filename + body |
| Multi-choice nested picker | extend `src/components/TemplatePicker.tsx` → `ChoicePicker.tsx` | keep the existing filter/arrow/Enter/focus-trap behaviour, add a `parent` stack |

```ts
// src/lib/knowledge/choices/types.ts
export type Choice =
  | { kind: 'template'; id: string; name: string; templatePath: string;
      folder: string | string[]; filenameFormat: string; openMode: 'none' | 'tab' | 'split' }
  | { kind: 'capture'; id: string; name: string; target: CaptureTarget;
      format: string; insertAfter?: { matches: string; createIfMissing: boolean }; prepend: boolean }
  | { kind: 'macro'; id: string; name: string; steps: Array<{ choiceId: string } | { scriptId: string }> }
  | { kind: 'multi'; id: string; name: string; children: Choice[] }

export type CaptureTarget =
  | { kind: 'daily-note' }
  | { kind: 'active-note' }
  | { kind: 'path'; path: string }        // path itself is format-expanded
```

---

## 4. obsidian-vimrc-support

**Purpose.** Loads a `.obsidian.vimrc` file from the vault on editor init and replays it through `codemirror-vim`, plus adds custom Ex commands to reach host-app functionality.

**Standout architecture.** Three mechanisms, all directly applicable to `packages/editor/src/vim-mode.ts`:

1. **`obcommand` — the host-command bridge.** A custom Ex command that invokes any registered app command by id: `:obcommand editor:toggle-comment`, `:obcommand app:go-back`. This is how you avoid re-implementing app features as vim commands.
2. **`exmap` — 0-arg aliasing, to work around a real CodeMirror limitation.** Verified from the README: CodeMirror's mapping commands pass only the first argument, so `:nmap <C-o> :obcommand app:go-back` executes `obcommand` with no args. The fix is to alias first, then map:
   ```
   exmap back obcommand app:go-back
   nmap <C-o> :back<CR>
   ```
   Note also the migration warning: since Obsidian 1.7.2 / newer `codemirror-vim`, normal-mode Ex mappings require an explicit `<CR>` (`nmap <F9> :nohl<CR>`), while movement remaps (`map j gj`) are unchanged. If Scriptor exposes a vimrc, document the `<CR>` requirement from day one rather than inheriting the breakage.
3. **`jsfile` / JS-backed Ex commands** — arbitrary JS snippets stored in the vault, bound to Ex commands. The README carries an explicit security warning: *"Running JavaScript snippets with Vim commands stored in your vault means that anyone who gains access to your notes can run arbitrary code inside your Obsidian app."* Same conclusion as Templater: a vault file is untrusted input. Route it through the Tier-1 worker sandbox or don't ship it.

Also worth copying: a status/mode indicator surfaced to CSS. Scriptor already does a minimal version of this (`document.documentElement.dataset.scriptorVim` on focus/blur) but it tracks *focus*, not *mode*.

**Extraction candidates.**

| Module | Scriptor file path | Notes |
|---|---|---|
| vimrc parser (`map`/`nmap`/`imap`/`vmap`/`exmap`/`set`/`unmap`) | `packages/editor/src/vim/vimrc.ts` (new) | pure parser → `VimrcDirective[]`; testable without a view |
| `obcommand` bridge | `packages/editor/src/vim/host-commands.ts` (new) | takes an injected `CommandRegistry`; do NOT reach into globals — Scriptor has a real command contract in `packages/plugin-api` |
| Mode → DOM/CSS reporting | extend `packages/editor/src/vim-mode.ts` | `data-scriptor-vim-mode="normal|insert|visual|replace"` |
| Per-file / frontmatter vim toggle | `packages/editor/src/vim/vimrc.ts` + `frontmatter.ts` | reuse `vimModeCompartment` which already exists |

```ts
// packages/editor/src/vim/vimrc.ts
export type VimrcDirective =
  | { kind: 'map'; modes: Array<'normal' | 'insert' | 'visual' | 'operator'>; lhs: string; rhs: string }
  | { kind: 'unmap'; modes: string[]; lhs: string }
  | { kind: 'exmap'; name: string; expansion: string }
  | { kind: 'set'; option: string; value: string | boolean }
  | { kind: 'exec'; command: string }          // run once at load, e.g. `nohl`

export function parseVimrc(source: string): { directives: VimrcDirective[]; errors: VimrcError[] }
export function applyVimrc(directives: VimrcDirective[], deps: { runCommand: (id: string) => void }): void
```

**Keymap layering in CodeMirror 6 — the design that avoids the classic bug.** CM6 resolves keymaps by precedence, and `@replit/codemirror-vim`'s `vim()` installs itself at high precedence. Scriptor's current `vimModeExtension()` returns `[vim(), domEventHandlers]` with no explicit `Prec`, so app-level bindings (`snippets.ts` already uses `Prec` for Tab) can win or lose non-deterministically depending on extension order. Fix it by declaring the layers once:

| Layer | Precedence | Contents |
|---|---|---|
| 1. Vim-exempt app keys | `Prec.highest` | global shortcuts that must never be swallowed (command palette, save, quit) — explicitly enumerated, small |
| 2. Vim | `Prec.high` | `vim()` inside `vimModeCompartment` |
| 3. Snippet/tabstop keys | `Prec.high` (below vim) | Tab/Shift-Tab only while a tabstop session is live — already gated by `snippetField` in `snippets.ts` |
| 4. Editor commands | `Prec.default` | markdown transforms, table commands, find/replace |
| 5. CM defaults | `Prec.lowest` | `defaultKeymap`, `historyKeymap` |

Rule: **vim owns insert/normal-mode keys; the app owns modifier-chorded keys.** With vim enabled, layer 3's Tab handling must yield in normal mode (vim's own Tab) and win in insert mode when a tabstop session exists. Encode that as a single guard function rather than scattering `if (vimEnabled)` checks.

---

## 5. obsidian-latex-suite

**Purpose.** UltiSnips-grade snippet expansion for LaTeX math, aiming at "as fast as handwriting" (explicitly modelled on Gilles Castel's UltiSnips setup).

**Standout architecture.** The snippet descriptor is the most expressive of any repo in this cluster. Verified from the README/DOCS:

```ts
{
  trigger: string | RegExp,
  replacement: string | BaseNode[],   // string, JS function, or AST nodes
  options: string,                    // flag string, see below
  priority?: number,                  // higher runs first; may be negative
  description?: string,
  flags?: string,                     // regex flags
  triggerKey?: string,                // per-snippet manual trigger
  language?: string,                  // for code-block snippets
  excludedMacros?: string[],
  excludedEnvironments?: string[],
}
```

The `options` flag string is a compact **syntax-context gate**, and this is the real innovation:

- `t` text mode (outside math), `m` math (= `M`+`n`), `M` block math `$$…$$`, `n` inline math `$…$`, `c` fenced code, `C` inline code
- `A` auto-expand the instant the trigger is typed (no Tab)
- `r` treat trigger as regex; `w` require word boundaries; `v` visual (operate on a selection, single-char trigger)
- `U` skip-undo: undo returns to before the trigger key, not to the un-expanded trigger

Plus a keypress pipeline with a documented, deterministic order: auto-delete `$` → auto snippets → manual snippets → next tabstop → previous tabstop → auto-fraction → priority tabout → matrix `\\`+newline → matrix `&` → matrix next line → tabout to closing bracket → tabout on typed closing delimiter. Writing that order down is why the feature feels predictable rather than magical.

Other transferable pieces: `${VISUAL}` in replacements (wrap the selection), `$0`/`$1` tabstops, snippets and *snippet variables* loadable from a vault file **or folder** (explicitly excluding hidden folders such as `.obsidian/`), concealment (render `\alpha` as α while the cursor is elsewhere), and tabout.

**Extraction candidates.**

| Module | Scriptor file path | Notes |
|---|---|---|
| Flag-string → syntax-scope gate | `packages/editor/src/snippet-context.ts` (new) | resolve via the lezer tree (`src/markdown/markdown-language.ts` + `custom-tags.ts`), not regex — Scriptor already has the parser |
| Auto-expand (`A`) input handler | extend `packages/editor/src/snippets.ts` | run as an input handler; skip-undo (`U`) via transaction annotation / `isolateHistory` |
| Regex triggers + `[[0]]` capture substitution | extend `packages/editor/src/snippet-parser.ts` | it already resolves `${VAR}`; add `RegExpExecArray` capture injection |
| `priority` ordering + first-match-wins | `packages/editor/src/snippet-catalog.ts` | `normalizeSnippetCatalog` currently sorts by name only |
| Visual snippets (`v`) | extend `snippets.ts`; reuse `transform-logic.ts::wrapSelectionText` | wrapping already implemented for bold/italic |
| Load snippets from file/folder, excluding hidden dirs | `packages/editor/src/snippet-catalogs.ts` + vault reader in `src/lib/knowledge` | mirror the `.scriptor/templates` discovery pattern in `templates.ts` |
| Tabout / closing-delimiter skip | extend `packages/editor/src/auto-pair.ts` | that file already owns bracket behaviour |
| Concealment decorations | extend `packages/editor/src/wysiwyg-decorations.ts` | same cursor-proximity pattern already used there |

```ts
// packages/editor/src/snippet-context.ts
export type SyntaxScope = 'text' | 'inline-math' | 'block-math' | 'fenced-code' | 'inline-code'

export interface SnippetOptions {
  scopes: readonly SyntaxScope[]     // empty = any scope
  auto: boolean
  regex: boolean
  visual: boolean
  wordBoundary: boolean
  skipUndo: boolean
  priority: number
}

export function parseSnippetOptions(flags: string, priority?: number): SnippetOptions
export function scopeAt(state: EditorState, pos: number): SyntaxScope
export function snippetApplies(opts: SnippetOptions, state: EditorState, pos: number): boolean
```

---

## Peer-feature comparison

### A. Markdown rule-engine design

| Dimension | obsidian-linter | remark-lint (upstream of Scriptor's shim) | latex-suite | Scriptor today |
|---|---|---|---|---|
| Rule unit | `Rule` object w/ metadata | unified plugin over mdast | snippet descriptor | inline `if` blocks in one loop |
| Config granularity | per-rule options + frontmatter disable | per-rule severity/options | per-snippet flags | none |
| Region exclusion | `ignoreTypes` mask/restore | AST-native | syntax scope flags | one `inFence` boolean |
| Auto-fix | yes, rule *is* the transform | separate (`remark-stringify`) | n/a | none |
| Docs/tests | generated from `examples` | manual | manual | manual |
| Ordering | `hasSpecialExecutionOrder` | plugin order | numeric `priority` | source order |

**Best of all worlds.** Take obsidian-linter's `Rule` object as the container, but make it AST-aware like remark-lint and offset-native like CM6, and borrow latex-suite's numeric `priority` instead of a boolean `runsLast`:

- **Rule = data + one pure function.** `check(ctx) => RuleDiagnostic[]` with `fix?: RuleFix` on each diagnostic. Report and fix are the same rule, so lint-on-save and the Problems dock can never disagree — obsidian-linter's key win over remark-lint, where linting and formatting are separate pipelines.
- **Exclusion via the existing lezer tree, not string masking.** obsidian-linter masks because it has no parser in hand. Scriptor *does* (`packages/editor/src/markdown/markdown-language.ts`), so `ignoreTypes` becomes "skip nodes whose enclosing scope is in this set" — no offset translation, no restore step, no corruption risk. Keep a masking fallback only for the vault/CLI path where no `EditorState` exists.
- **Offsets, not line/column.** `remark-lint.ts` currently returns `{line, column}` and `markdown-lint.ts` re-derives offsets. Emitting `{from, to}` directly deletes that conversion layer and makes CM6 quick-fix actions trivial.
- **`priority: number`** for ordering, defaulting to 0, so third-party rules can interleave.
- **Two-tier config**: workspace defaults + per-note frontmatter override (`scriptor-lint: {disable: [ids]}`), resolved once per document.
- **One registry, three consumers**: CM6 `linter()`, the vault-lint plugin, and the Rust CLI. `vault-lint`'s five health checks (`broken-links`, `duplicate-titles`, `orphan-assets`, `missing-heading`, `stale-definitions`) should be registered as `LintRule`s with `category: 'vault'` so ids are shared across editor, dock, and CLI output.

### B. Template expansion + scripting sandbox safety

| Dimension | Templater | QuickAdd | latex-suite | Scriptor today |
|---|---|---|---|---|
| Syntax | `<% %>` / `<%* *%>` | `{{TOKEN}}` / `{{TOKEN:arg}}` | `${VAR}`, `$0`, `[[0]]` | `{{var}}` fixed set |
| Expression power | full JS | declarative only | JS replacement fns | none |
| User input mid-expansion | `tp.system.prompt/suggester` | `{{VALUE:name}}` prompts | none | none |
| Date arithmetic | `tp.date.now(fmt, offset)` | `{{DATE:fmt}}` (+offset) | date vars only | none |
| Isolation | none (documented warning) | none | none | n/a |
| Filename/folder templating | yes | yes (core feature) | n/a | separate token set |
| Composition | `tp.file.include` | macros / multi-choices | none | none |

**Best of all worlds — a three-tier ladder, gated by trust.**

1. **Tier 0 (declarative, ship first).** QuickAdd's token model plus Templater's namespacing, with **one vocabulary shared by body, filename, folder, and title**. No evaluator at all: `<% tp.date.now("YYYY-MM-DD", -1) %>` is parsed into `{path: ['tp','date','now'], args: [literal, literal]}` and dispatched against a registry. Literals only — string, number, boolean. This covers the overwhelming majority of real-world templates with a provably empty attack surface, and it is the correct default because *templates live in the vault and vaults are shared, synced, and cloned*, i.e. untrusted input.
2. **Tier 1 (`<%* *%>` in a Worker).** Needed for loops and conditionals. Dedicated Web Worker; delete `fetch`/`XMLHttpRequest`/`importScripts` from `self` at boot; structured-clone messaging only; host-side capability checks on every namespace call; wall-clock `timeoutMs` enforced by `Worker.terminate()`; per-template capability grant surfaced in the UI before first run and recorded in workspace config. Explicitly **no** shell execution — Templater's `tp.system.command` is out of scope; if a user needs it, it goes through `packages/plugin-api` permissions, not the template engine.
3. **Tier 2 (WASM, marketplace template packs).** `crates/wasm-runtime` with `capabilities.rs`, fuel metering, memory caps, behind the existing `wasmtime-backend` feature flag. Only required once templates are distributable artifacts (`packages/plugin-api/src/marketplace.ts`).

The async signature (`expandTemplate(): Promise<TemplateResult>`) must land in Tier 0 even though nothing awaits yet — retrofitting async through `TemplatePicker` and the note-creation path later is the expensive version of this change.

Two smaller unifications worth doing at the same time:

- **Tabstops are the same concept in templates and snippets.** `templateExpansion.ts` has a single `{{cursor}}`; `snippet-parser.ts`/`snippets.ts` already implement ordered tabstops with a `StateField`, decorations, and Tab cycling. Templates should return `tabStops[]` and reuse `snippets.ts::insertExpandedSnippet` rather than a bespoke `cursorOffset`.
- **Snippet variables and template namespaces are the same registry.** `snippet-parser.ts`'s 20 builtins (`CURRENT_YEAR`, `CLIPBOARD`, `TITLE`, `TM_FILEPATH`, …) and the template `tp.*` namespaces should share one resolver so a value added in one place appears in both.

### C. Modal / vim keymap layering in CodeMirror 6

| Dimension | vimrc-support | latex-suite | Scriptor today |
|---|---|---|---|
| Keymap source | vault `.obsidian.vimrc` | settings-defined snippets | hardcoded 3 ex commands |
| Host-command access | `obcommand` + `exmap` alias | n/a | none |
| Precedence discipline | inherits plugin order | `Prec.highest` for Tab | unspecified (`vim()` bare) |
| Mode surfaced to UI | status/CSS indicator | n/a | focus-only `data-scriptor-vim` |
| Per-file toggle | frontmatter/setting | n/a | `vimModeCompartment` exists, unused |
| JS-backed commands | `jsfile` (warned) | function snippets | none |

**Best of all worlds.** Declare the precedence stack once, in one file, and never bind keys anywhere else:

| Layer | Precedence | Contents |
|---|---|---|
| 1 Vim-exempt app keys | `Prec.highest` | small explicit list: command palette, save, quit, pane nav |
| 2 Vim | `Prec.high` | `vim()` inside `vimModeCompartment` |
| 3 Snippet tabstops | `Prec.high` (declared after vim) | Tab/Shift-Tab **only** while `snippetField` has a live session |
| 4 Editor commands | `Prec.default` | markdown transforms, tables, find/replace, footnotes |
| 5 CM defaults | `Prec.lowest` | `defaultKeymap`, `historyKeymap` |

Rules that fall out of this:

- **Vim owns bare keys; the app owns modifier chords.** Any new app binding that is a bare key must be added to layer 1 explicitly and justified.
- **The layer-3 guard is one function**, `shouldSnippetTabWin(state)`, returning true only when a tabstop session is live and (with vim enabled) the editor is in insert mode. This replaces scattered `if (vimEnabled)` checks and is the single place the modal/tabstop conflict is decided.
- **`exmap` before `map`.** Adopt vimrc-support's two-step because the underlying `codemirror-vim` limitation is real: mapping commands pass only the first argument, so `:nmap <C-o> :obcommand app:go-back` silently loses its argument. Document `<CR>` as required for normal-mode Ex mappings from day one instead of inheriting the 1.7.2-era breakage.
- **`obcommand` goes through Scriptor's real command registry** (`packages/plugin-api/src/registry.ts`), not a global reach-around. vimrc-support's own README warns its approach is "done in a rather hacky manner" and may break; Scriptor has a typed contract and should use it.
- **Report mode, not focus.** Replace the focus/blur `data-scriptor-vim` flag in `vim-mode.ts` with `data-scriptor-vim-mode="normal|insert|visual|replace"` driven by the vim state, so the status bar and CSS (caret shape, gutter tint) are correct.
- **`jsfile` equivalent is Tier-1-or-nothing.** Same reasoning as templates: a vimrc lives in the vault, so it is untrusted. Ship declarative directives first; JS-backed Ex commands only through the worker sandbox.

---

## Prioritized backlog

Effort in ideal engineer-days, TS/React unless marked Rust. "Blocked by" refers to items in this table.

### P0 — foundations that get more expensive to retrofit

| # | Item | Files | Effort | Blocked by |
|---|---|---|---|---|
| P0-1 | Lint rule registry: `LintRule`/`RuleDiagnostic`/`RuleFix` types + `registerRule`/`runRules` | `packages/editor/src/lint/{rule,registry}.ts` | 2.0 | — |
| P0-2 | Port the 8-ish existing checks out of `remark-lint.ts` into one-file-per-rule, offsets not line/col | `packages/editor/src/lint/rules/*.ts` | 2.0 | P0-1 |
| P0-3 | Scope exclusion from the lezer tree (`scopeAt`) + masking fallback for the CLI path | `packages/editor/src/lint/ignore-ranges.ts` | 2.0 | P0-1 |
| P0-4 | Rewire `markdown-lint.ts` onto the registry; map `RuleFix` → CM6 quick-fix `actions` | `packages/editor/src/markdown-lint.ts` | 1.0 | P0-1..3 |
| P0-5 | Template parser: `parseTemplate()` → `TemplateNode[]`, `<% %>`/`<%* *%>`, whitespace trim. Pure, no eval | `src/lib/knowledge/template/parse.ts` | 2.0 | — |
| P0-6 | Tier-0 evaluator: namespace registry + literal-arg dispatch; **async signature** `Promise<TemplateResult>` | `src/lib/knowledge/template/index.ts`, `namespaces/{date,file,frontmatter}.ts` | 3.0 | P0-5 |
| P0-7 | Retire `templateExpansion.ts` in favour of Tier 0; keep `{{var}}` aliases for back-compat | `src/lib/knowledge/templateExpansion.ts` (shim) | 1.0 | P0-6 |
| P0-8 | Unify template tabstops with `snippets.ts::insertExpandedSnippet`; drop bespoke `cursorOffset` | `src/lib/knowledge/template/*`, `packages/editor/src/snippets.ts` | 1.5 | P0-6 |
| P0-9 | Declare the CM6 precedence stack in one file + `shouldSnippetTabWin(state)` guard | `packages/editor/src/keymap-layers.ts` (new), `snippets.ts`, `vim-mode.ts` | 1.5 | — |
| P0-10 | One shared variable resolver for snippet builtins and template namespaces | `packages/editor/src/snippet-parser.ts`, `src/lib/knowledge/template/namespaces/*` | 1.5 | P0-6 |

Subtotal: ~17.5 d.

### P1 — the features users actually notice

| # | Item | Files | Effort | Blocked by |
|---|---|---|---|---|
| P1-1 | Per-rule config: workspace defaults + per-note frontmatter `scriptor-lint.disable` | `packages/editor/src/lint/rule-config.ts` | 1.5 | P0-1 |
| P1-2 | Format-on-save via `applyFixes()`, with a dry-run diff preview | `packages/editor/src/lint/registry.ts` + save path | 2.0 | P0-4, P1-1 |
| P1-3 | Register the 5 vault-lint checks as `LintRule`s so editor/dock/CLI share ids | `packages/plugins/vault-lint/src/index.ts` | 1.5 | P0-1 |
| P1-4 | Paste rules as `category: 'paste'` (double list marker, ellipsis, blockquote indent, hyphen removal) | `packages/editor/src/paste-handler.ts` + `lint/rules/paste/*` | 2.0 | P0-1 |
| P1-5 | Rule `examples[]` → generated docs + table-driven tests in `validate-runner.ts` | `packages/editor/src/lint/rules/*`, `validate-runner.ts` | 1.5 | P0-2 |
| P1-6 | `tp.system.prompt` / `suggester` UI, reusing `TemplatePicker`'s focus-trap + keyboard model | `src/components/{TemplatePrompt,TemplateSuggester}.tsx` | 2.0 | P0-6 |
| P1-7 | Snippet options: `parseSnippetOptions` + scope gating + `priority` ordering | `packages/editor/src/snippet-context.ts`, `snippet-catalog.ts` | 2.0 | P0-3, P0-9 |
| P1-8 | Auto-expand (`A`) input handler with skip-undo (`U`) semantics | `packages/editor/src/snippets.ts` | 2.5 | P1-7 |
| P1-9 | Regex triggers + `[[n]]` capture substitution | `packages/editor/src/snippet-parser.ts` | 1.5 | P1-7 |
| P1-10 | Visual snippets (`v`) reusing `wrapSelectionText` | `packages/editor/src/snippets.ts` | 1.0 | P1-7 |
| P1-11 | Load snippets/variables from a vault file or folder, excluding hidden dirs | `packages/editor/src/snippet-catalogs.ts` + vault reader | 1.5 | P0-10 |
| P1-12 | `parseVimrc()` + `applyVimrc()` for `map`/`nmap`/`imap`/`vmap`/`exmap`/`set`/`unmap` | `packages/editor/src/vim/vimrc.ts` | 2.5 | P0-9 |
| P1-13 | `obcommand` bridge through `plugin-api/registry.ts`; `exmap` aliasing; `<CR>` documented | `packages/editor/src/vim/host-commands.ts` | 2.0 | P1-12 |
| P1-14 | `data-scriptor-vim-mode` reporting + status-bar indicator | `packages/editor/src/vim-mode.ts` | 1.0 | P0-9 |
| P1-15 | QuickAdd-style capture choice (anchored append/prepend, regex insert-after) generalizing `inbox.ts`/`dailyNote.ts` | `src/lib/knowledge/choices/{types,capture}.ts` | 3.0 | P0-6 |
| P1-16 | Folder→template mapping (`resolveTemplateForPath`) + filename/folder format expansion | `src/lib/knowledge/templates.ts` | 1.5 | P0-6 |

Subtotal: ~29.5 d.

### P2 — power users, distribution, polish

| # | Item | Files | Effort | Blocked by |
|---|---|---|---|---|
| P2-1 | Tier-1 worker sandbox for `<%* *%>`: stripped globals, structured-clone RPC, `terminate()` timeout, per-template capability grants | `src/lib/knowledge/template/worker/*`, `packages/plugin-api/src/sandbox.ts` | 5.0 | P0-6 |
| P2-2 | Capability-grant UI + persisted trust decisions per template path | `src/components/TemplateTrustDialog.tsx`, workspace config | 2.0 | P2-1 |
| P2-3 | Macro / multi choices (chaining + nested picker on top of `TemplatePicker` → `ChoicePicker`) | `src/lib/knowledge/choices/macro.ts`, `src/components/ChoicePicker.tsx` | 3.5 | P1-15 |
| P2-4 | Tabout + closing-delimiter skip, latex-suite's documented pipeline order | `packages/editor/src/auto-pair.ts` | 2.0 | P1-7 |
| P2-5 | Concealment decorations (cursor-proximity reveal) | `packages/editor/src/wysiwyg-decorations.ts` | 2.5 | P1-7 |
| P2-6 | Rust mirror of pure lint rules for vault-scale runs | `crates/cli`, `crates/vault` | 4.0 | P0-2, P1-3 |
| P2-7 | Tier-2 WASM execution for marketplace template packs | `crates/wasm-runtime` (`wasmtime-backend`), `packages/plugin-api/src/wasm-host.ts` | 5.0 | P2-1 |
| P2-8 | JS-backed Ex commands (vimrc `jsfile` equivalent) routed through the Tier-1 worker | `packages/editor/src/vim/host-commands.ts` | 2.0 | P2-1, P1-13 |
| P2-9 | Rule-authoring API exposed to plugins (third-party `LintRule` registration + `priority`) | `packages/plugin-api/src/contributions.ts` | 2.0 | P1-1 |
| P2-10 | Matrix/environment-aware snippet shortcuts (`\\`+newline, `&`, next line) | `packages/editor/src/snippets.ts` | 2.0 | P2-4 |

Subtotal: ~30.0 d. Cluster total ≈ 77 d.

---

## Cross-cutting notes

- **Three of the five upstream repos ship arbitrary code execution with a README warning as the only mitigation** (Templater's JS + system commands, vimrc-support's `jsfile`, latex-suite's function snippets). All three treat vault content as trusted. Scriptor should not: vaults are synced, cloned, and shared. The Tier-0/1/2 ladder above is the differentiator, and Tier 0 is deliberately powerful enough that most users never request Tier 1.
- **Four separate token vocabularies exist upstream** (Templater `tp.*`, QuickAdd `{{TOKEN}}`, latex-suite `${VAR}`/`$0`, linter's option keys). Scriptor already has two (`templateExpansion.ts`'s six `{{var}}` tokens and `snippet-parser.ts`'s twenty `${VAR}` builtins). P0-10 collapses them before a third appears.
- **Everything hangs off two registries**: `LintRule[]` and the template/snippet variable namespace. Both should be plugin-extensible (`packages/plugin-api/src/contributions.ts`) from the start; retrofitting extension points onto a closed registry is the expensive path.
- **`validate-runner.ts` is the right home for the new tests** — it already imports `snippet-parser`, `snippet-catalog`, `frontmatter`, and `transform-logic`, and uses `node:test` + `assert/strict`. Rule `examples[]` (P1-5) become table-driven cases there, giving obsidian-linter's docs-and-tests-from-one-source property for free.
- **Language choice.** All of P0 and P1 is TypeScript/React, which is correct: the rules must run inside CodeMirror against a live `EditorState`. Rust enters only at P2-6 (vault-scale lint throughput in `crates/cli`) and P2-7 (WASM isolation), both of which are performance/isolation problems rather than logic problems, and both reuse crates that already exist.











