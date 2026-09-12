# Command-Katalog

[English](COMMAND_CATALOG.md) · [简体中文](COMMAND_CATALOG.zh-CN.md) · [Русский](COMMAND_CATALOG.ru.md) · **Deutsch** · [Español](COMMAND_CATALOG.es.md) · [فارسی](COMMAND_CATALOG.fa.md)

## Benennung

Commands verwenden Punktnamen:

```text
area.action
```

Beispiele: `vault.open`, `note.save`, `index.rebuild`, `graph.backlinks`, `export.run`, `git.status`, `mcp.search`.

## Kanonische Command-Namen

| Command | Owner | Permission | Input Contract | Output Contract | Rollback |
|---|---|---|---|---|---|
| `vault.open` | `rust-vault` | `read` | `OpenVaultInput` | `OpenVaultOutput` | Keine Mutation außer Derived Session State. |
| `vault.health` | `rust-indexer` | `read` | `vaultId` | `VaultHealthReport` | Keine Mutation. |
| `note.read` | `rust-vault` | `read` | `ReadNoteInput` | `ReadNoteOutput` | Keine Mutation. |
| `note.save` | `rust-vault` | `write-approved` | `SaveNoteInput` | `SaveNoteOutput` | Atomic Write Recovery Artifact. |
| `note.rename.dryRun` | `rust-vault` | `read` | `RenameNoteDryRunInput` | `RenameNoteDryRunOutput` | Keine Mutation. |
| `note.rename.apply` | `rust-vault` | `write-approved` | Dry-run id + confirmation | Rename result | Patch Log + Backups. |
| `index.rebuild` | `rust-indexer` | `system` | `vaultId` | `JobDescriptor` | Derived Cache löschen/neu aufbauen. |
| `graph.query` | `rust-indexer` | `read` | `GraphQueryInput` | `GraphQueryOutput` | Keine Mutation. |
| `graph.backlinks` | `rust-indexer` | `read` | `BacklinksInput` | `BacklinksOutput` | Keine Mutation. |
| `canvas.query` | `rust-canvas` | `read` | `CanvasQueryInput` | `CanvasQueryOutput` | Keine Mutation. |
| `canvas.snapshot` | `rust-canvas` | `system` | `CanvasSnapshotInput` | `CanvasSnapshotOutput` | Snapshot Temp Workspace löschen. |
| `canvas.applyTemplate` | `rust-canvas` | `write-approved` | Template id + target canvas | Canvas patch result | Patch Log + Undo Checkpoint. |
| `export.run` | `rust-export` | `system` | `RunExportInput` | `RunExportOutput` | Export Temp Workspace löschen. |
| `git.status` | `rust-git` | `read` | `vaultId` | Git status summary | Keine Mutation. |
| `git.commitSelected` | `rust-git` | `write-approved` | Selected paths + message | Commit result | Git History zeichnet Operation auf. |
| `mcp.search` | `mcp` | `read` | Search query | Search results | Nur Audit Record. |
| `mcp.proposePatch` | `mcp` | `write-approved` | Draft patch | Approval request | Kein Write vor Approval. |

## Implementierte Tauri-Surface (desktop v1.x)

Dotted Command Names mappen auf snake_case `invoke` Commands und Event Channels in `apps/desktop/src-tauri`. Diese Tabelle ist der aktuell ausgelieferte Command Contract.

