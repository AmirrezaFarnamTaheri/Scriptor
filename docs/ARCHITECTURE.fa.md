<div dir="ltr" align="center">
[English](ARCHITECTURE.md) · **فارسی** · [简体中文](ARCHITECTURE.zh-CN.md) · [Русский](ARCHITECTURE.ru.md) · [Deutsch](ARCHITECTURE.de.md) · [Español](ARCHITECTURE.es.md)
</div>

<div dir="rtl" lang="fa" align="right">

<div dir="rtl" lang="fa">

# معماری فعلی

[English](ARCHITECTURE.md) · [简体中文](ARCHITECTURE.zh-CN.md) · [Русский](ARCHITECTURE.ru.md) · [Deutsch](ARCHITECTURE.de.md) · [Español](ARCHITECTURE.es.md) · **فارسی**

**وضعیت:** نقشه پیاده‌سازی فعلی. نسخه مرجع محصول در [`VERSION`](../VERSION) است؛ پیشنهادهای صرفاً طراحی در اسناد جدا قرار دارند و در [`CAPABILITY-MATURITY.md`](CAPABILITY-MATURITY.md) علامت‌گذاری می‌شوند.

## توپولوژی Runtime

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

renderer یک authority boundary نیست. عملیات native مستقل از state رابط کاربری، scope، authorization، runtime payload، path، process policy و cancellation را اعتبارسنجی می‌کنند.

## لایه‌ها و مالکیت

| Plane | Owner | مسئولیت |
|---|---|---|
| Product shell | <bdi dir="ltr">`src/App.tsx`, `src/components/shell/`, `src/components/app/QuickCaptureWorkspaceLayer.tsx`, `src/components/app/WorkspaceRenameDialogs.tsx`, `src/hooks/`</bdi> | workspace composition، گردش‌کار capture/rename و presentation state |
| Runtime validation | <bdi dir="ltr">`src/lib/runtimeSchema.ts`, `src/types/vaultValidators.ts`</bdi> | parse کردن bridge/storage payload غیرقابل‌اعتماد |
| Native adapter | <bdi dir="ltr">`apps/desktop/src-tauri/src/commands/`</bdi> | فقط mapping آرگومان/نتیجه Tauri |
| Authorization | <bdi dir="ltr">`apps/desktop/src-tauri/src/authorization.rs`</bdi> | grant یک‌بارمصرف operation/scope و native confirmation |
| Vault | <bdi dir="ltr">`crates/vault/`</bdi> | safe path، note، config، scan، watcher event و audit record |
| Index | <bdi dir="ltr">`crates/indexer/`</bdi> | SQLite current schema، FTS، backlink، graph و knowledge query |
| Git | <bdi dir="ltr">`crates/native-git/`</bdi> | عملیات noninteractive status/diff/commit/conflict |
| External tools | <bdi dir="ltr">`crates/system-bridge/src/process.rs`</bdi> | executable policy، sanitized env، sandbox، bounds، cancellation و receipt |
| Daemon transport | <bdi dir="ltr">`crates/daemon/`, `crates/ipc/`</bdi> | local RPC با احراز اصالت، frame bounds، event delivery با resynchronization، job و MCP bridge؛ مالکیت command catalog از dispatch جداست |
| Desktop git serialization | <bdi dir="ltr">`crates/native-git/src/queue.rs`, `apps/desktop/src-tauri/src/state.rs`</bdi> | هر پنج native Git mutation وارد bounded per-repo GitQueue worker با 64-slot backpressure می‌شوند؛ handle هنگام vault swap reset می‌شود؛ commandهای read-only whole-vault از طریق session-clone seam بیرون daemon state mutex dispatch می‌شوند |
| Observability | <bdi dir="ltr">`crates/system-bridge/src/observability.rs`</bdi> | structured، redacted و bounded local tracing |
| Export | <bdi dir="ltr">`crates/export-runner/`, `packages/export/`</bdi> | profile، preflight، diagram و Pandoc orchestration |
| Publish | <bdi dir="ltr">`crates/publish-runner/`، desktop/CLI adapters</bdi> | frontmatter-gated plan/review/apply، managed local Starlight output، stale-plan و output-drift protection |
| UI packages | <bdi dir="ltr">`packages/*`</bdi> | deep module فقط از package export؛ MCP tool contract/catalog جدا از runtime state و dispatch |

## گردش‌کارهای اصلی

### بازکردن و index کردن vault

1. renderer از typed bridge درخواست بازکردن vault می‌کند.
2. native adapter path را اعتبارسنجی و scoped state را به‌روزرسانی می‌کند.
3. metadata discovery از bounded content parsing جداست.
4. indexer یک generation اعمال و notes/links/FTS را در SQLite ذخیره می‌کند.
5. watcher تغییرات incremental را batch می‌کند؛ overflow/error رویداد <bdi dir="ltr">`RescanRequired`</bdi> منتشر می‌کند.
6. desktop و daemon generationهای stale را نادیده می‌گیرند و recovery یکسان full-rebuild را اجرا می‌کنند.

### تغییر note از طریق MCP

1. tool و vault scope را validate کنید.
2. intent حاوی idempotency key و hash-chain link را persist کنید و <bdi dir="ltr">`fsync`</bdi> بزنید.
3. atomic vault mutation را اجرا کنید.
4. outcome را append کنید. اگر process بین intent و outcome متوقف شود، startup reconciliation رکورد pending را به‌صورت deterministic حل می‌کند.

