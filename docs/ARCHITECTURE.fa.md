<div dir="ltr" align="center">
[English](ARCHITECTURE.md) · **فارسی** · [简体中文](ARCHITECTURE.zh-CN.md) · [Русский](ARCHITECTURE.ru.md) · [Deutsch](ARCHITECTURE.de.md) · [Español](ARCHITECTURE.es.md)
</div>

<div dir="rtl" lang="fa" align="right">

<div dir="rtl" lang="fa">

# معماری فعلی

[<bdi dir="ltr">English</bdi>](ARCHITECTURE.md) · [简体中文](ARCHITECTURE.zh-CN.md) · [Русский](ARCHITECTURE.ru.md) · [<bdi dir="ltr">Deutsch</bdi>](ARCHITECTURE.de.md) · [<bdi dir="ltr">Espa</bdi>ñ<bdi dir="ltr">ol</bdi>](ARCHITECTURE.es.md) · **فارسی**

**وضعیت:** نقشه پیاده‌سازی فعلی. نسخه مرجع محصول در [`VERSION`](../VERSION) است؛ پیشنهادهای صرفاً طراحی در اسناد جدا قرار دارند و در [`CAPABILITY-MATURITY.md`](CAPABILITY-MATURITY.md) علامت‌گذاری می‌شوند.

## توپولوژی <bdi dir="ltr">Runtime</bdi>

</div>

<div dir="ltr">

<div dir="ltr">
```text
React renderer
  -> typed bridge commands
  -> Tauri command adapters
  -> authorization broker
  -> application/kernel crates
       vault | indexer | native-git | export-runner | canvas-engine
  -> filesystem / SQLite / Git / keychain / approved external tools

CLI/TUI and MCP
  -> daemon IPC (scriptor-ipc envelopes)
  -> daemon handlers and shared kernel crates
```
</div>

</div>

<div dir="rtl" lang="fa">

<bdi dir="ltr">renderer</bdi> یک <bdi dir="ltr">authority boundary</bdi> نیست. عملیات <bdi dir="ltr">native</bdi> مستقل از <bdi dir="ltr">state</bdi> رابط کاربری، <bdi dir="ltr">scope</bdi>، <bdi dir="ltr">authorization</bdi>، <bdi dir="ltr">runtime payload</bdi>، <bdi dir="ltr">path</bdi>، <bdi dir="ltr">process policy</bdi> و <bdi dir="ltr">cancellation</bdi> را اعتبارسنجی می‌کنند.

## لایه‌ها و مالکیت

