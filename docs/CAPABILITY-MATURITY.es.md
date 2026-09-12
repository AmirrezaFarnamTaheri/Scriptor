# Registro de madurez de capacidades

[English](CAPABILITY-MATURITY.md) · [简体中文](CAPABILITY-MATURITY.zh-CN.md) · [Русский](CAPABILITY-MATURITY.ru.md) · [Deutsch](CAPABILITY-MATURITY.de.md) · **Español** · [فارسی](CAPABILITY-MATURITY.fa.md)

Este registro es la fuente de verdad para las afirmaciones de soporte. **Implemented** significa que existe código fuente. **Supported** exige además pruebas integradas, inclusión en la versión, documentación y un owner. **Experimental** es opt-in y puede cambiar. **Design-only** no debe presentarse como disponible.

| Capacidad | Estado | Fuente / evidencia | Posición en release |
|---|---|---|---|
| Lectura/escritura/config de vault Markdown | Supported | `crates/vault/`, adaptadores Tauri/daemon | Included |
| Indexado y búsqueda SQLite/FTS | Supported | `crates/indexer/` | Included |
| Backlinks/knowledge/graph | Supported, bounded | `crates/indexer/src/knowledge.rs`, `graph.rs` | Included |
| Desktop workspace | Supported | `src/`, `apps/desktop/` | Included |
| Lector PDF/EPUB del vault con anotaciones | Experimental | `src/components/reader/`, `apps/desktop/src-tauri/src/commands/reader.rs`, `.scriptor/reader/annotations.json` | Solo escritorio local; exige evidencia completa de browser/accessibility y release gate antes de afirmar soporte |
| Edición de tasks respaldada por Markdown | Experimental | `crates/indexer/src/tasks.rs`, `src/components/TaskPanel.tsx` | Actualiza el Markdown fuente mediante el vault write path; exige evidencia end-to-end en entorno limpio antes de afirmar soporte |
| Markdown Kanban | Experimental | `crates/indexer/src/kanban.rs`, `src/components/KanbanPanel.tsx` | Mover una card recoloca la línea fuente completa bajo el heading `##` solicitado; exige evidencia browser-flow antes de afirmar soporte |
| Editor Markdown CodeMirror | Default supported editor | `packages/editor/src/codemirror.tsx` | Included |
| Editor Monaco | Advanced/lazy editor | `src/components/shell/EditorWorkspace.tsx` | Included, non-default |
| Operaciones Git/conflict UI | Supported | `crates/native-git/`, `src/components/GitPanel.tsx` | Included |
| Perfiles Export/Pandoc | Supported with external-tool policy | `crates/export-runner/`, `packages/export/` | Included; Pandoc separado |
| Parsing de citas/UI de bibliografía | Supported, bounded | `crates/indexer/src/citations.rs`, ruta citeproc del renderer | Included; bibliografía local, sin afirmación de Zotero sync |
| Publicación local Starlight | Experimental | `crates/publish-runner/`, desktop plan/review/apply, adaptador CLI | Solo salida local; contratos source/security aprobados, aún requiere evidencia completa Cargo/browser de release |
| Canvas | Supported | `crates/canvas-engine/`, `packages/canvas/` | Included |
| Daemon IPC / CLI / TUI | Supported | `crates/daemon/`, `crates/ipc/`, `crates/cli/` | Daemon sidecar included |
| Canonical MCP server | Supported (legacy compatibility codecs; adopción current-spec explícita) | `packages/mcp/` | Included |
| Trusted automation stdio | Supported with audit/authorization; `mcp-stdio` se conserva como alias CLI | `crates/daemon/src/automation_stdio.rs` | Included |
| Manifest-first plugins | Experimental | `packages/plugin-api/` | Solo catálogo first-party |
| External code chunks | Experimental/high-risk | process broker + confirmación de usuario | Opt-in |
| AI provider requests | Experimental opt-in | native keychain/network boundary | Opt-in |
| Local recovery snapshots | Supported | `commands/backup.rs` | Included |
| External DR backups | Supported foundation; drill obligatorio por release | `commands/backup.rs` | Included |
| Encrypted vaults | Solo Experimental primitives | `crates/vault/src/encryption.rs` | No es un vault mode soportado |
| Rust citation-engine (BibLaTeX parsing) | Supported | `crates/citation-engine/`, `crates/indexer/src/bibliography.rs` | Indexer parsea `.bib` mediante el engine (hayagriva grammar): fatal parse errors se degradan a warning y se omiten fallos de conversión por entry; la superficie citeproc rendering del crate sigue incubating |
| Zotero Web API connector | Experimental / library-only | `packages/zotero-connector/` | Read-only library; no está compuesto en el producto ni hay sync UI distribuida |
| Google Calendar and Tasks | Experimental desktop integration | `apps/desktop/src-tauri/src/commands/google_calendar.rs`, `src/hooks/useGoogleCalendarSync.ts` | OAuth PKCE y tokens en OS-keychain; necesita Google client ID configurado y evidencia browser-flow más amplia antes de afirmar soporte |
| Gmail native bridge (manager UI composed, capability-gated) | Experimental desktop integration | `apps/desktop/src-tauri/src/commands/google_calendar.rs`, `src/bridge/commands/google_gmail.ts` | Detrás de la capability `scriptor.gmail-manager`: solo se lista con plugin explícitamente habilitado; cada native command, incluidos reads/auth, vuelve a comprobar capability en el boundary; bounded message listing con concurrent fetches |
| Desktop Git mutation queue (GitQueue) | Integrated | `crates/native-git/src/queue.rs` | Todas las mutaciones Git de desktop entran en un bounded per-repo worker; source-contracts prueban serialization + 64-slot backpressure; comandos Git del daemon siguen serializados por daemon state mutex |
| Semantic (embedding) search | Experimental opt-in | `crates/embeddings/`, `crates/daemon/src/handler.rs` | Opt-in mediante section `semantic` del vault config (ollama local o OpenAI con keychain key del usuario); vault sync embed solo notes cambiadas y redacta sealed spans antes; sin configurar degrada a keyword-only search; cosine query zero-copy sobre reusable scratch buffer |
| Tantivy index | Evaluation | `crates/tantivy-indexer/` | Excluido de default workspace build y release binaries; benchmark 2026-09-01, release build, vault 2k-note: warm search 0.0ms vs FTS5 7.8ms, ambos muy por debajo del budget 100ms. Con batched-commit API (`stage_note` + `commit_batch`) build index 452ms vs ~8s de rebuild FTS5 en el mismo vault, pero FTS5 ya cumple todos los budgets y está ligado transaccionalmente a note cache, por lo que el producto conserva FTS5; Tantivy queda incubating como reemplazo listo si se necesita sub-millisecond semantic-scale search. Comparación: `cargo run --release -p scriptor-cli --features tantivy -- bench-tantivy <vault> <query>` |
| WASM plugin host | Incubating | `crates/wasm-runtime/` | Excluido de default workspace build |
| Mobile app | Design-only | `docs/architecture/MOBILE_ARCHITECTURE.md` | Not shipped |
| Signed public plugin marketplace | Design-only | plugin graduation requirements | Not shipped |
| Built-in self updater | Disabled | updater plugin/permission removed | Not shipped |

## Puerta de graduación

Una capacidad solo pasa a Supported cuando existen todos estos elementos:

1. owner y support window definidos;
2. public contract estable y current-schema policy;
3. tests positivos, negativos, de restart, cancellation y recovery;
4. modelo authorization/privacy;
5. bounded performance evidence;
6. documentación de usuario y operador;
7. inclusión en release y artifact verification;
8. changelog entry.
