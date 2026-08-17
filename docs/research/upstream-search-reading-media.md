# Upstream Research: Search / Reading / Media Metadata

Cluster study of five Obsidian-ecosystem projects, mapped onto Scriptor
(Tauri v2 + React 19 + Rust monorepo).

## Scriptor baseline (grounded)

- `crates/indexer` — SQLite derived cache (`rusqlite`, r2d2 pool). Schema v4 in
  `src/schema.rs`: `notes`, `links`, `note_fts` (FTS5, `tokenize='unicode61'`),
  `citation_refs`, `recent_access`, `cache_meta`.
- `crates/indexer/src/search.rs` — hand-rolled query compiler
  (`build_fts_query`) supporting `AND` (space), `OR` (`|`), `NOT` (`!`), quoted
  phrases; every term becomes `"term"*` prefix-quoted so FTS5 operators are
  literal. Ranking is raw `ORDER BY bm25(note_fts)` with no per-column weights.
  Snippets via `snippet(note_fts, 1, '[[', ']]', '...', 32)`.
- `crates/tantivy-indexer` — thin `TantivyIndex` (fields `path`/`title`/`body`),
  wired but not used by the bridge. Second, unexploited ranking engine.
- `crates/embeddings` — SQLite + Ollama client; vector side exists, unused by search.
- `src/bridge/commands/indexer.ts` — 20 `invoke` wrappers, the single seam every
  recommendation below must land behind.
- `packages/zotero-connector` — the only existing external metadata provider; a
  bespoke `ZoteroConnector` class, **not** an abstraction. Prime refactor target.
- Absent entirely: annotation storage, PDF/EPUB reading surface, SRS/flashcards,
  web capture, media metadata providers.

---

## 1. omnisearch (`scambier/obsidian-omnisearch`)

**Purpose.** Vault-wide fuzzy full-text search with a quick-switcher and an
in-vault results view; indexes markdown, PDFs, images (OCR), and office docs.

**Standout architecture.** Everything is in-memory: a single `MiniSearch`
instance over `IndexedDocument` records, serialized to a persisted JSON blob
(`AsPlainObject`) so restart is a rehydrate rather than a rebuild. Index writes
are chunked (`chunkArray`) to keep the UI thread responsive. Text extraction for
non-markdown is delegated to a companion plugin (`obsidian-text-extractor`) that
runs pdf.js and tesseract in a worker and caches extracted text by file hash —
extraction is decoupled from indexing.

**Ranking details worth stealing.**

- Fields indexed: `basename`, `aliases`, `content`, `headings1..3`, `tags`,
  `path`, `displayTitle`. Per-field boosts at query time are roughly
  `basename ≈ 10`, `aliases ≈ 10`, `displayTitle ≈ 10`, `headings1 ≈ 3`,
  `headings2 ≈ 2`, `headings3 ≈ 1.5`, `tags/path` modest.
- `fuzzy: 0.2` (edit distance ≈ 20% of term length) and `prefix: true` on the
  last token only, so typing is prefix-matched but earlier tokens stay strict.
- Diacritics folding (`removeDiacritics`) applied symmetrically at index and
  query time; a CJK guard (`chsRegex = /[一-龥]/`) switches to
  character-level segmentation because MiniSearch's whitespace tokenizer cannot
  split Chinese.
- Post-BM25 re-scoring: a *recency* multiplier keyed off `mtime` with a
  configurable `RecencyCutoff`, plus down-weighting of results whose only match
  is in `path`. This "BM25 then business-rule multiply" pattern is the single
  most portable idea in the repo.
- Excerpts are produced by splitting content on `regexLineSplit` (newline or
  sentence terminator), picking the line with the densest match, and wrapping
  matched offsets returned by MiniSearch in `<mark>`.

**Known limits.** Memory grows with vault size; no boolean/field query syntax as
rich as FTS5; the index blob must be rewritten wholesale on save.

**Extraction candidates.**

