<div dir="ltr" align="center">
[English](OPERATIONS.md) · **فارسی** · [简体中文](OPERATIONS.zh-CN.md) · [Русский](OPERATIONS.ru.md) · [Deutsch](OPERATIONS.de.md) · [Español](OPERATIONS.es.md)
</div>

<div dir="rtl" lang="fa" align="right">

# عملیات و عیب‌یابی

## <bdi dir="ltr">Tracing</bdi> ساخت‌یافته

نسخه دسکتاپ، <bdi dir="ltr">daemon</bdi> و <bdi dir="ltr">CLI</bdi> از طریق `crates/system-bridge/src/observability.rs` <bdi dir="ltr">tracing</bdi> ساخت‌یافته <bdi dir="ltr">JSON</bdi> را راه‌اندازی می‌کنند. فیلدهایی که نام‌هایی مرتبط با <bdi dir="ltr">secret/token/password/key</bdi> دارند <bdi dir="ltr">redact</bdi> می‌شوند. فایل‌های محلی بر اساس اندازه <bdi dir="ltr">rotate</bdi> می‌شوند و تعداد <bdi dir="ltr">segment</bdi>های نگه‌داری‌شده محدود است.

## هم‌بستگی

عملیات طولانی یا عبوری از چند مرز باید یک <bdi dir="ltr">operation/request ID</bdi> را از فرمان <bdi dir="ltr">renderer</bdi>، آداپتور <bdi dir="ltr">Tauri/daemon</bdi>، رسید فرایند خارجی و رویداد ممیزی عبور دهند. گزارش خرابی باید با همان <bdi dir="ltr">ID</bdi> و بدون خواندن کد منبع قابل عیب‌یابی باشد.

## سیگنال‌های سلامت

- نسل <bdi dir="ltr">watcher</bdi> و وضعیت <bdi dir="ltr">rescan-required</bdi>؛
- نسل/تازگی <bdi dir="ltr">index</bdi>؛
- قطع‌شدن <bdi dir="ltr">subscriber</bdi>های <bdi dir="ltr">daemon</bdi>؛
- نتایج <bdi dir="ltr">timeout/cancel/truncation</bdi> فرایند؛
- <bdi dir="ltr">intent</bdi>های در انتظار <bdi dir="ltr">MCP</bdi>؛
- راستی‌آزمایی <bdi dir="ltr">backup</bdi> و <bdi dir="ltr">restore journal</bdi>؛
- وضعیت <bdi dir="ltr">log rotation/repair.</bdi>

## گردآوری اطلاعات رخداد

فقط از <bdi dir="ltr">diagnostic</bdi>های <bdi dir="ltr">redact</bdi>شده استفاده کنید. هرگز <bdi dir="ltr">vault</bdi> واقعی، مقدار <bdi dir="ltr">keychain</bdi>، بدنه کامل <bdi dir="ltr">request</bdi> یا <bdi dir="ltr">audit log</bdi> بازبینی‌نشده را پیوست نکنید. <bdi dir="ltr">source commit</bdi>، نسخه برنامه، <bdi dir="ltr">OS/arch</bdi>، مراحل بازتولید، <bdi dir="ltr">operation ID</bdi> و کوچک‌ترین <bdi dir="ltr">segment</bdi> محدود و مرتبط لاگ را حفظ کنید.

## بسته پشتیبانی

<bdi dir="ltr">Settings</bdi> → <bdi dir="ltr">Diagnostics</bdi> → **<bdi dir="ltr">Export redacted support bundle</bdi>** یک <bdi dir="ltr">artifact</bdi> پشتیبانی <bdi dir="ltr">JSON</bdi> محدود را در `.scriptor/diagnostics/` می‌نویسد. این بسته شامل هویت برنامه/سیستم، شمارش‌های تجمیعی سلامت <bdi dir="ltr">vault</bdi> و حداکثر ۱۰۰ رویداد <bdi dir="ltr">diagnostic</bdi> از قبل <bdi dir="ltr">redact</bdi>شده سمت <bdi dir="ltr">client</bdi> است. مسیر ریشه <bdi dir="ltr">vault</bdi>، مسیر یادداشت‌ها، محتوای یادداشت، بدنه <bdi dir="ltr">request</bdi>ها و <bdi dir="ltr">credential</bdi>ها عمداً حذف می‌شوند. <bdi dir="ltr">journal</bdi> تشخیصی <bdi dir="ltr">client</bdi> در 2 <bdi dir="ltr">MiB rotate</bdi> می‌شود و اندازه <bdi dir="ltr">message/detail</bdi> پیش از ذخیره‌سازی محدود می‌گردد.


</div>
