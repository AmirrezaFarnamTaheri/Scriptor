# Command Catalog

## Naming

Commands use dotted names:

```text
area.action
```

Examples:

- `vault.open`
- `note.save`
- `index.rebuild`
- `graph.backlinks`
- `export.run`
- `git.status`
- `mcp.search`

## Canonical Command Names

| Command | Owner | Permission | Input Contract | Output Contract | Rollback |
|---|---|---|---|---|---|
| `vault.open` | `rust-vault` | `read` | `OpenVaultInput` | `OpenVaultOutput` | No mutation except derived session state. |
| `vault.health` | `rust-indexer` | `read` | `vaultId` | `VaultHealthReport` | No mutation. |
| `note.read` | `rust-vault` | `read` | `ReadNoteInput` | `ReadNoteOutput` | No mutation. |
| `note.save` | `rust-vault` | `write-approved` | `SaveNoteInput` | `SaveNoteOutput` | Atomic write recovery artifact. |
| `note.rename.dryRun` | `rust-vault` | `read` | `RenameNoteDryRunInput` | `RenameNoteDryRunOutput` | No mutation. |
| `note.rename.apply` | `rust-vault` | `write-approved` | Dry-run id plus confirmation | Rename result | Patch log and backups. |
| `index.rebuild` | `rust-indexer` | `system` | `vaultId` | `JobDescriptor` | Delete and rebuild derived cache. |
| `graph.query` | `rust-indexer` | `read` | `GraphQueryInput` | `GraphQueryOutput` | No mutation. |
| `graph.backlinks` | `rust-indexer` | `read` | `BacklinksInput` | `BacklinksOutput` | No mutation. |
| `canvas.query` | `rust-canvas` | `read` | `CanvasQueryInput` | `CanvasQueryOutput` | No mutation. |
| `canvas.snapshot` | `rust-canvas` | `system` | `CanvasSnapshotInput` | `CanvasSnapshotOutput` | Snapshot temp workspace deletion. |
| `canvas.applyTemplate` | `rust-canvas` | `write-approved` | Template id plus target canvas | Canvas patch result | Patch log and undo checkpoint. |
| `export.run` | `rust-export` | `system` | `RunExportInput` | `RunExportOutput` | Export temp workspace deletion. |
| `git.status` | `rust-git` | `read` | `vaultId` | Git status summary | No mutation. |
| `git.commitSelected` | `rust-git` | `write-approved` | Selected paths and message | Commit result | Git history records operation. |
| `mcp.search` | `mcp` | `read` | Search query | Search results | Audit record only. |
| `mcp.proposePatch` | `mcp` | `write-approved` | Draft patch | Approval request | No write until approved. |

## Implemented Tauri surface (desktop v1.x)

Draft dotted names above map to snake_case `invoke` commands and event channels in `apps/desktop/src-tauri`. This table tracks what ships today; migrate toward dotted names when contracts stabilize.

