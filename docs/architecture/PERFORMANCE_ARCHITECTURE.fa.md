<div dir="ltr" align="center">
[English](PERFORMANCE_ARCHITECTURE.md) · **فارسی** · [简体中文](PERFORMANCE_ARCHITECTURE.zh-CN.md) · [Русский](PERFORMANCE_ARCHITECTURE.ru.md) · [Deutsch](PERFORMANCE_ARCHITECTURE.de.md) · [Español](PERFORMANCE_ARCHITECTURE.es.md)
</div>

<div dir="rtl" lang="fa" align="right">

<div dir="rtl" lang="fa">

# معماری کارایی

[<bdi dir="ltr">English</bdi>](PERFORMANCE_ARCHITECTURE.md) · [简体中文](PERFORMANCE_ARCHITECTURE.zh-CN.md) · [Русский](PERFORMANCE_ARCHITECTURE.ru.md) · [<bdi dir="ltr">Deutsch</bdi>](PERFORMANCE_ARCHITECTURE.de.md) · [<bdi dir="ltr">Espa</bdi>ñ<bdi dir="ltr">ol</bdi>](PERFORMANCE_ARCHITECTURE.es.md) · **فارسی**

## فرض اصلی کارایی

<bdi dir="ltr">Scriptor</bdi> باید از <bdi dir="ltr">workspace</bdi>های <bdi dir="ltr">Markdown</bdi> دوران <bdi dir="ltr">Electron</bdi> سریع‌تر حس شود، چون کار سنگین از <bdi dir="ltr">UI thread</bdi> بیرون می‌رود، کد <bdi dir="ltr">native</bdi> مالک مرزهای <bdi dir="ltr">IO</bdi> و <bdi dir="ltr">process</bdi> است و <bdi dir="ltr">state</bdi> مشتق با <bdi dir="ltr">semantics</bdi> صریح <bdi dir="ltr">rebuild cache</bdi> می‌شود.

## پشته بهینه‌سازی

| لایه | بهینه‌سازی | <bdi dir="ltr">Owner</bdi> | اعتبارسنجی |
|---|---|---|---|
| <bdi dir="ltr">Desktop shell</bdi> | <bdi dir="ltr">Tauri</bdi> 2 به‌جای <bdi dir="ltr">Electron.</bdi> | <bdi dir="ltr">Native Platform</bdi> | <bdi dir="ltr">benchmark</bdi> مربوط به <bdi dir="ltr">startup</bdi> و <bdi dir="ltr">idle memory.</bdi> |
| <bdi dir="ltr">File IO</bdi> | هسته <bdi dir="ltr">vault</bdi> در <bdi dir="ltr">Rust</bdi> با <bdi dir="ltr">atomic write</bdi> و <bdi dir="ltr">batching</bdi> رویدادهای <bdi dir="ltr">watcher.</bdi> | <bdi dir="ltr">Vault Kernel</bdi> | تست <bdi dir="ltr">latency</bdi> ذخیره و <bdi dir="ltr">watcher burst.</bdi> |
| <bdi dir="ltr">Cache</bdi> | <bdi dir="ltr">cache</bdi> مشتق <bdi dir="ltr">SQLite/FTS.</bdi> | <bdi dir="ltr">Indexing And Search</bdi> | تست <bdi dir="ltr">rebuild</bdi>، <bdi dir="ltr">warm search</bdi> و <bdi dir="ltr">migration.</bdi> |
| <bdi dir="ltr">Editor</bdi> | <bdi dir="ltr">adapter</bdi> مربوط به <bdi dir="ltr">CodeMirror</bdi>، <bdi dir="ltr">extension</bdi>های <bdi dir="ltr">lazy</bdi>، بدون <bdi dir="ltr">rich editor</bdi> به‌صورت پیش‌فرض. | <bdi dir="ltr">Editor Experience</bdi> | بودجه <bdi dir="ltr">frame</bdi> مربوط به <bdi dir="ltr">keystroke.</bdi> |
| <bdi dir="ltr">Preview</bdi> | <bdi dir="ltr">rendering Markdown</bdi> مبتنی بر <bdi dir="ltr">worker</bdi> و مرز <bdi dir="ltr">sanitizer.</bdi> | <bdi dir="ltr">Publication</bdi> | <bdi dir="ltr">benchmark</bdi> مربوط به <bdi dir="ltr">preview render.</bdi> |
| <bdi dir="ltr">Graph</bdi> | <bdi dir="ltr">edge</bdi>های <bdi dir="ltr">precomputed</bdi>، <bdi dir="ltr">focused graph query</bdi> و <bdi dir="ltr">worker layout.</bdi> | <bdi dir="ltr">Knowledge Graph</bdi> | <bdi dir="ltr">benchmark query</bdi> و <bdi dir="ltr">layout</bdi> گراف. |
| <bdi dir="ltr">Canvas</bdi> | <bdi dir="ltr">native scene model</bdi>، <bdi dir="ltr">spatial index</bdi>، <bdi dir="ltr">block renderer</bdi>های <bdi dir="ltr">lazy</bdi> و <bdi dir="ltr">snapshot job.</bdi> | <bdi dir="ltr">Canvas Experience</bdi> | <bdi dir="ltr">benchmark</bdi>های <bdi dir="ltr">hit-test</bdi>، <bdi dir="ltr">pan/zoom</bdi> و <bdi dir="ltr">snapshot.</bdi> |
| <bdi dir="ltr">Export</bdi> | <bdi dir="ltr">job runner</bdi> در <bdi dir="ltr">Rust</bdi>، <bdi dir="ltr">temp dir</bdi>های <bdi dir="ltr">isolated</bdi> و <bdi dir="ltr">process</bdi> قابل لغو <bdi dir="ltr">Pandoc.</bdi> | <bdi dir="ltr">Publication</bdi> | تست مدت <bdi dir="ltr">export</bdi> و <bdi dir="ltr">cancellation.</bdi> |
| <bdi dir="ltr">UI lists</bdi> | <bdi dir="ltr">file tree</bdi>، <bdi dir="ltr">search result</bdi>، <bdi dir="ltr">backlink</bdi> و <bdi dir="ltr">job</bdi> مجازی‌سازی‌شده. | <bdi dir="ltr">Design Systems</bdi> | تست تعامل با <bdi dir="ltr">list</bdi> بزرگ. |
| <bdi dir="ltr">Automation</bdi> | ابتدا <bdi dir="ltr">MCP</bdi> به‌صورت <bdi dir="ltr">read-only</bdi>، سپس <bdi dir="ltr">write approval.</bdi> | <bdi dir="ltr">Automation And AI</bdi> | <bdi dir="ltr">permission test</bdi> و <bdi dir="ltr">audit log.</bdi> |