| Upstream idea | Scriptor landing site | Interface sketch |
|---|---|---|
| Weighted multi-field BM25 | `crates/indexer/src/search.rs` | Replace FTS5 table with `fts5(note_id UNINDEXED, title, aliases, headings, tags, body)` and rank via `bm25(note_fts, 0.0, 10.0, 8.0, 3.0, 2.0, 1.0)` |
| Post-score business rules | new `crates/indexer/src/rank.rs` | `pub struct RankWeights { recency_half_life_days: f64, path_only_penalty: f64, title_boost: f64 } ; pub fn rerank(hits: &mut Vec<SearchHit>, w: &RankWeights)` |
| Fuzzy fallback tier | `crates/indexer/src/search.rs` | if FTS5 returns `< limit`, run `fuzzy_candidates(cache, query, limit)` using a Rust trigram/Jaro-Winkler pass over `notes.title` + `notes.path` |
| Extractor-as-cache | new `crates/extractor` | `pub trait TextExtractor { fn supports(ext: &str) -> bool; fn extract(path: &Path) -> Result<String>; }` + `extracted_text(path, content_hash, text)` table so re-index is a hash lookup |
| Bridge surface | `src/bridge/commands/indexer.ts` | `indexerSearchRanked(query, opts: { limit?: number; fuzzy?: boolean; fields?: SearchField[]; recency?: boolean }): Promise<RankedSearchHit[]>` where `RankedSearchHit = SearchHit & { score: number; matchedFields: string[]; highlights: Array<[number, number]> }` |

**Note on tantivy.** `crates/tantivy-indexer` already gives per-field schemas,
proper tokenizers (including CJK via a custom tokenizer), and `SnippetGenerator`.
The cheaper path is to widen FTS5 first (P0) and treat tantivy as the P2
migration once field weighting proves insufficient — keep both behind the same
`indexerSearchRanked` bridge signature so the swap is invisible to React.

---

## 2. obsidian-media-db-plugin (`mProjectsCode/obsidian-media-db-plugin`)

**Purpose.** Query external media catalogues (movies, series, games, books,
music, board games, comics) and materialize the result as a note with structured
frontmatter.

**Standout architecture.** A clean two-layer provider abstraction that Scriptor
currently lacks:

- `APIModel` — abstract base each provider subclasses. Carries `apiName`,
  `apiDescription`, `apiUrl`, `types: string[]` (which media types it can serve),
  and implements `searchByTitle(title): Promise<MediaTypeModel[]>` plus
  `getById(id): Promise<MediaTypeModel>`.
- `APIManager` — registry holding `apiModels: APIModel[]`; dispatches
  `query(title, types)` by fanning out to every registered model whose `types`
  intersect the request and flattening results, and `queryDetailedInfo(item)` /
  `queryByIdAndAPI(id, apiName)` for the second round-trip.
- Concrete providers: `OMDbAPI`, `MALAPI` / `MALAPIManga`, `SteamAPI`,
  `MobyGamesAPI`, `GiantBombAPI`, `BoardGameGeekAPI`, `MusicBrainzAPI`,
  `OpenLibraryAPI`, `WikipediaAPI`, `ComicVineAPI`.
- `MediaTypeModel` hierarchy — `MovieModel`, `SeriesModel`, `GameModel`,
  `BookModel`, `MusicReleaseModel`, `BoardGameModel`, `ComicMangaModel`. Each
  implements `getTags()`, `getMediaType()`, `getSummary()`, and
  `toMetaDataObject()` — the single choke point that turns a provider payload
  into frontmatter, so provider shape never leaks into the note format.
- Templates: per-media-type template file names in settings, `{{ field }}`
  substitution against the flattened model, configurable folder-per-type,
  `fileNameTemplate`, and duplicate detection before write.

**Extraction candidates.**

