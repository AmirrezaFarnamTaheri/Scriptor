<div dir="ltr" align="center">

[English](COMMAND_CATALOG.md) · **فارسی** · [简体中文](COMMAND_CATALOG.zh-CN.md) · [Русский](COMMAND_CATALOG.ru.md) · [Deutsch](COMMAND_CATALOG.de.md) · [Español](COMMAND_CATALOG.es.md)

</div>

<div dir="rtl" lang="fa" align="right">

# فهرست فرمان‌ها

## نام‌گذاری

فرمان‌ها از نام‌های نقطه‌ای استفاده می‌کنند:

</div>

<div dir="ltr" align="left">

```text
area.action
```

</div>

<div dir="rtl" lang="fa" align="right">

نمونه‌ها:

- `vault.open`
- `note.save`
- `index.rebuild`
- `graph.backlinks`
- `export.run`
- `git.status`
- `mcp.search`

## نام‌های canonical فرمان‌ها

| فرمان | owner | permission | قرارداد input | قرارداد output | rollback |
|---|---|---|---|---|---|
| `vault.open` | `rust-vault` | `read` | `OpenVaultInput` | `OpenVaultOutput` | بدون mutation، به‌جز state مشتق‌شده session. |
| `vault.health` | `rust-indexer` | `read` | `vaultId` | `VaultHealthReport` | بدون mutation. |
| `note.read` | `rust-vault` | `read` | `ReadNoteInput` | `ReadNoteOutput` | بدون mutation. |
| `note.save` | `rust-vault` | `write-approved` | `SaveNoteInput` | `SaveNoteOutput` | artifact بازیابی write اتمیک. |
| `note.rename.dryRun` | `rust-vault` | `read` | `RenameNoteDryRunInput` | `RenameNoteDryRunOutput` | بدون mutation. |
| `note.rename.apply` | `rust-vault` | `write-approved` | شناسه dry-run به‌همراه confirmation | نتیجه rename | patch log و backup. |
| `index.rebuild` | `rust-indexer` | `system` | `vaultId` | `JobDescriptor` | cache مشتق‌شده حذف و rebuild می‌شود. |
| `graph.query` | `rust-indexer` | `read` | `GraphQueryInput` | `GraphQueryOutput` | بدون mutation. |
| `graph.backlinks` | `rust-indexer` | `read` | `BacklinksInput` | `BacklinksOutput` | بدون mutation. |
| `canvas.query` | `rust-canvas` | `read` | `CanvasQueryInput` | `CanvasQueryOutput` | بدون mutation. |
| `canvas.snapshot` | `rust-canvas` | `system` | `CanvasSnapshotInput` | `CanvasSnapshotOutput` | workspace موقت snapshot حذف می‌شود. |
| `canvas.applyTemplate` | `rust-canvas` | `write-approved` | template id و canvas هدف | نتیجه patch Canvas | patch log و undo checkpoint. |
| `export.run` | `rust-export` | `system` | `RunExportInput` | `RunExportOutput` | workspace موقت export حذف می‌شود. |
| `git.status` | `rust-git` | `read` | `vaultId` | خلاصه Git status | بدون mutation. |
| `git.commitSelected` | `rust-git` | `write-approved` | pathهای انتخاب‌شده و message | نتیجه commit | تاریخچه Git عملیات را ثبت می‌کند. |
| `mcp.search` | `mcp` | `read` | query جست‌وجو | نتایج جست‌وجو | فقط audit record. |
| `mcp.proposePatch` | `mcp` | `write-approved` | draft patch | درخواست approval | تا پیش از approval چیزی نوشته نمی‌شود. |

## سطح پیاده‌سازی‌شده Tauri در desktop v1.x

نام‌های نقطه‌ای به فرمان‌های `invoke` با snake_case و channelهای event در `apps/desktop/src-tauri` نگاشت می‌شوند. جدول زیر قرارداد command منتشرشده فعلی است.

