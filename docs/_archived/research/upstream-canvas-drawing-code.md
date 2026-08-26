# Upstream Research: Canvas / Drawing / Code Presentation

Scope: `obsidian-excalidraw-plugin`, `obsidian-tldraw`, `obsidian-mind-map`, `Code-Styler`, `obsidian-annotator`.
Target: Scriptor (Tauri v2 + React 19 + Rust), landing in `crates/canvas-engine`, `packages/canvas`, `packages/editor`, `packages/renderer`, `src/components/canvas`.

## Scriptor baseline (verified by reading code)

- `crates/canvas-engine/src/{scene,apply,hit_test,snapshot,snapshot_raster,store,templates}.rs` — 1,920 LOC. Scene model is `CanvasDocument { id, vaultId, title, mode, layers[], blocks[], updatedAt }`; blocks are `markdown | sticky-note | shape | connector | image | embed | table | template` with optional `strokePoints`, `contentRef`, `style`, `locked`. Snapshot to SVG/PNG (resvg/tiny-skia) and PDF via Pandoc wrapper. Boards persist at `{vault}/.scriptor/canvas/boards`.
- Mirrored TS contract in `packages/core/src/contracts/canvas.ts` (identical shape, `pressure?` on points — Rust lacks it: **drift**).
- `packages/canvas/src/{crdt-sync,templates,validate-runner}.ts`; UI in `src/components/canvas/CanvasStage.tsx`, `useCanvasViewport.ts`, `src/lib/canvasRenderWorker.ts`, IPC in `src/bridge/canvas.ts`.
- `@scriptor/editor` is CodeMirror 6-based with a mature decoration culture already (`wysiwyg-decorations.ts`, `wikilink-decorations.ts`, `frontmatter-gutter.ts`, `toc-field.ts`). No code-block decoration exists.
- `packages/renderer` has `code-copy.ts` only; no header/fold/line-number/highlight layer for fences.

Gaps this research targets: (1) no note-embeddable drawing format, (2) no freehand/pen ink quality layer, (3) no code-block presentation layer, (4) no generated (derived) canvas such as mind maps, (5) no document-annotation surface.

---

## 1. obsidian-excalidraw-plugin

**Purpose.** Wraps Excalidraw as a first-class Obsidian file type: draw, embed drawings in notes, embed notes in drawings, and script the canvas.

**Standout architecture.** The drawing *is a markdown file*. A `.excalidraw.md` note carries frontmatter (`excalidraw-plugin: parsed`, export/embed keys) plus a `## Drawing` fenced block holding the Excalidraw JSON, optionally LZ-compressed (`Decompress Excalidraw JSON in Markdown View` toggles readability). Consequences: drawings are grep-able, git-diffable, wiki-linkable, and every element ID is addressable as a block ref. On top of that sits **ExcalidrawAutomate** — a stable scripting facade — and the **Script Engine**, which loads user scripts from a vault folder, folder-groups them into a tools panel, and registers them as command-palette entries with per-script settings.

**Highest-value idea: addressable sub-regions.** `![[file#^elementId]]`, `#^group=elementId`, `#area=Section heading`, `#frame=`, `#clippedframe=`, each accepting `,padding=N`, plus render sizing `|100x100|left`. One file yields many stable, named viewports.

**Extraction candidates.**

| Upstream module | Scriptor path | Interface sketch |
|---|---|---|
| `.excalidraw.md` container | `crates/canvas-engine/src/embed.rs` | `fn to_markdown(&CanvasDocument, EmbedOpts) -> String`; `fn from_markdown(&str) -> Result<CanvasDocument>`; `struct EmbedOpts { compress: bool, fence_lang: &'static str /* "scriptor-canvas" */ }` |
| element/group/area/frame refs | `crates/canvas-engine/src/region.rs` | `enum RegionRef { Block(String), Group(String), Area{anchor:String,padding:f64}, Frame{id:String,clipped:bool} }`; `fn resolve(&CanvasDocument, RegionRef) -> Option<CanvasRect>` |
| embed sizing/alignment syntax | `packages/renderer/src/remark-canvas-embed.ts` | parses `![[board.canvas.md#area=Intro,padding=120\|600x400\|right]]` → `<CanvasEmbed src region width height align>` |
| auto-export SVG/PNG sidecars | `crates/canvas-engine/src/snapshot.rs` (extend) | `fn autoexport(&CanvasDocument, &[SnapshotFormat], theme: Theme) -> Vec<PathBuf>` — light+dark pairs for publish/export paths |
| markdown-in-drawing | `crates/canvas-engine/src/snapshot.rs` + `markdown` block kind | render note → SVG via existing `packages/renderer` pipeline, cache by content hash; per-note override keys mirroring `excalidraw-border-color`, `excalidraw-css` |
| ScriptEngine | `packages/plugin-api` + `crates/wasm-runtime` | `interface CanvasAutomate { addShape(...); addText(...); selection(): CanvasBlock[]; commit(label: string): Promise<void> }` exposed to plugins; each script auto-registers a command in `src/lib/appCommandRegistry.ts` |