| Upstream idea | Scriptor landing site | Interface sketch |
|---|---|---|
| `APIModel` | new `packages/metadata-providers/src/provider.ts` | `export interface MetadataProvider { id: string; label: string; mediaTypes: MediaType[]; searchByTitle(q: string, signal?: AbortSignal): Promise<MetadataRecord[]>; getById(id: string): Promise<MetadataRecord> }` |
| `APIManager` | `packages/metadata-providers/src/registry.ts` | `export class MetadataRegistry { register(p: MetadataProvider): void; providersFor(t: MediaType): MetadataProvider[]; async query(q: string, types: MediaType[]): Promise<MetadataRecord[]>; async detail(ref: { providerId: string; id: string }): Promise<MetadataRecord> }` |
| `MediaTypeModel.toMetaDataObject()` | `packages/metadata-providers/src/normalize.ts` | `export type MediaType = 'movie' \| 'series' \| 'game' \| 'book' \| 'music' \| 'paper' \| 'boardgame'` and `export function toFrontmatter(r: MetadataRecord): Record<string, unknown>` — one normalizer, providers stay dumb |
| Retrofit Zotero | `packages/zotero-connector/src/index.ts` | Wrap the existing `ZoteroConnector` in `class ZoteroProvider implements MetadataProvider` (`mediaTypes: ['paper','book']`) — no rewrite, just an adapter; proves the abstraction against real code |
| Template + duplicate write | `src/components/MediaLookupDialog.tsx` + `packages/core` | `createNoteFromMetadata(record, { templatePath, folder, fileNameTemplate })`; duplicate check reuses `indexerResolveWikilink` / `indexerBatchNoteMeta` |
| Provider search indexed | `crates/indexer` | persist accepted records into a new `external_refs(note_id, provider_id, external_id, payload_json)` table so `indexerSearch` can match on catalogue metadata, not just note body |

Network calls belong in Rust (`reqwest`, already a dep of `crates/embeddings`)
behind Tauri commands so API keys never reach the webview; the TypeScript
`MetadataProvider` implementations then call
`invoke('metadata_provider_request', { providerId, ... })`. This is a hard
requirement, not a preference — provider keys are secrets.

---

## 3. obsidian-annotator (`elias-sundqvist/obsidian-annotator`)

**Purpose.** Read and annotate PDF and EPUB inside the vault; annotations live in
markdown, not a sidecar database.

**Standout architecture.** It embeds a patched **hypothes.is** client and swaps
its storage backend from the Hypothesis API to the vault file. A note becomes a
reader when its frontmatter carries `annotation-target: path/or/url`. Rendering is
pdf.js for PDF and epub.js for EPUB, both loaded into an iframe alongside the
Hypothesis sidebar.

**Annotation storage format.** Each annotation is appended to the same note as a
markdown block, with the W3C Web Annotation payload embedded in comment
delimiters so it renders as a quote in preview but round-trips losslessly:

```
>%%
>```annotation-json
>{"created":"...","text":"my comment","target":[{"source":"...","selector":[
>  {"type":"TextPositionSelector","start":1234,"end":1290},
>  {"type":"TextQuoteSelector","exact":"...","prefix":"...","suffix":"..."}]}]}
>```
>%%
>*%%PREFIX%%…the words before*
>==the highlighted text==
>*%%POSTFIX%%the words after…*
```

The dual-selector design is the key insight: `TextPositionSelector` gives O(1)
re-anchoring when the document is byte-identical, and `TextQuoteSelector`
(exact + prefix + suffix) gives fuzzy re-anchoring when it is not. EPUB adds a
`FragmentSelector` carrying an EPUB CFI; PDF adds page index. Deep links are
`#annotation-<id>` appended to the note link, so a backlink can jump to a
highlight.

**Weaknesses.** Bundling a patched third-party web app is a maintenance sink and
a security surface; the markdown format is verbose and easy to corrupt by hand.
Scriptor should copy the *data model*, not the *client*.

**Extraction candidates.**

