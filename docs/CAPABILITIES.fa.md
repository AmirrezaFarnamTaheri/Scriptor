<div dir="ltr" align="center">
[English](CAPABILITIES.md) · **فارسی** · [简体中文](CAPABILITIES.zh-CN.md) · [Русский](CAPABILITIES.ru.md) · [Deutsch](CAPABILITIES.de.md) · [Español](CAPABILITIES.es.md)
</div>

<div dir="rtl" lang="fa" align="right">

<div dir="rtl" lang="fa">

# قابلیت‌های <bdi dir="ltr">Scriptor</bdi>

[<bdi dir="ltr">English</bdi>](CAPABILITIES.md) · [简体中文](CAPABILITIES.zh-CN.md) · [Русский](CAPABILITIES.ru.md) · [<bdi dir="ltr">Deutsch</bdi>](CAPABILITIES.de.md) · [<bdi dir="ltr">Espa</bdi>ñ<bdi dir="ltr">ol</bdi>](CAPABILITIES.es.md) · **فارسی**

نمونه‌های بصری سطوحی که بر اساس قابلیت فعال می‌شوند در [گالری بازبینی بصری](./VISUAL-REVIEW.md) و [فهرست مرجع اسکرین‌شات‌ها](assets/screenshots/README.md) نگهداری می‌شوند؛ از جمله [<bdi dir="ltr">Graph</bdi>](assets/screenshots/graph.png)، [<bdi dir="ltr">Canvas</bdi>](assets/screenshots/canvas.png)، [<bdi dir="ltr">MCP</bdi>](assets/screenshots/mcp-panel.png) و [<bdi dir="ltr">Plugins</bdi>](assets/screenshots/plugins.png). اسکرین‌شات‌ها فقط وضعیت رابط کاربری را نشان می‌دهند؛ مجوزدهی بومی و وضعیت واقعی <bdi dir="ltr">vault</bdi> همچنان مرجع نهایی هستند.

این سند سطوح محصولِ منتشرشده و اعتبارسنجی انتشار برای **<bdi dir="ltr">v1.0.0</bdi>** را پوشش می‌دهد.

معرفی قابلیت‌های کاربرمحور در [`README.md`](../README.md) اصلی (بخش <bdi dir="ltr">Features</bdi>) قرار دارد و مرجع رسمی وضعیت بلوغ قابلیت‌ها [`CAPABILITY-MATURITY.md`](./CAPABILITY-MATURITY.md) است. این صفحه مانیفست تحویل <bdi dir="ltr">v1.0.0</bdi> و فرمان‌های اعتبارسنجی انتشار را دنبال می‌کند.

## موارد موجود در <bdi dir="ltr">v1.0.0</bdi>

| حوزه | مرجع |
|---|---|
| پوسته دسکتاپ (<bdi dir="ltr">Tauri</bdi> 2) | <bdi dir="ltr">`apps/desktop/`</bdi> |
| هسته <bdi dir="ltr">vault</bdi> و <bdi dir="ltr">indexer</bdi> | <bdi dir="ltr">`crates/vault`, `crates/indexer`</bdi> |
| <bdi dir="ltr">IPC</bdi> مربوط به <bdi dir="ltr">daemon</bdi> بدون رابط | [`architecture/IPC_DAEMON.md`](./architecture/IPC_DAEMON.md) |
| رابط ترمینالی | [`architecture/TUI_PARITY.md`](./architecture/TUI_PARITY.md) |
| سامانه افزونه‌ها (<bdi dir="ltr">safe mode</bdi> و <bdi dir="ltr">marketplace</bdi>) | [`architecture/PLUGIN_SYSTEM.md`](./architecture/PLUGIN_SYSTEM.md) |
| راهنمای توسعه افزونه و <bdi dir="ltr">hello-world</bdi> | [`plugins/AUTHOR_GUIDE.md`](./plugins/AUTHOR_GUIDE.md) |
| ۲۲ ابزار <bdi dir="ltr">MCP</bdi> با <bdi dir="ltr">draft</bdi>های بازبینی‌شده | <bdi dir="ltr">`packages/mcp/`</bdi>؛ ممیزی پایدار تغییرات: <bdi dir="ltr">`crates/vault/src/mcp_audit.rs`, `crates/daemon/src/automation_stdio.rs`</bdi> |
| خروجی‌گیری (<bdi dir="ltr">Pandoc</bdi>) | <bdi dir="ltr">`crates/export-runner`, `@scriptor/export`</bdi> |
| موتور <bdi dir="ltr">Canvas</bdi> (انتقال <bdi dir="ltr">resvg</bdi> به <bdi dir="ltr">worker</bdi>) | <bdi dir="ltr">`crates/canvas-engine`, `@scriptor/canvas`</bdi> |
| درخت مجازی‌سازی‌شده <bdi dir="ltr">vault</bdi> | <bdi dir="ltr">`src/components/app/VirtualNoteList.tsx`</bdi> |
| توکن‌های طراحی (۴۱۴ خط استخراج‌شده) | <bdi dir="ltr">`src/styles/tokens/components.css`</bdi> |
| آزمون‌های <bdi dir="ltr">visual regression</bdi> | <bdi dir="ltr">`playwright.visual.config.ts`</bdi> |
| دروازه <bdi dir="ltr">CI</bdi> مبتنی بر <bdi dir="ltr">axe-core</bdi> | <bdi dir="ltr">`check:a11y-axe` در `check:release`</bdi> |
| اسکرین‌شات‌های مستندات | <bdi dir="ltr">`docs/assets/screenshots/`</bdi> |
| بسته‌بندی انتشار و شواهد اعتمادِ بدون امضا | <bdi dir="ltr">`scripts/release/`, `.github/workflows/release.yml`</bdi> |

