# 命令目录

[English](COMMAND_CATALOG.md) · **简体中文** · [Русский](COMMAND_CATALOG.ru.md) · [Deutsch](COMMAND_CATALOG.de.md) · [Español](COMMAND_CATALOG.es.md) · [فارسی](COMMAND_CATALOG.fa.md)

## 命名

命令采用点分名称：

```text
area.action
```

例如：`vault.open`、`note.save`、`index.rebuild`、`graph.backlinks`、`export.run`、`git.status`、`mcp.search`。

## 规范命令名

| Command | Owner | Permission | Input Contract | Output Contract | Rollback |
|---|---|---|---|---|---|
| `vault.open` | `rust-vault` | `read` | `OpenVaultInput` | `OpenVaultOutput` | 除派生 session state 外无修改。 |
| `vault.health` | `rust-indexer` | `read` | `vaultId` | `VaultHealthReport` | 无修改。 |
| `note.read` | `rust-vault` | `read` | `ReadNoteInput` | `ReadNoteOutput` | 无修改。 |
| `note.save` | `rust-vault` | `write-approved` | `SaveNoteInput` | `SaveNoteOutput` | 原子写 recovery artifact。 |
| `note.rename.dryRun` | `rust-vault` | `read` | `RenameNoteDryRunInput` | `RenameNoteDryRunOutput` | 无修改。 |
| `note.rename.apply` | `rust-vault` | `write-approved` | Dry-run id + confirmation | Rename result | Patch log + backups。 |
| `index.rebuild` | `rust-indexer` | `system` | `vaultId` | `JobDescriptor` | 删除并重建派生 cache。 |
| `graph.query` | `rust-indexer` | `read` | `GraphQueryInput` | `GraphQueryOutput` | 无修改。 |
| `graph.backlinks` | `rust-indexer` | `read` | `BacklinksInput` | `BacklinksOutput` | 无修改。 |
| `canvas.query` | `rust-canvas` | `read` | `CanvasQueryInput` | `CanvasQueryOutput` | 无修改。 |
| `canvas.snapshot` | `rust-canvas` | `system` | `CanvasSnapshotInput` | `CanvasSnapshotOutput` | 删除 snapshot 临时 workspace。 |
| `canvas.applyTemplate` | `rust-canvas` | `write-approved` | Template id + target canvas | Canvas patch result | Patch log + undo checkpoint。 |
| `export.run` | `rust-export` | `system` | `RunExportInput` | `RunExportOutput` | 删除 export 临时 workspace。 |
| `git.status` | `rust-git` | `read` | `vaultId` | Git status summary | 无修改。 |
| `git.commitSelected` | `rust-git` | `write-approved` | Selected paths + message | Commit result | Git history 记录操作。 |
| `mcp.search` | `mcp` | `read` | Search query | Search results | 仅 audit record。 |
| `mcp.proposePatch` | `mcp` | `write-approved` | Draft patch | Approval request | 批准前不写入。 |

## 已实现的 Tauri Surface（desktop v1.x）

点分 command name 映射到 `apps/desktop/src-tauri` 中的 snake_case `invoke` command 与 event channel。此表是当前已发布的 command contract。