## بودجه‌های کارایی

| بودجه | هدف | نخستین <bdi dir="ltr">Measurement Hook</bdi> |
|---|---:|---|
| <bdi dir="ltr">cold shell</bdi> قابل استفاده | 2.0<bdi dir="ltr">s</bdi> | <bdi dir="ltr">`scripts/benchmarks/startup`</bdi> |
| <bdi dir="ltr">vault</bdi> گرم با 5<bdi dir="ltr">k note</bdi> قابل استفاده | 1.5<bdi dir="ltr">s</bdi> | <bdi dir="ltr">`scripts/benchmarks/vault-scan`</bdi> |
| ذخیره <bdi dir="ltr">note</bdi> عادی تا <bdi dir="ltr">cache update</bdi> | 150<bdi dir="ltr">ms</bdi> | <bdi dir="ltr">timing</bdi> تست <bdi dir="ltr">integration</bdi> در <bdi dir="ltr">Rust</bdi> |
| <bdi dir="ltr">warm search query</bdi> | 100<bdi dir="ltr">ms</bdi> | <bdi dir="ltr">`scripts/benchmarks/search`</bdi> |
| هزینه متوسط <bdi dir="ltr">frame</bdi> در <bdi dir="ltr">editor</bdi> | 16<bdi dir="ltr">ms</bdi> | <bdi dir="ltr">editor latency probe</bdi> |
| <bdi dir="ltr">render preview</bdi> یک <bdi dir="ltr">note</bdi> معمولی | 250<bdi dir="ltr">ms</bdi> | <bdi dir="ltr">renderer worker benchmark</bdi> |
| <bdi dir="ltr">rename dry run</bdi> روی 5<bdi dir="ltr">k note</bdi> | 500<bdi dir="ltr">ms</bdi> | <bdi dir="ltr">graph rename fixture</bdi> |
| هزینه <bdi dir="ltr">frame</bdi> مربوط به <bdi dir="ltr">Canvas pan/zoom</bdi> | 16<bdi dir="ltr">ms</bdi> | <bdi dir="ltr">canvas interaction probe</bdi> |
| <bdi dir="ltr">latency</bdi> شروع <bdi dir="ltr">Canvas snapshot</bdi> | 250<bdi dir="ltr">ms</bdi> | <bdi dir="ltr">canvas snapshot job benchmark</bdi> |
| پاسخ <bdi dir="ltr">cancellation</bdi> در <bdi dir="ltr">export</bdi> | 250<bdi dir="ltr">ms</bdi> | <bdi dir="ltr">export-runner integration test</bdi> |

## قواعد کارایی <bdi dir="ltr">UI</bdi>