| Surface | Kind | Owner | Notes |
|---|---|---|---|
| `vault_open`, `vault_scan`, `vault_read_note`, `vault_save_note`, … | command | Vault Kernel | Rename dry-run/apply, Config load/save, Daily Note Plan, Save dry-run, Recent-Note MRU. |
| `vault_list_recent_notes`, `vault_record_recent_note` | command | Vault Kernel | `.scriptor/recent.json` MRU list. |
| `vault:filesystem-changed` | event | Vault Kernel | Debounced watcher; Payload sind changed relative paths. |
| `indexer_rebuild`, `indexer_update_note`, `indexer_apply_filesystem_changes` | command | Knowledge Graph | Full rebuild vs single-note vs batched incremental (watcher). |
| `indexer_search`, `indexer_backlinks`, `indexer_graph`, knowledge list commands | command | Knowledge Graph | Search, Graph, Orphans, Bibliography, Recent Files usw. |
| `indexer_list_recent_files`, `indexer_record_recent_access` | command | Knowledge Graph | SQLite `recent_access` MRU. |
| `export_discover`, `export_run_note`, `export_start_note`, `export_cancel` | command | Publication | Sync run vs Async Job mit Cancel Slot. |
| `export:progress`, `export:finished`, `export:failed` | event | Publication | Stderr Streaming und Job Completion. |
| `git_status_cmd`, `git_commit_cmd`, `git_pull_cmd`, `git_push_cmd`, `git_resolve_conflict_cmd`, `git_read_conflict_markers_cmd` | command | Native Platform | Git Integration + Conflict Marker Preview. |
| `vault_delete_note`, `vault_frontmatter_set`, `vault_textbundle_export`, `vault_read_stats_history`, `vault_append_stats_history` | command | Vault Kernel | Note Delete, FM Field Set, TextBundle, Writing Stats. |
| `indexer_traverse_graph`, `indexer_execute_dql` | command | Knowledge Graph | Graph Traversal + Foam-style DQL. |
| `canvas_*`, `diagnostics_append_event`, `system_info` | command | Canvas / Platform | Canvas Hit-Test, Templates, Snapshots. |
| `daemon_ping`, `daemon_endpoint`, `daemon_start` | command | Headless IPC | Process Lifecycle und Health Probe. |
| `daemon_open_vault` | command | Headless IPC | Vault in Daemon Session öffnen (postcard RPC). |
| `daemon_health_diagnostics`, `daemon_health_report` | command | Headless IPC | Vault Lint + Indexer Health JSON. |
| `daemon_rebuild_index` | command | Headless IPC | Full Cache Rebuild + Health Summary. |
| `daemon_search`, `daemon_list_note_summaries` | command | Headless IPC | FTS Search und Note Index Listing. |
| `daemon_backlinks`, `daemon_graph` | command | Headless IPC | Backlinks und Focused Graph Summary. |
| `daemon_git_status` | command | Headless IPC | Git Status JSON für Vault Root. |
| `daemon_save_note`, `daemon_update_note_index` | command | Headless IPC | Note Save + Single-Note Index Refresh. |
| `daemon_rename_apply` | command | Headless IPC | Rename Apply + Affected-File Index Refresh. |
| `daemon_export_run_note`, `daemon_export_run_markdown` | command | Headless IPC | Pandoc Export: Disk Note oder Preprocessed Markdown. |

Frontend wrappers: `src/bridge/commands.ts` (re-export `src/bridge/commands/*`), `src/bridge/canvas.ts`, `src/bridge/native.ts`, `src/bridge/vaultEvents.ts`, `src/bridge/exportEvents.ts`, `src/hooks/useHeadlessEngine.ts`.

Headless routing: Bei aktivem Settings → Headless engine delegieren `indexer.ts`, `git.ts`, `vault.ts` (save/rename) und `export.ts` an `daemon_*` statt In-Process Commands.

## Daemon RPC Methods (`scriptor-daemon`)

Postcard-framed IPC; siehe [`architecture/IPC_DAEMON.md`](../architecture/IPC_DAEMON.md).

| RPC method | Permission | Notes |
|---|---|---|
| `Ping` | read | Liveness und Version. |
| `OpenVault` | system | Vault Root an Session binden. |
| `ListNotes` | read | Note Index Summaries. |
| `SearchNotes` | read | FTS Query mit Limit. |
| `ReadNote` | read | Einzelner Note Body (CLI/TUI; Desktop nutzt In-Process Read). |
| `RebuildIndex` | system | Derived Cache Rebuild. |
| `HealthDiagnostics`, `HealthReport` | read | Lint und Indexer Health. |
| `GitStatus` | read | Native Git Status JSON. |
| `Backlinks`, `GraphSummary` | read | Graph Queries. |
| `ReloadConfig` | system | `.scriptor/config.json` neu laden. |
| `SaveNote` | write-approved | Atomic Note Save + Incremental Index Update. |
| `UpdateNoteIndex` | system | Einzelnen Note Path neu indexieren. |
| `RenameNoteApply` | write-approved | Rename Apply + Affected-File Index Refresh. |
| `ExportRunNote` | system | Pandoc Export aus Vault Note auf Disk. |
| `ExportRunMarkdown` | system | Pandoc Export aus caller-supplied Markdown. |

## MCP stdio Bridge (CLI Subprocess)

Bei `pnpm mcp:stdio` außerhalb der Desktop Shell setzen:

| Variable | Zweck |
|---|---|
| `SCRIPTOR_VAULT` | Absoluter Pfad zum Open Vault Root; erforderlich für real Note/Search Context. |
| `SCRIPTOR_CLI` | Optionaler Pfad zum `scriptor` CLI Binary; Standard ist `scriptor` in `PATH`. |
| `SCRIPTOR_MCP_MODE` | Permission Mode: `off`, `read-only`, `draft`, `write-approved`; Standard `read-only`. |

Implementation: `packages/mcp/src/cli-vault-context.ts`, `packages/mcp/src/stdio-server.ts`.

## Command Review Checklist

Bei neuem Command/RPC Method:

- Owner Module und Permission Class vorhanden;
- typed Input/Output (Rust + TS Contracts wo relevant);
- stable Error Strings/Codes für UI;
- Audit Behavior bei MCP/AI Invoke;
- Rollback Note oder explizite No-Mutation Declaration;
- Fixture, Smoke Script oder Unit Test Coverage.
