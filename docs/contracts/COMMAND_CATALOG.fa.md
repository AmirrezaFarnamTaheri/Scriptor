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

## نام‌های <bdi dir="ltr">canonical</bdi> فرمان‌ها

| فرمان | <bdi dir="ltr">owner</bdi> | <bdi dir="ltr">permission</bdi> | قرارداد <bdi dir="ltr">input</bdi> | قرارداد <bdi dir="ltr">output</bdi> | <bdi dir="ltr">rollback</bdi> |
|---|---|---|---|---|---|
| `vault.open` | `rust-vault` | `read` | `OpenVaultInput` | `OpenVaultOutput` | بدون <bdi dir="ltr">mutation</bdi>، به‌جز <bdi dir="ltr">state</bdi> مشتق‌شده <bdi dir="ltr">session.</bdi> |
| `vault.health` | `rust-indexer` | `read` | `vaultId` | `VaultHealthReport` | بدون <bdi dir="ltr">mutation.</bdi> |
| `note.read` | `rust-vault` | `read` | `ReadNoteInput` | `ReadNoteOutput` | بدون <bdi dir="ltr">mutation.</bdi> |
| `note.save` | `rust-vault` | `write-approved` | `SaveNoteInput` | `SaveNoteOutput` | <bdi dir="ltr">artifact</bdi> بازیابی <bdi dir="ltr">write</bdi> اتمیک. |
| `note.rename.dryRun` | `rust-vault` | `read` | `RenameNoteDryRunInput` | `RenameNoteDryRunOutput` | بدون <bdi dir="ltr">mutation.</bdi> |
| `note.rename.apply` | `rust-vault` | `write-approved` | شناسه <bdi dir="ltr">dry-run</bdi> به‌همراه <bdi dir="ltr">confirmation</bdi> | نتیجه <bdi dir="ltr">rename</bdi> | <bdi dir="ltr">patch log</bdi> و <bdi dir="ltr">backup.</bdi> |
| `index.rebuild` | `rust-indexer` | `system` | `vaultId` | `JobDescriptor` | <bdi dir="ltr">cache</bdi> مشتق‌شده حذف و <bdi dir="ltr">rebuild</bdi> می‌شود. |
| `graph.query` | `rust-indexer` | `read` | `GraphQueryInput` | `GraphQueryOutput` | بدون <bdi dir="ltr">mutation.</bdi> |
| `graph.backlinks` | `rust-indexer` | `read` | `BacklinksInput` | `BacklinksOutput` | بدون <bdi dir="ltr">mutation.</bdi> |
| `canvas.query` | `rust-canvas` | `read` | `CanvasQueryInput` | `CanvasQueryOutput` | بدون <bdi dir="ltr">mutation.</bdi> |
| `canvas.snapshot` | `rust-canvas` | `system` | `CanvasSnapshotInput` | `CanvasSnapshotOutput` | <bdi dir="ltr">workspace</bdi> موقت <bdi dir="ltr">snapshot</bdi> حذف می‌شود. |
| `canvas.applyTemplate` | `rust-canvas` | `write-approved` | <bdi dir="ltr">template id</bdi> و <bdi dir="ltr">canvas</bdi> هدف | نتیجه <bdi dir="ltr">patch Canvas</bdi> | <bdi dir="ltr">patch log</bdi> و <bdi dir="ltr">undo checkpoint.</bdi> |
| `export.run` | `rust-export` | `system` | `RunExportInput` | `RunExportOutput` | <bdi dir="ltr">workspace</bdi> موقت <bdi dir="ltr">export</bdi> حذف می‌شود. |
| `git.status` | `rust-git` | `read` | `vaultId` | خلاصه <bdi dir="ltr">Git status</bdi> | بدون <bdi dir="ltr">mutation.</bdi> |
| `git.commitSelected` | `rust-git` | `write-approved` | <bdi dir="ltr">path</bdi>های انتخاب‌شده و <bdi dir="ltr">message</bdi> | نتیجه <bdi dir="ltr">commit</bdi> | تاریخچه <bdi dir="ltr">Git</bdi> عملیات را ثبت می‌کند. |
| `mcp.search` | `mcp` | `read` | <bdi dir="ltr">query</bdi> جست‌وجو | نتایج جست‌وجو | فقط <bdi dir="ltr">audit record.</bdi> |
| `mcp.proposePatch` | `mcp` | `write-approved` | <bdi dir="ltr">draft patch</bdi> | درخواست <bdi dir="ltr">approval</bdi> | تا پیش از <bdi dir="ltr">approval</bdi> چیزی نوشته نمی‌شود. |