| Upstream idea | Scriptor landing site | Interface sketch |
|---|---|---|
| W3C selector model | new `crates/annotations/src/selector.rs` | `pub enum Selector { TextPosition { start: usize, end: usize }, TextQuote { exact: String, prefix: String, suffix: String }, Fragment { value: String }, PageIndex(u32) }` (serde-tagged as `type`) |
| Two-stage re-anchor | `crates/annotations/src/anchor.rs` | `pub fn anchor(doc: &str, selectors: &[Selector]) -> Option<Range<usize>>` — try `TextPosition`, verify against `TextQuote.exact`, else fuzzy-search `prefix+exact+suffix` (bitap/Levenshtein window) and return the best scoring window |
| Markdown round-trip | `crates/annotations/src/markdown.rs` | `pub fn parse_annotation_blocks(md: &str) -> Vec<Annotation>` / `pub fn render_annotation_block(a: &Annotation) -> String`; delimiter set kept compatible with obsidian-annotator so vaults import cleanly |
| Indexed annotations | `crates/indexer/src/schema.rs` (schema v5) | `CREATE TABLE annotations(id TEXT PRIMARY KEY, note_id TEXT NOT NULL, target TEXT NOT NULL, page INTEGER, exact TEXT, comment TEXT, tags_json TEXT NOT NULL DEFAULT '[]', created_at TEXT NOT NULL)` + FTS row so highlights are first-class search hits |
| Reader surface | `src/components/reader/ReaderPanel.tsx` | pdf.js + epub.js in React 19, no Hypothesis. `useAnnotations(notePath)` hook over new bridge calls |
| Bridge | new `src/bridge/commands/annotations.ts` | `annotationsList(notePath)`, `annotationsCreate(notePath, draft: AnnotationDraft)`, `annotationsUpdate(id, patch)`, `annotationsDelete(id)`, `annotationsAnchor(notePath, id): Promise<{ start: number; end: number } \| null>` |

`annotation-target` frontmatter is already parseable by
`crates/indexer/src/parse.rs`; surfacing it means adding one field to
`ParsedNote` and one column to `notes`, not a new pipeline.

---

## 4. obsidian-clipper (`obsidianmd/obsidian-clipper`)

**Purpose.** Browser extension that captures a web page into vault markdown via
user-authored templates.

**Standout architecture.** A three-part declarative capture pipeline:

1. **Extraction.** `Defuddle` (the maintainers' own successor to Mozilla
   Readability) isolates main content; Turndown converts the surviving HTML to
   markdown with custom rules for tables, footnotes, math, and code fences.
2. **Variables.** A namespaced variable space resolved against the page:
   `{{title}}`, `{{author}}`, `{{content}}`, `{{url}}`, `{{domain}}`,
   `{{published}}`, `{{image}}`, plus three dynamic families —
   `{{meta:name}}` (meta tags), `{{schema:@Article:author.name}}` (JSON-LD /
   schema.org path access, with `[]` array indexing), and
   `{{selector:h1.title?attr}}` / `{{selectorHtml:…}}` (CSS selector escape hatch).
3. **Filters.** A left-to-right pipe chain applied to any variable:
   `{{published|date:"YYYY-MM-DD"}}`, and `slugify`, `safe_name`, `lower`,
   `upper`, `trim`, `truncate`, `split`, `join`, `list` / `numlist` / `tasklist`,
   `wikilink`, `markdown`, `strip_tags`, `strip_md`, `replace`, `map`, `template`,
   `first`, `last`, `unique`, `nth`, `calc`, `number_format`. Filters are pure
   `(value, arg) => value` functions in a lookup table — trivially portable.

Templates additionally declare `behavior` (create / append / prepend / daily
note), `noteNameFormat`, `path`, typed `properties` (text / multitext / number /
checkbox / date), and **triggers** — URL patterns or regexes that auto-select the
template. A highlighter mode records page highlights (selector + offsets, the
same anchoring problem as annotator) and an optional "interpreter" sends the page
to an LLM to fill declared prompt variables.

**Extraction candidates.**

| Upstream idea | Scriptor landing site | Interface sketch |
|---|---|---|
| Filter pipeline | new `packages/core/src/template/filters.ts` | `export type Filter = (value: unknown, arg?: string) => unknown; export const filters: Record<string, Filter>; export function applyPipeline(value: unknown, spec: string): unknown` — reusable by `TemplatePicker.tsx` today, capture later |
| Variable resolution | `packages/core/src/template/resolve.ts` | `export interface VariableSource { get(ns: string, key: string): Promise<unknown> }` with `MetaSource`, `SchemaSource`, `SelectorSource`, `FrontmatterSource` — unifies clipper variables and Scriptor's existing note templates |
| Template descriptor | `packages/core/src/template/schema.ts` | `export interface CaptureTemplate { id: string; name: string; behavior: 'create' \| 'append' \| 'prepend' \| 'daily'; path: string; noteNameFormat: string; triggers: string[]; properties: TemplateProperty[]; body: string }` (zod-validated, matching existing `packages/export/src/schema.ts` conventions) |
| HTML → markdown | new `crates/capture` or `packages/core/src/capture/html.ts` | Rust: `pub fn html_to_markdown(html: &str, base_url: &str) -> Result<CaptureResult>` using `readability` + `htmd`; keeps capture usable headlessly from `crates/cli`. TS/Turndown is the fallback if fidelity lags |
| Trigger matching | `packages/core/src/template/triggers.ts` | `export function selectTemplate(url: string, templates: CaptureTemplate[]): CaptureTemplate \| null` — longest-prefix then regex, first match wins |
| Bridge | new `src/bridge/commands/capture.ts` | `captureFromUrl(url, templateId?)`, `captureFromHtml(html, url, templateId?)`, `captureTemplates()` |