**Do not copy.** Compression-by-default (kills git diffs — make it opt-in), the OCR/SVG-import "clever hacks", and the frontmatter key sprawl (~30 keys). Scriptor should namespace under one `scriptor.canvas` frontmatter object.

---

## 2. obsidian-tldraw (tldraw integration)

**Purpose.** Same shape as Excalidraw but on tldraw: an infinite-canvas editor persisted per file, with tldraw's own store as the source of truth.

**Standout architecture.** tldraw's model is the interesting part, not the plugin glue:

- **Record store + schema migrations.** State is a flat map of typed records (`shape:*`, `page:*`, `instance:*`) behind a reactive store, with a declared `schemaVersion` and per-record-type migration chain. Opening an old file runs migrations deterministically. Scriptor's `CanvasDocument` has *no* version field — this is the single most important borrow.
- **`ShapeUtil` plugin seam.** Every shape type is a class supplying `getDefaultProps`, `getGeometry`, `component()`, `indicator()`, `canBind`, `onResize`. Third-party shapes are first-class, not special-cased.
- **Bindings as records.** Arrows attach via `binding:arrow` records referencing shape IDs + normalized anchor, so connectors survive moves/resizes. Scriptor's `connector` block kind currently carries no binding — it is geometry only.
- **Nested pages + frames** as containers with clipping, which is what makes `#frame=` style region refs cheap.
- **Reactive signals** (`@tldraw/state`) driving incremental render, and a `HistoryManager` with mark/bail/squash semantics for grouped undo.

**Extraction candidates.**

| Upstream concept | Scriptor path | Interface sketch |
|---|---|---|
| schema version + migrations | `crates/canvas-engine/src/migrate.rs` | `const SCENE_SCHEMA: u32`; `fn migrate(value: serde_json::Value) -> Result<CanvasDocument>`; add `schemaVersion: u32` to `CanvasDocument` and `packages/core/src/contracts/canvas.ts` |
| `ShapeUtil` registry | `packages/canvas/src/shape-registry.ts` | `interface ShapeUtil<P> { kind: string; defaultProps(): P; geometry(b: CanvasBlock): Geometry; Component: FC<{block: CanvasBlock}>; onResize?(b, delta): Partial<CanvasBlock> }`; `registerShape(util)` — consumed by `CanvasStage.tsx` and by `packages/plugin-api` |
| arrow bindings | `crates/canvas-engine/src/scene.rs` | `struct CanvasBinding { id, connector_id, target_block_id, anchor: CanvasPoint /* normalized 0..1 */, terminal: Terminal }`; `bindings: Vec<CanvasBinding>` on the document; `apply.rs` reflows connectors when a bound block moves |
| frames as clipping containers | `crates/canvas-engine/src/scene.rs` | new `CanvasBlockKind::Frame` + `parent_id: Option<String>` on `CanvasBlock`; `hit_test.rs` respects clip |
| mark/bail history | `packages/canvas/src/history.ts` | `mark(label): MarkId; bail(MarkId): void; squash(MarkId): void` layered over existing `crdt-sync.ts` patches |
| geometry-based hit test | `crates/canvas-engine/src/hit_test.rs` (extend) | replace rect-only containment with `Geometry::{Rect,Ellipse,Polyline,Path}` + stroke-width tolerance; needed for freehand/connector picking |

**Licensing note.** tldraw's SDK is under its own non-Apache license with watermark/licensing terms. Borrow the *architecture* (record store, migrations, ShapeUtil seam, bindings) — do not vendor the package into a commercially licensed Scriptor build. Excalidraw is MIT and is the safer vendoring target if one is needed; `perfect-freehand` (MIT, by the tldraw author) is safe and is the right ink library.