## سطح پیاده‌سازی‌شده <bdi dir="ltr">Tauri</bdi> در <bdi dir="ltr">desktop v1.x</bdi>

نام‌های نقطه‌ای به فرمان‌های `invoke` با <bdi dir="ltr">snake_case</bdi> و <bdi dir="ltr">channel</bdi>های <bdi dir="ltr">event</bdi> در `apps/desktop/src-tauri` نگاشت می‌شوند. جدول زیر قرارداد <bdi dir="ltr">command</bdi> منتشرشده فعلی است.

| سطح | نوع | <bdi dir="ltr">owner</bdi> | توضیح |
|---|---|---|---|
| `vault_open`, `vault_scan`, `vault_read_note`, `vault_save_note`, … | <bdi dir="ltr">command</bdi> | <bdi dir="ltr">Vault Kernel</bdi> | شامل <bdi dir="ltr">rename dry-run/apply</bdi>، <bdi dir="ltr">config load/save</bdi>، <bdi dir="ltr">daily-note plan</bdi>، <bdi dir="ltr">save dry-run</bdi> و <bdi dir="ltr">MRU note</bdi>های اخیر. |
| `vault_list_recent_notes`, `vault_record_recent_note` | <bdi dir="ltr">command</bdi> | <bdi dir="ltr">Vault Kernel</bdi> | فهرست <bdi dir="ltr">MRU</bdi> در `.scriptor/recent.json`. |
| `vault:filesystem-changed` | <bdi dir="ltr">event</bdi> | <bdi dir="ltr">Vault Kernel</bdi> | <bdi dir="ltr">watcher</bdi> با <bdi dir="ltr">debounce</bdi>؛ <bdi dir="ltr">payload</bdi> شامل <bdi dir="ltr">path</bdi>های نسبی تغییرکرده است. |
| `indexer_rebuild`, `indexer_update_note`, `indexer_apply_filesystem_changes` | <bdi dir="ltr">command</bdi> | <bdi dir="ltr">Knowledge Graph</bdi> | <bdi dir="ltr">rebuild</bdi> کامل در برابر <bdi dir="ltr">note</bdi> منفرد یا <bdi dir="ltr">batch incremental watcher.</bdi> |
| `indexer_search`, `indexer_backlinks`, `indexer_graph`, <bdi dir="ltr">knowledge list commands</bdi> | <bdi dir="ltr">command</bdi> | <bdi dir="ltr">Knowledge Graph</bdi> | <bdi dir="ltr">search</bdi>، <bdi dir="ltr">graph</bdi>، <bdi dir="ltr">orphan</bdi>، <bdi dir="ltr">bibliography</bdi>، <bdi dir="ltr">recent files</bdi> و غیره. |
| `indexer_list_recent_files`, `indexer_record_recent_access` | <bdi dir="ltr">command</bdi> | <bdi dir="ltr">Knowledge Graph</bdi> | <bdi dir="ltr">MRU</bdi> در <bdi dir="ltr">SQLite</bdi> `recent_access`. |
| `export_discover`, `export_run_note`, `export_start_note`, `export_cancel` | <bdi dir="ltr">command</bdi> | <bdi dir="ltr">Publication</bdi> | اجرای <bdi dir="ltr">sync</bdi> در برابر <bdi dir="ltr">async job</bdi> با <bdi dir="ltr">cancel slot.</bdi> |
| `export:progress`, `export:finished`, `export:failed` | <bdi dir="ltr">event</bdi> | <bdi dir="ltr">Publication</bdi> | <bdi dir="ltr">streaming</bdi> از <bdi dir="ltr">stderr</bdi> و <bdi dir="ltr">completion job.</bdi> |
| `git_status_cmd`, `git_commit_cmd`, `git_pull_cmd`, `git_push_cmd`, `git_resolve_conflict_cmd`, `git_read_conflict_markers_cmd` | <bdi dir="ltr">command</bdi> | <bdi dir="ltr">Native Platform</bdi> | <bdi dir="ltr">integration</bdi> با <bdi dir="ltr">Git</bdi> و <bdi dir="ltr">preview</bdi> مربوط به <bdi dir="ltr">conflict marker.</bdi> |
| `vault_delete_note`, `vault_frontmatter_set`, `vault_textbundle_export`, `vault_read_stats_history`, `vault_append_stats_history` | <bdi dir="ltr">command</bdi> | <bdi dir="ltr">Vault Kernel</bdi> | حذف <bdi dir="ltr">note</bdi>، تنظیم <bdi dir="ltr">FM field</bdi>، <bdi dir="ltr">TextBundle</bdi> و <bdi dir="ltr">writing stats.</bdi> |
| `indexer_traverse_graph`, `indexer_execute_dql` | <bdi dir="ltr">command</bdi> | <bdi dir="ltr">Knowledge Graph</bdi> | پیمایش <bdi dir="ltr">graph</bdi> و <bdi dir="ltr">DQL</bdi> به سبک <bdi dir="ltr">Foam.</bdi> |
| `canvas_*`, `diagnostics_append_event`, `system_info` | <bdi dir="ltr">command</bdi> | <bdi dir="ltr">Canvas</bdi> / <bdi dir="ltr">Platform</bdi> | <bdi dir="ltr">Canvas hit-test</bdi>، <bdi dir="ltr">template</bdi>ها و <bdi dir="ltr">snapshot</bdi>ها. |
| `daemon_ping`, `daemon_endpoint`, `daemon_start` | <bdi dir="ltr">command</bdi> | <bdi dir="ltr">Headless IPC</bdi> | <bdi dir="ltr">lifecycle process</bdi> و <bdi dir="ltr">health probe.</bdi> |
| `daemon_open_vault` | <bdi dir="ltr">command</bdi> | <bdi dir="ltr">Headless IPC</bdi> | بازکردن <bdi dir="ltr">vault</bdi> در <bdi dir="ltr">session daemon</bdi> با <bdi dir="ltr">postcard RPC.</bdi> |
| `daemon_health_diagnostics`, `daemon_health_report` | <bdi dir="ltr">command</bdi> | <bdi dir="ltr">Headless IPC</bdi> | <bdi dir="ltr">lint vault</bdi> و <bdi dir="ltr">JSON</bdi> سلامت <bdi dir="ltr">indexer.</bdi> |
| `daemon_rebuild_index` | <bdi dir="ltr">command</bdi> | <bdi dir="ltr">Headless IPC</bdi> | <bdi dir="ltr">rebuild</bdi> کامل <bdi dir="ltr">cache</bdi> و <bdi dir="ltr">health summary.</bdi> |
| `daemon_search`, `daemon_list_note_summaries` | <bdi dir="ltr">command</bdi> | <bdi dir="ltr">Headless IPC</bdi> | جست‌وجوی <bdi dir="ltr">FTS</bdi> و فهرست <bdi dir="ltr">index note</bdi>ها. |
| `daemon_backlinks`, `daemon_graph` | <bdi dir="ltr">command</bdi> | <bdi dir="ltr">Headless IPC</bdi> | <bdi dir="ltr">backlinks</bdi> و <bdi dir="ltr">graph summary</bdi> متمرکز. |
| `daemon_git_status` | <bdi dir="ltr">command</bdi> | <bdi dir="ltr">Headless IPC</bdi> | <bdi dir="ltr">Git status</bdi> به‌صورت <bdi dir="ltr">JSON</bdi> برای <bdi dir="ltr">root vault.</bdi> |
| `daemon_save_note`, `daemon_update_note_index` | <bdi dir="ltr">command</bdi> | <bdi dir="ltr">Headless IPC</bdi> | <bdi dir="ltr">save note</bdi> و <bdi dir="ltr">refresh index</bdi> تک‌<bdi dir="ltr">note.</bdi> |
| `daemon_rename_apply` | <bdi dir="ltr">command</bdi> | <bdi dir="ltr">Headless IPC</bdi> | اعمال <bdi dir="ltr">rename</bdi> و <bdi dir="ltr">refresh index</bdi> فایل‌های تحت‌تأثیر. |
| `daemon_export_run_note`, `daemon_export_run_markdown` | <bdi dir="ltr">command</bdi> | <bdi dir="ltr">Headless IPC</bdi> | <bdi dir="ltr">export</bdi> با <bdi dir="ltr">Pandoc</bdi> از <bdi dir="ltr">note</bdi> روی <bdi dir="ltr">disk</bdi> یا <bdi dir="ltr">Markdown preprocess</bdi>شده. |

