# عملیات و عیب‌یابی

## Tracing ساخت‌یافته

نسخه دسکتاپ، daemon و CLI از طریق `crates/system-bridge/src/observability.rs` tracing ساخت‌یافته JSON را راه‌اندازی می‌کنند. فیلدهایی که نام‌هایی مرتبط با secret/token/password/key دارند redact می‌شوند. فایل‌های محلی بر اساس اندازه rotate می‌شوند و تعداد segmentهای نگه‌داری‌شده محدود است.

## هم‌بستگی

عملیات طولانی یا عبوری از چند مرز باید یک operation/request ID را از فرمان renderer، آداپتور Tauri/daemon، رسید فرایند خارجی و رویداد ممیزی عبور دهند. گزارش خرابی باید با همان ID و بدون خواندن کد منبع قابل عیب‌یابی باشد.

## سیگنال‌های سلامت

- نسل watcher و وضعیت rescan-required؛
- نسل/تازگی index؛
- قطع‌شدن subscriberهای daemon؛
- نتایج timeout/cancel/truncation فرایند؛
- intentهای در انتظار MCP؛
- راستی‌آزمایی backup و restore journal؛
- وضعیت log rotation/repair.

## گردآوری اطلاعات رخداد

فقط از diagnosticهای redactشده استفاده کنید. هرگز vault واقعی، مقدار keychain، بدنه کامل request یا audit log بازبینی‌نشده را پیوست نکنید. source commit، نسخه برنامه، OS/arch، مراحل بازتولید، operation ID و کوچک‌ترین segment محدود و مرتبط لاگ را حفظ کنید.

## بسته پشتیبانی

Settings → Diagnostics → **Export redacted support bundle** یک artifact پشتیبانی JSON محدود را در `.scriptor/diagnostics/` می‌نویسد. این بسته شامل هویت برنامه/سیستم، شمارش‌های تجمیعی سلامت vault و حداکثر ۱۰۰ رویداد diagnostic از قبل redactشده سمت client است. مسیر ریشه vault، مسیر یادداشت‌ها، محتوای یادداشت، بدنه requestها و credentialها عمداً حذف می‌شوند. journal تشخیصی client در 2 MiB rotate می‌شود و اندازه message/detail پیش از ذخیره‌سازی محدود می‌گردد.