---

## 3. obsidian-mind-map

**Purpose.** Renders the *current note* as a mind map from its heading/list hierarchy via Markmap. Read-only, generated, ephemeral.

**Standout architecture.** The scene is **derived, never stored**. Pipeline: markdown → `markmap-lib` transform → hierarchical `{content, children, depth}` tree → `markmap-view` SVG with D3 layout. Options (`markmap-*` frontmatter keys, split-depth, screenshot with theme colors) are view state, not document state. Because nothing is persisted, there is no format, no migration, no conflict.

**Why it matters for Scriptor.** It supplies the missing third canvas mode: alongside `document | edgeless | presentation`, a *derived* view whose blocks are projected from a note's AST. Scriptor already has the AST (`packages/renderer` remark pipeline) and a graph renderer (`src/components/GraphCanvas.tsx`) to reuse for layout/pan/zoom.

**Extraction candidates.**

| Upstream module | Scriptor path | Interface sketch |
|---|---|---|
| markdown→tree transform | `packages/renderer/src/remark-mindmap.ts` | `interface MindNode { id: string; content: string; depth: number; children: MindNode[]; sourceLine: number }`; `fn buildMindTree(root: mdast.Root): MindNode` |
| tree→scene projection | `packages/canvas/src/derive-mindmap.ts` | `deriveMindmap(tree: MindNode, opts: {spacingX, spacingY, collapseDepth}): CanvasDocument` producing `sticky-note` + `connector` blocks with `sourceNoteId` and `contentRef` = `note#L{line}` |
| derived mode | contracts + engine | add `CanvasMode::Derived` and `derivedFrom?: { noteId, generator: 'mindmap' \| 'outline', revision: string }`; store.rs must refuse to persist derived docs as boards |
| screenshot with theme | `crates/canvas-engine/src/snapshot.rs` | already present — reuse `snapshot_raster.rs` for PNG export of derived scenes; no new code beyond a `Theme` param |
| bi-directional click | `src/components/canvas/CanvasStage.tsx` | node click → `scroll-sync.ts` jump to `sourceLine`; editor cursor move → highlight node. Scriptor's `rehype-source-lines.ts` already emits the mapping |

**Do not copy.** The plugin is archived/unmaintained and depends on an old Markmap. Reimplement the ~150 lines of transform against Scriptor's own mdast — do not add `markmap-lib` as a dependency.

---

## 4. Code-Styler

**Purpose.** Styles fenced code blocks *and* inline code identically in both editing mode (CodeMirror 6) and reading mode (post-processor).

**Standout architecture.** One **parameter parser** feeding **two independent renderers**. The fence info-string is a mini-language: `title:`, `fold`, `ln:` (`true|false|N` start offset), `hl:` (`2,4-6`, named alt-highlight groups, `hl:functionName` word/plain-text highlighting), `ignore`, `unwrap`, `wrap`. Reading mode gets a DOM post-processor; editing mode gets a CodeMirror `StateField` of `Decoration` ranges plus widgets for the header — which is the hard part, because decorations must survive typing, folding must not corrupt the document, and the header widget must not be selectable as text. Inline code uses `` `{lang} code` `` and shares the exact highlighter, so a snippet looks the same inline and in a fence.

Also notable: ~17 themed CSS variables (header bg, language-tag bg/text, gutter bg, line-number text, current-line indicator, active-line highlight, default + named alternative highlight colors, button + button-active), so themes restyle everything without touching logic. And a fully separate concern: **plugin/external-source support** — fences whose content is fetched from a file/URL and rendered read-only.

**This is the cleanest fit for Scriptor of all five repos** — `@scriptor/editor` already has the exact CodeMirror decoration patterns (`wysiwyg-decorations.ts`, `frontmatter-gutter.ts`), and `packages/renderer` already has the post-processor slot (`code-copy.ts`).

**Extraction candidates.**

