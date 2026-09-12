# Reifegrad-Ledger der Funktionen

[English](CAPABILITY-MATURITY.md) · [简体中文](CAPABILITY-MATURITY.zh-CN.md) · [Русский](CAPABILITY-MATURITY.ru.md) · **Deutsch** · [Español](CAPABILITY-MATURITY.es.md) · [فارسی](CAPABILITY-MATURITY.fa.md)

Dieses Ledger ist maßgeblich für Support-Aussagen. **Implemented** bedeutet, dass Quellcode existiert. **Supported** verlangt zusätzlich integrierte Tests, Aufnahme in Releases, Dokumentation und einen benannten Owner. **Experimental** ist opt-in und kann sich ändern. **Design-only** darf nicht als verfügbar dargestellt werden.

| Fähigkeit | Status | Quelle / Nachweis | Release-Position |
|---|---|---|---|
| Markdown-Vault Read/Write/Config | Supported | `crates/vault/`, Tauri-/Daemon-Adapter | Included |
| SQLite/FTS Indexing und Search | Supported | `crates/indexer/` | Included |
| Backlinks/Knowledge/Graph | Supported, bounded | `crates/indexer/src/knowledge.rs`, `graph.rs` | Included |
| Desktop Workspace | Supported | `src/`, `apps/desktop/` | Included |
| Vault PDF/EPUB Reader mit Annotationen | Experimental | `src/components/reader/`, `apps/desktop/src-tauri/src/commands/reader.rs`, `.scriptor/reader/annotations.json` | Nur lokaler Desktop; vollständiger Browser-/Accessibility- und Release-Gate-Nachweis vor Support-Aussage nötig |
| Markdown-basiertes Task Editing | Experimental | `crates/indexer/src/tasks.rs`, `src/components/TaskPanel.tsx` | Schreibt Source Markdown über den Vault Write Path; Clean-Environment-E2E-Nachweis vor Support-Aussage nötig |
| Markdown Kanban | Experimental | `crates/indexer/src/kanban.rs`, `src/components/KanbanPanel.tsx` | Card Moves verschieben vollständigen Quelltext unter `##`-Überschriften; Browser-Flow-Nachweis vor Support-Aussage nötig |
| CodeMirror Markdown Editor | Default supported editor | `packages/editor/src/codemirror.tsx` | Included |
| Monaco Editor | Advanced/lazy editor | `src/components/shell/EditorWorkspace.tsx` | Included, non-default |
| Git Operations/Conflict UI | Supported | `crates/native-git/`, `src/components/GitPanel.tsx` | Included |
| Export/Pandoc Profiles | Supported with external-tool policy | `crates/export-runner/`, `packages/export/` | Included; Pandoc separat |
| Citation Parsing/Bibliography UI | Supported, bounded | `crates/indexer/src/citations.rs`, Renderer-Citeproc-Pfad | Included; lokale Bibliografiedaten, kein Zotero-Sync-Claim |
| Local Starlight Publishing | Experimental | `crates/publish-runner/`, Desktop Plan/Review/Apply, CLI Adapter | Nur lokaler Output; Source/Security Contracts bestehen, vollständiger Cargo-/Browser-Release-Nachweis noch erforderlich |
| Canvas | Supported | `crates/canvas-engine/`, `packages/canvas/` | Included |
| Daemon IPC / CLI / TUI | Supported | `crates/daemon/`, `crates/ipc/`, `crates/cli/` | Daemon sidecar included |
| Canonical MCP Server | Supported (Legacy Compatibility Codecs; Current-Spec-Adoption ausdrücklich) | `packages/mcp/` | Included |
| Trusted Automation stdio | Supported with audit/authorization; `mcp-stdio` als CLI Alias beibehalten | `crates/daemon/src/automation_stdio.rs` | Included |
| Manifest-first Plugins | Experimental | `packages/plugin-api/` | Nur First-Party Catalog |
| External Code Chunks | Experimental/high-risk | Process Broker + Nutzerbestätigung | Opt-in |
| AI Provider Requests | Experimental opt-in | Native Keychain/Network Boundary | Opt-in |
| Local Recovery Snapshots | Supported | `commands/backup.rs` | Included |
| External DR Backups | Supported foundation; Drill je Release erforderlich | `commands/backup.rs` | Included |
| Encrypted Vaults | Nur Experimental Primitives | `crates/vault/src/encryption.rs` | Kein unterstützter Vault Mode |
| Rust Citation Engine (BibLaTeX Parsing) | Supported | `crates/citation-engine/`, `crates/indexer/src/bibliography.rs` | Indexer parst `.bib` über die Engine (hayagriva grammar): fatale Parsefehler werden Warnungen, Konvertierungsfehler einzelner Einträge werden übersprungen; Citeproc Rendering Surface der Crate bleibt incubating |
| Zotero Web API Connector | Experimental / library-only | `packages/zotero-connector/` | Read-only Library; nicht in Produkt komponiert, keine ausgelieferte Sync UI |
| Google Calendar and Tasks | Experimental desktop integration | `apps/desktop/src-tauri/src/commands/google_calendar.rs`, `src/hooks/useGoogleCalendarSync.ts` | OAuth PKCE und OS-Keychain Tokens; konfigurierter Google Client ID und breitere Browser-Flow-Evidence vor Support-Aussage erforderlich |
| Gmail Native Bridge (Manager UI composed, capability-gated) | Experimental desktop integration | `apps/desktop/src-tauri/src/commands/google_calendar.rs`, `src/bridge/commands/google_gmail.ts` | Hinter Plugin Capability `scriptor.gmail-manager`: nur bei explizit aktiviertem Plugin gelistet; jeder Native Command einschließlich Reads/Auth prüft Capability an der Boundary erneut; bounded message listing mit concurrent fetches |
| Desktop Git Mutation Queue (GitQueue) | Integrated | `crates/native-git/src/queue.rs` | Alle Desktop-Git-Mutationen laufen über bounded per-repo worker; Source Contracts prüfen Serialization + 64-slot Backpressure; daemon-side Git Commands bleiben durch Daemon State Mutex serialisiert |
| Semantic (Embedding) Search | Experimental opt-in | `crates/embeddings/`, `crates/daemon/src/handler.rs` | Opt-in über `semantic` section der Vault Config (lokaler ollama server oder OpenAI mit Nutzer-Keychain-Key); Vault Sync embed-et nur geänderte Notes und redacted sealed spans zuerst; unkonfiguriert Keyword-only Search; Cosine Query zero-copy über reusable scratch buffer |
| Tantivy Index | Evaluation | `crates/tantivy-indexer/` | Aus Default Workspace Build und Release Binaries ausgeschlossen; Benchmark 2026-09-01, Release Build, 2k-note Vault: Warm Search 0.0ms vs FTS5 7.8ms, beide weit unter 100ms Budget. Mit Batched-Commit API (`stage_note` + `commit_batch`) 452ms Index Build vs ~8s FTS5 Rebuild; FTS5 erfüllt bereits alle Budgets und ist transaktional an Note Cache gebunden, daher bleibt FTS5 im Produkt. Tantivy bleibt als fertiger Ersatz für künftige sub-millisecond semantic-scale search incubating. Vergleich: `cargo run --release -p scriptor-cli --features tantivy -- bench-tantivy <vault> <query>` |
| WASM Plugin Host | Incubating | `crates/wasm-runtime/` | Aus Default Workspace Build ausgeschlossen |
| Mobile App | Design-only | `docs/architecture/MOBILE_ARCHITECTURE.md` | Not shipped |
| Signed Public Plugin Marketplace | Design-only | plugin graduation requirements | Not shipped |
| Built-in Self Updater | Disabled | updater plugin/permission removed | Not shipped |

## Graduation Gate

Eine Fähigkeit wird nur dann Supported, wenn alles vorhanden ist:

1. benannter Owner und Support Window;
2. stabiler Public Contract und Current-Schema Policy;
3. positive, negative, restart, cancellation und recovery tests;
4. authorization/privacy model;
5. bounded performance evidence;
6. Nutzer- und Operator-Dokumentation;
7. Release Inclusion und Artifact Verification;
8. Changelog Entry.
