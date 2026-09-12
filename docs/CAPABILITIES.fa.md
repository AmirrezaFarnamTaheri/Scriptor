<div dir="rtl" lang="fa">

# قابلیت‌های Scriptor

[English](CAPABILITIES.md) · [简体中文](CAPABILITIES.zh-CN.md) · [Русский](CAPABILITIES.ru.md) · [Deutsch](CAPABILITIES.de.md) · [Español](CAPABILITIES.es.md) · **فارسی**

نمونه‌های بصری سطوحی که بر اساس قابلیت فعال می‌شوند در [گالری بازبینی بصری](./VISUAL-REVIEW.md) و [فهرست مرجع اسکرین‌شات‌ها](assets/screenshots/README.md) نگهداری می‌شوند؛ از جمله [Graph](assets/screenshots/graph.png)، [Canvas](assets/screenshots/canvas.png)، [MCP](assets/screenshots/mcp-panel.png) و [Plugins](assets/screenshots/plugins.png). اسکرین‌شات‌ها فقط وضعیت رابط کاربری را نشان می‌دهند؛ مجوزدهی بومی و وضعیت واقعی vault همچنان مرجع نهایی هستند.

این سند سطوح محصولِ منتشرشده و اعتبارسنجی انتشار برای **v1.0.0** را پوشش می‌دهد.

معرفی قابلیت‌های کاربرمحور در [`README.md`](../README.md) اصلی (بخش Features) قرار دارد و مرجع رسمی وضعیت بلوغ قابلیت‌ها [`CAPABILITY-MATURITY.md`](./CAPABILITY-MATURITY.md) است. این صفحه مانیفست تحویل v1.0.0 و فرمان‌های اعتبارسنجی انتشار را دنبال می‌کند.

## موارد موجود در v1.0.0

| حوزه | مرجع |
|---|---|
| پوسته دسکتاپ (Tauri 2) | <bdi dir="ltr">`apps/desktop/`</bdi> |
| هسته vault و indexer | <bdi dir="ltr">`crates/vault`, `crates/indexer`</bdi> |
| IPC مربوط به daemon بدون رابط | [`architecture/IPC_DAEMON.md`](./architecture/IPC_DAEMON.md) |
| رابط ترمینالی | [`architecture/TUI_PARITY.md`](./architecture/TUI_PARITY.md) |
| سامانه افزونه‌ها (safe mode و marketplace) | [`architecture/PLUGIN_SYSTEM.md`](./architecture/PLUGIN_SYSTEM.md) |
| راهنمای توسعه افزونه و hello-world | [`plugins/AUTHOR_GUIDE.md`](./plugins/AUTHOR_GUIDE.md) |
| ۲۲ ابزار MCP با draftهای بازبینی‌شده | <bdi dir="ltr">`packages/mcp/`</bdi>؛ ممیزی پایدار تغییرات: <bdi dir="ltr">`crates/vault/src/mcp_audit.rs`, `crates/daemon/src/automation_stdio.rs`</bdi> |
| خروجی‌گیری (Pandoc) | <bdi dir="ltr">`crates/export-runner`, `@scriptor/export`</bdi> |
| موتور Canvas (انتقال resvg به worker) | <bdi dir="ltr">`crates/canvas-engine`, `@scriptor/canvas`</bdi> |
| درخت مجازی‌سازی‌شده vault | <bdi dir="ltr">`src/components/app/VirtualNoteList.tsx`</bdi> |
| توکن‌های طراحی (۴۱۴ خط استخراج‌شده) | <bdi dir="ltr">`src/styles/tokens/components.css`</bdi> |
| آزمون‌های visual regression | <bdi dir="ltr">`playwright.visual.config.ts`</bdi> |
| دروازه CI مبتنی بر axe-core | <bdi dir="ltr">`check:a11y-axe` در `check:release`</bdi> |
| اسکرین‌شات‌های مستندات | <bdi dir="ltr">`docs/assets/screenshots/`</bdi> |
| بسته‌بندی انتشار و شواهد اعتمادِ بدون امضا | <bdi dir="ltr">`scripts/release/`, `.github/workflows/release.yml`</bdi> |

## موتور Headless

وقتی **Settings → Headless engine** فعال باشد، نمایه‌سازی، جست‌وجو، backlinkها، graph، وضعیت Git، تشخیص‌های سلامت، ذخیره/تغییرنام یادداشت و jobهای خروجی‌گیری از daemon محلی عبور می‌کنند. بازکردن vault، scan و Canvas برای پاسخ‌گویی سریع داخل همان فرایند باقی می‌مانند. برای جزئیات به [`architecture/IPC_DAEMON.md`](./architecture/IPC_DAEMON.md) مراجعه کنید.

## اعتبارسنجی انتشار

</div>

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

<div dir="rtl" lang="fa">

CI همین بررسی‌ها را در [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) تکرار می‌کند.

## اسناد مرتبط

| سند | کاربرد |
|---|---|
| [`guides/GETTING_STARTED.md`](./guides/GETTING_STARTED.md) | راهنمای اجرای نخست |
| [`release/PANDOC_STRATEGY.md`](./release/PANDOC_STRATEGY.md) | پیش‌نیازهای خروجی‌گیری |
| [`release/SIGNING.md`](./release/SIGNING.md) | سیاست اعتماد و امضای نصب‌کننده‌ها |
| [`../PRODUCT.md`](../PRODUCT.md) | اصول محصول |
| [`../CHANGELOG.md`](../CHANGELOG.md) | تاریخچه انتشارها |

</div>
