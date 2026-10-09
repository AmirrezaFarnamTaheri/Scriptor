# Capability maturity ledger

This ledger is authoritative for support claims. “Implemented” means source exists; “Supported” additionally requires integrated tests, release inclusion, docs, and an owner. “Experimental” is opt-in and may change. “Design-only” must not be presented as available.

| Capability | Status | Source / evidence | Release posture |
|---|---|---|---|
| Markdown vault read/write/config | Supported | `crates/vault/`, Tauri/daemon adapters | Included |
| SQLite/FTS indexing and search | Supported | `crates/indexer/` | Included |
| Backlinks/knowledge/graph | Supported, bounded | `crates/indexer/src/knowledge.rs`, `graph.rs` | Included |
| Desktop workspace | Supported | `src/`, `apps/desktop/` | Included |
| Optional workspace shortcuts | Implemented; hosted workflow and visual verification | `workspaceShortcuts.ts`, `WorkspaceShortcutBar.tsx`; `validation/WORKSPACE-SHORTCUTS-2026-10-08.md` | Compact defaults; persisted visibility, pinning, ordering, names and bounded sizes. Palette recovery for hidden rows. Does not change workspace permissions or back up drafts |
| Workspace leaves and plugin navigation | Experimental | `useWorkspaceComposition.ts`, `useWorkspaceLeaves.ts`, `WorkspaceLeafDock.tsx`, module manager; `validation/WORKSPACE-COMPOSITION-2026-10-02.md` | Up to 24 references in two groups, per-vault restoration without starting operations, permission-aware launches, retained source drafts and guarded runtime shutdown. Markdown has one mutable editor with separate note previews; layout persistence does not back up unsaved drafts |
| Vault PDF/EPUB reader with annotations | Experimental | `src/components/reader/`, `apps/desktop/src-tauri/src/commands/reader.rs`, `.scriptor/reader/annotations.json` | Local desktop only; requires full browser/accessibility and release-gate proof before support claim |
| Asset deck with raster/audio preview | Experimental | `src/components/AssetDeckWorkspace.tsx`, `AssetMediaPreview.tsx`, native reader boundary | PDF/EPUB retain annotations; raster/audio previews capped at 32 MiB, SVG/HTML excluded. Packaged verification pending |
| Database studio | Experimental | `src/components/DatabaseStudioPanel.tsx`, guarded frontmatter writes; `validation/RESEARCH_WORKSPACES.md` | Bounded filters, views, formulas and aggregates; metadata edits retain the displayed revision and use editor save coordination |
| Capture reviewer | Experimental | `src/components/CaptureReviewerPanel.tsx`, native extraction preview | Reviewed extracted text and metadata before save; passive, sanitized original-source structure preview uses an isolated sandbox. Scripts, resources and navigation are removed |
| Revision analytics | Experimental | `src/components/NoteHistoryPanel.tsx`, `src/lib/vocabularyEvolution.ts` | Real retained history and measured vocabulary evolution from up to 32 sources; unavailable revisions remain gaps. No readability or full-vault activity claim |
| Google Drive and Docs collaboration | Experimental | `src/components/CollaborationPanel.tsx`, native immutable revision transport; `validation/GOOGLE-INTEGRATIONS-2026-10-09.md` | Discoverable folders and Docs, approved folder creation, persisted vault binding, explicit share/merge, finite consented polling, byte-preserving opaque Markdown records and reviewed loss-aware text copies. Media replication and live account certification remain outside current evidence |
| Standalone source editor | Experimental | `SourceFileEditor.tsx`, native `commands/source_files.rs` | LaTeX, Python and an explicit text-format allowlist; strict creation, content-hash save/recovery and unsaved-vault-change review. Native and browser workflows pass; packaged verification pending |
| Overleaf source exchange | Experimental | `OverleafPanel.tsx`, native `commands/overleaf.rs` | Reviewed individual source files through the supported Git transport, remote head/content checks and local save conflict checks. Native regression and independent review verify unrelated project files survive commits; live account verification pending |
| Diagram studio | Experimental | `DiagramStudioPanel.tsx`, renderer Graphviz worker | Live Mermaid/local DOT preview, bounded zoom and real pan, and explicit native PlantUML rendering. Actual network-denied WASM and browser workflows pass; bundled notices include wrapper, Graphviz and Expat texts. Packaged WebView verification remains |
| Brokered Typst PDF profile | Experimental, external tools required | `crates/export-runner/src/typst.rs`, `tests/typst_artifact.rs` | Real local artifact verified through the process broker |
| Offline PDF compiler | Experimental | `crates/export-runner/src/inprocess_pdf.rs`, desktop `commands/export_pdf.rs`, mobile native adapter | In-process compilation, deterministic output, bounded inputs, bundled fonts and explicit notices; real artifact plus desktop/mobile host and browser workflows verified. Android/iOS device and packaged verification pending |
| Reviewed vault repairs | Experimental | Native `commands/health_repair.rs`, `HealthRepairCards.tsx` | Reviewed create/tag/prune actions, vault/source checks, complete bounded reference proof including source files and Obsidian assets, and immutable recovery receipts. Native and three browser workflows pass; packaged verification pending |
| Runtime console | Experimental, bounded desktop workflow | `src/components/plugins/RuntimeConsolePanel.tsx`, `apps/desktop/src-tauri/src/commands/code_chunk/runtime.rs`, native process broker | Fresh process execution plus vault-owned persistent Python sessions with reviewed environments, per-cell consent, live output, bounded variables/PNG plots and stop/restart; sessions expire after 15 minutes, cells after 30 seconds. Other languages remain fresh processes; no package installer or interactive stdin |
| Markdown-backed task editing | Experimental | `crates/indexer/src/tasks.rs`, `src/components/TaskPanel.tsx` | Updates source Markdown through the vault write path; requires clean-environment end-to-end proof before support claim |
| Markdown Kanban | Experimental | `crates/indexer/src/kanban.rs`, `src/components/KanbanPanel.tsx` | Card moves relocate source text under `##` headings; requires browser-flow proof before support claim |
| CodeMirror Markdown editor | Default supported editor | `packages/editor/src/codemirror.tsx` | Included |
| Monaco editor | Advanced/lazy editor | `src/components/shell/EditorWorkspace.tsx` | Included, non-default |
| Git operations/conflict UI | Supported | `crates/native-git/`, `src/components/GitPanel.tsx` | Included |
| Export/Pandoc profiles | Supported with external-tool policy | `crates/export-runner/`, `packages/export/` | Included; Pandoc separate |
| Citation parsing/bibliography UI | Supported, bounded | `crates/indexer/src/citations.rs`, renderer citeproc path | Included; local bibliography data, no Zotero sync claim |
| Starlight publishing studio | Experimental | `crates/publish-runner/`, desktop reviewed plans, bounded build jobs and receipt-verified deployment snapshot | Local preview/build plus explicit configured Pages/domain adapters; live deployment and full release proof pending |
| Canvas | Supported | `crates/canvas-engine/`, `packages/canvas/` | Included |
| Daemon IPC / CLI / TUI | Supported | `crates/daemon/`, `crates/ipc/`, `crates/cli/` | Daemon sidecar included |
| Canonical MCP server | Supported (legacy compatibility codecs; current-spec adoption is explicit) | `packages/mcp/` | Included |
| Trusted automation stdio | Supported with audit/authorization; `mcp-stdio` retained as a CLI alias | `crates/daemon/src/automation_stdio.rs` | Included |
| Manifest-first plugins | Experimental | `packages/plugin-api/` | First-party catalog only |
| External code chunks | Experimental/high-risk | process broker + user confirmation | Opt-in |
| AI provider requests | Experimental opt-in | native keychain/network boundary | Opt-in |
| Local recovery snapshots | Supported | `commands/backup.rs` | Included |
| External DR backups | Supported foundation; drill required per release | `commands/backup.rs` | Included |
| Encrypted vaults | Experimental primitives only | `crates/vault/src/encryption.rs` | Not a supported vault mode |
| Rust citation-engine (BibLaTeX parsing) | Supported | `crates/citation-engine/`, `crates/indexer/src/bibliography.rs` | The indexer parses `.bib` files through the engine (hayagriva grammar): fatal parse errors degrade to a warning and per-entry conversion failures are skipped; the citeproc rendering surface of the crate stays incubating |
| Zotero read-only reference import | Experimental | Native preview adapter, `src/components/bibliography/ReferenceImportReview.tsx`, `packages/zotero-connector/`; `validation/RESEARCH_WORKSPACES.md` | Explicit paginated preview and reviewed new bibliography writes; credentials in memory, no automatic synchronization or live account verification |
| Google Calendar and Tasks | Experimental desktop integration | `apps/desktop/src-tauri/src/commands/google_calendar.rs`, `src/hooks/useGoogleCalendarSync.ts`; `validation/GOOGLE-INTEGRATIONS-2026-10-09.md` | OAuth PKCE, separate OS-keychain bundle, bounded calendar/task-list discovery and persisted selectors; calendar event writes require discovered write access. Reviewed task/event reconciliation retains provider revision checks. Hosted browser and live-account evidence are distinct gates |
| Gmail manager | Experimental desktop integration | `GmailManagerPanel.tsx`, native Google commands, `google-gmail-workflows.spec.ts`; `validation/GOOGLE-INTEGRATIONS-2026-10-09.md` | Explicit plugin capability checked at every native command; independent account, bounded paginated metadata, search, literal-text import, approved send/archive/read/trash operations. Delayed results are discarded after account/query/vault changes. Hosted browser and live-account verification remain separately recorded |
| Desktop Git mutation queue (GitQueue) | Integrated | `crates/native-git/src/queue.rs` | All desktop Git mutations enqueue through the bounded per-repo worker; contract-tested in source-contracts (serialization + 64-slot backpressure); daemon-side Git commands remain serialized by the daemon state mutex |
| Semantic (embedding) search | Experimental opt-in | `crates/embeddings/`, `crates/daemon/src/handler.rs` | Opt-in via vault config `semantic` section (ollama local server, or OpenAI with a user keychain key); vault sync embeds only changed notes with sealed spans redacted first; unconfigured vaults degrade to keyword-only search; cosine query is zero-copy over a reusable scratch buffer |
| Tantivy index | Evaluation | `crates/tantivy-indexer/` | Excluded from default workspace build and release binaries; benched against FTS5 (2026-09-01, release build, 2k-note vault): warm search 0.0ms vs FTS5 7.8ms (both far under the 100ms budget). With the batched-commit API (`stage_note` + `commit_batch`) index build is 452ms vs FTS5 rebuild ~8s on the same vault, but FTS5 already meets every budget and is transactionally tied to the note cache, so the product keeps FTS5; tantivy stays incubating as the ready replacement if sub-millisecond semantic-scale search is needed. Comparable via `cargo run --release -p scriptor-cli --features tantivy -- bench-tantivy <vault> <query>` |
| WASM plugin host | Incubating | `crates/wasm-runtime/` | Excluded from default workspace build |
| Mobile app | Experimental implementation | `apps/mobile/`, `crates/mobile-runtime/`, `architecture/MOBILE_IMPLEMENTATION.md` | Signed Android ARM64 debug APK verified; device, iOS and release distribution proof pending |
| Signed public plugin marketplace | Design-only | plugin graduation requirements | Not shipped |
| Built-in self updater | Disabled | updater plugin/permission removed | Not shipped |

## Graduation gate

A capability moves to Supported only when all are present:

1. named owner and support window;
2. stable public contract and current-schema policy;
3. positive, negative, restart, cancellation, and recovery tests;
4. authorization/privacy model;
5. bounded performance evidence;
6. user and operator docs;
7. release inclusion and artifact verification;
8. changelog entry.