Scriptor is a desktop app, not an extension, so the realistic scope is
*paste-a-URL* and *paste-HTML* capture plus an optional companion extension that
POSTs to the local daemon (`crates/daemon` already exists). Do not port the
browser plumbing.

---

## 5. obsidian-spaced-repetition (`st3v3nmw/obsidian-spaced-repetition`)

**Purpose.** Flashcards and whole-note review parsed out of plain markdown, with
scheduling state written back inline.

**Card syntax.** Scoped by a `#flashcards` tag (or subtags, which become decks):

- `Question::Answer` — one-directional single line.
- `Question:::Answer` — generates both directions.
- `Question` / `?` / `Answer` — multiline (`??` for reversed multiline).
- Cloze: `==text==` or `{{text}}` or `**text**`, configurable.

**Scheduling state** is appended as an HTML comment so it is invisible in
preview: `<!--SR:!2026-08-20,17,270-->` = `!<dueDate>,<interval days>,<ease>`.
Multiple cards in one block get comma-separated triples.

**Algorithm (SM-2 variant).** Base ease 250; ease is adjusted per review
(`Easy` +20, `Good` 0, `Hard` −20 by default, floored near 130); on lapse the
interval is multiplied by `lapsesIntervalChange` (default 0.5) and the card
returns to the queue; `Easy` applies an `easyBonus` (default 1.3) on top of
`interval × ease/100`; a `maximumInterval` cap (default 36525 days) and a
fuzz/load-balancer spread due dates so daily counts stay even. Note review uses
`linkContribution` — a weighted average of the ease of linked notes, so a note's
initial ease inherits from its graph neighbourhood. That graph-aware
initialization is genuinely novel and Scriptor already has the graph
(`crates/indexer/src/graph.rs`).

**FSRS comparison.** The Free Spaced Repetition Scheduler models memory as
`difficulty`/`stability`/`retrievability` with ~17–21 fitted parameters and
schedules to a target retention rather than a fixed ease ladder; parameters can
be optimized from a user's own review log. It reliably beats SM-2 on review count
for equal retention. Implementations: `ts-fsrs` (npm, MIT) and `fsrs-rs`
(Rust, the crate Anki itself ships). For Scriptor, `fsrs-rs` in a Rust crate is
the correct choice — scheduling belongs next to the review-log store, not in the
webview.

**Extraction candidates.**