| <bdi dir="ltr">Plane</bdi> | <bdi dir="ltr">Owner</bdi> | مسئولیت |
|---|---|---|
| <bdi dir="ltr">Product shell</bdi> | <bdi dir="ltr">`src/App.tsx`, `src/components/shell/`, `src/components/app/QuickCaptureWorkspaceLayer.tsx`, `src/components/app/WorkspaceRenameDialogs.tsx`, `src/hooks/`</bdi> | <bdi dir="ltr">workspace composition</bdi>، گردش‌کار <bdi dir="ltr">capture/rename</bdi> و <bdi dir="ltr">presentation state</bdi> |
| <bdi dir="ltr">Runtime validation</bdi> | <bdi dir="ltr">`src/lib/runtimeSchema.ts`, `src/types/vaultValidators.ts`</bdi> | <bdi dir="ltr">parse</bdi> کردن <bdi dir="ltr">bridge/storage payload</bdi> غیرقابل‌اعتماد |
| <bdi dir="ltr">Native adapter</bdi> | <bdi dir="ltr">`apps/desktop/src-tauri/src/commands/`</bdi> | فقط <bdi dir="ltr">mapping</bdi> آرگومان/نتیجه <bdi dir="ltr">Tauri</bdi> |
| <bdi dir="ltr">Authorization</bdi> | <bdi dir="ltr">`apps/desktop/src-tauri/src/authorization.rs`</bdi> | <bdi dir="ltr">grant</bdi> یک‌بارمصرف <bdi dir="ltr">operation/scope</bdi> و <bdi dir="ltr">native confirmation</bdi> |
| <bdi dir="ltr">Vault</bdi> | <bdi dir="ltr">`crates/vault/`</bdi> | <bdi dir="ltr">safe path</bdi>، <bdi dir="ltr">note</bdi>، <bdi dir="ltr">config</bdi>، <bdi dir="ltr">scan</bdi>، <bdi dir="ltr">watcher event</bdi> و <bdi dir="ltr">audit record</bdi> |
| <bdi dir="ltr">Index</bdi> | <bdi dir="ltr">`crates/indexer/`</bdi> | <bdi dir="ltr">SQLite current schema</bdi>، <bdi dir="ltr">FTS</bdi>، <bdi dir="ltr">backlink</bdi>، <bdi dir="ltr">graph</bdi> و <bdi dir="ltr">knowledge query</bdi> |
| <bdi dir="ltr">Git</bdi> | <bdi dir="ltr">`crates/native-git/`</bdi> | عملیات <bdi dir="ltr">noninteractive status/diff/commit/conflict</bdi> |
| <bdi dir="ltr">External tools</bdi> | <bdi dir="ltr">`crates/system-bridge/src/process.rs`</bdi> | <bdi dir="ltr">executable policy</bdi>، <bdi dir="ltr">sanitized env</bdi>، <bdi dir="ltr">sandbox</bdi>، <bdi dir="ltr">bounds</bdi>، <bdi dir="ltr">cancellation</bdi> و <bdi dir="ltr">receipt</bdi> |
| <bdi dir="ltr">Daemon transport</bdi> | <bdi dir="ltr">`crates/daemon/`, `crates/ipc/`</bdi> | <bdi dir="ltr">local RPC</bdi> با احراز اصالت، <bdi dir="ltr">frame bounds</bdi>، <bdi dir="ltr">event delivery</bdi> با <bdi dir="ltr">resynchronization</bdi>، <bdi dir="ltr">job</bdi> و <bdi dir="ltr">MCP bridge</bdi>؛ مالکیت <bdi dir="ltr">command catalog</bdi> از <bdi dir="ltr">dispatch</bdi> جداست |
| <bdi dir="ltr">Desktop git serialization</bdi> | <bdi dir="ltr">`crates/native-git/src/queue.rs`, `apps/desktop/src-tauri/src/state.rs`</bdi> | هر پنج <bdi dir="ltr">native Git mutation</bdi> وارد <bdi dir="ltr">bounded per-repo GitQueue worker</bdi> با 64-<bdi dir="ltr">slot backpressure</bdi> می‌شوند؛ <bdi dir="ltr">handle</bdi> هنگام <bdi dir="ltr">vault swap reset</bdi> می‌شود؛ <bdi dir="ltr">command</bdi>های <bdi dir="ltr">read-only whole-vault</bdi> از طریق <bdi dir="ltr">session-clone seam</bdi> بیرون <bdi dir="ltr">daemon state mutex dispatch</bdi> می‌شوند |
| <bdi dir="ltr">Observability</bdi> | <bdi dir="ltr">`crates/system-bridge/src/observability.rs`</bdi> | <bdi dir="ltr">structured</bdi>، <bdi dir="ltr">redacted</bdi> و <bdi dir="ltr">bounded local tracing</bdi> |
| <bdi dir="ltr">Export</bdi> | <bdi dir="ltr">`crates/export-runner/`, `packages/export/`</bdi> | <bdi dir="ltr">profile</bdi>، <bdi dir="ltr">preflight</bdi>، <bdi dir="ltr">diagram</bdi> و <bdi dir="ltr">Pandoc orchestration</bdi> |
| <bdi dir="ltr">Publish</bdi> | <bdi dir="ltr">`crates/publish-runner/`، desktop/CLI adapters</bdi> | <bdi dir="ltr">frontmatter-gated plan/review/apply</bdi>، <bdi dir="ltr">managed local Starlight output</bdi>، <bdi dir="ltr">stale-plan</bdi> و <bdi dir="ltr">output-drift protection</bdi> |
| <bdi dir="ltr">UI packages</bdi> | <bdi dir="ltr">`packages/*`</bdi> | <bdi dir="ltr">deep module</bdi> فقط از <bdi dir="ltr">package export</bdi>؛ <bdi dir="ltr">MCP tool contract/catalog</bdi> جدا از <bdi dir="ltr">runtime state</bdi> و <bdi dir="ltr">dispatch</bdi> |