### Commit فایل‌های انتخاب‌شده

<bdi dir="ltr">`crates/native-git/src/status.rs`</bdi> یک index موقت isolated از <bdi dir="ltr">`HEAD`</bdi> می‌سازد، pathهای literal درخواستی را stage می‌کند، commit tree می‌سازد، branch را update می‌کند و index اصلی کاربر را تغییر نمی‌دهد.

### خواندن اسناد vault

Reader در native boundary فقط pathهای PDF/EPUB نسبی به vault را می‌پذیرد. native code پیش از برگرداندن document bytes هر path را resolve و confined می‌کند؛ renderer از assetهای همراه PDF/EPUB viewer استفاده می‌کند و annotationها را اتمیک در vault sidecar ذخیره می‌کند. فعال‌سازی Reader از command palette آغاز می‌شود و هیچ default shortcut ادعا نمی‌شود.

### به‌روزرسانی task و Kanban card

Taskها از Markdown index می‌شوند و تغییرات پیش از native mutation از canonical vault save path به note مبدأ نوشته می‌شوند. Kanban یک view جایگزین Markdown است: جابه‌جایی card، خط کامل آن را زیر heading درخواستی <bdi dir="ltr">`##`</bdi> منتقل می‌کند و سپس index refresh می‌شود. هر دو path، source state stale یا invalid را رد می‌کنند و تغییر optimistic فقط در UI را بی‌صدا اعمال نمی‌کنند.

### انتشار local Starlight site

1. desktop یا CLI از <bdi dir="ltr">`crates/publish-runner`</bdi> یک read-only plan مشتق از bounded symlink-aware vault scan می‌گیرد.
2. فقط noteهای دارای <bdi dir="ltr">`publish: true`</bdi> candidate هستند؛ sealed content پس از opt-in gate رد می‌شود.
3. desktop itemهای new/changed/orphaned را برای review نشان می‌دهد. Apply یک native-authorized mutation مستقل است.
4. Apply eligibility و content hash را دوباره محاسبه می‌کند، selection stale یا ساخته renderer را رد می‌کند و فقط fresh pathهایی را حذف می‌کند که قبلاً متعلق به publish state بوده‌اند.
5. managed output از atomic write استفاده می‌کند و traversal، symlink indirection، source/output containment و unmanaged overwrite را رد می‌کند. generated page گم‌شده یا دستی‌تغییریافته managed ownership را حفظ می‌کند، اما در plan بعدی changed دیده می‌شود تا reviewed apply آن را repair کند.

### فرایند خارجی

همه launchهای پشتیبانی‌شده از process broker عبور می‌کنند. policy شامل canonical executable resolution، optional binary hash، trusted workspace، environment allowlist، network policy، time/output limits، process group/job cancellation و structured outcome است. هیچ command با shell string ساخته نمی‌شود.

### Backup و restore

- <bdi dir="ltr">`.scriptor/snapshots`</bdi> محلی برای recovery سریع است.
- target خارجی backup مربوط به disaster recovery را در directory وابسته به vault تولید می‌کند.
- هر backup یک versioned SHA-256 manifest دارد.
- Restore پیش از promotion، path، size، hash و vault binding را verify می‌کند و crash-visible restore journal ثبت می‌کند.

## مدل داده و کنترل مقیاس

SQLite از WAL، foreign key، busy timeout، current-schema validation، FTS و secondary index روی vault/path و link adjacency استفاده می‌کند. Graph APIها bounded هستند و BFS depth/parent/path را حفظ می‌کنند. knowledge summary و link resolution از batch/aggregate query استفاده می‌کنند. scanها file count و note size را محدود می‌کنند.

## مرزهای اعتماد و شکست

| Boundary | Failure policy |
|---|---|
| Renderer -> native | validate، authorize، رد unknown/expired scope |
| Runtime JSON | parse از <bdi dir="ltr">`unknown`</bdi>؛ quarantine برای persisted state خراب |
| Filesystem | vault confinement، بدون symlink/traversal escape |
| SQLite | current-schema validation؛ سطح busy/error صریح |
| Watcher | generation ID و full-rescan recovery |
| Event subscribers | bounded nonblocking queue؛ slow consumer disconnect می‌شود؛ authenticated resubscription پیش از delivery عادی <bdi dir="ltr">`ResyncRequired`</bdi> منتشر می‌کند |
| Subprocess | timeout/cancel/process-tree kill؛ bounded stdout/stderr |
| Logs/audit | redaction، size rotation، bounded tail؛ mutation log hash chain |
| Release | immutable action pins، version contract، explicit unsigned trust records، checksums/SBOM/receipt و provenance attestations |

## کار معماری شناخته‌شده

adapter layer هنوز composition root دارد، اما quick capture، rename transaction، deletion، telemetry، shortcut، sidebar action، auxiliary workspace data، settings vault configuration، MCP tool contract، daemon command catalog/support، daemon transport tests، CLI command-line schema و CLI benchmarks owner متمرکز دارند. decomposition بعدی از طریق vertical workflowهای characterizeشده روی typed application services انجام می‌شود، نه big-bang rewrite. capability ledger را ببینید.

</div>


</div>