| Upstream idea | Scriptor landing site | Interface sketch |
|---|---|---|
| Card parser | new `crates/srs/src/parse.rs` | `pub struct ParsedCard { pub kind: CardKind, pub front: String, pub back: String, pub line: usize, pub sched: Option<SchedState> }` + `pub fn parse_cards(md: &str, tag_scope: &[String]) -> Vec<ParsedCard>`, `CardKind::{Single, Reversed, Multiline, MultilineReversed, Cloze}` |
| Inline sched comment | `crates/srs/src/markdown.rs` | `pub fn parse_sched(comment: &str) -> Vec<SchedState>` / `pub fn render_sched(&[SchedState]) -> String`; keep the `<!--SR:!YYYY-MM-DD,ivl,ease-->` wire format for import compatibility, store richer FSRS state in SQLite |
| FSRS scheduler | `crates/srs/src/schedule.rs` (dep `fsrs`) | `pub struct Scheduler { params: [f32; 21], target_retention: f32 }` + `pub fn review(&self, card: &CardState, rating: Rating, now: DateTime<Utc>) -> CardState`, `Rating::{Again, Hard, Good, Easy}` |
| Review log | `crates/indexer/src/schema.rs` (v5) | `srs_cards(id, note_id, line, hash, due, stability, difficulty, reps, lapses, state)` + `srs_reviews(id, card_id, rating, reviewed_at, elapsed_days)`; the log is what makes later parameter optimization possible |
| Graph-aware seeding | `crates/srs/src/seed.rs` | `pub fn seed_difficulty(cache: &IndexCache, note_id: &str, w: f32) -> f32` reusing `graph::traverse_graph(depth = 1)` — port of `linkContribution` |
| Load balancing | `crates/srs/src/schedule.rs` | `pub fn balance(due: NaiveDate, ivl: f32, load: &DailyLoad) -> NaiveDate` — ±5% fuzz, pick lightest day in window |
| Bridge | new `src/bridge/commands/srs.ts` | `srsDueCards(deck?, limit?)`, `srsReview(cardId, rating: 1\|2\|3\|4): Promise<CardState>`, `srsDecks()`, `srsSyncNote(path): Promise<{ added: number; updated: number; removed: number }>` |
| Review UI | `src/components/srs/ReviewPanel.tsx` | keyboard-first (1–4 ratings, space to reveal); render card bodies through `packages/renderer` so cards get the same markdown pipeline as notes |

Card identity must be content-hash-based (`hash` column, reusing
`crates/indexer/src/hash.rs`), not line-based, or every edit above a card orphans
its schedule. This is the mistake most SRS plugins make.

---

## Peer-feature comparison

### A. Ranking / fuzzy matching

| Dimension | omnisearch | Scriptor today (`search.rs`) | Scriptor `tantivy-indexer` | Best of all worlds |
|---|---|---|---|---|
| Engine | MiniSearch, in-memory | SQLite FTS5, on-disk | tantivy, on-disk | FTS5 now, tantivy behind the same bridge later |
| Field weighting | per-field query boosts (basename ≈10) | none — single `body` column | schema fields, no weights set | multi-column FTS5 + `bm25()` weight vector |
| Fuzzy | `fuzzy: 0.2`, `prefix` on last token | prefix-only (`"term"*`) | none | prefix tier, then trigram/Jaro-Winkler fallback on title+path when hits < limit |
| Boolean syntax | none | AND / OR (`\|`) / NOT (`!`) / phrases | QueryParser | keep Scriptor's — it is strictly better |
| Recency | `mtime` multiplier w/ cutoff | none | none | `rank.rs` post-multiplier; `notes.modified_at` already indexed |
| Diacritics | folded both sides | `unicode61` folds partially | configurable | `tokenize='unicode61 remove_diacritics 2'` — one-line win |
| CJK | char-level fallback via `chsRegex` | broken (whitespace tokenizer) | custom tokenizer available | FTS5 trigram tokenizer for CJK-detected queries, else unicode61 |
| Snippets | densest-line + `<mark>` offsets | `snippet(note_fts, …)` | `SnippetGenerator` | keep FTS5 `snippet()`, add match offsets so React can highlight |
| Non-markdown | delegated extractor plugin w/ hash cache | none | none | `crates/extractor` trait + `extracted_text` cache table |

**Recommendation.** Do not adopt MiniSearch. Scriptor's FTS5 already beats it on
query syntax and memory; it loses only on field weighting, fuzziness, and
recency — all three are additive changes inside `search.rs` plus one new
`rank.rs`. Semantic search via `crates/embeddings` becomes a third tier
(reciprocal-rank fusion of BM25 + vector) once the reranking seam exists.

### B. PDF / EPUB annotation storage

| Dimension | obsidian-annotator | obsidian-clipper (highlights) | Best of all worlds |
|---|---|---|---|
| Store | markdown blocks in the target note | extension-local storage, synced on clip | markdown is source of truth, SQLite mirror for query |
| Payload | `annotation-json` fenced block inside `>%%` comments | selector + offsets JSON | same W3C model for both PDF/EPUB and web |
| Selectors | TextPosition + TextQuote + FragmentSelector (CFI) | CSS selector + text offsets | union enum; add a `CssSelector` variant for web captures |
| Re-anchor | position first, quote fuzzy fallback | offsets, brittle | two-stage: exact position → verify quote → fuzzy prefix/exact/suffix window |
| Deep link | `#annotation-<id>` | none | `#annotation-<id>`, resolvable by `indexerResolveWikilink` |
| Searchable | only as note body text | no | dedicated `annotations` FTS rows (`note_id`, `page`, `exact`, `comment`) |
| Renderer | patched Hypothesis in iframe | in-page overlay | own React overlay on pdf.js/epub.js; no third-party client bundled |