## گردش‌کارهای اصلی

### بازکردن و <bdi dir="ltr">index</bdi> کردن <bdi dir="ltr">vault</bdi>

1. <bdi dir="ltr">renderer</bdi> از <bdi dir="ltr">typed bridge</bdi> درخواست بازکردن <bdi dir="ltr">vault</bdi> می‌کند.
2. <bdi dir="ltr">native</bdi> <bdi dir="ltr">adapter path</bdi> را اعتبارسنجی و <bdi dir="ltr">scoped state</bdi> را به‌روزرسانی می‌کند.
3. <bdi dir="ltr">metadata</bdi> <bdi dir="ltr">discovery</bdi> از <bdi dir="ltr">bounded content parsing</bdi> جداست.
4. <bdi dir="ltr">indexer</bdi> یک <bdi dir="ltr">generation</bdi> اعمال و <bdi dir="ltr">notes/links/FTS</bdi> را در <bdi dir="ltr">SQLite</bdi> ذخیره می‌کند.
5. <bdi dir="ltr">watcher</bdi> تغییرات <bdi dir="ltr">incremental</bdi> را <bdi dir="ltr">batch</bdi> می‌کند؛ <bdi dir="ltr">overflow/error</bdi> رویداد <bdi dir="ltr">`RescanRequired`</bdi> منتشر می‌کند.
6. <bdi dir="ltr">desktop</bdi> و <bdi dir="ltr">daemon generation</bdi>های <bdi dir="ltr">stale</bdi> را نادیده می‌گیرند و <bdi dir="ltr">recovery</bdi> یکسان <bdi dir="ltr">full-rebuild</bdi> را اجرا می‌کنند.

### تغییر <bdi dir="ltr">note</bdi> از طریق <bdi dir="ltr">MCP</bdi>

1. <bdi dir="ltr">tool</bdi> و <bdi dir="ltr">vault scope</bdi> را <bdi dir="ltr">validate</bdi> کنید.
2. <bdi dir="ltr">intent</bdi> حاوی <bdi dir="ltr">idempotency key</bdi> و <bdi dir="ltr">hash-chain link</bdi> را <bdi dir="ltr">persist</bdi> کنید و <bdi dir="ltr">`fsync`</bdi> بزنید.
3. <bdi dir="ltr">atomic</bdi> <bdi dir="ltr">vault mutation</bdi> را اجرا کنید.
4. <bdi dir="ltr">outcome</bdi> را <bdi dir="ltr">append</bdi> کنید. اگر <bdi dir="ltr">process</bdi> بین <bdi dir="ltr">intent</bdi> و <bdi dir="ltr">outcome</bdi> متوقف شود، <bdi dir="ltr">startup reconciliation</bdi> رکورد <bdi dir="ltr">pending</bdi> را به‌صورت <bdi dir="ltr">deterministic</bdi> حل می‌کند.

### <bdi dir="ltr">Commit</bdi> فایل‌های انتخاب‌شده

<bdi dir="ltr">`crates/native-git/src/status.rs`</bdi> یک <bdi dir="ltr">index</bdi> موقت <bdi dir="ltr">isolated</bdi> از <bdi dir="ltr">`HEAD`</bdi> می‌سازد، <bdi dir="ltr">path</bdi>های <bdi dir="ltr">literal</bdi> درخواستی را <bdi dir="ltr">stage</bdi> می‌کند، <bdi dir="ltr">commit tree</bdi> می‌سازد، <bdi dir="ltr">branch</bdi> را <bdi dir="ltr">update</bdi> می‌کند و <bdi dir="ltr">index</bdi> اصلی کاربر را تغییر نمی‌دهد.

