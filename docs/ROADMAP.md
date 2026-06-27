# Scriptor Roadmap

Development direction for Scriptor — a local-first Markdown knowledge workspace.

This document describes shipped and planned features. For the detailed audit and engineering backlog, see [`scriptor_audit_and_roadmap.md`](../scriptor_audit_and_roadmap.md).

---

## v0.1.0 — Shipped

The initial release delivers a complete research workspace:

| Surface | Capabilities |
|---------|-------------|
| **Desktop shell** | Tauri 2 with vault sidebar, CodeMirror/Monaco editor, inspector rail, command palette |
| **Knowledge** | Vault scan, FTS search, backlinks, knowledge graph, citation inspector, DQL, vault health dashboard |
| **Publishing** | Pandoc export profiles (HTML, PDF, DOCX, LaTeX, ePub, Reveal.js), publish center, bibliography support |
| **Automation** | Git status/commit/push, MCP read-only tools, plugin safe mode, headless daemon, terminal UI |
| **Canvas** | Spatial canvas boards with templates and undo |
| **Platform** | Cross-platform installers (Windows, macOS, Linux), system tray, deep links, auto-updater |
| **Editor** | Source/split/preview modes, snippets, frontmatter inspector, writing targets, footnote authoring |
| **UX** | Light/dark/high-contrast themes, onboarding tour, session restore, vault-open skeleton, perf HUD |

---

## Phase A — Safety and data integrity

Core reliability and IPC hardening.

- Chunked IPC frame reads with stream recovery
- SQLite WAL mode and busy timeout for concurrent access
- Async vault open with progress events
- Shared atomic write helper for all vault persistence
- Atomic canvas JSON writes
- Transaction ledger for bulk rename with crash recovery
- Per-connection daemon worker threads (head-of-line blocking fix)
- Session-scoped persistent index cache in daemon
- Daemon endpoint hardening and RAII cleanup

Architecture docs: [`docs/architecture/IPC_DAEMON.md`](architecture/IPC_DAEMON.md)

---

## Phase B — Gateway, trust, and validation

Unified routing, security hardening, and CI quality gates.

- Unified Rust session gateway (topology-agnostic bridge)
- Pandoc and pdf2zh binary hash verification
- IPC fuzz testing and per-connection rate limiting
- XSS fixture suite and Tauri CSP hardening
- MCP write-approved E2E and audit logging
- Cross-platform release scripts (replace PowerShell-only gates)
- Performance baseline JSON committed to CI
- Functional Playwright E2E test suite
- `cargo-deny` and `pnpm audit` in CI
- Contract codegen between Rust and TypeScript
- Pandoc `extra_pandoc_args` allowlist
- IPC connection pool and RPC multiplexing

Architecture docs: [`docs/architecture/IPC_DAEMON.md`](architecture/IPC_DAEMON.md), [`docs/contracts/CONTRACT_GOVERNANCE.md`](contracts/CONTRACT_GOVERNANCE.md)

---

## Phase C — Product polish and scale

UX refinement, editor improvements, and performance.

- Lazy Monaco loading and documented dual-engine roles
- Note local history with timeline UI
- Keyboard shortcut editor
- Hunspell locales and self-hosted LanguageTool default
- Toast notification queue
- Design token extraction from monolithic CSS
- Web Worker graph layout and Canvas2D renderer
- Graph keyboard navigation and axe CI integration
- Three-way conflict UI with line metadata
- Scheduled vault backup UI
- Obsidian vault importer
- Preview worker 250ms CI budget
- Omnibar (FTS note hits in command palette)
- Vault-portable graph and saved-view presets
- Print/page-break export preview
- In-app performance HUD
- Canvas `resvg` snapshot offloaded to worker thread
- Background textbundle export

Architecture docs: [`docs/architecture/EDITOR_ENGINES.md`](architecture/EDITOR_ENGINES.md), [`docs/architecture/PERFORMANCE_ARCHITECTURE.md`](architecture/PERFORMANCE_ARCHITECTURE.md)

---

## Phase D — Platform and ecosystem

Extensibility, integrations, and new platforms.

- Tauri auto-updater with signed channels
- Deep links and file associations
- System tray quick capture
- Daemon tracing and structured telemetry
- Native Rust citation engine evaluation
- Zotero read-only connector
- Ollama/local LLM MCP backend
- Local embeddings and vector index for semantic search
- Tantivy evaluation (if FTS budget missed)
- WASM plugin runtime with signed marketplace
- Plugin author guide and reference plugins
- Headless SSG/CI export pipeline
- Internationalization framework
- Flatpak and ARM64 releases
- Mobile foreground-only architecture
- Optional vault encryption at rest
- Example vault gallery
- Devcontainer and nix flake

Architecture docs: [`docs/architecture/WASM_PLUGINS.md`](architecture/WASM_PLUGINS.md), [`docs/architecture/LOCAL_EMBEDDINGS.md`](architecture/LOCAL_EMBEDDINGS.md), [`docs/architecture/HEADLESS_SSG.md`](architecture/HEADLESS_SSG.md), [`docs/architecture/I18N_FRAMEWORK.md`](architecture/I18N_FRAMEWORK.md), [`docs/architecture/ENCRYPTION_AT_REST.md`](architecture/ENCRYPTION_AT_REST.md), [`docs/architecture/CITATION_ENGINE_EVAL.md`](architecture/CITATION_ENGINE_EVAL.md)

---

## Stable channel criteria

- Overall audit score ≥ 82 with no dimension below 75
- All P0 safety and data integrity items complete
- `pnpm check:release` green on Ubuntu and Windows
- Functional E2E covering save, rename, conflict, export, headless switch
