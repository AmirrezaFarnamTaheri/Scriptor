# Каталог команд

[English](COMMAND_CATALOG.md) · [简体中文](COMMAND_CATALOG.zh-CN.md) · **Русский** · [Deutsch](COMMAND_CATALOG.de.md) · [Español](COMMAND_CATALOG.es.md) · [فارسی](COMMAND_CATALOG.fa.md)

## Именование

Команды используют dotted names:

```text
area.action
```

Примеры: `vault.open`, `note.save`, `index.rebuild`, `graph.backlinks`, `export.run`, `git.status`, `mcp.search`.

## Канонические имена команд

| Command | Owner | Permission | Input Contract | Output Contract | Rollback |
|---|---|---|---|---|---|
| `vault.open` | `rust-vault` | `read` | `OpenVaultInput` | `OpenVaultOutput` | Нет mutation, кроме derived session state. |
| `vault.health` | `rust-indexer` | `read` | `vaultId` | `VaultHealthReport` | Нет mutation. |
| `note.read` | `rust-vault` | `read` | `ReadNoteInput` | `ReadNoteOutput` | Нет mutation. |
| `note.save` | `rust-vault` | `write-approved` | `SaveNoteInput` | `SaveNoteOutput` | Atomic write recovery artifact. |
| `note.rename.dryRun` | `rust-vault` | `read` | `RenameNoteDryRunInput` | `RenameNoteDryRunOutput` | Нет mutation. |
| `note.rename.apply` | `rust-vault` | `write-approved` | Dry-run id + confirmation | Rename result | Patch log + backups. |
| `index.rebuild` | `rust-indexer` | `system` | `vaultId` | `JobDescriptor` | Удаление/перестройка derived cache. |
| `graph.query` | `rust-indexer` | `read` | `GraphQueryInput` | `GraphQueryOutput` | Нет mutation. |
| `graph.backlinks` | `rust-indexer` | `read` | `BacklinksInput` | `BacklinksOutput` | Нет mutation. |
| `canvas.query` | `rust-canvas` | `read` | `CanvasQueryInput` | `CanvasQueryOutput` | Нет mutation. |
| `canvas.snapshot` | `rust-canvas` | `system` | `CanvasSnapshotInput` | `CanvasSnapshotOutput` | Удаление snapshot temp workspace. |
| `canvas.applyTemplate` | `rust-canvas` | `write-approved` | Template id + target canvas | Canvas patch result | Patch log + undo checkpoint. |
| `export.run` | `rust-export` | `system` | `RunExportInput` | `RunExportOutput` | Удаление export temp workspace. |
| `git.status` | `rust-git` | `read` | `vaultId` | Git status summary | Нет mutation. |
| `git.commitSelected` | `rust-git` | `write-approved` | Selected paths + message | Commit result | Git history фиксирует operation. |
| `mcp.search` | `mcp` | `read` | Search query | Search results | Только audit record. |
| `mcp.proposePatch` | `mcp` | `write-approved` | Draft patch | Approval request | Нет write до approval. |

## Реализованная Tauri surface (desktop v1.x)

Dotted command names отображаются на snake_case `invoke` commands и event channels в `apps/desktop/src-tauri`. Таблица — текущий shipped command contract.

