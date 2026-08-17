# Upstream Research — Sync / Git / Publish / Export Cluster

Scope: `obsidian-git`, `obsidian-livesync`, `obsidian-digital-garden`, `obsidian-clipper`, `better-export-pdf`, `obsidian-encrypt`.
Target: Scriptor (Tauri v2 + React 19 + Rust monorepo, `D:\GitHub\Scriptor`).

## Scriptor baseline (grounded)

| Area | Current state | Files |
| --- | --- | --- |
| Git | `git` CLI subprocess adapter. `git_status` (porcelain=1 -uall, ahead/behind, rename detection, conflict flags), `git_commit_selected`, `git_pull` (**`--ff-only` only**), `git_push`, `git_resolve_conflict` (ours/theirs), `git_apply_merged_conflict`, `git_show_head_file`, `git_show_merge_base_file`, `read_conflict_markers`. No fetch, no clone, no stage/unstage, no history/log, no line authoring, no auto-sync timers, no credential storage. | `crates/native-git/src/{status,sync,conflict,error}.rs`, `apps/desktop/src-tauri/src/commands/git.rs` (9 commands), `src/bridge/commands/git.ts`, `src/hooks/useWorkspaceGit.ts`, `src/components/{GitPanel,GitDiffPreview}.tsx` |
| Export | Pandoc subprocess with hash-pinned binary discovery, strict arg allowlist, path-confinement for `--css/--bibliography/--csl/--reference-doc/--template`, mermaid/plantuml preprocess, cancel slot, progress events, artifact validation, JSONL export log w/ slow-export counting. Formats: html, pdf, docx, latex, epub (+`wechat-html` in TS contract). | `crates/export-runner/src/*`, `packages/core/src/contracts/export.ts`, `src/hooks/useWorkspaceExport.ts`, `src/components/{PublishCenter,ExportPreflightPreview,ExportPrintPreview}.tsx` |
| Publish | `vault_publish_starlight` — copies every scanned note into `src/content/docs/`, writes a stub `astro.config.mjs` + `package.json`. No frontmatter gating, no asset rewriting, no diff/changed-set detection, no deploy. | `apps/desktop/src-tauri/src/commands/code_chunk.rs:167-223` |
| Encryption | `SENC` envelope: magic(4) + version(1) + alg(1=AES-256-GCM) + kdf(1=Argon2id) + salt(16) + nonce(12) + key_id(4), tag 16. Argon2id m=64MiB t=3 p=4. `DerivedKey` zeroized on drop. Whole-file only — no per-note inline encryption, no session password cache. | `crates/vault/src/encryption.rs` |
| CRDT | Hand-rolled LWW op-log CRDT for canvas only (`CanvasCrdtOp`, `CanvasCrdtSync`, `mergeCrdtOps`). No text CRDT, no Yjs/Automerge/Loro dependency anywhere. | `packages/canvas/src/crdt-sync.ts` |
| Web capture | **None.** No turndown, no Readability, no Defuddle, no clipper surface. | — |

---

## 1. Vinzent03/obsidian-git

**Purpose.** Version-control an Obsidian vault from inside the app: staged commits, auto-backup, auto-pull, history/diff, conflict resolution, line authoring. MIT, TypeScript.