**Recommendation.** Adopt annotator's on-disk format verbatim (import
compatibility with existing Obsidian vaults is free), reject its Hypothesis
client, and add the SQLite mirror so highlights are searchable and graphable.
Reuse the same `Selector` enum for clipper-style web highlights — one anchoring
implementation, three media types.

### C. SRS scheduling

| Dimension | obsidian-spaced-repetition (SM-2) | FSRS (`fsrs-rs` / `ts-fsrs`) | Best of all worlds |
|---|---|---|---|
| Model | ease % ladder, base 250 | difficulty / stability / retrievability | FSRS |
| Params | ~6 hand-tuned settings | 17–21 fitted, optimizable per user | FSRS defaults, optimizer as P2 |
| Target | implicit | explicit `target_retention` | explicit, user-settable |
| Lapse | `interval × 0.5`, ease −20 | stability recomputed from model | FSRS |
| Load balance | fuzz + lightest-day pick | not in core | keep SM-2's balancer as a post-step |
| Graph seeding | `linkContribution` from linked notes | none | keep — Scriptor has the graph already |
| State on disk | `<!--SR:!date,ivl,ease-->` | library-agnostic | legacy comment for portability, FSRS state in `srs_cards` |

**Recommendation.** `fsrs-rs` in `crates/srs`, SM-2's markdown syntax and inline
comment for compatibility, SM-2's load balancer and `linkContribution` seeding as
Scriptor-specific additions. Never implement SM-2 itself.

### D. External metadata provider abstraction

| Dimension | media-db `APIManager`/`APIModel` | Scriptor `ZoteroConnector` | clipper (`schema:`/`meta:`) | Best of all worlds |
|---|---|---|---|---|
| Shape | interface + registry, fan-out by media type | single concrete class | page-scraping variable resolver | media-db's registry |
| Two-phase | `searchByTitle` then `getById` | `search` then item fetch | single pass | two-phase (cheap list, lazy detail) |
| Normalization | `MediaTypeModel.toMetaDataObject()` | ad-hoc mapping in caller | filter pipeline | one `toFrontmatter(record)` normalizer |
| Auth | keys in plugin settings (webview) | key in webview | none | keys in Rust; TS providers call a Tauri command |
| Templates | per-type template + `{{ }}` | none | rich filter pipeline | clipper's filters over media-db's records |
| Failure mode | per-provider try/catch, partial results | throws | n/a | `Promise.allSettled` fan-out, partial results + per-provider errors |

**Recommendation.** Build `packages/metadata-providers` with media-db's
`MetadataProvider` + `MetadataRegistry`, wrap the existing `ZoteroConnector` as
the first implementation (proves the seam without a rewrite), normalize through a
single `toFrontmatter`, and render with clipper's filter pipeline. All HTTP goes
through one Rust `metadata_provider_request` command so API keys never enter the
webview.

---

## Prioritized backlog

Effort: S ≈ ≤1 day, M ≈ 2–4 days, L ≈ 1–2 weeks, XL ≈ >2 weeks. Estimates
include tests, since `crates/indexer` already carries integration tests.

### P0 — high value, low risk, no new surface