| Surface | Kind | Owner | Notes |
|---|---|---|---|
| `vault_open`, `vault_scan`, `vault_read_note`, `vault_save_note`, … | command | Vault Kernel | Rename dry-run/apply, config load/save, daily note plan, save dry-run, recent-note MRU. |
| `vault_list_recent_notes`, `vault_record_recent_note` | command | Vault Kernel | `.scriptor/recent.json` MRU list. |
| `vault:filesystem-changed` | event | Vault Kernel | Debounced watcher; payload — changed relative paths. |
| `indexer_rebuild`, `indexer_update_note`, `indexer_apply_filesystem_changes` | command | Knowledge Graph | Full rebuild, single-note, batched incremental (watcher). |
| `indexer_search`, `indexer_backlinks`, `indexer_graph`, knowledge list commands | command | Knowledge Graph | Search, graph, orphans, bibliography, recent files и др. |
| `indexer_list_recent_files`, `indexer_record_recent_access` | command | Knowledge Graph | SQLite `recent_access` MRU. |
| `export_discover`, `export_run_note`, `export_start_note`, `export_cancel` | command | Publication | Sync run и async job с cancel slot. |
| `export:progress`, `export:finished`, `export:failed` | event | Publication | Stderr streaming и job completion. |
| `git_status_cmd`, `git_commit_cmd`, `git_pull_cmd`, `git_push_cmd`, `git_resolve_conflict_cmd`, `git_read_conflict_markers_cmd` | command | Native Platform | Git integration + conflict marker preview. |
| `vault_delete_note`, `vault_frontmatter_set`, `vault_textbundle_export`, `vault_read_stats_history`, `vault_append_stats_history` | command | Vault Kernel | Note delete, FM field set, TextBundle, writing stats. |
| `indexer_traverse_graph`, `indexer_execute_dql` | command | Knowledge Graph | Graph traversal + Foam-style DQL. |
| `canvas_*`, `diagnostics_append_event`, `system_info` | command | Canvas / Platform | Canvas hit-test, templates, snapshots. |
| `daemon_ping`, `daemon_endpoint`, `daemon_start` | command | Headless IPC | Process lifecycle и health probe. |
| `daemon_open_vault` | command | Headless IPC | Open vault в daemon session (postcard RPC). |
| `daemon_health_diagnostics`, `daemon_health_report` | command | Headless IPC | Vault lint + indexer health JSON. |
| `daemon_rebuild_index` | command | Headless IPC | Full cache rebuild + health summary. |
| `daemon_search`, `daemon_list_note_summaries` | command | Headless IPC | FTS search и note index listing. |
| `daemon_backlinks`, `daemon_graph` | command | Headless IPC | Backlinks и focused graph summary. |
| `daemon_git_status` | command | Headless IPC | Git status JSON для vault root. |
| `daemon_save_note`, `daemon_update_note_index` | command | Headless IPC | Note save + single-note index refresh. |
| `daemon_rename_apply` | command | Headless IPC | Note rename apply + affected-file index refresh. |
| `daemon_export_run_note`, `daemon_export_run_markdown` | command | Headless IPC | Pandoc export: disk note или preprocessed Markdown. |

Frontend wrappers: `src/bridge/commands.ts` (re-export `src/bridge/commands/*`), `src/bridge/canvas.ts`, `src/bridge/native.ts`, `src/bridge/vaultEvents.ts`, `src/bridge/exportEvents.ts`, `src/hooks/useHeadlessEngine.ts`.

Headless routing: при включённом Settings → Headless engine `indexer.ts`, `git.ts`, `vault.ts` (save/rename) и `export.ts` делегируют в `daemon_*`, а не in-process commands.

## Daemon RPC methods (`scriptor-daemon`)

Postcard-framed IPC; см. [`architecture/IPC_DAEMON.md`](../architecture/IPC_DAEMON.md).

| RPC method | Permission | Notes |
|---|---|---|
| `Ping` | read | Liveness/version. |
| `OpenVault` | system | Bind vault root для session. |
| `ListNotes` | read | Note index summaries. |
| `SearchNotes` | read | FTS query с limit. |
| `ReadNote` | read | Single note body (CLI/TUI; desktop использует in-process read). |
| `RebuildIndex` | system | Derived cache rebuild. |
| `HealthDiagnostics`, `HealthReport` | read | Lint/indexer health. |
| `GitStatus` | read | Native git status JSON. |
| `Backlinks`, `GraphSummary` | read | Graph queries. |
| `ReloadConfig` | system | Reload `.scriptor/config.json`. |
| `SaveNote` | write-approved | Atomic note save + incremental index update. |
| `UpdateNoteIndex` | system | Re-index single note path. |
| `RenameNoteApply` | write-approved | Rename apply + affected-file index refresh. |
| `ExportRunNote` | system | Pandoc export из vault note на диске. |
| `ExportRunMarkdown` | system | Pandoc export из markdown, переданного caller. |

## MCP stdio bridge (CLI subprocess)

При `pnpm mcp:stdio` вне desktop shell задайте:

| Variable | Purpose |
|---|---|
| `SCRIPTOR_VAULT` | Абсолютный путь к open vault root; нужен для real note/search context. |
| `SCRIPTOR_CLI` | Необязательный путь к `scriptor` CLI; default — `scriptor` в `PATH`. |
| `SCRIPTOR_MCP_MODE` | Permission mode: `off`, `read-only`, `draft`, `write-approved`; default `read-only`. |

Implementation: `packages/mcp/src/cli-vault-context.ts`, `packages/mcp/src/stdio-server.ts`.

## Command Review Checklist

При добавлении нового command/RPC method:

- есть owner module и permission class;
- typed input/output (Rust + TS contracts, где применимо);
- stable error strings/codes для UI;
- audit behavior при MCP/AI invoke;
- rollback note или explicit no-mutation declaration;
- fixture, smoke script или unit test coverage.