- <bdi dir="ltr">summary</bdi> مشتق را <bdi dir="ltr">render</bdi> کنید، نه ساختار خام کل <bdi dir="ltr">vault</bdi> را.
- <bdi dir="ltr">editor</bdi> <bdi dir="ltr">state</bdi> را محلی در <bdi dir="ltr">editor adapter</bdi> نگه دارید.
- <bdi dir="ltr">app</bdi> <bdi dir="ltr">shell state</bdi> را کم‌عمق و <bdi dir="ltr">serializable</bdi> نگه دارید.
- برای <bdi dir="ltr">file tree</bdi>، <bdi dir="ltr">backlink</bdi>، <bdi dir="ltr">job</bdi> و <bdi dir="ltr">command result</bdi> از <bdi dir="ltr">row height</bdi> ثابت استفاده کنید.
- <bdi dir="ltr">panel</bdi>های <bdi dir="ltr">graph</bdi>، <bdi dir="ltr">canvas</bdi>، <bdi dir="ltr">export</bdi>، <bdi dir="ltr">plugin</bdi> و <bdi dir="ltr">AI</bdi> را تا زمان بازشدن <bdi dir="ltr">defer</bdi> کنید.
- <bdi dir="ltr">plugin</bdi> <bdi dir="ltr">widget</bdi>ها را در <bdi dir="ltr">slot</bdi> محدود با <bdi dir="ltr">data contract</bdi> صریح نگه دارید.
- در <bdi dir="ltr">panel</bdi>های مستقل با <bdi dir="ltr">scroll</bdi> جدا از <bdi dir="ltr">CSS containment</bdi> استفاده کنید.
- <bdi dir="ltr">reduced</bdi> <bdi dir="ltr">motion</bdi> را رعایت کنید و از <bdi dir="ltr">choreography</bdi> هنگام <bdi dir="ltr">page load</bdi> دوری کنید.

## قواعد کارایی <bdi dir="ltr">Native</bdi>

- یک <bdi dir="ltr">vault path</bdi> را هرگز دو بار به‌صورت موازی <bdi dir="ltr">scan</bdi> نکنید.
- <bdi dir="ltr">file</bdi> <bdi dir="ltr">watcher event</bdi>ها را پیش از <bdi dir="ltr">cache update batch</bdi> کنید.
- با <bdi dir="ltr">content hash</bdi> از <bdi dir="ltr">note</bdi>های بدون تغییر عبور کنید.
- <bdi dir="ltr">index</bdi> <bdi dir="ltr">update</bdi>ها را داخل <bdi dir="ltr">transaction</bdi>های <bdi dir="ltr">SQLite</bdi> اجرا کنید.
- <bdi dir="ltr">process</bdi> <bdi dir="ltr">arg</bdi> صریح را به <bdi dir="ltr">shell string</bdi> ترجیح دهید.
- <bdi dir="ltr">cache</bdi> <bdi dir="ltr">rebuild</bdi> را یک <bdi dir="ltr">recovery path</bdi> عادی در نظر بگیرید.
- برای <bdi dir="ltr">job</bdi>های طولانی <bdi dir="ltr">progress</bdi> و نقطه <bdi dir="ltr">cancellation</bdi> منتشر کنید.

## مسیرهای ارتقا

| محدودیت | رویکرد نخست | فقط اگر شواهد نشان داد ارتقا دهید |
|---|---|---|
| <bdi dir="ltr">Search latency</bdi> | <bdi dir="ltr">SQLite FTS5</bdi> | <bdi dir="ltr">crate</bdi> مربوط به <bdi dir="ltr">Tantivy index.</bdi> |
| <bdi dir="ltr">Graph layout</bdi> | <bdi dir="ltr">Web worker layout</bdi> | <bdi dir="ltr">Rust layout precompute</bdi> یا <bdi dir="ltr">WebGL renderer.</bdi> |
| <bdi dir="ltr">Canvas hit-testing</bdi> | <bdi dir="ltr">Rust spatial index</bdi> | <bdi dir="ltr">GPU renderer</bdi> فقط پس از اندازه‌گیری فشار تعامل. |
| <bdi dir="ltr">Large vault scans</bdi> | <bdi dir="ltr">Rust sequential scan</bdi> با <bdi dir="ltr">batching</bdi> | <bdi dir="ltr">Rayon parallel scan</bdi> با <bdi dir="ltr">IO backpressure.</bdi> |
| <bdi dir="ltr">Git process overhead</bdi> | <bdi dir="ltr">Safe Git CLI adapter</bdi> | <bdi dir="ltr">wrapper</bdi> مربوط به <bdi dir="ltr">`git2`</bdi>. |
| <bdi dir="ltr">Export throughput</bdi> | یک <bdi dir="ltr">Pandoc job queue</bdi> | <bdi dir="ltr">parallel queue</bdi> با <bdi dir="ltr">resource cap</bdi> جدا برای هر <bdi dir="ltr">profile.</bdi> |

</div>


</div>
