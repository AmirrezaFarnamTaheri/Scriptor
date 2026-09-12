<div dir="rtl" lang="fa">

# معماری کارایی

[English](PERFORMANCE_ARCHITECTURE.md) · [简体中文](PERFORMANCE_ARCHITECTURE.zh-CN.md) · [Русский](PERFORMANCE_ARCHITECTURE.ru.md) · [Deutsch](PERFORMANCE_ARCHITECTURE.de.md) · [Español](PERFORMANCE_ARCHITECTURE.es.md) · **فارسی**

## فرض اصلی کارایی

Scriptor باید از workspaceهای Markdown دوران Electron سریع‌تر حس شود، چون کار سنگین از UI thread بیرون می‌رود، کد native مالک مرزهای IO و process است و state مشتق با semantics صریح rebuild cache می‌شود.

## پشته بهینه‌سازی

| لایه | بهینه‌سازی | Owner | اعتبارسنجی |
|---|---|---|---|
| Desktop shell | Tauri 2 به‌جای Electron. | Native Platform | benchmark مربوط به startup و idle memory. |
| File IO | هسته vault در Rust با atomic write و batching رویدادهای watcher. | Vault Kernel | تست latency ذخیره و watcher burst. |
| Cache | cache مشتق SQLite/FTS. | Indexing And Search | تست rebuild، warm search و migration. |
| Editor | adapter مربوط به CodeMirror، extensionهای lazy، بدون rich editor به‌صورت پیش‌فرض. | Editor Experience | بودجه frame مربوط به keystroke. |
| Preview | rendering Markdown مبتنی بر worker و مرز sanitizer. | Publication | benchmark مربوط به preview render. |
| Graph | edgeهای precomputed، focused graph query و worker layout. | Knowledge Graph | benchmark query و layout گراف. |
| Canvas | native scene model، spatial index، block rendererهای lazy و snapshot job. | Canvas Experience | benchmarkهای hit-test، pan/zoom و snapshot. |
| Export | job runner در Rust، temp dirهای isolated و process قابل لغو Pandoc. | Publication | تست مدت export و cancellation. |
| UI lists | file tree، search result، backlink و job مجازی‌سازی‌شده. | Design Systems | تست تعامل با list بزرگ. |
| Automation | ابتدا MCP به‌صورت read-only، سپس write approval. | Automation And AI | permission test و audit log. |

## بودجه‌های کارایی

| بودجه | هدف | نخستین Measurement Hook |
|---|---:|---|
| cold shell قابل استفاده | 2.0s | <bdi dir="ltr">`scripts/benchmarks/startup`</bdi> |
| vault گرم با 5k note قابل استفاده | 1.5s | <bdi dir="ltr">`scripts/benchmarks/vault-scan`</bdi> |
| ذخیره note عادی تا cache update | 150ms | timing تست integration در Rust |
| warm search query | 100ms | <bdi dir="ltr">`scripts/benchmarks/search`</bdi> |
| هزینه متوسط frame در editor | 16ms | editor latency probe |
| render preview یک note معمولی | 250ms | renderer worker benchmark |
| rename dry run روی 5k note | 500ms | graph rename fixture |
| هزینه frame مربوط به Canvas pan/zoom | 16ms | canvas interaction probe |
| latency شروع Canvas snapshot | 250ms | canvas snapshot job benchmark |
| پاسخ cancellation در export | 250ms | export-runner integration test |

## قواعد کارایی UI

- summary مشتق را render کنید، نه ساختار خام کل vault را.
- editor state را محلی در editor adapter نگه دارید.
- app shell state را کم‌عمق و serializable نگه دارید.
- برای file tree، backlink، job و command result از row height ثابت استفاده کنید.
- panelهای graph، canvas، export، plugin و AI را تا زمان بازشدن defer کنید.
- plugin widgetها را در slot محدود با data contract صریح نگه دارید.
- در panelهای مستقل با scroll جدا از CSS containment استفاده کنید.
- reduced motion را رعایت کنید و از choreography هنگام page load دوری کنید.

## قواعد کارایی Native

- یک vault path را هرگز دو بار به‌صورت موازی scan نکنید.
- file watcher eventها را پیش از cache update batch کنید.
- با content hash از noteهای بدون تغییر عبور کنید.
- index updateها را داخل transactionهای SQLite اجرا کنید.
- process arg صریح را به shell string ترجیح دهید.
- cache rebuild را یک recovery path عادی در نظر بگیرید.
- برای jobهای طولانی progress و نقطه cancellation منتشر کنید.

## مسیرهای ارتقا

| محدودیت | رویکرد نخست | فقط اگر شواهد نشان داد ارتقا دهید |
|---|---|---|
| Search latency | SQLite FTS5 | crate مربوط به Tantivy index. |
| Graph layout | Web worker layout | Rust layout precompute یا WebGL renderer. |
| Canvas hit-testing | Rust spatial index | GPU renderer فقط پس از اندازه‌گیری فشار تعامل. |
| Large vault scans | Rust sequential scan با batching | Rayon parallel scan با IO backpressure. |
| Git process overhead | Safe Git CLI adapter | wrapper مربوط به <bdi dir="ltr">`git2`</bdi>. |
| Export throughput | یک Pandoc job queue | parallel queue با resource cap جدا برای هر profile. |

</div>