| سطح | نوع | owner | توضیح |
|---|---|---|---|
| `vault_open`, `vault_scan`, `vault_read_note`, `vault_save_note`, … | command | Vault Kernel | شامل rename dry-run/apply، config load/save، daily-note plan، save dry-run و MRU noteهای اخیر. |
| `vault_list_recent_notes`, `vault_record_recent_note` | command | Vault Kernel | فهرست MRU در `.scriptor/recent.json`. |
| `vault:filesystem-changed` | event | Vault Kernel | watcher با debounce؛ payload شامل pathهای نسبی تغییرکرده است. |
| `indexer_rebuild`, `indexer_update_note`, `indexer_apply_filesystem_changes` | command | Knowledge Graph | rebuild کامل در برابر note منفرد یا batch incremental watcher. |
| `indexer_search`, `indexer_backlinks`, `indexer_graph`, knowledge list commands | command | Knowledge Graph | search، graph، orphan، bibliography، recent files و غیره. |
| `indexer_list_recent_files`, `indexer_record_recent_access` | command | Knowledge Graph | MRU در SQLite `recent_access`. |
| `export_discover`, `export_run_note`, `export_start_note`, `export_cancel` | command | Publication | اجرای sync در برابر async job با cancel slot. |
| `export:progress`, `export:finished`, `export:failed` | event | Publication | streaming از stderr و completion job. |
| `git_status_cmd`, `git_commit_cmd`, `git_pull_cmd`, `git_push_cmd`, `git_resolve_conflict_cmd`, `git_read_conflict_markers_cmd` | command | Native Platform | integration با Git و preview مربوط به conflict marker. |
| `vault_delete_note`, `vault_frontmatter_set`, `vault_textbundle_export`, `vault_read_stats_history`, `vault_append_stats_history` | command | Vault Kernel | حذف note، تنظیم FM field، TextBundle و writing stats. |
| `indexer_traverse_graph`, `indexer_execute_dql` | command | Knowledge Graph | پیمایش graph و DQL به سبک Foam. |
| `canvas_*`, `diagnostics_append_event`, `system_info` | command | Canvas / Platform | Canvas hit-test، templateها و snapshotها. |
| `daemon_ping`, `daemon_endpoint`, `daemon_start` | command | Headless IPC | lifecycle process و health probe. |
| `daemon_open_vault` | command | Headless IPC | بازکردن vault در session daemon با postcard RPC. |
| `daemon_health_diagnostics`, `daemon_health_report` | command | Headless IPC | lint vault و JSON سلامت indexer. |
| `daemon_rebuild_index` | command | Headless IPC | rebuild کامل cache و health summary. |
| `daemon_search`, `daemon_list_note_summaries` | command | Headless IPC | جست‌وجوی FTS و فهرست index noteها. |
| `daemon_backlinks`, `daemon_graph` | command | Headless IPC | backlinks و graph summary متمرکز. |
| `daemon_git_status` | command | Headless IPC | Git status به‌صورت JSON برای root vault. |
| `daemon_save_note`, `daemon_update_note_index` | command | Headless IPC | save note و refresh index تک‌note. |
| `daemon_rename_apply` | command | Headless IPC | اعمال rename و refresh index فایل‌های تحت‌تأثیر. |
| `daemon_export_run_note`, `daemon_export_run_markdown` | command | Headless IPC | export با Pandoc از note روی disk یا Markdown preprocessشده. |

<bdi dir="ltr">wrapper</bdi>های frontend: `src/bridge/commands.ts` (بازصادرکننده `src/bridge/commands/*`)، `src/bridge/canvas.ts`، `src/bridge/native.ts`، `src/bridge/vaultEvents.ts`، `src/bridge/exportEvents.ts`، `src/hooks/useHeadlessEngine.ts`.

<bdi dir="ltr">routing</bdi> در headless: وقتی Settings → Headless engine فعال است، `indexer.ts`، `git.ts`، `vault.ts` برای save/rename و `export.ts` به‌جای فرمان‌های in-process به `daemon_*` delegate می‌کنند.

## متدهای RPC daemon (`scriptor-daemon`)

<bdi dir="ltr">IPC</bdi> با framing از نوع postcard؛ [`architecture/IPC_DAEMON.fa.md`](../architecture/IPC_DAEMON.fa.md) را ببینید.

| متد RPC | permission | توضیح |
|---|---|---|
| `Ping` | read | liveness و version. |
| `OpenVault` | system | root vault را برای session bind می‌کند. |
| `ListNotes` | read | summaryهای index note. |
| `SearchNotes` | read | query از FTS با limit. |
| `ReadNote` | read | body یک note؛ CLI/TUI استفاده می‌کند و desktop read را in-process انجام می‌دهد. |
| `RebuildIndex` | system | rebuild cache مشتق‌شده. |
| `HealthDiagnostics`, `HealthReport` | read | lint و سلامت indexer. |
| `GitStatus` | read | native git status به‌صورت JSON. |
| `Backlinks`, `GraphSummary` | read | queryهای graph. |
| `ReloadConfig` | system | reload فایل `.scriptor/config.json`. |
| `SaveNote` | write-approved | save اتمیک note و update incremental index. |
| `UpdateNoteIndex` | system | re-index یک path note. |
| `RenameNoteApply` | write-approved | اعمال rename و refresh index فایل‌های مرتبط. |
| `ExportRunNote` | system | export Pandoc از note روی disk در vault. |
| `ExportRunMarkdown` | system | export Pandoc از Markdown ارائه‌شده توسط caller. |

## bridge مربوط به MCP stdio در CLI subprocess

هنگام اجرای `pnpm mcp:stdio` بیرون desktop shell، موارد زیر را تنظیم کنید:

| variable | هدف |
|---|---|
| `SCRIPTOR_VAULT` | path مطلق root یک vault باز؛ برای context واقعی note/search اجباری است. |
| `SCRIPTOR_CLI` | path اختیاری binary `scriptor`؛ default برابر `scriptor` روی `PATH` است. |
| `SCRIPTOR_MCP_MODE` | mode permission: `off`، `read-only`، `draft` یا `write-approved`؛ default برابر `read-only` است. |

<bdi dir="ltr">implementation:</bdi> `packages/mcp/src/cli-vault-context.ts` و `packages/mcp/src/stdio-server.ts`.

## checklist بازبینی فرمان

هنگام افزودن command یا RPC method جدید:

- <bdi dir="ltr">owner</bdi> module و permission class دارد.
- <bdi dir="ltr">input/output</bdi> تایپ‌شده دارد؛ در صورت کاربرد contractهای Rust و TS هر دو.
- <bdi dir="ltr">error</bdi> string یا code پایدار برای نمایش در UI دارد.
- هنگام invocation از MCP یا AI رفتار audit مشخص دارد.
- <bdi dir="ltr">rollback</bdi> note یا declaration صریح no-mutation دارد.
- <bdi dir="ltr">fixture</bdi>، smoke script یا پوشش unit test دارد.

</div>