### خواندن اسناد <bdi dir="ltr">vault</bdi>

<bdi dir="ltr">Reader</bdi> در <bdi dir="ltr">native boundary</bdi> فقط <bdi dir="ltr">path</bdi>های <bdi dir="ltr">PDF/EPUB</bdi> نسبی به <bdi dir="ltr">vault</bdi> را می‌پذیرد. <bdi dir="ltr">native code</bdi> پیش از برگرداندن <bdi dir="ltr">document bytes</bdi> هر <bdi dir="ltr">path</bdi> را <bdi dir="ltr">resolve</bdi> و <bdi dir="ltr">confined</bdi> می‌کند؛ <bdi dir="ltr">renderer</bdi> از <bdi dir="ltr">asset</bdi>های همراه <bdi dir="ltr">PDF/EPUB viewer</bdi> استفاده می‌کند و <bdi dir="ltr">annotation</bdi>ها را اتمیک در <bdi dir="ltr">vault sidecar</bdi> ذخیره می‌کند. فعال‌سازی <bdi dir="ltr">Reader</bdi> از <bdi dir="ltr">command palette</bdi> آغاز می‌شود و هیچ <bdi dir="ltr">default shortcut</bdi> ادعا نمی‌شود.

### به‌روزرسانی <bdi dir="ltr">task</bdi> و <bdi dir="ltr">Kanban card</bdi>

<bdi dir="ltr">Task</bdi>ها از <bdi dir="ltr">Markdown index</bdi> می‌شوند و تغییرات پیش از <bdi dir="ltr">native mutation</bdi> از <bdi dir="ltr">canonical vault save path</bdi> به <bdi dir="ltr">note</bdi> مبدأ نوشته می‌شوند. <bdi dir="ltr">Kanban</bdi> یک <bdi dir="ltr">view</bdi> جایگزین <bdi dir="ltr">Markdown</bdi> است: جابه‌جایی <bdi dir="ltr">card</bdi>، خط کامل آن را زیر <bdi dir="ltr">heading</bdi> درخواستی <bdi dir="ltr">`##`</bdi> منتقل می‌کند و سپس <bdi dir="ltr">index refresh</bdi> می‌شود. هر دو <bdi dir="ltr">path</bdi>، <bdi dir="ltr">source state stale</bdi> یا <bdi dir="ltr">invalid</bdi> را رد می‌کنند و تغییر <bdi dir="ltr">optimistic</bdi> فقط در <bdi dir="ltr">UI</bdi> را بی‌صدا اعمال نمی‌کنند.

### انتشار <bdi dir="ltr">local Starlight site</bdi>

1. <bdi dir="ltr">desktop</bdi> یا <bdi dir="ltr">CLI</bdi> از <bdi dir="ltr">`crates/publish-runner`</bdi> یک <bdi dir="ltr">read-only plan</bdi> مشتق از <bdi dir="ltr">bounded symlink-aware vault scan</bdi> می‌گیرد.
2. فقط <bdi dir="ltr">note</bdi>های دارای <bdi dir="ltr">`publish: true`</bdi> <bdi dir="ltr">candidate</bdi> هستند؛ <bdi dir="ltr">sealed content</bdi> پس از <bdi dir="ltr">opt-in gate</bdi> رد می‌شود.
3. <bdi dir="ltr">desktop</bdi> <bdi dir="ltr">item</bdi>های <bdi dir="ltr">new/changed/orphaned</bdi> را برای <bdi dir="ltr">review</bdi> نشان می‌دهد. <bdi dir="ltr">Apply</bdi> یک <bdi dir="ltr">native-authorized mutation</bdi> مستقل است.
4. <bdi dir="ltr">Apply</bdi> <bdi dir="ltr">eligibility</bdi> و <bdi dir="ltr">content hash</bdi> را دوباره محاسبه می‌کند، <bdi dir="ltr">selection stale</bdi> یا ساخته <bdi dir="ltr">renderer</bdi> را رد می‌کند و فقط <bdi dir="ltr">fresh path</bdi>هایی را حذف می‌کند که قبلاً متعلق به <bdi dir="ltr">publish state</bdi> بوده‌اند.
5. <bdi dir="ltr">managed</bdi> <bdi dir="ltr">output</bdi> از <bdi dir="ltr">atomic write</bdi> استفاده می‌کند و <bdi dir="ltr">traversal</bdi>، <bdi dir="ltr">symlink indirection</bdi>، <bdi dir="ltr">source/output containment</bdi> و <bdi dir="ltr">unmanaged overwrite</bdi> را رد می‌کند. <bdi dir="ltr">generated page</bdi> گم‌شده یا دستی‌تغییریافته <bdi dir="ltr">managed ownership</bdi> را حفظ می‌کند، اما در <bdi dir="ltr">plan</bdi> بعدی <bdi dir="ltr">changed</bdi> دیده می‌شود تا <bdi dir="ltr">reviewed apply</bdi> آن را <bdi dir="ltr">repair</bdi> کند.