| # | Item | Files | Effort |
|---|---|---|---|
| 1 | Diacritics folding: `tokenize='unicode61 remove_diacritics 2'` | `crates/indexer/src/schema.rs`, `migration.rs` (v5) | S |
| 2 | Multi-column FTS5 (`title`, `aliases`, `headings`, `tags`, `body`) + weighted `bm25()` | `schema.rs`, `notes.rs`, `search.rs`, `parse.rs` | M |
| 3 | `rank.rs` post-scoring: recency decay, path-only penalty, title boost; expose `score` on `SearchHit` | new `crates/indexer/src/rank.rs`, `search.rs` | M |
| 4 | `indexerSearchRanked` bridge + typed opts; keep `indexerSearch` as a shim | `src/bridge/commands/indexer.ts`, `src/types/vault.ts` | S |
| 5 | Fuzzy fallback tier on title/path when exact hits < limit | `crates/indexer/src/search.rs` | M |
| 6 | `MetadataProvider` / `MetadataRegistry` + `ZoteroProvider` adapter | new `packages/metadata-providers`, `packages/zotero-connector/src/index.ts` | M |
| 7 | Clipper filter pipeline as a standalone module (immediately useful to `TemplatePicker`) | new `packages/core/src/template/filters.ts` | M |

### P1 — new capability, contained blast radius

| # | Item | Files | Effort |
|---|---|---|---|
| 8 | `crates/annotations`: `Selector` enum, two-stage `anchor()`, markdown round-trip (annotator-compatible) | new crate | L |
| 9 | `annotations` table + FTS mirror; index `annotation-target` frontmatter | `crates/indexer/src/schema.rs` (v5), `parse.rs` | M |
| 10 | `src/bridge/commands/annotations.ts` + `ReaderPanel.tsx` (pdf.js/epub.js, own overlay) | bridge + `src/components/reader/` | L |
| 11 | `crates/srs`: card parser, `<!--SR:-->` round-trip, `fsrs-rs` scheduler, hash-based identity | new crate | L |
| 12 | `srs_cards` / `srs_reviews` tables, `srsSyncNote` on index update | `crates/indexer`, `rebuild.rs` | M |
| 13 | `ReviewPanel.tsx` keyboard-first review over `packages/renderer` | `src/components/srs/` | M |
| 14 | `crates/extractor` trait + `extracted_text(path, hash, text)` cache; PDF text first | new crate, `rebuild.rs` | L |
| 15 | Capture: `html_to_markdown` + `CaptureTemplate` schema + `captureFromUrl/Html` | `crates/capture`, `packages/core/src/template/`, `src/bridge/commands/capture.ts` | L |

### P2 — bigger bets, defer until P0/P1 land

| # | Item | Files | Effort |
|---|---|---|---|
| 16 | CJK: trigram tokenizer path selected by script detection | `crates/indexer/src/{schema,search}.rs` | M |
| 17 | Hybrid retrieval: reciprocal-rank fusion of BM25 + `crates/embeddings` vectors behind `rank.rs` | `crates/indexer/src/rank.rs`, `crates/embeddings` | L |
| 18 | Concrete media providers (OMDb, Open Library, MusicBrainz, TMDB) + `metadata_provider_request` Rust command with keyring-backed secrets | `packages/metadata-providers/src/providers/`, new Tauri command | L |
| 19 | OCR extraction (tesseract) for images behind the `TextExtractor` trait | `crates/extractor` | L |
| 20 | FSRS parameter optimizer over `srs_reviews` | `crates/srs/src/optimize.rs` | L |
| 21 | Migrate ranked search to `crates/tantivy-indexer` if field weighting proves insufficient; bridge signature unchanged | `crates/tantivy-indexer`, `crates/indexer/src/search.rs` | XL |
| 22 | Companion browser extension POSTing to `crates/daemon` for one-click web capture | `crates/daemon`, new extension package | XL |
| 23 | Web-highlight support reusing `crates/annotations` selectors (`CssSelector` variant) | `crates/annotations`, capture pipeline | M |

### Sequencing notes

- Items 1–3 share one schema migration (v4 → v5); land them together to avoid two
  rebuild-forcing releases. Items 9 and 12 can join the same migration if
  scheduled in the same cycle.
- Item 4 must precede any React consumption of ranking so the UI never binds to
  the unranked `SearchHit` shape.
- Item 8 is a prerequisite for both 10 and 23; build the selector/anchor crate
  before either reader or capture UI.
- Item 14's `extracted_text` cache is what makes 19 cheap, and it is also what
  lets PDFs participate in item 2's multi-column index.
- Item 6 before 18: prove the abstraction against `ZoteroConnector` (real,
  already-shipping code) before adding providers that need secret management.
