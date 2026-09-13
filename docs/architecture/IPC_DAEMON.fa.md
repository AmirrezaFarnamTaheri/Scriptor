<div dir="ltr" align="center">
[English](IPC_DAEMON.md) · **فارسی** · [简体中文](IPC_DAEMON.zh-CN.md) · [Русский](IPC_DAEMON.ru.md) · [Deutsch](IPC_DAEMON.de.md) · [Español](IPC_DAEMON.es.md)
</div>

<div dir="rtl" lang="fa" align="right">

<div dir="rtl" lang="fa">

# معماری <bdi dir="ltr">IPC</bdi> مربوط به <bdi dir="ltr">Daemon</bdi>

[<bdi dir="ltr">English</bdi>](IPC_DAEMON.md) · [简体中文](IPC_DAEMON.zh-CN.md) · [Русский](IPC_DAEMON.ru.md) · [<bdi dir="ltr">Deutsch</bdi>](IPC_DAEMON.de.md) · [<bdi dir="ltr">Espa</bdi>ñ<bdi dir="ltr">ol</bdi>](IPC_DAEMON.es.md) · **فارسی**

> **مرجع اصلی:** [`docs/ARCHITECTURE.md`](../ARCHITECTURE.md) — <bdi dir="ltr">transport</bdi> مربوط به <bdi dir="ltr">daemon</bdi> در آنجا در سطح <bdi dir="ltr">topology</bdi> و <bdi dir="ltr">ownership</bdi> توضیح داده شده است. این سند **مرجع سریع <bdi dir="ltr">RPC surface</bdi>** و **<bdi dir="ltr">invariant</bdi>ها و <bdi dir="ltr">validation</bdi>**هایی را نگه می‌دارد که برای سند <bdi dir="ltr">overview</bdi> بیش از حد جزئی هستند.

## <bdi dir="ltr">Invariant</bdi>ها

1. **<bdi dir="ltr">transport</bdi> فقط محلی** — <bdi dir="ltr">Windows</bdi> از <bdi dir="ltr">namespaced pipe</bdi> با نام <bdi dir="ltr">`scriptor-core`</bdi> استفاده می‌کند؛ <bdi dir="ltr">Unix</bdi> از فایل <bdi dir="ltr">UDS</bdi> زیر <bdi dir="ltr">directory</bdi> داده برنامه.
2. **پیام‌های <bdi dir="ltr">framed</bdi>** — هر <bdi dir="ltr">frame</bdi> ساختار <bdi dir="ltr">`MAGIC (u32) | LEN (u32) | postcard body`</bdi> دارد و سقف آن 16 <bdi dir="ltr">MiB</bdi> است.
3. **<bdi dir="ltr">RPC</bdi> به‌صورت <bdi dir="ltr">fail-fast</bdi>** — <bdi dir="ltr">frame</bdi> خراب یا وضعیت ناشناخته <bdi dir="ltr">vault</bdi> رشته صریح <bdi dir="ltr">`RpcResult::Err`</bdi> برمی‌گرداند.
4. **مالکیت <bdi dir="ltr">session</bdi>** — <bdi dir="ltr">`OpenVault`</bdi> <bdi dir="ltr">vault</bdi> فعال را مشخص می‌کند؛ فراخوانی‌های بعدی به <bdi dir="ltr">session</bdi> باز نیاز دارند.
5. **<bdi dir="ltr">hook</bdi> مربوط به <bdi dir="ltr">hot reload</bdi>** — <bdi dir="ltr">`ReloadConfig`</bdi> <bdi dir="ltr">generation counter</bdi> داخلی را بالا می‌برد بی‌آنکه <bdi dir="ltr">session</bdi>های فعال را متوقف کند.

## <bdi dir="ltr">RPC Surface</bdi>

