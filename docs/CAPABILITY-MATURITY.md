# Capability maturity ledger

This ledger is authoritative for support claims. “Implemented” means source exists; “Supported” additionally requires integrated tests, release inclusion, docs, and an owner. “Experimental” is opt-in and may change. “Design-only” must not be presented as available.

| Capability | Status | Source / evidence | Release posture |
|---|---|---|---|
| Markdown vault read/write/config | Supported | `crates/vault/`, Tauri/daemon adapters | Included |
| SQLite/FTS indexing and search | Supported | `crates/indexer/` | Included |
| Backlinks/knowledge/graph | Supported, bounded | `crates/indexer/src/knowledge.rs`, `graph.rs` | Included |
| Desktop workspace | Supported | `src/`, `apps/desktop/` | Included |
| Vault PDF/EPUB reader with annotations | Experimental | `src/components/reader/`, `apps/desktop/src-tauri/src/commands/reader.rs`, `.scriptor/reader/annotations.json` | Local desktop only; requires full browser/accessibility and release-gate proof before support claim |
| Markdown-backed task editing | Experimental | `crates/indexer/src/tasks.rs`, `src/components/TaskPanel.tsx` | Updates source Markdown through the vault write path; requires clean-environment end-to-end proof before support claim |
| Markdown Kanban | Experimental | `crates/indexer/src/kanban.rs`, `src/components/KanbanPanel.tsx` | Card moves relocate source text under `##` headings; requires browser-flow proof before support claim |
| CodeMirror Markdown editor | Default supported editor | `packages/editor/src/codemirror.tsx` | Included |
| Monaco editor | Advanced/lazy editor | `src/components/shell/EditorWorkspace.tsx` | Included, non-default |
| Git operations/conflict UI | Supported | `crates/native-git/`, `src/components/GitPanel.tsx` | Included |
| Export/Pandoc profiles | Supported with external-tool policy | `crates/export-runner/`, `packages/export/` | Included; Pandoc separate |
| Citation parsing/bibliography UI | Supported, bounded | `crates/indexer/src/citations.rs`, renderer citeproc path | Included; local bibliography data, no Zotero sync claim |
| Local Starlight publishing | Experimental | `crates/publish-runner/`, desktop plan/review/apply, CLI adapter | Local output only; source/security contracts pass, full Cargo/browser release proof still required |
| Canvas | Supported | `crates/canvas-engine/`, `packages/canvas/` | Included |
| Daemon IPC / CLI / TUI | Supported | `crates/daemon/`, `crates/ipc/`, `crates/cli/` | Daemon sidecar included |
| MCP stdio tools | Supported with audit/authorization | `crates/daemon/src/mcp_stdio.rs`, `packages/mcp/` | Included |
| Manifest-first plugins | Experimental | `packages/plugin-api/` | First-party catalog only |
| External code chunks | Experimental/high-risk | process broker + user confirmation | Opt-in |
| AI provider requests | Experimental opt-in | native keychain/network boundary | Opt-in |
| Local recovery snapshots | Supported | `commands/backup.rs` | Included |
| External DR backups | Supported foundation; drill required per release | `commands/backup.rs` | Included |
| Encrypted vaults | Experimental primitives only | `crates/vault/src/encryption.rs` | Not a supported vault mode |
| Rust citation-engine prototype | Incubating | `crates/citation-engine/` | Workspace-only prototype; not composed into desktop/daemon/CLI |
| Zotero Web API connector | Experimental / library-only | `packages/zotero-connector/` | Read-only library; not composed into the product and no shipped sync UI |
| Local embeddings | Incubating | `crates/embeddings/` | Excluded from default workspace build |
| Tantivy index | Evaluation | `crates/tantivy-indexer/` | Excluded from default workspace build |
| WASM plugin host | Incubating | `crates/wasm-runtime/` | Excluded from default workspace build |
| Mobile app | Design-only | `docs/architecture/MOBILE_ARCHITECTURE.md` | Not shipped |
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
