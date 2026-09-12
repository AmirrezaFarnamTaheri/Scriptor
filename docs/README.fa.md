# مستندات Scriptor

[English](README.md) · **فارسی** · [简体中文](README.zh-CN.md) · [Русский](README.ru.md) · [Deutsch](README.de.md) · [Español](README.es.md)

> مستندات انگلیسی مرجع اصلی و رسمی هستند. این ترجمه برای خوانایی روان و طبیعی تهیه شده است؛ کدها، فرمان‌ها، مسیرها، نام APIها و شناسه‌های قراردادی بدون تغییر باقی می‌مانند.

## مستندات مرجعِ وضعیت فعلی

| سند | کاربرد |
|---|---|
| [`../README.fa.md`](../README.fa.md) | معرفی، راه‌اندازی، راستی‌آزمایی و وضعیت انتشار |
| [`ARCHITECTURE.fa.md`](ARCHITECTURE.fa.md) | توپولوژی زمان اجرا، مالکیت، مرزهای اعتماد و خرابی |
| [`CAPABILITY-MATURITY.fa.md`](CAPABILITY-MATURITY.fa.md) | وضعیت قابلیت‌های منتشرشده، آزمایشی، در حال ارزیابی و صرفاً طراحی‌شده |
| [`../PRODUCT.fa.md`](../PRODUCT.fa.md) | نتایج مورد انتظار کاربر، تعهدات محصول و موارد خارج از دامنه |
| [`../DESIGN.fa.md`](../DESIGN.fa.md) | سیستم رابط کاربری، واکنش‌گرایی و دسترس‌پذیری |
| [`../SECURITY.fa.md`](../SECURITY.fa.md) | مرزهای امنیتی و سیاست گزارش آسیب‌پذیری |
| [`RELEASE-SECURITY.fa.md`](RELEASE-SECURITY.fa.md) | امضا، SBOM، provenance و راستی‌آزمایی توسط مصرف‌کننده |
| [`ENCRYPTION-THREAT-MODEL.fa.md`](ENCRYPTION-THREAT-MODEL.fa.md) | دروازه تصمیم‌گیری برای رمزگذاری آزمایشی |
| [`OPERATIONS.fa.md`](OPERATIONS.fa.md) | tracing، هم‌بستگی، سلامت و رخدادها |
| [`FINAL-REMEDIATION-REPORT.fa.md`](FINAL-REMEDIATION-REPORT.fa.md) | خط مبنای فعلی محصول v1، schema و انتشار |
| [`VERIFICATION.fa.md`](VERIFICATION.fa.md) | دروازه‌های اثبات اجراشده، ایستا، در انتظار، انتشار و تاریخچه |
| [`RELEASE-CHECKLIST.fa.md`](RELEASE-CHECKLIST.fa.md) | چک‌لیست go/no-go انتشار تولیدی |

## راهنماهای کاربر و مشارکت‌کننده

- [`guides/GETTING_STARTED.fa.md`](guides/GETTING_STARTED.fa.md)
- [`CAPABILITIES.fa.md`](CAPABILITIES.fa.md)
- [`../CONTRIBUTING.fa.md`](../CONTRIBUTING.fa.md)
- [`plugins/AUTHOR_GUIDE.fa.md`](plugins/AUTHOR_GUIDE.fa.md)
- [`contracts/COMMAND_CATALOG.fa.md`](contracts/COMMAND_CATALOG.fa.md)
- [`contracts/CONTRACT_INDEX.fa.md`](contracts/CONTRACT_INDEX.fa.md)
- [`contracts/CONTRACT_GOVERNANCE.fa.md`](contracts/CONTRACT_GOVERNANCE.fa.md)

## طراحی و اعتبارسنجی

- [`design/DESIGN_SYSTEM.fa.md`](design/DESIGN_SYSTEM.fa.md)
- [`design/LAYOUT_BLUEPRINTS.fa.md`](design/LAYOUT_BLUEPRINTS.fa.md)
- [`validation/ACCESSIBILITY_AUDIT.fa.md`](validation/ACCESSIBILITY_AUDIT.fa.md)
- [`validation/FRONTEND_QUALITY.fa.md`](validation/FRONTEND_QUALITY.fa.md)
- [`assets/screenshots/README.fa.md`](assets/screenshots/README.fa.md)

## سوابق معماری

| فایل | دامنه |
|---|---|
| [`ARCHITECTURE.fa.md`](ARCHITECTURE.fa.md) | توپولوژی زمان اجرا، مالکیت، اعتماد و مرزهای خرابی |
| [`architecture/c4-container.fa.md`](architecture/c4-container.fa.md) | نمودار زمان اجرای سطح Container با Mermaid |
| [`architecture/c4-context.fa.md`](architecture/c4-context.fa.md) | نمودار Context با Mermaid |
| [`architecture/IPC_DAEMON.fa.md`](architecture/IPC_DAEMON.fa.md) | سطح RPC مربوط به daemon، قواعد ثابت و اعتبارسنجی |
| [`architecture/PLUGIN_SYSTEM.fa.md`](architecture/PLUGIN_SYSTEM.fa.md) | manifest افزونه، حالت امن، marketplace و توسعه افزونه |
| [`architecture/PERFORMANCE_ARCHITECTURE.fa.md`](architecture/PERFORMANCE_ARCHITECTURE.fa.md) | لایه‌های بهینه‌سازی، مالکان و بودجه‌های عملکرد |
| [`architecture/TUI_PARITY.fa.md`](architecture/TUI_PARITY.fa.md) | مدل برابری TTY TUI با سطح دسکتاپ |

تمام ادعاهای مربوط به قابلیت‌ها در این فایل‌ها باید با [`CAPABILITY-MATURITY.fa.md`](CAPABILITY-MATURITY.fa.md) سازگار باشند. یک سند طراحی به‌تنهایی اثبات نمی‌کند که قابلیتی منتشر شده است.

## مطالب آرشیوی

پژوهش‌های پیش از v1 و ارزیابی‌های طراحی منسوخ‌شده در [`_archived/`](_archived/) برای مراجعه تاریخی نگهداری می‌شوند و بخشی از قرارداد محصول یا دامنه ترجمه فعال نیستند.

## مراجع انتشار

- [`release/SIGNING.fa.md`](release/SIGNING.fa.md)
- [`release/PANDOC_STRATEGY.fa.md`](release/PANDOC_STRATEGY.fa.md)