<bdi dir="ltr">wrapper</bdi>های <bdi dir="ltr">frontend:</bdi> `src/bridge/commands.ts` (بازصادرکننده `src/bridge/commands/*`)، `src/bridge/canvas.ts`، `src/bridge/native.ts`، `src/bridge/vaultEvents.ts`، `src/bridge/exportEvents.ts`، `src/hooks/useHeadlessEngine.ts`.

<bdi dir="ltr">routing</bdi> در <bdi dir="ltr">headless:</bdi> وقتی <bdi dir="ltr">Settings</bdi> → <bdi dir="ltr">Headless engine</bdi> فعال است، `indexer.ts`، `git.ts`، `vault.ts` برای <bdi dir="ltr">save/rename</bdi> و `export.ts` به‌جای فرمان‌های <bdi dir="ltr">in-process</bdi> به `daemon_*` <bdi dir="ltr">delegate</bdi> می‌کنند.

## متدهای <bdi dir="ltr">RPC daemon</bdi> (`scriptor-daemon`)

<bdi dir="ltr">IPC</bdi> با <bdi dir="ltr">framing</bdi> از نوع <bdi dir="ltr">postcard</bdi>؛ [`architecture/IPC_DAEMON.fa.md`](../architecture/IPC_DAEMON.fa.md) را ببینید.

