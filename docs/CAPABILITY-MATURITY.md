# Capability maturity ledger

This ledger is authoritative for support claims. “Implemented” means source exists; “Supported” additionally requires integrated tests, release inclusion, docs, and an owner. “Experimental” is opt-in and may change. “Design-only” must not be presented as available.

| Capability | Status | Source / evidence | Release posture |
|---|---|---|---|
| Markdown vault read/write/config | Supported | `crates/vault/`, Tauri/daemon adapters | Included |
| SQLite/FTS indexing and search | Supported | `crates/indexer/` | Included |
| Backlinks/knowledge/graph | Supported, bounded | `crates/indexer/src/knowledge.rs`, `graph.rs` | Included |
| Desktop workspace | Supported | `src/`, `apps/desktop/` | Included |
| CodeMirror Markdown editor | Default supported editor | `packages/editor/src/codemirror.tsx` | Included |
| Monaco editor | Advanced/lazy compatibility editor | `src/components/shell/EditorWorkspace.tsx` | Included, non-default |
| Git operations/conflict UI | Supported | `crates/native-git/`, `src/components/GitPanel.tsx` | Included |
| Export/Pandoc profiles | Supported with external-tool policy | `crates/export-runner/`, `packages/export/` | Included; Pandoc separate |
| Canvas | Supported | `crates/canvas-engine/`, `packages/canvas/` | Included |
| Daemon IPC / CLI / TUI | Supported | `crates/daemon/`, `crates/ipc/`, `crates/cli/` | Daemon sidecar included |
| MCP stdio tools | Supported with audit/authorization | `crates/daemon/src/mcp_stdio.rs`, `packages/mcp/` | Included |
| Manifest-first plugins | Experimental | `packages/plugin-api/` | First-party catalog only |
| External code chunks | Experimental/high-risk | process broker + user confirmation | Opt-in |
| AI provider requests | Experimental opt-in | native keychain/network boundary | Opt-in |
| Local recovery snapshots | Supported | `commands/backup.rs` | Included |
| External DR backups | Supported foundation; drill required per release | `commands/backup.rs` | Included |
| Encrypted vaults | Experimental primitives only | `crates/vault/src/encryption.rs` | Not a supported vault mode |
| Local embeddings | Incubating | `crates/embeddings/` | Excluded from default workspace build |
| Tantivy index | Evaluation | `crates/tantivy-indexer/` | Excluded from default workspace build |
| WASM plugin host | Incubating | `crates/wasm-runtime/` | Excluded from default workspace build |
| Mobile app | Design-only | `docs/architecture/MOBILE_ARCHITECTURE.md` | Not shipped |
| Signed public plugin marketplace | Design-only | plugin graduation requirements | Not shipped |
| Built-in self updater | Disabled | updater plugin/permission removed | Not shipped |

## Graduation gate

A capability moves to Supported only when all are present:

1. named owner and support window;
2. stable public contract and migration policy;
3. positive, negative, restart, cancellation, and recovery tests;
4. authorization/privacy model;
5. bounded performance evidence;
6. user and operator docs;
7. release inclusion and artifact verification;
8. changelog entry.