| Surface | Kind | Owner | Notes |
|---|---|---|---|
| `vault_open`, `vault_scan`, `vault_read_note`, `vault_save_note`, … | command | Vault Kernel | Includes rename dry-run/apply, config load/save, daily note plan, save dry-run, recent-note MRU. |
| `vault_list_recent_notes`, `vault_record_recent_note` | command | Vault Kernel | `.scriptor/recent.json` MRU list. |
| `vault:filesystem-changed` | event | Vault Kernel | Debounced watcher; payload is changed relative paths. |
| `indexer_rebuild`, `indexer_update_note`, `indexer_apply_filesystem_changes` | command | Knowledge Graph | Full rebuild vs single-note vs batched incremental (watcher). |
| `indexer_search`, `indexer_backlinks`, `indexer_graph`, knowledge list commands | command | Knowledge Graph | Search, graph, orphans, bibliography, recent files, etc. |
| `indexer_list_recent_files`, `indexer_record_recent_access` | command | Knowledge Graph | SQLite `recent_access` MRU. |
| `export_discover`, `export_run_note`, `export_start_note`, `export_cancel` | command | Publication | Sync run vs async job with cancel slot. |
| `export:progress`, `export:finished`, `export:failed` | event | Publication | Stderr streaming and job completion. |
| `git_status_cmd`, `git_commit_cmd`, `git_pull_cmd`, `git_push_cmd`, `git_resolve_conflict_cmd`, `git_read_conflict_markers_cmd` | command | Native Platform | Git integration + conflict marker preview. |
| `vault_delete_note`, `vault_frontmatter_set`, `vault_textbundle_export`, `vault_read_stats_history`, `vault_append_stats_history` | command | Vault Kernel | Note delete, FM field set, TextBundle, writing stats. |
| `indexer_traverse_graph`, `indexer_execute_dql` | command | Knowledge Graph | Graph traversal + Foam-style DQL. |
| `canvas_*`, `diagnostics_append_event`, `system_info` | command | Canvas / Platform | Canvas hit-test, templates, snapshots. |
| `daemon_ping`, `daemon_endpoint`, `daemon_start` | command | Headless IPC | Process lifecycle and health probe. |
| `daemon_open_vault` | command | Headless IPC | Open vault in daemon session (postcard RPC). |
| `daemon_health_diagnostics`, `daemon_health_report` | command | Headless IPC | Vault lint + indexer health JSON. |
| `daemon_rebuild_index` | command | Headless IPC | Full cache rebuild + health summary. |
| `daemon_search`, `daemon_list_note_summaries` | command | Headless IPC | FTS search and note index listing. |
| `daemon_backlinks`, `daemon_graph` | command | Headless IPC | Backlinks and focused graph summary. |
| `daemon_git_status` | command | Headless IPC | Git status JSON for vault root. |
| `daemon_save_note`, `daemon_update_note_index` | command | Headless IPC | Note save and single-note index refresh. |
| `daemon_rename_apply` | command | Headless IPC | Note rename apply + affected-file index refresh. |
| `daemon_export_run_note`, `daemon_export_run_markdown` | command | Headless IPC | Pandoc export (disk note or preprocessed markdown). |

Frontend wrappers: `src/bridge/commands.ts` (re-exports `src/bridge/commands/*`), `src/bridge/canvas.ts`, `src/bridge/native.ts`, `src/bridge/vaultEvents.ts`, `src/bridge/exportEvents.ts`, `src/bridge/headlessMode.ts`.

Headless routing: when Settings → Headless engine is on, `indexer.ts`, `git.ts`, `vault.ts` (save/rename), and `export.ts` delegate to `daemon_*` instead of in-process commands.

## Daemon RPC methods (`scriptor-daemon`)

Postcard-framed IPC; see [`architecture/IPC_DAEMON.md`](../architecture/IPC_DAEMON.md).

| RPC method | Permission | Notes |
|---|---|---|
| `Ping` | read | Liveness and version. |
| `OpenVault` | system | Bind vault root for session. |
| `ListNotes` | read | Note index summaries. |
| `SearchNotes` | read | FTS query with limit. |
| `ReadNote` | read | Single note body (CLI/TUI; desktop uses in-process read). |
| `RebuildIndex` | system | Derived cache rebuild. |
| `HealthDiagnostics`, `HealthReport` | read | Lint and indexer health. |
| `GitStatus` | read | Native git status JSON. |
| `Backlinks`, `GraphSummary` | read | Graph queries. |
| `ReloadConfig` | system | Reload `.scriptor/config.json`. |
| `SaveNote` | write-approved | Atomic note save + incremental index update. |
| `UpdateNoteIndex` | system | Re-index a single note path. |
| `RenameNoteApply` | write-approved | Note rename apply + affected-file index refresh. |
| `ExportRunNote` | system | Pandoc export from vault note on disk. |
| `ExportRunMarkdown` | system | Pandoc export from caller-supplied markdown. |

## MCP stdio bridge (CLI subprocess)

When running `pnpm mcp:stdio` outside the desktop shell, set:

| Variable | Purpose |
|---|---|
| `SCRIPTOR_VAULT` | Absolute path to an open vault root (required for real note/search context). |
| `SCRIPTOR_CLI` | Optional path to `scriptor` CLI binary (defaults to `scriptor` on `PATH`). |
| `SCRIPTOR_MCP_MODE` | Permission mode: `off`, `read-only`, `draft`, or `write-approved` (default `read-only`). |

Implementation: `packages/mcp/src/cli-vault-context.ts`, `packages/mcp/src/stdio-server.ts`.

## Command Review Checklist

Use when adding a new command or RPC method:

- Has owner module and permission class.
- Has typed input/output (Rust + TS contracts where applicable).
- Has stable error strings or codes for UI surfacing.
- Has audit behavior when invoked by MCP or AI.
- Has rollback note or explicit no-mutation declaration.
- Has fixture, smoke script, or unit test coverage.