| متد <bdi dir="ltr">RPC</bdi> | <bdi dir="ltr">permission</bdi> | توضیح |
|---|---|---|
| `Ping` | <bdi dir="ltr">read</bdi> | <bdi dir="ltr">liveness</bdi> و <bdi dir="ltr">version.</bdi> |
| `OpenVault` | <bdi dir="ltr">system</bdi> | <bdi dir="ltr">root vault</bdi> را برای <bdi dir="ltr">session bind</bdi> می‌کند. |
| `ListNotes` | <bdi dir="ltr">read</bdi> | <bdi dir="ltr">summary</bdi>های <bdi dir="ltr">index note.</bdi> |
| `SearchNotes` | <bdi dir="ltr">read</bdi> | <bdi dir="ltr">query</bdi> از <bdi dir="ltr">FTS</bdi> با <bdi dir="ltr">limit.</bdi> |
| `ReadNote` | <bdi dir="ltr">read</bdi> | <bdi dir="ltr">body</bdi> یک <bdi dir="ltr">note</bdi>؛ <bdi dir="ltr">CLI/TUI</bdi> استفاده می‌کند و <bdi dir="ltr">desktop read</bdi> را <bdi dir="ltr">in-process</bdi> انجام می‌دهد. |
| `RebuildIndex` | <bdi dir="ltr">system</bdi> | <bdi dir="ltr">rebuild cache</bdi> مشتق‌شده. |
| `HealthDiagnostics`, `HealthReport` | <bdi dir="ltr">read</bdi> | <bdi dir="ltr">lint</bdi> و سلامت <bdi dir="ltr">indexer.</bdi> |
| `GitStatus` | <bdi dir="ltr">read</bdi> | <bdi dir="ltr">native git status</bdi> به‌صورت <bdi dir="ltr">JSON.</bdi> |
| `Backlinks`, `GraphSummary` | <bdi dir="ltr">read</bdi> | <bdi dir="ltr">query</bdi>های <bdi dir="ltr">graph.</bdi> |
| `ReloadConfig` | <bdi dir="ltr">system</bdi> | <bdi dir="ltr">reload</bdi> فایل `.scriptor/config.json`. |
| `SaveNote` | <bdi dir="ltr">write-approved</bdi> | <bdi dir="ltr">save</bdi> اتمیک <bdi dir="ltr">note</bdi> و <bdi dir="ltr">update incremental index.</bdi> |
| `UpdateNoteIndex` | <bdi dir="ltr">system</bdi> | <bdi dir="ltr">re-index</bdi> یک <bdi dir="ltr">path note.</bdi> |
| `RenameNoteApply` | <bdi dir="ltr">write-approved</bdi> | اعمال <bdi dir="ltr">rename</bdi> و <bdi dir="ltr">refresh index</bdi> فایل‌های مرتبط. |
| `ExportRunNote` | <bdi dir="ltr">system</bdi> | <bdi dir="ltr">export Pandoc</bdi> از <bdi dir="ltr">note</bdi> روی <bdi dir="ltr">disk</bdi> در <bdi dir="ltr">vault.</bdi> |
| `ExportRunMarkdown` | <bdi dir="ltr">system</bdi> | <bdi dir="ltr">export Pandoc</bdi> از <bdi dir="ltr">Markdown</bdi> ارائه‌شده توسط <bdi dir="ltr">caller.</bdi> |

