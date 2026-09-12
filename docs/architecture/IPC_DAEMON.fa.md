<div dir="rtl" lang="fa">

# معماری IPC مربوط به Daemon

[English](IPC_DAEMON.md) · [简体中文](IPC_DAEMON.zh-CN.md) · [Русский](IPC_DAEMON.ru.md) · [Deutsch](IPC_DAEMON.de.md) · [Español](IPC_DAEMON.es.md) · **فارسی**

> **مرجع اصلی:** [`docs/ARCHITECTURE.md`](../ARCHITECTURE.md) — transport مربوط به daemon در آنجا در سطح topology و ownership توضیح داده شده است. این سند **مرجع سریع RPC surface** و **invariantها و validation**هایی را نگه می‌دارد که برای سند overview بیش از حد جزئی هستند.

## Invariantها

1. **transport فقط محلی** — Windows از namespaced pipe با نام <bdi dir="ltr">`scriptor-core`</bdi> استفاده می‌کند؛ Unix از فایل UDS زیر directory داده برنامه.
2. **پیام‌های framed** — هر frame ساختار <bdi dir="ltr">`MAGIC (u32) | LEN (u32) | postcard body`</bdi> دارد و سقف آن 16 MiB است.
3. **RPC به‌صورت fail-fast** — frame خراب یا وضعیت ناشناخته vault رشته صریح <bdi dir="ltr">`RpcResult::Err`</bdi> برمی‌گرداند.
4. **مالکیت session** — <bdi dir="ltr">`OpenVault`</bdi> vault فعال را مشخص می‌کند؛ فراخوانی‌های بعدی به session باز نیاز دارند.
5. **hook مربوط به hot reload** — <bdi dir="ltr">`ReloadConfig`</bdi> generation counter داخلی را بالا می‌برد بی‌آنکه sessionهای فعال را متوقف کند.

## RPC Surface

| Method | Payload |
|---|---|
| <bdi dir="ltr">`Ping`</bdi> | version |
| <bdi dir="ltr">`OpenVault`</bdi> | vault descriptor |
| <bdi dir="ltr">`ListNotes` / `SearchNotes`</bdi> | note summary / hit |
| <bdi dir="ltr">`ReadNote`</bdi> | سند Markdown |
| <bdi dir="ltr">`RebuildIndex`</bdi> | rebuild summary |
| <bdi dir="ltr">`HealthReport` / `HealthDiagnostics`</bdi> | گزارش JSON |
| <bdi dir="ltr">`GitStatus`</bdi> | وضعیت Git در JSON |
| <bdi dir="ltr">`Backlinks`</bdi> | backlink hit در JSON |
| <bdi dir="ltr">`GraphSummary`</bdi> | graph متمرکز در JSON |
| <bdi dir="ltr">`ReloadConfig`</bdi> | unit |
| <bdi dir="ltr">`SaveNote`</bdi> | JSON خروجی ذخیره، شامل metadata و content hash |
| <bdi dir="ltr">`UpdateNoteIndex`</bdi> | unit |
| <bdi dir="ltr">`RenameNoteApply`</bdi> | JSON نتیجه اعمال rename |
| <bdi dir="ltr">`ExportRunNote`</bdi> | JSON خروجی export job |
| <bdi dir="ltr">`ExportRunMarkdown`</bdi> | JSON خروجی export job با source ازپیش‌پردازش‌شده Markdown |

## اعتبارسنجی

- roundtrip مربوط به frame در <bdi dir="ltr">`scriptor-ipc`</bdi>
- handler + socket RPC ping در <bdi dir="ltr">`scriptor-daemon`</bdi>
- differential oracle: <bdi dir="ltr">`rewrite_tags_differential_oracle` در `vault::tag_rename`</bdi>
- CI: <bdi dir="ltr">`cargo test -p scriptor-daemon -p scriptor-ipc` + `pnpm check:daemon`</bdi>

## فرمان‌های اجرا

</div>

<div dir="ltr">

```bash
cargo run -p scriptor-daemon -- serve
cargo run -p scriptor-cli -- daemon ping
cargo run -p scriptor-cli -- tui ./vault --via-daemon
pnpm check:daemon
```

</div>

<div dir="rtl" lang="fa">

برای نمودار topology، routing مربوط به integration دسکتاپ، staging مربوط به sidecar و مسیرهای hook موتور headless، ردیف **Daemon transport** در [`docs/ARCHITECTURE.md`](../ARCHITECTURE.md) و مسیرهای bridge مستندشده در همان فایل را ببینید.

</div>