| <bdi dir="ltr">Method</bdi> | <bdi dir="ltr">Payload</bdi> |
|---|---|
| <bdi dir="ltr">`Ping`</bdi> | <bdi dir="ltr">version</bdi> |
| <bdi dir="ltr">`OpenVault`</bdi> | <bdi dir="ltr">vault descriptor</bdi> |
| <bdi dir="ltr">`ListNotes` / `SearchNotes`</bdi> | <bdi dir="ltr">note summary</bdi> / <bdi dir="ltr">hit</bdi> |
| <bdi dir="ltr">`ReadNote`</bdi> | سند <bdi dir="ltr">Markdown</bdi> |
| <bdi dir="ltr">`RebuildIndex`</bdi> | <bdi dir="ltr">rebuild summary</bdi> |
| <bdi dir="ltr">`HealthReport` / `HealthDiagnostics`</bdi> | گزارش <bdi dir="ltr">JSON</bdi> |
| <bdi dir="ltr">`GitStatus`</bdi> | وضعیت <bdi dir="ltr">Git</bdi> در <bdi dir="ltr">JSON</bdi> |
| <bdi dir="ltr">`Backlinks`</bdi> | <bdi dir="ltr">backlink hit</bdi> در <bdi dir="ltr">JSON</bdi> |
| <bdi dir="ltr">`GraphSummary`</bdi> | <bdi dir="ltr">graph</bdi> متمرکز در <bdi dir="ltr">JSON</bdi> |
| <bdi dir="ltr">`ReloadConfig`</bdi> | <bdi dir="ltr">unit</bdi> |
| <bdi dir="ltr">`SaveNote`</bdi> | <bdi dir="ltr">JSON</bdi> خروجی ذخیره، شامل <bdi dir="ltr">metadata</bdi> و <bdi dir="ltr">content hash</bdi> |
| <bdi dir="ltr">`UpdateNoteIndex`</bdi> | <bdi dir="ltr">unit</bdi> |
| <bdi dir="ltr">`RenameNoteApply`</bdi> | <bdi dir="ltr">JSON</bdi> نتیجه اعمال <bdi dir="ltr">rename</bdi> |
| <bdi dir="ltr">`ExportRunNote`</bdi> | <bdi dir="ltr">JSON</bdi> خروجی <bdi dir="ltr">export job</bdi> |
| <bdi dir="ltr">`ExportRunMarkdown`</bdi> | <bdi dir="ltr">JSON</bdi> خروجی <bdi dir="ltr">export job</bdi> با <bdi dir="ltr">source</bdi> ازپیش‌پردازش‌شده <bdi dir="ltr">Markdown</bdi> |

## اعتبارسنجی

- <bdi dir="ltr">roundtrip</bdi> مربوط به <bdi dir="ltr">frame</bdi> در <bdi dir="ltr">`scriptor-ipc`</bdi>
- <bdi dir="ltr">handler</bdi> + <bdi dir="ltr">socket RPC ping</bdi> در <bdi dir="ltr">`scriptor-daemon`</bdi>
- <bdi dir="ltr">differential oracle:</bdi> <bdi dir="ltr">`rewrite_tags_differential_oracle` در `vault::tag_rename`</bdi>
- <bdi dir="ltr">CI:</bdi> <bdi dir="ltr">`cargo test -p scriptor-daemon -p scriptor-ipc` + `pnpm check:daemon`</bdi>

## فرمان‌های اجرا

</div>

<div dir="ltr">

<div dir="ltr">
```bash
cargo run -p scriptor-daemon -- serve
cargo run -p scriptor-cli -- daemon ping
cargo run -p scriptor-cli -- tui ./vault --via-daemon
pnpm check:daemon
```
</div>

</div>

<div dir="rtl" lang="fa">

برای نمودار <bdi dir="ltr">topology</bdi>، <bdi dir="ltr">routing</bdi> مربوط به <bdi dir="ltr">integration</bdi> دسکتاپ، <bdi dir="ltr">staging</bdi> مربوط به <bdi dir="ltr">sidecar</bdi> و مسیرهای <bdi dir="ltr">hook</bdi> موتور <bdi dir="ltr">headless</bdi>، ردیف **<bdi dir="ltr">Daemon transport</bdi>** در [`docs/ARCHITECTURE.md`](../ARCHITECTURE.md) و مسیرهای <bdi dir="ltr">bridge</bdi> مستندشده در همان فایل را ببینید.

</div>


</div>