## <bdi dir="ltr">bridge</bdi> مربوط به <bdi dir="ltr">MCP stdio</bdi> در <bdi dir="ltr">CLI subprocess</bdi>

هنگام اجرای `pnpm mcp:stdio` بیرون <bdi dir="ltr">desktop shell</bdi>، موارد زیر را تنظیم کنید:

| <bdi dir="ltr">variable</bdi> | هدف |
|---|---|
| `SCRIPTOR_VAULT` | <bdi dir="ltr">path</bdi> مطلق <bdi dir="ltr">root</bdi> یک <bdi dir="ltr">vault</bdi> باز؛ برای <bdi dir="ltr">context</bdi> واقعی <bdi dir="ltr">note/search</bdi> اجباری است. |
| `SCRIPTOR_CLI` | <bdi dir="ltr">path</bdi> اختیاری <bdi dir="ltr">binary</bdi> `scriptor`؛ <bdi dir="ltr">default</bdi> برابر `scriptor` روی `PATH` است. |
| `SCRIPTOR_MCP_MODE` | <bdi dir="ltr">mode permission:</bdi> `off`، `read-only`، `draft` یا `write-approved`؛ <bdi dir="ltr">default</bdi> برابر `read-only` است. |

<bdi dir="ltr">implementation:</bdi> `packages/mcp/src/cli-vault-context.ts` و `packages/mcp/src/stdio-server.ts`.

## <bdi dir="ltr">checklist</bdi> بازبینی فرمان

هنگام افزودن <bdi dir="ltr">command</bdi> یا <bdi dir="ltr">RPC method</bdi> جدید:

- <bdi dir="ltr">owner</bdi> <bdi dir="ltr">module</bdi> و <bdi dir="ltr">permission class</bdi> دارد.
- <bdi dir="ltr">input/output</bdi> تایپ‌شده دارد؛ در صورت کاربرد <bdi dir="ltr">contract</bdi>های <bdi dir="ltr">Rust</bdi> و <bdi dir="ltr">TS</bdi> هر دو.
- <bdi dir="ltr">error</bdi> <bdi dir="ltr">string</bdi> یا <bdi dir="ltr">code</bdi> پایدار برای نمایش در <bdi dir="ltr">UI</bdi> دارد.
- هنگام <bdi dir="ltr">invocation</bdi> از <bdi dir="ltr">MCP</bdi> یا <bdi dir="ltr">AI</bdi> رفتار <bdi dir="ltr">audit</bdi> مشخص دارد.
- <bdi dir="ltr">rollback</bdi> <bdi dir="ltr">note</bdi> یا <bdi dir="ltr">declaration</bdi> صریح <bdi dir="ltr">no-mutation</bdi> دارد.
- <bdi dir="ltr">fixture</bdi>، <bdi dir="ltr">smoke script</bdi> یا پوشش <bdi dir="ltr">unit test</bdi> دارد.

</div>