## موتور <bdi dir="ltr">Headless</bdi>

وقتی **<bdi dir="ltr">Settings</bdi> → <bdi dir="ltr">Headless engine</bdi>** فعال باشد، نمایه‌سازی، جست‌وجو، <bdi dir="ltr">backlink</bdi>ها، <bdi dir="ltr">graph</bdi>، وضعیت <bdi dir="ltr">Git</bdi>، تشخیص‌های سلامت، ذخیره/تغییرنام یادداشت و <bdi dir="ltr">job</bdi>های خروجی‌گیری از <bdi dir="ltr">daemon</bdi> محلی عبور می‌کنند. بازکردن <bdi dir="ltr">vault</bdi>، <bdi dir="ltr">scan</bdi> و <bdi dir="ltr">Canvas</bdi> برای پاسخ‌گویی سریع داخل همان فرایند باقی می‌مانند. برای جزئیات به [`architecture/IPC_DAEMON.md`](./architecture/IPC_DAEMON.md) مراجعه کنید.

## اعتبارسنجی انتشار

</div>

<div dir="ltr">

<div dir="ltr">
```powershell
pnpm check:release   # Full local release gate (includes axe-core CI gate)
pnpm check:daemon    # IPC smoke
pnpm check:tui       # Terminal UI smoke
pnpm check:a11y      # Static accessibility checks
pnpm check:a11y-axe  # axe-core WCAG 2a/2aa/2.1aa automated audit
pnpm check:plugins   # Plugin manifest + marketplace catalog
pnpm check:mcp       # MCP tool manifest validation
pnpm check:contracts # TypeScript contract packages
pnpm check:canvas    # Canvas engine contracts
pnpm check:editor    # Editor engine contracts
pnpm check:renderer  # Renderer contracts
pnpm check:export    # Export pipeline contracts
pnpm check:knowledge # Knowledge graph contracts
pnpm check:citations # Citation engine contracts
pnpm check:headless  # Headless runner contracts
pnpm check:perf      # Performance baseline check
pnpm test:rust       # Rust unit and integration tests
pnpm test:visual     # Visual regression Playwright tests
pnpm test:e2e        # Playwright end-to-end tests
```
</div>

</div>

<div dir="rtl" lang="fa">

<bdi dir="ltr">CI</bdi> همین بررسی‌ها را در [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) تکرار می‌کند.

## اسناد مرتبط

| سند | کاربرد |
|---|---|
| [`guides/GETTING_STARTED.md`](./guides/GETTING_STARTED.md) | راهنمای اجرای نخست |
| [`release/PANDOC_STRATEGY.md`](./release/PANDOC_STRATEGY.md) | پیش‌نیازهای خروجی‌گیری |
| [`release/SIGNING.md`](./release/SIGNING.md) | سیاست اعتماد و امضای نصب‌کننده‌ها |
| [`../PRODUCT.md`](../PRODUCT.md) | اصول محصول |
| [`../CHANGELOG.md`](../CHANGELOG.md) | تاریخچه انتشارها |

</div>


</div>