**Standout architecture.** A `GitManager` abstract base with two interchangeable backends — `SimpleGitManager` (spawns the system `git` binary; desktop only) and `IsomorphicGitManager` (pure-JS `isomorphic-git` over Obsidian's `DataAdapter`; the only backend that works on mobile). Every UI surface talks to the abstract type, so mobile support is a backend swap rather than a feature fork. Around it sits a small scheduler layer of debounced/interval "automatics" (auto-commit-and-sync, auto-pull, auto-push) that are *paused while the vault is dirty in the editor* and re-armed on save, plus a `LineAuthoringFeature` CodeMirror 6 extension that decorates each visible line with `git blame` author/date gutter info, computed incrementally and cached per-blob.

**Modules worth extracting**

| Upstream | What it does | Becomes in Scriptor |
| --- | --- | --- |
| `src/gitManager/gitManager.ts` (abstract) + `simpleGit.ts` / `isomorphicGit.ts` | Backend-agnostic git surface | `crates/native-git/src/backend.rs` — `trait GitBackend` with `CliBackend` (today's `run_git`) and a future `Gix2Backend` (`gix` crate) for a no-external-binary path. Keeps `git_*` fns as thin free functions over `&dyn GitBackend`. |
| `src/promiseQueue.ts` | Serializes all git mutations so overlapping auto-jobs can't interleave | `crates/native-git/src/queue.rs` — `struct GitQueue { tx: mpsc::Sender<GitJob> }`, one worker thread per repo root. Fixes a real Scriptor bug: `useWorkspaceGit` guards with a single `isGitMutationBusy` boolean per hook instance, not per repo. |
| `src/ui/history/*`, `src/ui/diff/diffView.ts` | Commit log tree + side-by-side diff of any blob pair | `crates/native-git/src/history.rs` — `git_log(repo, GitLogQuery { path, limit, since }) -> Vec<GitCommit>`; `git_show_blob(repo, oid, path)`. Frontend `src/components/GitHistoryPanel.tsx` reusing existing `GitDiffPreview`. |
| `src/lineAuthor/*` | Incremental blame gutter | `crates/native-git/src/blame.rs` — `git_blame(repo, path) -> Vec<BlameHunk { start_line, line_count, oid, author, time_unix, summary }>`; CM6 gutter in `packages/editor/src/extensions/blameGutter.ts`. |
| `src/setting/settings.ts` auto-* fields | Timer config incl. "commit message template" with `{{date}}`/`{{hostname}}`/`{{numFiles}}`/`{{files}}` placeholders | `crates/native-git/src/autosync.rs` + `packages/core/src/contracts/git.ts::GitAutoSyncConfig`. Scriptor already renders commit templates in `GitPanel.tsx:246` — this gives them variables. |
| `.gitignore`-aware status + submodule recursion | Avoids committing `.obsidian/workspace.json`-class churn | `crates/native-git/src/ignore.rs` — bootstrap a Scriptor-aware `.gitignore` (`.scriptor/cache`, `target/`, `exports/`) on `git_init`. |

**Conflict resolution.** Detection is `status` unmerged-stage parsing (same as Scriptor's porcelain `conflict` flag). Resolution is deliberately shallow: it lists conflicted files, opens each so the user edits `<<<<<<<`/`=======`/`>>>>>>>` markers by hand, then `git add`. There is no three-way merge UI. **Scriptor is already ahead here** (`git_show_merge_base_file` + `git_apply_merged_conflict` = a real 3-way base/ours/theirs surface).

**Weaknesses.** `--ff-only` vs merge vs rebase is a global setting and mis-set values produce confusing failures; isomorphic-git backend is markedly slower on large vaults and has partial support (no submodules, weak SSH); binary/large-file handling is poor; credentials rely on the OS git credential helper on desktop and plaintext-ish settings on mobile.

---

## 2. vrtmrz/obsidian-livesync

**Purpose.** Self-hosted, end-to-end-encrypted, multi-device live replication of a vault via CouchDB (or an object-storage/S3 backend), designed for continuous sync rather than commit-and-push. MIT, TypeScript.

**Standout architecture — four ideas that matter more than the CouchDB choice:**

1. **Content-addressed chunking.** A note is not stored as one document. It is split into content-defined chunks; each chunk becomes its own database document keyed by a hash of its content, and the note document holds an ordered list of chunk ids (`children`). Consequences: unchanged chunks are never re-uploaded, chunks dedupe across the whole vault, and the sync delta for a one-line edit in a 200 KB note is one chunk. Chunk size is adaptive ("V2 chunking" / `useSegmenter`) because CouchDB penalizes both very small and very large docs.
2. **Replication as the transport, revisions as the truth.** PouchDB's `changes()` feed drives a local event pipeline; every doc carries a `_rev` chain, so "conflict" is a first-class database state (two leaf revisions), not a filesystem accident. This is the key structural difference from git: conflicts are detected *per document at write time*, not discovered at merge time.
3. **E2EE envelope applied per-chunk, path included.** Both chunk bodies and *file paths* are encrypted (obfuscated path mode), so the remote CouchDB operator learns neither content nor vault structure. Passphrase → key derivation, per-document nonce, and a versioned envelope so old vaults keep decrypting after the crypto is upgraded.
4. **Conflict surface with an actual merge.** `conflictResolve`/`diffAndPatch` fetches both leaf revisions plus their common ancestor and runs a **line-level three-way merge (diff-match-patch)**. If the merge is clean it commits the merged doc and deletes the losing revision; if not, a "Resolve conflict" dialog shows a per-line diff and lets the user pick a side or accept the merge. There are also sentinel modes: `Newer` (LWW by mtime), `Older`, and "even if conflicted, keep both as `filename.conflicted.md`". Recent versions add a "Doctor"/self-check pass that detects corrupted chunk trees and missing chunks and repairs or re-uploads them.

**Modules worth extracting**

| Upstream concept | Becomes in Scriptor |
| --- | --- |
| Chunked content-addressed store | `crates/vault/src/chunkstore.rs` — `fn split_chunks(bytes: &[u8]) -> Vec<Chunk { hash: [u8;32], data: Vec<u8> }>` (FastCDC), `struct NoteManifest { path: String, chunks: Vec<Hash>, mtime_ms: u64, size: u64 }`. Reuses the existing `crates/vault/src/hash.rs`. Immediately useful *offline* too: it makes incremental backup (`commands/backup.rs`) and remote push O(delta). |
| `diffAndPatch` 3-way line merge | `crates/native-git/src/merge3.rs` — `fn merge3(base: &str, ours: &str, theirs: &str) -> Merge3Result { merged: String, conflicts: Vec<ConflictHunk> }` (crate `diffy` or `similar`). Wire into the *existing* `git_show_merge_base_file` path so Scriptor's conflict panel can offer "auto-merge" before falling back to manual. This is the single highest-value extraction in the whole cluster. |
| Conflict resolution policy enum | `packages/core/src/contracts/sync.ts` — `type ConflictPolicy = 'manual' \| 'auto-merge' \| 'newer' \| 'older' \| 'keep-both'`; `keep-both` writes `name.conflicted.md` via `crates/vault/src/rename_transaction.rs`. |
| Per-chunk E2EE with versioned envelope + path obfuscation | Extend `crates/vault/src/encryption.rs`: bump `VERSION` to 2, add `ALGORITHM_XCHACHA20POLY1305 = 2`, add `fn encrypt_chunk(&self, key, chunk_hash, data)` using the chunk hash as AAD, and `fn obfuscate_path(&self, key, path) -> String` (HMAC-SHA256 → base32). The existing header already reserves `version`/`algorithm`/`key_id` bytes — no format break. |
| "Doctor" / self-check | `crates/vault/src/diagnostics.rs` (exists) — add `fn verify_chunk_integrity(vault) -> Vec<ChunkDefect>`. |
| Replication event pipeline | `crates/daemon` — `SyncEngine` actor emitting `sync:progress`/`sync:conflict` Tauri events, mirroring the existing `export:*` event pattern in `src/bridge/exportEvents.ts`. |

**Weaknesses.** Operationally heavy — the user must run and secure CouchDB; setup is the #1 complaint. E2EE passphrase changes require a full vault re-upload. Chunk-tree corruption historically produced silent data loss (hence "Doctor"). Very large binary attachments still sync badly. No history: it is replication, not version control — a bad edit propagates instantly with no `git revert`.

---

## 3. oleeskild/obsidian-digital-garden

**Purpose.** Publish a *selected subset* of a vault as a public static site by committing rendered content through the GitHub REST API into a user-owned template repo, which Vercel/Netlify then builds. MIT, TypeScript.

**Standout architecture.** No local build step, no CLI dependency: the plugin is a **GitHub content-API client**. Each note is rendered, base64-encoded, and `PUT /repos/{owner}/{repo}/contents/{path}` with the current blob `sha` (read first via `GET`) — publishing is an idempotent upsert against the remote tree. Eligibility is per-note frontmatter (`dg-publish: true`, plus `dg-home`, `dg-permalink`, `dg-hide`, `dg-pinned`, `dg-metatags`). Its best idea is the **Publication Center**: hash the remote tree, hash each local publishable note, and render four buckets — *unchanged / changed / new / orphaned (remote-only)* — with per-item and bulk actions. That diff-first model is exactly what `vault_publish_starlight` lacks.

Its compiler (`Publisher` + `GardenPageCompiler`) does transform work Scriptor needs regardless of target: rewrite `[[wikilinks]]` to site-relative links (resolving aliases and heading anchors), inline transclusions (`![[note]]`, `![[note#heading]]`), convert `![[image.png]]` to a published asset path while uploading the binary separately, strip links to unpublished notes so the site has no dead ends, and rewrite callouts/dataview blocks into renderable output.

**Modules worth extracting**

| Upstream | Becomes in Scriptor |
| --- | --- |
| `src/publisher/Publisher.ts` | **New crate** `crates/publish-runner` (sibling of `export-runner`) — `struct PublishPlan { unchanged: Vec<PublishItem>, changed: Vec<PublishItem>, new_items: Vec<PublishItem>, orphaned: Vec<String> }`; `fn plan_publish(vault: &VaultRoot, cfg: &PublishConfig) -> Result<PublishPlan, PublishError>`; `fn apply_publish(plan: &PublishPlan, sink: &dyn PublishSink, cancel: Option<&ExportCancelSlot>) -> Result<PublishReport, PublishError>`. |
| `src/publisher/GardenPageCompiler.ts` | `crates/publish-runner/src/compile.rs` — `fn compile_note(md: &str, ctx: &CompileCtx) -> CompiledNote { markdown: String, assets: Vec<AssetRef>, warnings: Vec<String> }`. Reuse existing `crates/vault/src/link_rewrite.rs` for the wikilink pass instead of writing a second resolver. |
| `src/views/PublicationCenter*`, `src/repositoryConnection/*` | `src/components/PublishCenter.tsx` gains a `PublishDiffView` tab fed by a `publish_plan` command; remote-tree hashing lives in `crates/publish-runner/src/sink/github.rs`. |
| `dg-*` frontmatter contract | `packages/core/src/contracts/publish.ts` — `interface PublishFrontmatter { publish?: boolean; permalink?: string; hide?: boolean; pinned?: boolean; home?: boolean; metatags?: Record<string, string> }`, read via existing `crates/vault/src/frontmatter_ops.rs`. Namespace as `scriptor-publish:` but **also accept `dg-publish`** so Obsidian imports (`crates/vault/src/importers/obsidian.rs`) keep working. |
| Sink abstraction (implicit upstream, explicit here) | `trait PublishSink { fn existing_tree(&self) -> Result<BTreeMap<String, String>>; fn put(&self, path: &str, bytes: &[u8]) -> Result<()>; fn delete(&self, path: &str) -> Result<()>; }` with `LocalDirSink` (rewrite of today's Starlight command), `GitSink` (commit via `native-git`, no PAT needed), `GithubApiSink`. Ship `LocalDirSink` + `GitSink` first — neither needs a credential surface. |

**Weaknesses.** Requires a GitHub PAT with `repo` scope stored in plugin settings as plain text — a non-starter for Scriptor without OS keychain. One HTTP request per file makes large publishes slow and rate-limit-prone. Template-repo drift is the top issue category. Dataview/plugin-rendered content only partially survives compilation.

---

## 4. obsidianmd/obsidian-clipper

**Purpose.** Official browser extension (Chromium / Firefox / Safari, incl. iOS) that captures a web page as durable Markdown into a vault, driven by user-authored templates. MIT, TypeScript; verified source tree below.

**Standout architecture — a three-stage pipeline, each stage independently reusable:**

1. **Extract** — `src/utils/content-extractor.ts` delegates to the `defuddle` library, which does both Readability-style main-content isolation *and* HTML→Markdown conversion, with `DOMPurify` sanitizing first and `src/utils/flatten-shadow-dom.ts` pulling shadow-root content into the main tree before extraction. Structured metadata (schema.org / JSON-LD, OpenGraph, `<meta>`) is harvested into a flat variable namespace inspected via `src/managers/inspect-variables.ts`.
2. **Template** — a full little language, not string interpolation. `src/utils/template.ts` + `src/utils/parser.ts` + `src/utils/renderer.ts` support `{{variable}}`, `{{selector:.css-sel}}`, `{{schema:@Article:author}}`, `if/for` blocks (added 1.1.0), and a **filter pipeline** `{{content|strip_md|split:"\n"|map:...|join}}`. The filter set is one file per filter with a colocated test — verified 50+ filters including `blockquote`, `callout`, `footnote`, `wikilink`, `table`, `html_to_json`, `safe_name`, `date`/`date_modify`, `number_format`, `fragment_link`, `strip_attr`, `remove_tags`, `nth`, `calc`. Templates are matched to pages by URL pattern and stored lz-string-compressed in extension storage.
3. **Write** — `src/utils/obsidian-note-creator.ts` builds the note + frontmatter properties (typed via `src/managers/property-types-manager.ts`) and hands off through the `obsidian://` URI. `src/utils/interpreter.ts` is an optional LLM pass that fills template fields from a natural-language prompt against the extracted page.

Also notable: `src/utils/highlighter.ts` + `highlighter-overlays.ts` (persistent, anchor-based page highlights that survive reload and become the clipped excerpt), `src/core/reader-view.ts` + `reader-script.ts` (a distraction-free reader mode reusing the same extraction), and `src/cli.ts` — a **headless CLI entry point over the same pipeline**, which is precisely the shape Scriptor needs.

**Modules worth extracting**

| Upstream | Becomes in Scriptor |
| --- | --- |
| `src/utils/{parser,renderer,template}.ts` + `src/utils/filters/*` | **New package** `packages/template-engine` — `renderTemplate(source: string, vars: VariableBag, filters?: FilterRegistry): string`, `registerFilter(name, fn: (input: unknown, args: string[]) => unknown)`. Port the filter set 1:1 with its tests; this engine is not clipper-specific and should also back export templates, note templates, and `GitAutoSyncConfig` commit-message templates (unifying three ad-hoc interpolation sites). |
| `src/utils/content-extractor.ts` + `defuddle` | `crates/web-clip/src/extract.rs` — `fn extract_article(html: &str, base_url: &Url) -> Article { title, byline, published, site_name, content_html, lang }` using `readability` + `ammonia` (sanitize) + `scraper`. Rust keeps the network/HTML parsing out of the renderer process. |
| HTML→Markdown with custom rules | `crates/web-clip/src/to_markdown.rs` — `fn html_to_markdown(html: &str, opts: &MdOptions) -> String` (`htmd`), with rules for math (`\(..\)` → `$..$`), fenced code with language detection, GFM tables, and footnotes — matching clipper's turndown rule set. |
| `src/utils/obsidian-note-creator.ts` + `property-types-manager.ts` | `crates/web-clip/src/note.rs` — `fn build_clip_note(article, template, props) -> ClipNote { relative_path, frontmatter: BTreeMap<String, Value>, body }`, written through existing `crates/vault/src/{fs,frontmatter_ops}.rs`. |
| `src/cli.ts` | `crates/cli` subcommand `scriptor clip <url> [--template t]`, reusing the same crate — gives clipping without shipping a browser extension. |
| `src/utils/highlighter.ts` | `packages/portal` (already exists) — optional browser-side highlight overlay posting to the local daemon, deferred to P2. |

**Ingest boundary.** Do **not** copy the `obsidian://` URI mechanism. Scriptor already runs a local daemon (`crates/daemon`) and an authorization gate (`apps/desktop/src-tauri/src/authorization.rs`, `SensitiveOperation`); a browser extension should POST to a loopback daemon endpoint guarded by a per-install token and a new `SensitiveOperation::WebClip`. URI handlers are a shell-injection-adjacent surface Scriptor has so far avoided.

**Weaknesses.** Templates live in browser storage, not the vault, so they are not versioned with the notes. The filter pipeline has no static typing across stages — errors surface as empty strings. The interpreter sends page content to a third-party LLM. Extraction quality is only as good as `defuddle` on hostile/SPA pages.

---

## 5. l1xnan/obsidian-better-export-pdf

**Purpose.** Produce print-quality PDFs from Obsidian notes with real pagination control, a table of contents, PDF outline bookmarks, and headers/footers — replacing Obsidian's minimal built-in PDF export. Verified source tree: `src/{main.ts, pdf.ts, render.ts, modal.ts, setting.ts, constant.ts, type.d.ts}`, `src/utils/{index.ts, mutex.ts, pageSize.ts, renderStates.ts}`, `src/components/{ModalUI.svelte, ExportSettings.svelte, PdfPreview.svelte, PdfPreviewV2.svelte, Switch.svelte}`, `src/actions/`, `src/i18n/`. MIT, TypeScript + Svelte.

**Standout architecture.** It does **not** go through a markdown→LaTeX→PDF pipeline. It renders the note with the app's own preview renderer into a hidden document, waits for asynchronous render completion (`src/utils/renderStates.ts` polls until embeds, math, and diagrams have settled — the single most-underestimated correctness detail in HTML-based PDF export), then calls Electron `webContents.printToPDF` with an explicit `PageSize`/margin/scale/landscape config from `src/utils/pageSize.ts`. Post-processing in `src/pdf.ts` re-opens the produced PDF with `pdf-lib` to **inject an outline/bookmark tree derived from the heading structure** and to fix internal-link destinations so `[[wikilinks]]` become intra-PDF page jumps. `src/utils/mutex.ts` serializes export jobs because two concurrent `printToPDF` calls corrupt output. Per-note frontmatter overrides the global settings, and a live `PdfPreview` shows paginated output before committing.

**Why this matters for Scriptor.** Scriptor's PDF path is Pandoc-only, which means a LaTeX engine dependency and a rendering model that diverges from what the user sees in preview. Scriptor already has `ExportPrintPreview.tsx` and `supportsPrintPagePreview` in `@scriptor/export` — the WebView-based route is half-built and is the natural second PDF backend.

**Modules worth extracting**

| Upstream | Becomes in Scriptor |
| --- | --- |
| `src/utils/renderStates.ts` | `packages/export/src/renderSettled.ts` — `awaitRenderSettled(root: HTMLElement, opts?: { timeoutMs?: number }): Promise<void>`, resolving when MathJax/KaTeX, mermaid, plantuml, images and lazy embeds have all completed. Must gate any print-to-PDF path. |
| `src/utils/pageSize.ts`, `src/setting.ts` | `packages/core/src/contracts/export.ts` — extend `ExportProfile` with `page?: { size: 'A4' \| 'Letter' \| 'Legal' \| { widthMm: number; heightMm: number }; marginsMm: [number, number, number, number]; landscape?: boolean; scale?: number; printBackground?: boolean }`. Frontmatter per note can override. |
| `printToPDF` invocation | `crates/export-runner/src/webview_pdf.rs` — `fn export_pdf_via_webview(html: &Path, out: &Path, page: &PageConfig) -> Result<(), ExportError>`, implemented against Tauri v2's WebView print API with a headless Chromium fallback. Registered as `ExportFormat::Pdf` **backend = `webview`**, alongside `backend = 'pandoc'`. |
| `src/pdf.ts` outline injection | `crates/export-runner/src/pdf_outline.rs` — `fn inject_outline(pdf: &Path, headings: &[OutlineEntry { level: u8, title: String, page: u16, y: f32 }]) -> Result<(), ExportError>` via the `lopdf` crate; plus `fn rewrite_internal_links(pdf, anchors: &BTreeMap<String, PdfDest>)`. Works for the Pandoc backend too. |
| `src/utils/mutex.ts` | Already covered by `crates/export-runner/src/cancel.rs`' slot pattern; add a single-flight guard so two PDF jobs can't share a WebView. |
| Header/footer templates | `PageConfig.headerTemplate/footerTemplate: Option<String>` rendered with the new `packages/template-engine` (`{{page}}`, `{{pages}}`, `{{title}}`, `{{date}}`). |
| `ExportSettings.svelte` + `PdfPreview.svelte` | Fold into existing `src/components/ExportPrintPreview.tsx` — add page-size/margin controls and a page-count indicator. No new panel. |

**Weaknesses.** Electron-specific (`printToPDF` is not a web standard), so the technique needs a Tauri-side equivalent rather than a port. Fragile against theme CSS: `break-inside`/`break-after` behaviour differs from screen layout and wide tables/code blocks overflow. Slow on very long notes. The rendered-DOM dependency means CSS regressions silently change PDF output — argues for golden-file PDF tests (`e2e/` + `playwright.visual.config.ts` already exist).

---

## 6. meld-cp/obsidian-encrypt (Meld Encrypt)

**Purpose.** Password-protect note content inside an otherwise plaintext vault, in two modes: whole-file encrypted notes (`.encrypted` / dedicated file type) and **in-place inline encryption** of a selected region within an ordinary markdown note. MIT, TypeScript.

**Standout architecture.** Three ideas Scriptor's whole-file-only `SENC` design does not have:

1. **Versioned crypto with a decode chain.** Multiple implementations coexist (`CryptoHelperV2`/`V3`-style), each with its own KDF and parameter set; the file records which version wrote it and decryption dispatches on that, so old vaults keep opening after a parameter upgrade. Scriptor's header already carries a `version` byte but has exactly one implementation and no dispatch table — the extensibility is declared but unbuilt.
2. **Inline encrypted markers.** Encrypted content is stored as a self-describing inline token (`%%🔐 <hint> <base64-payload> 🔐%%`), so a single note can mix public and private text, remain valid markdown, and stay diffable/syncable by git — the ciphertext is one line-stable blob. The stored **hint** is what makes multi-password vaults usable.
3. **Decrypt-in-modal editing.** Plaintext is only ever materialized in a modal editor and re-encrypted on close; it is never written back to disk in the clear, and there is a session-scoped password cache (with a "remember for this session" toggle) so the user is not prompted per block.

**Modules worth extracting**

| Upstream | Becomes in Scriptor |
| --- | --- |
| `CryptoHelper*` version dispatch | `crates/vault/src/encryption.rs` — add `enum EnvelopeVersion { V1Aes256GcmArgon2id, V2XChaCha20Poly1305Argon2id }` and `fn decrypt_any(bytes: &[u8], passphrase: &str) -> Result<Vec<u8>, EncryptionError>` that reads the version byte and dispatches. Keep V1 write support until a migration command exists. |
| Inline marker format | **New module** `crates/vault/src/inline_encrypt.rs` — `struct InlineSecret { hint: Option<String>, envelope: Vec<u8>, span: Range<usize> }`; `fn find_inline_secrets(md: &str) -> Vec<InlineSecret>`; `fn seal_inline(plaintext: &str, hint: Option<&str>, key: &DerivedKey) -> String`; `fn open_inline(secret: &InlineSecret, key: &DerivedKey) -> Result<String, EncryptionError>`. Encode as `%%scriptor-enc:v2:<hint-b64>:<payload-b64>%%` — ASCII-only (no emoji delimiters) so it survives Pandoc, git diff, and Windows codepages. |
| Session password cache | `crates/vault/src/key_session.rs` — `struct KeySession { entries: HashMap<KeyId, DerivedKey>, ttl: Duration, last_used: Instant }` living in `AppState`, zeroized on timeout/lock/app-blur. Gate every open through the existing `SensitiveOperation` authorization path (add `SensitiveOperation::DecryptContent`). |
| Decrypt-in-modal flow | `src/components/InlineSecretModal.tsx` + a CM6 decoration in `packages/editor/src/extensions/inlineSecret.ts` rendering sealed regions as a lock chip with the hint; plaintext held only in component state, never in the document until explicitly re-sealed. |

**Interaction with export and publish (important).** Inline secrets must be treated as first-class by the other pipelines: `crates/export-runner` must **refuse** to export a note containing unopened secrets unless `--redact-secrets` is passed (replacing each with `[redacted]`), and `crates/publish-runner::compile_note` must hard-fail on any sealed region — silently publishing ciphertext, or worse decrypting during publish, is the failure mode that ends trust in the feature. Add this to `docs/ENCRYPTION-THREAT-MODEL.md`.

**Weaknesses.** Password loss is unrecoverable and users do lose data; there is no key escrow or recovery code. Encrypted content is invisible to search and indexing (Scriptor's `tantivy-indexer` will be blind to it — accept and document, do not index plaintext). No forward secrecy or per-note key rotation. Emoji-delimited markers have historically been mangled by other tooling.

---

## 7. Peer-feature comparison

### 7.1 Sync and conflict handling

| Dimension | obsidian-git | obsidian-livesync | digital-garden | Scriptor today | Best of all worlds |
| --- | --- | --- | --- | --- | --- |
| Transport | git remote (push/pull) | CouchDB/S3 continuous replication | GitHub content API | git remote, `--ff-only` pull | **git as the source of truth** + chunked delta transport for non-git remotes |
| Granularity | whole file, whole commit | content-defined chunks | whole file | whole file | chunked (`chunkstore.rs`) for transport + backup; git objects for history |
| Latency | seconds–minutes (timer) | sub-second (live) | manual | manual only | manual + optional debounced auto-sync (30 s idle default, off by default) |
| Conflict detection | at merge time, porcelain unmerged stages | at write time, two `_rev` leaves | none (last write wins remotely) | at merge time (already correct) | keep git detection; add mtime/hash pre-flight so the user is warned *before* pulling |
| Conflict resolution | manual marker editing only | 3-way `diff-match-patch` auto-merge, then per-line dialog, plus `newer`/`older`/`keep-both` | n/a | ours / theirs / manual merged buffer, with true merge-base available | **3-way auto-merge first** (`merge3.rs`), fall back to Scriptor's existing base/ours/theirs panel, offer `keep-both` (`name.conflicted.md`) as the never-lose-data escape hatch |
| History | full git log + blame + diff | none | none | none | git log + blame (from obsidian-git) |
| E2EE | no (relies on remote) | per-chunk, path obfuscation, versioned | no | whole-file `SENC` only | versioned envelope reused for chunks and inline secrets |
| Mobile story | isomorphic-git backend | first-class | n/a | n/a (`src/mobile` exists) | `trait GitBackend` + `gix` so mobile needs no external binary |
| Ops burden | low (any git host) | high (self-host CouchDB) | medium (PAT + template repo) | low | **stay low — do not ship a server** |

### 7.2 CRDT vs git — recommendation

**Do not replace git with a CRDT.** The reasoning, specific to Scriptor:

- Scriptor's value proposition is plain markdown files on disk. A text CRDT requires per-document oplog state alongside every file; that state is the real database and the `.md` file degrades into a projection. Every external editor write then becomes an out-of-band mutation the CRDT cannot attribute, which is exactly livesync's chunk-corruption failure class.
- Git gives history, blame, revert, signed commits, and a hosting ecosystem for free. A CRDT gives none of these; livesync's total absence of history is a direct consequence.
- CRDT convergence is not semantic correctness. Two devices editing the same markdown table converge to a syntactically merged but semantically broken table. A 3-way merge that *declares a conflict* is the safer default for prose and structured markdown.
- The real user pain is not "simultaneous typing on one paragraph" — it is "two devices edited different notes and one had an unpushed commit". A 3-way line merge plus `keep-both` resolves ~95% of that without any CRDT.

**Where a CRDT does earn its place:** live multi-cursor collaboration on a single open document, and structured non-text documents. Scriptor already has the latter (`packages/canvas/src/crdt-sync.ts`, LWW op-log) and that is the right boundary. If live text collaboration is ever prioritized, use a **session-scoped** CRDT (Loro or Yjs in a WASM worker under `crates/wasm-runtime`) that exists only while a shared session is open and commits a normal file + git commit on session end — the CRDT is transport, never storage.

**So the strategy is: git for history and truth, chunked content-addressed deltas for efficient transport and backup, 3-way merge for conflicts, CRDT confined to live sessions and canvas.**

### 7.3 Publish and export

| Dimension | digital-garden | better-export-pdf | clipper | Scriptor today | Best of all worlds |
| --- | --- | --- | --- | --- | --- |
| Selection | `dg-publish` frontmatter | current note / batch | n/a | **all notes, unconditionally** | frontmatter opt-in + explicit include/exclude globs in `PublishConfig` |
| Change detection | remote-hash vs local-hash diff, 4 buckets | n/a | n/a | none | `plan_publish` diff view before any write |
| Link/asset handling | wikilink→URL, transclusion inlining, asset upload, dead-link stripping | internal link→PDF dest | n/a | none (raw copy) | `compile.rs` over existing `link_rewrite.rs`, shared by publish and export |
| Templating | Nunjucks-ish in template repo | frontmatter overrides | full filter pipeline (50+ filters) | Pandoc `--template` only | one `packages/template-engine` powering clip, publish, export, commit messages |
| PDF fidelity | n/a | rendered-DOM + printToPDF + outline injection | n/a | Pandoc/LaTeX only | dual backend: `pandoc` (typographic/academic) and `webview` (WYSIWYG); shared `pdf_outline.rs` |
| Target | GitHub + Vercel/Netlify | file | vault | local Astro stub | `PublishSink` trait: local dir → git → GitHub API |
| Safety | PAT in plaintext settings | n/a | LLM egress | strong: hash-pinned pandoc, arg allowlist, path confinement, `SensitiveOperation` gate | keep Scriptor's model; credentials only via OS keychain, never settings JSON |

---

## 8. Prioritized backlog

Effort in engineer-days, assuming familiarity with the existing crates. "Grounding" names the file the work attaches to.

### P0 — correctness and trust gaps in shipped surfaces

| # | Item | Deliverable | Grounding | Effort |
| --- | --- | --- | --- | --- |
| P0-1 | 3-way auto-merge for conflicts | `crates/native-git/src/merge3.rs` + `git_automerge_conflict_cmd`; conflict panel gains "Auto-merge" with per-hunk fallback | `conflict.rs`, `git_show_merge_base_file` already returns the base | 3 |
| P0-2 | `keep-both` conflict escape hatch | `ConflictPolicy::KeepBoth` writing `name.conflicted.md` through `rename_transaction.rs` | `crates/vault/src/rename_transaction.rs` | 1 |
| P0-3 | Serialize git mutations per repo | `crates/native-git/src/queue.rs`; remove the per-hook `isGitMutationBusy` race | `useWorkspaceGit.ts` | 2 |
| P0-4 | Non-`--ff-only` pull with explicit strategy | `GitPullStrategy { FastForward, Merge, Rebase }` on `git_pull`, surfaced in Git panel; refuse ambiguous defaults | `sync.rs:29` | 2 |
| P0-5 | Publish plan / diff before write | `crates/publish-runner` skeleton + `plan_publish` + `LocalDirSink`; `PublishDiffView` tab. Replaces the unconditional copy in `vault_publish_starlight` | `code_chunk.rs:167-223`, `PublishCenter.tsx` | 5 |
| P0-6 | Frontmatter publish gating | `PublishFrontmatter` contract, `scriptor-publish` + `dg-publish` compatibility | `frontmatter_ops.rs`, `importers/obsidian.rs` | 2 |
| P0-7 | Encryption version dispatch | `EnvelopeVersion` enum + `decrypt_any`; document in threat model | `encryption.rs:41-49` | 2 |
| P0-8 | Export/publish refuse sealed content | `--redact-secrets` flag; publish hard-fails on sealed regions | `export-runner/src/job.rs`, `docs/ENCRYPTION-THREAT-MODEL.md` | 2 |
| | | | **P0 total** | **19** |

### P1 — high-value new capability on existing foundations

| # | Item | Deliverable | Grounding | Effort |
| --- | --- | --- | --- | --- |
| P1-1 | Git history + diff panel | `crates/native-git/src/history.rs` (`git_log`, `git_show_blob`), `GitHistoryPanel.tsx` reusing `GitDiffPreview` | `status.rs`, `GitDiffPreview.tsx` | 4 |
| P1-2 | Blame gutter | `crates/native-git/src/blame.rs` + `packages/editor/src/extensions/blameGutter.ts` | `packages/editor` | 4 |
| P1-3 | Auto-sync scheduler | `crates/native-git/src/autosync.rs`, idle-debounced, off by default, paused while dirty | `useWorkspaceGit.ts`, daemon event pattern | 3 |
| P1-4 | Template engine package | `packages/template-engine` with ported filter set + tests; rewire commit-message templates first | `GitPanel.tsx:246` | 5 |
| P1-5 | Publish compile pass | `compile.rs`: wikilink→URL, transclusion inlining, asset copy, dead-link stripping | `link_rewrite.rs` | 5 |
| P1-6 | `GitSink` publish target | Publish by committing to a branch via `native-git` — no PAT, no network credential surface | P0-5, `native-git` | 2 |
| P1-7 | WebView PDF backend | `webview_pdf.rs` + `renderSettled.ts` + `PageConfig` on `ExportProfile`; golden-file PDF tests | `ExportPrintPreview.tsx`, `supportsPrintPagePreview` | 6 |
| P1-8 | PDF outline + internal links | `pdf_outline.rs` (`lopdf`), applied to both PDF backends | `export-runner` | 3 |
| P1-9 | Inline encryption | `inline_encrypt.rs`, `key_session.rs`, CM6 decoration, `InlineSecretModal.tsx` | `encryption.rs`, P0-7 | 6 |
| P1-10 | Chunk store | `crates/vault/src/chunkstore.rs` (FastCDC) + incremental backup wired to it | `hash.rs`, `commands/backup.rs` | 5 |
| | | | **P1 total** | **43** |

### P2 — larger bets, sequence after P0/P1 land

| # | Item | Deliverable | Effort |
| --- | --- | --- | --- |
| P2-1 | Web clip pipeline | `crates/web-clip` (`extract.rs`, `to_markdown.rs`, `note.rs`), `scriptor clip` CLI subcommand, `SensitiveOperation::WebClip`, loopback daemon ingest with per-install token | 10 |
| P2-2 | Browser extension | Minimal MV3 extension in `packages/portal` posting to the daemon; highlight overlay optional | 8 |
| P2-3 | `GithubApiSink` + keychain credentials | OS-keychain-backed token store, rate-limit-aware batched publish, deploy trigger | 6 |
| P2-4 | `trait GitBackend` + `gix` backend | Removes the external `git` binary dependency; unblocks mobile (`src/mobile`) | 10 |
| P2-5 | Chunked remote sync (no server) | `SyncEngine` in `crates/daemon` pushing chunk deltas to S3-compatible storage with per-chunk E2EE and path obfuscation; git remains history | 15 |
| P2-6 | Live collaborative session | Session-scoped Loro/Yjs CRDT in `crates/wasm-runtime`, commits a normal file + git commit on session end | 15 |
| P2-7 | Publish integrity checks | `verify_chunk_integrity` / publish "doctor", orphan asset GC | 3 |
| | | | **P2 total 67** |

### Sequencing notes

- P0-1 and P0-2 are the two changes that most reduce data-loss risk and should land together.
- P0-5/P0-6 must precede any remote publish sink: shipping `GithubApiSink` before diff-and-gating would push a user's entire private vault to a public repo on first click.
- P1-4 (template engine) is a dependency of P1-7's header/footer templates and of P2-1; doing it early avoids a third interpolation implementation.
- P1-10 (chunk store) is the prerequisite for P2-5 but pays for itself immediately via incremental backup, so it is worth doing even if remote sync is never built.
- P2-4 gates mobile; nothing else in the backlog does.