### فرایند خارجی

همه <bdi dir="ltr">launch</bdi>های پشتیبانی‌شده از <bdi dir="ltr">process broker</bdi> عبور می‌کنند. <bdi dir="ltr">policy</bdi> شامل <bdi dir="ltr">canonical executable resolution</bdi>، <bdi dir="ltr">optional binary hash</bdi>، <bdi dir="ltr">trusted workspace</bdi>، <bdi dir="ltr">environment allowlist</bdi>، <bdi dir="ltr">network policy</bdi>، <bdi dir="ltr">time/output limits</bdi>، <bdi dir="ltr">process group/job cancellation</bdi> و <bdi dir="ltr">structured outcome</bdi> است. هیچ <bdi dir="ltr">command</bdi> با <bdi dir="ltr">shell string</bdi> ساخته نمی‌شود.

### <bdi dir="ltr">Backup</bdi> و <bdi dir="ltr">restore</bdi>

- <bdi dir="ltr">`.scriptor/snapshots`</bdi> محلی برای <bdi dir="ltr">recovery</bdi> سریع است.
- <bdi dir="ltr">target</bdi> خارجی <bdi dir="ltr">backup</bdi> مربوط به <bdi dir="ltr">disaster recovery</bdi> را در <bdi dir="ltr">directory</bdi> وابسته به <bdi dir="ltr">vault</bdi> تولید می‌کند.
- هر <bdi dir="ltr">backup</bdi> یک <bdi dir="ltr">versioned SHA-256 manifest</bdi> دارد.
- <bdi dir="ltr">Restore</bdi> پیش از <bdi dir="ltr">promotion</bdi>، <bdi dir="ltr">path</bdi>، <bdi dir="ltr">size</bdi>، <bdi dir="ltr">hash</bdi> و <bdi dir="ltr">vault binding</bdi> را <bdi dir="ltr">verify</bdi> می‌کند و <bdi dir="ltr">crash-visible restore journal</bdi> ثبت می‌کند.

## مدل داده و کنترل مقیاس

<bdi dir="ltr">SQLite</bdi> از <bdi dir="ltr">WAL</bdi>، <bdi dir="ltr">foreign key</bdi>، <bdi dir="ltr">busy timeout</bdi>، <bdi dir="ltr">current-schema validation</bdi>، <bdi dir="ltr">FTS</bdi> و <bdi dir="ltr">secondary index</bdi> روی <bdi dir="ltr">vault/path</bdi> و <bdi dir="ltr">link adjacency</bdi> استفاده می‌کند. <bdi dir="ltr">Graph API</bdi>ها <bdi dir="ltr">bounded</bdi> هستند و <bdi dir="ltr">BFS depth/parent/path</bdi> را حفظ می‌کنند. <bdi dir="ltr">knowledge summary</bdi> و <bdi dir="ltr">link resolution</bdi> از <bdi dir="ltr">batch/aggregate query</bdi> استفاده می‌کنند. <bdi dir="ltr">scan</bdi>ها <bdi dir="ltr">file count</bdi> و <bdi dir="ltr">note size</bdi> را محدود می‌کنند.

