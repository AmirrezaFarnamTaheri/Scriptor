# Реестр зрелости возможностей

[English](CAPABILITY-MATURITY.md) · [简体中文](CAPABILITY-MATURITY.zh-CN.md) · **Русский** · [Deutsch](CAPABILITY-MATURITY.de.md) · [Español](CAPABILITY-MATURITY.es.md) · [فارسی](CAPABILITY-MATURITY.fa.md)

Этот реестр является источником истины для заявлений о поддержке. **Implemented** означает, что исходный код существует; **Supported** дополнительно требует интеграционных тестов, включения в релиз, документации и назначенного владельца. **Experimental** включается явно и может меняться. **Design-only** нельзя представлять как доступную функцию.

| Возможность | Статус | Источник / доказательство | Положение в релизе |
|---|---|---|---|
| Чтение/запись/config Markdown vault | Supported | `crates/vault/`, Tauri/daemon adapters | Included |
| SQLite/FTS indexing и search | Supported | `crates/indexer/` | Included |
| Backlinks/knowledge/graph | Supported, bounded | `crates/indexer/src/knowledge.rs`, `graph.rs` | Included |
| Desktop workspace | Supported | `src/`, `apps/desktop/` | Included |
| PDF/EPUB reader vault с annotations | Experimental | `src/components/reader/`, `apps/desktop/src-tauri/src/commands/reader.rs`, `.scriptor/reader/annotations.json` | Только локальный desktop; до заявления о поддержке нужны полные browser/accessibility и release-gate доказательства |
| Редактирование tasks на основе Markdown | Experimental | `crates/indexer/src/tasks.rs`, `src/components/TaskPanel.tsx` | Обновляет исходный Markdown через vault write path; до заявления о поддержке нужны end-to-end доказательства в чистой среде |
| Markdown Kanban | Experimental | `crates/indexer/src/kanban.rs`, `src/components/KanbanPanel.tsx` | Перемещение card переносит полную строку source под нужный заголовок `##`; до заявления о поддержке нужны browser-flow доказательства |
| CodeMirror Markdown editor | Default supported editor | `packages/editor/src/codemirror.tsx` | Included |
| Monaco editor | Advanced/lazy editor | `src/components/shell/EditorWorkspace.tsx` | Included, non-default |
| Git operations/conflict UI | Supported | `crates/native-git/`, `src/components/GitPanel.tsx` | Included |
| Export/Pandoc profiles | Supported with external-tool policy | `crates/export-runner/`, `packages/export/` | Included; Pandoc отдельно |
| Citation parsing/bibliography UI | Supported, bounded | `crates/indexer/src/citations.rs`, renderer citeproc path | Included; локальные bibliography data, без заявления Zotero sync |
| Local Starlight publishing | Experimental | `crates/publish-runner/`, desktop plan/review/apply, CLI adapter | Только локальный output; source/security contracts проходят, но нужны полные Cargo/browser release proofs |
| Canvas | Supported | `crates/canvas-engine/`, `packages/canvas/` | Included |
| Daemon IPC / CLI / TUI | Supported | `crates/daemon/`, `crates/ipc/`, `crates/cli/` | Daemon sidecar included |
| Canonical MCP server | Supported (legacy compatibility codecs сохранены; current-spec adoption является явным решением) | `packages/mcp/` | Included |
| Trusted automation stdio | Supported with audit/authorization; `mcp-stdio` сохранён как CLI alias | `crates/daemon/src/automation_stdio.rs` | Included |
| Manifest-first plugins | Experimental | `packages/plugin-api/` | Только first-party catalog |
| External code chunks | Experimental/high-risk | process broker + user confirmation | Opt-in |
| AI provider requests | Experimental opt-in | native keychain/network boundary | Opt-in |
| Local recovery snapshots | Supported | `commands/backup.rs` | Included |
| External DR backups | Supported foundation; drill обязателен для каждого release | `commands/backup.rs` | Included |
| Encrypted vaults | Только Experimental primitives | `crates/vault/src/encryption.rs` | Не является поддерживаемым vault mode |
| Rust citation-engine (BibLaTeX parsing) | Supported | `crates/citation-engine/`, `crates/indexer/src/bibliography.rs` | Indexer разбирает `.bib` через engine (hayagriva grammar): fatal parse errors понижаются до warning, ошибки конвертации отдельных entries пропускаются; citeproc rendering surface crate остаётся incubating |
| Zotero Web API connector | Experimental / library-only | `packages/zotero-connector/` | Read-only library; не включён в продукт, shipped sync UI отсутствует |
| Google Calendar and Tasks | Experimental desktop integration | `apps/desktop/src-tauri/src/commands/google_calendar.rs`, `src/hooks/useGoogleCalendarSync.ts` | OAuth PKCE и tokens в OS-keychain; нужен настроенный Google client ID и более широкий browser-flow proof до заявления о поддержке |
| Gmail native bridge (manager UI composed, capability-gated) | Experimental desktop integration | `apps/desktop/src-tauri/src/commands/google_calendar.rs`, `src/bridge/commands/google_gmail.ts` | Работает за capability `scriptor.gmail-manager`: отображается только при явном включении plugin; каждый native command, включая reads/auth, повторно проверяет capability на границе; bounded message listing с concurrent fetches |
| Desktop Git mutation queue (GitQueue) | Integrated | `crates/native-git/src/queue.rs` | Все desktop Git mutations входят в bounded per-repo worker; source-contracts проверяют serialization + 64-slot backpressure; daemon-side Git commands по-прежнему сериализованы daemon state mutex |
| Semantic (embedding) search | Experimental opt-in | `crates/embeddings/`, `crates/daemon/src/handler.rs` | Opt-in через `semantic` section vault config (локальный ollama server или OpenAI с пользовательским keychain key); vault sync embed-ит только изменённые notes, предварительно redacting sealed spans; без конфигурации деградирует до keyword-only search; cosine query zero-copy через reusable scratch buffer |
| Tantivy index | Evaluation | `crates/tantivy-indexer/` | Исключён из default workspace build и release binaries; benchmark 2026-09-01, release build, 2k-note vault: warm search 0.0ms против FTS5 7.8ms, оба значительно ниже бюджета 100ms. С batched-commit API (`stage_note` + `commit_batch`) build index 452ms против ~8s rebuild FTS5 на том же vault, но FTS5 уже выполняет бюджеты и transactionally связан с note cache; продукт сохраняет FTS5, Tantivy остаётся готовой заменой для будущего sub-millisecond semantic-scale search. Сравнение: `cargo run --release -p scriptor-cli --features tantivy -- bench-tantivy <vault> <query>` |
| WASM plugin host | Incubating | `crates/wasm-runtime/` | Исключён из default workspace build |
| Mobile app | Design-only | `docs/architecture/MOBILE_ARCHITECTURE.md` | Not shipped |
| Signed public plugin marketplace | Design-only | plugin graduation requirements | Not shipped |
| Built-in self updater | Disabled | updater plugin/permission removed | Not shipped |

## Условия перехода в Supported

Возможность становится Supported только при наличии всех пунктов:

1. назначенный owner и support window;
2. стабильный public contract и current-schema policy;
3. positive, negative, restart, cancellation и recovery tests;
4. authorization/privacy model;
5. bounded performance evidence;
6. пользовательская и операторская документация;
7. включение в release и artifact verification;
8. changelog entry.