| Upstream module | Scriptor path | Interface sketch |
|---|---|---|
| fence parameter parser (shared) | `packages/core/src/code-fence-params.ts` | `interface FenceParams { language?: string; title?: string; fold: 'none'\|'folded'\|'unfolded'; lineNumbers: false \| { start: number }; highlights: { default: LineSet; named: Record<string, LineSet>; words: string[] }; ignore: boolean; wrap?: boolean }`; `parseFenceInfo(info: string): FenceParams`. One parser, imported by both editor and renderer — non-negotiable. |
| editing-mode decorations | `packages/editor/src/code-block-decorations.ts` | `codeBlockStyling(opts): Extension` — `StateField<DecorationSet>` mapping through changes; `WidgetType` header (`contenteditable=false`, `ignoreEvent()` true) + line-number gutter via `lineNumberMarkers`; fold implemented as `Decoration.replace` on the body range, **never** a document edit |
| reading-mode post-processor | `packages/renderer/src/rehype-code-styler.ts` | rehype plugin wrapping `<pre>` in `<div class="sc-code">` + header node; consumes the same `FenceParams`; composes with existing `code-copy.ts` (header becomes copy/fold button host) |
| inline code highlighting | `packages/editor/src/inline-code-decorations.ts` + `packages/renderer/src/remark-inline-code-lang.ts` | detect `` `{ts} const x = 1` ``, strip the `{lang}` token from display, apply the same Lezer/Shiki highlighter |
| theme variable surface | `design-system/scriptor` + `export-theme.css` | `--sc-code-header-bg`, `--sc-code-lang-bg`, `--sc-code-gutter-bg`, `--sc-code-ln-text`, `--sc-code-hl-default`, `--sc-code-hl-{name}`, `--sc-code-active-line`, `--sc-code-btn`, `--sc-code-btn-active` |
| external-source fences | `packages/renderer/src/remark-code-include.ts` | `` ```ts title:x.ts src:vault://path#L10-L40 `` → resolved through `crates/vault` (vault-relative only by default; remote fetch behind an explicit setting, consistent with existing `remark-import.ts`) |

**Do not copy.** Fold-by-document-edit, and the `ignore` escape hatch proliferation. Keep the info-string grammar strict and validated — emit a lint diagnostic through the existing `packages/editor/src/markdown-lint.ts` on malformed params rather than silently ignoring them.

---

## 5. obsidian-annotator

**Purpose.** Annotate PDFs and EPUBs from inside a note. The note is the annotation database; the document is just a target.

**Standout architecture.** A note declares `annotation-target: Pdfs/mypdf.pdf` (vault path *or* URL) in frontmatter. The plugin renders a view (PDF.js / epub.js) with Hypothesis's annotation layer wired to a **local storage adapter** instead of Hypothesis's server. Each highlight is written back into the note body as a block with a `%%` comment payload holding the selector, so annotations are plain markdown, block-referenceable (`[[note#^annotationId]]`), and survive without the plugin. Position uses **multi-strategy anchoring** (text-quote selector + text-position + range selector) so highlights survive reflow — text-quote wins when offsets shift. Known weakness, called out in its own README: renaming the target file orphans every annotation.

**Extraction candidates.**

| Upstream concept | Scriptor path | Interface sketch |
|---|---|---|
| target declaration | `packages/core/src/contracts/annotation.ts` | `interface AnnotationTarget { kind: 'pdf' \| 'epub' \| 'image' \| 'canvas'; ref: NoteId \| VaultPath; }` — resolve by **stable note/asset id**, not path, fixing the upstream rename bug (Scriptor already has `NoteId` and `crates/vault`) |
| multi-strategy anchors | `crates/vault/src/anchor.rs` | `enum Selector { TextQuote { exact, prefix, suffix }, TextPosition { start, end }, Rect { page: u32, rect: CanvasRect } }`; `fn reanchor(&[Selector], haystack: &str) -> Option<Range<usize>>` — try quote, then position, then fail soft to an "orphaned" state instead of dropping |
| annotations-in-markdown | `packages/renderer/src/remark-annotations.ts` | parse/serialize `>%%[!annotation] {json}%%` blocks; round-trip guarded by existing `packages/editor/src/roundtrip.ts` |
| annotation → canvas block | `crates/canvas-engine/src/scene.rs` | reuse `CanvasBlockKind::Embed` with `contentRef = "note#^annotationId"`; dragging a highlight onto a board creates a live-linked citation card — pairs with `crates/citation-engine` |
| rect anchors on drawings | `crates/canvas-engine/src/region.rs` | the same `Selector::Rect` variant lets the annotation layer target a *canvas region*, unifying "comment on a PDF page" and "comment on a board area" |

**Do not copy.** Bundling PDF.js + epub.js + the Hypothesis client (three heavy vendored trees). Scriptor should implement the anchor model and markdown serialization first; the PDF/EPUB viewer is a separate, later decision (`pdfium` via Rust, or `pdf.js` in a webview, evaluated on its own).

---

## Peer-feature comparison

### A. Scene file format

| Aspect | Excalidraw plugin | tldraw | mind-map | Scriptor today |
|---|---|---|---|---|
| Container | markdown note + fenced JSON | `.tldr` JSON (record map) | none (derived) | standalone JSON in `.scriptor/canvas/boards` |
| Grep/diff-able | yes (unless compressed) | poor (flat record map, id churn) | n/a | yes but outside the vault tree |
| Versioned | implicit (Excalidraw `version`) | **explicit `schemaVersion` + migration chain** | n/a | **none** |
| Element addressing | element id, group, area, frame | record id, page, frame | n/a | block id only, not link-addressable |
| Wiki-linkable / backlinked | yes | no | n/a | no |
| Undo model | Excalidraw internal | mark/bail/squash | n/a | patch log (`apply.rs` + `crdt-sync.ts`) |

**Best of all worlds.** Excalidraw's *container* + tldraw's *rigor*: a `board.canvas.md` note in the vault, frontmatter carrying `scriptor.canvas.schemaVersion` and embed/export options, body carrying a `` ```scriptor-canvas `` fence with pretty-printed JSON (compression opt-in, off by default so git diffs work). Add `schemaVersion: u32` to `CanvasDocument` **now**, before external files exist, with `crates/canvas-engine/src/migrate.rs` running on every load. Add `bindings` and `parent_id` at the same time — both are format changes and should land in one migration, not three. Keep `.scriptor/canvas/boards` as a cache/checkpoint location only; the vault note becomes the source of truth so backlinks, search (`tantivy-indexer`), and git (`native-git`) all work for free.

### B. Embedding drawings in notes

| Aspect | Excalidraw plugin | tldraw | mind-map | Scriptor today |
|---|---|---|---|---|
| Syntax | `![[f#^area=X,padding=120\|600x400\|right]]` | `![[f.tldr]]` (whole file) | n/a | none |
| Sub-region embeds | element / group / area / frame / clippedframe | frame only | n/a | none |
| Render path | live SVG in-app, SVG/PNG sidecar for publish | live canvas | live SVG | `snapshot.rs` exists, unused by renderer |
| Light/dark | dual auto-export | theme-reactive | theme colors | `Theme` param available |

**Best of all worlds.** Excalidraw's region grammar, restricted to four forms (`#^id`, `#group=id`, `#area=name`, `#frame=id`), each accepting `,padding=N`, plus `|WxH|align`. Two render paths from one `RegionRef`: in-app, `packages/renderer/src/remark-canvas-embed.ts` emits a React `<CanvasEmbed>` that reuses `CanvasStage` in read-only mode (live, theme-reactive, no snapshot cost); for export/publish, `export-runner` calls `snapshot.rs` with the resolved rect and the active theme, emitting light+dark SVG. Content-hash the snapshot cache so unchanged regions are free.

### C. Code-block decoration

| Aspect | Code-Styler | Excalidraw | Scriptor today |
|---|---|---|---|
| Editing mode | CM6 StateField + header widget | n/a | none |
| Reading mode | DOM post-processor | n/a | `code-copy.ts` only |
| Params | rich info-string mini-language | n/a | none |
| Inline code | same highlighter as fences | n/a | none |
| Fold | decoration-based | n/a | none |
| Theming | ~17 CSS variables | n/a | n/a |

**Best of all worlds.** Code-Styler wholesale, with one correction: a **single parser in `packages/core`** consumed by both renderers (upstream duplicates parsing logic across its two paths, which is the source of most of its editing-vs-reading inconsistency bugs). Fold via `Decoration.replace`, never a document edit. Validate the info-string and surface errors through the existing lint channel. Add `src:` external-source fences last, resolved through `crates/vault`.

---

## Prioritized backlog

Effort in engineer-days. "Format" items are ordered first because they are cheap now and expensive after users have files on disk.

### P0 — do first

| # | Item | Lands in | Effort |
|---|---|---|---|
| 1 | `schemaVersion` + `migrate.rs` + migration test fixture | `crates/canvas-engine/src/migrate.rs`, `packages/core/src/contracts/canvas.ts` | 2 |
| 2 | Format change bundle in one migration: `bindings: Vec<CanvasBinding>`, `parent_id`, `CanvasBlockKind::Frame`, `pressure` on Rust `CanvasPoint` (fixes existing TS/Rust drift) | `crates/canvas-engine/src/scene.rs` + contracts | 3 |
| 3 | `board.canvas.md` container: `to_markdown` / `from_markdown`, vault note as source of truth, boards dir demoted to cache | `crates/canvas-engine/src/embed.rs`, `store.rs` | 4 |
| 4 | Shared fence parameter parser + tests | `packages/core/src/code-fence-params.ts` | 2 |
| 5 | Code-block decorations, editing mode (header widget, line numbers, highlights, decoration-fold) | `packages/editor/src/code-block-decorations.ts` | 5 |
| 6 | Code-block reading mode, composed with `code-copy.ts` | `packages/renderer/src/rehype-code-styler.ts` | 3 |
| 7 | Code theme variable surface + light/dark tokens | `design-system/scriptor`, `export-theme.css` | 1 |

**P0 total ≈ 20 days.** Items 1–3 are a single PR train; 4–7 are independent of them and can run in parallel.

### P1 — high value, depends on P0

| # | Item | Lands in | Effort |
|---|---|---|---|
| 8 | `RegionRef` resolution (`#^id`, `group=`, `area=`, `frame=`, `padding=`) | `crates/canvas-engine/src/region.rs` | 3 |
| 9 | `![[board.canvas.md#area=X\|600x400\|right]]` embed → live read-only `CanvasStage` | `packages/renderer/src/remark-canvas-embed.ts`, `src/components/canvas/` | 4 |
| 10 | Snapshot-on-export with theme pairs + content-hash cache | `crates/canvas-engine/src/snapshot.rs`, `crates/export-runner` | 3 |
| 11 | `ShapeUtil` registry; migrate built-in shapes onto it; expose via `packages/plugin-api` | `packages/canvas/src/shape-registry.ts` | 4 |
| 12 | Geometry-aware hit test (ellipse/polyline/path + stroke tolerance) | `crates/canvas-engine/src/hit_test.rs` | 3 |
| 13 | Connector binding reflow on move/resize | `crates/canvas-engine/src/apply.rs` | 3 |
| 14 | Ink quality: `perfect-freehand` (MIT) stroke outlines + pressure | `packages/canvas/src/ink.ts`, `src/lib/canvasRenderWorker.ts` | 3 |
| 15 | Inline code highlighting, both modes | `packages/editor`, `packages/renderer` | 2 |
| 16 | Derived mindmap mode (`CanvasMode::Derived`, mdast→tree→scene, click-to-source via `rehype-source-lines.ts`) | `packages/renderer/src/remark-mindmap.ts`, `packages/canvas/src/derive-mindmap.ts` | 5 |
| 17 | `mark/bail/squash` grouped undo over the patch log | `packages/canvas/src/history.ts` | 3 |

**P1 total ≈ 33 days.**

### P2 — later / conditional

| # | Item | Lands in | Effort |
|---|---|---|---|
| 18 | Markdown-note blocks rendered into boards (renderer→SVG, hash-cached, per-note CSS override) | `crates/canvas-engine/src/snapshot.rs` | 5 |
| 19 | Annotation anchor model + markdown serialization (no viewer yet) | `crates/vault/src/anchor.rs`, `packages/renderer/src/remark-annotations.ts` | 5 |
| 20 | Annotation → canvas citation card, wired to `crates/citation-engine` | `crates/canvas-engine`, `src/components/canvas` | 3 |
| 21 | `CanvasAutomate` scripting facade + script→command auto-registration | `packages/plugin-api`, `src/lib/appCommandRegistry.ts` | 5 |
| 22 | `src:` external-source code fences (vault-only default) | `packages/renderer/src/remark-code-include.ts` | 2 |
| 23 | Opt-in scene compression | `crates/canvas-engine/src/embed.rs` | 1 |
| 24 | PDF/EPUB viewer decision + spike (`pdfium` vs webview `pdf.js`) | new | 8 |

**P2 total ≈ 29 days.**

### Explicit non-goals

Vendoring the tldraw SDK (license), `markmap-lib` (unmaintained upstream), the Hypothesis client, OCR, and SVG-import. Compression-by-default. Any second fence-parameter parser.