## مرزهای اعتماد و شکست

| <bdi dir="ltr">Boundary</bdi> | <bdi dir="ltr">Failure policy</bdi> |
|---|---|
| <bdi dir="ltr">Renderer</bdi> -> <bdi dir="ltr">native</bdi> | <bdi dir="ltr">validate</bdi>، <bdi dir="ltr">authorize</bdi>، رد <bdi dir="ltr">unknown/expired scope</bdi> |
| <bdi dir="ltr">Runtime JSON</bdi> | <bdi dir="ltr">parse</bdi> از <bdi dir="ltr">`unknown`</bdi>؛ <bdi dir="ltr">quarantine</bdi> برای <bdi dir="ltr">persisted state</bdi> خراب |
| <bdi dir="ltr">Filesystem</bdi> | <bdi dir="ltr">vault confinement</bdi>، بدون <bdi dir="ltr">symlink/traversal escape</bdi> |
| <bdi dir="ltr">SQLite</bdi> | <bdi dir="ltr">current-schema validation</bdi>؛ سطح <bdi dir="ltr">busy/error</bdi> صریح |
| <bdi dir="ltr">Watcher</bdi> | <bdi dir="ltr">generation ID</bdi> و <bdi dir="ltr">full-rescan recovery</bdi> |
| <bdi dir="ltr">Event subscribers</bdi> | <bdi dir="ltr">bounded nonblocking queue</bdi>؛ <bdi dir="ltr">slow consumer disconnect</bdi> می‌شود؛ <bdi dir="ltr">authenticated resubscription</bdi> پیش از <bdi dir="ltr">delivery</bdi> عادی <bdi dir="ltr">`ResyncRequired`</bdi> منتشر می‌کند |
| <bdi dir="ltr">Subprocess</bdi> | <bdi dir="ltr">timeout/cancel/process-tree kill</bdi>؛ <bdi dir="ltr">bounded stdout/stderr</bdi> |
| <bdi dir="ltr">Logs/audit</bdi> | <bdi dir="ltr">redaction</bdi>، <bdi dir="ltr">size rotation</bdi>، <bdi dir="ltr">bounded tail</bdi>؛ <bdi dir="ltr">mutation log hash chain</bdi> |
| <bdi dir="ltr">Release</bdi> | <bdi dir="ltr">immutable action pins</bdi>، <bdi dir="ltr">version contract</bdi>، <bdi dir="ltr">explicit unsigned trust records</bdi>، <bdi dir="ltr">checksums/SBOM/receipt</bdi> و <bdi dir="ltr">provenance attestations</bdi> |

## کار معماری شناخته‌شده

<bdi dir="ltr">adapter</bdi> <bdi dir="ltr">layer</bdi> هنوز <bdi dir="ltr">composition root</bdi> دارد، اما <bdi dir="ltr">quick capture</bdi>، <bdi dir="ltr">rename transaction</bdi>، <bdi dir="ltr">deletion</bdi>، <bdi dir="ltr">telemetry</bdi>، <bdi dir="ltr">shortcut</bdi>، <bdi dir="ltr">sidebar action</bdi>، <bdi dir="ltr">auxiliary workspace data</bdi>، <bdi dir="ltr">settings vault configuration</bdi>، <bdi dir="ltr">MCP tool contract</bdi>، <bdi dir="ltr">daemon command catalog/support</bdi>، <bdi dir="ltr">daemon transport tests</bdi>، <bdi dir="ltr">CLI command-line schema</bdi> و <bdi dir="ltr">CLI benchmarks owner</bdi> متمرکز دارند. <bdi dir="ltr">decomposition</bdi> بعدی از طریق <bdi dir="ltr">vertical workflow</bdi>های <bdi dir="ltr">characterize</bdi>شده روی <bdi dir="ltr">typed application services</bdi> انجام می‌شود، نه <bdi dir="ltr">big-bang rewrite. capability ledger</bdi> را ببینید.

</div>


</div>