| Surface | Kind | Owner | Notes |
|---|---|---|---|
| `vault_open`, `vault_scan`, `vault_read_note`, `vault_save_note`, … | command | Vault Kernel | rename dry-run/apply、config load/save、daily note plan、save dry-run、recent-note MRU。 |
| `vault_list_recent_notes`, `vault_record_recent_note` | command | Vault Kernel | `.scriptor/recent.json` MRU list。 |
| `vault:filesystem-changed` | event | Vault Kernel | Debounced watcher；payload 为 changed relative paths。 |
| `indexer_rebuild`, `indexer_update_note`, `indexer_apply_filesystem_changes` | command | Knowledge Graph | Full rebuild、single-note、batched incremental（watcher）。 |
| `indexer_search`, `indexer_backlinks`, `indexer_graph`, knowledge list commands | command | Knowledge Graph | Search、graph、orphans、bibliography、recent files 等。 |
| `indexer_list_recent_files`, `indexer_record_recent_access` | command | Knowledge Graph | SQLite `recent_access` MRU。 |
| `export_discover`, `export_run_note`, `export_start_note`, `export_cancel` | command | Publication | Sync run 与带 cancel slot 的 async job。 |
| `export:progress`, `export:finished`, `export:failed` | event | Publication | Stderr streaming 与 job completion。 |
| `git_status_cmd`, `git_commit_cmd`, `git_pull_cmd`, `git_push_cmd`, `git_resolve_conflict_cmd`, `git_read_conflict_markers_cmd` | command | Native Platform | Git integration + conflict marker preview。 |
| `vault_delete_note`, `vault_frontmatter_set`, `vault_textbundle_export`, `vault_read_stats_history`, `vault_append_stats_history` | command | Vault Kernel | note delete、FM field set、TextBundle、writing stats。 |
| `indexer_traverse_graph`, `indexer_execute_dql` | command | Knowledge Graph | Graph traversal + Foam-style DQL。 |
| `canvas_*`, `diagnostics_append_event`, `system_info` | command | Canvas / Platform | Canvas hit-test、templates、snapshots。 |
| `daemon_ping`, `daemon_endpoint`, `daemon_start` | command | Headless IPC | Process lifecycle 与 health probe。 |
| `daemon_open_vault` | command | Headless IPC | 在 daemon session 中打开 vault（postcard RPC）。 |
| `daemon_health_diagnostics`, `daemon_health_report` | command | Headless IPC | Vault lint + indexer health JSON。 |
| `daemon_rebuild_index` | command | Headless IPC | Full cache rebuild + health summary。 |
| `daemon_search`, `daemon_list_note_summaries` | command | Headless IPC | FTS search 与 note index listing。 |
| `daemon_backlinks`, `daemon_graph` | command | Headless IPC | Backlinks 与 focused graph summary。 |
| `daemon_git_status` | command | Headless IPC | Vault root 的 Git status JSON。 |
| `daemon_save_note`, `daemon_update_note_index` | command | Headless IPC | Note save + single-note index refresh。 |
| `daemon_rename_apply` | command | Headless IPC | Note rename apply + affected-file index refresh。 |
| `daemon_export_run_note`, `daemon_export_run_markdown` | command | Headless IPC | Pandoc export（磁盘 note 或预处理 Markdown）。 |

Frontend wrappers：`src/bridge/commands.ts`（re-export `src/bridge/commands/*`）、`src/bridge/canvas.ts`、`src/bridge/native.ts`、`src/bridge/vaultEvents.ts`、`src/bridge/exportEvents.ts`、`src/hooks/useHeadlessEngine.ts`。

Headless routing：Settings → Headless engine 启用时，`indexer.ts`、`git.ts`、`vault.ts`（save/rename）与 `export.ts` 委派给 `daemon_*`，而不是 in-process command。

## Daemon RPC 方法（`scriptor-daemon`）

Postcard-framed IPC；详见 [`architecture/IPC_DAEMON.md`](../architecture/IPC_DAEMON.md)。

| RPC method | Permission | Notes |
|---|---|---|
| `Ping` | read | Liveness 与 version。 |
| `OpenVault` | system | 将 vault root 绑定到 session。 |
| `ListNotes` | read | Note index summaries。 |
| `SearchNotes` | read | FTS query + limit。 |
| `ReadNote` | read | 单个 note body（CLI/TUI；desktop 用 in-process read）。 |
| `RebuildIndex` | system | Derived cache rebuild。 |
| `HealthDiagnostics`, `HealthReport` | read | Lint 与 indexer health。 |
| `GitStatus` | read | Native git status JSON。 |
| `Backlinks`, `GraphSummary` | read | Graph queries。 |
| `ReloadConfig` | system | Reload `.scriptor/config.json`。 |
| `SaveNote` | write-approved | Atomic note save + incremental index update。 |
| `UpdateNoteIndex` | system | Re-index 单个 note path。 |
| `RenameNoteApply` | write-approved | Note rename apply + affected-file index refresh。 |
| `ExportRunNote` | system | 从磁盘 vault note 执行 Pandoc export。 |
| `ExportRunMarkdown` | system | 从 caller 提供的 Markdown 执行 Pandoc export。 |

## MCP stdio Bridge（CLI subprocess）

在 desktop shell 外运行 `pnpm mcp:stdio` 时，设置：

| Variable | Purpose |
|---|---|
| `SCRIPTOR_VAULT` | Open vault root 的绝对路径；real note/search context 必需。 |
| `SCRIPTOR_CLI` | `scriptor` CLI binary 的可选 path；默认使用 `PATH` 中的 `scriptor`。 |
| `SCRIPTOR_MCP_MODE` | Permission mode：`off`、`read-only`、`draft`、`write-approved`；默认 `read-only`。 |

实现：`packages/mcp/src/cli-vault-context.ts`、`packages/mcp/src/stdio-server.ts`。

## Command Review Checklist

新增 command/RPC method 时检查：

- 有 owner module 与 permission class；
- 有 typed input/output（适用处 Rust + TS contracts）；
- 有供 UI 展示的 stable error strings/codes；
- MCP/AI 调用时有 audit behavior；
- 有 rollback note 或明确 no-mutation declaration；
- 有 fixture、smoke script 或 unit test coverage。
