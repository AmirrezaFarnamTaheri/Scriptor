<div dir="ltr" align="center">

[English](CAPABILITIES.md) · **فارسی** · [简体中文](CAPABILITIES.zh-CN.md) · [Русский](CAPABILITIES.ru.md) · [Deutsch](CAPABILITIES.de.md) · [Español](CAPABILITIES.es.md)

</div>

<div dir="rtl" lang="fa" align="right">

# قابلیت‌های Scriptor

برنامه، فایل‌های محلی Markdown را با ویرایش، پژوهش، انتشار و خودکارسازی دارای مجوز صریح ترکیب می‌کند. این نقشه، قابلیت‌های فعلی و مرز مسئولیت آن‌ها را معرفی می‌کند. [دفتر بلوغ قابلیت‌ها](CAPABILITY-MATURITY.md) میان قابلیت منتشرشده، آزمایشی و صرفاً طراحی‌شده تفاوت می‌گذارد؛ دیده شدن یک کنترل، پشتیبانی آماده تولید را ثابت نمی‌کند.

[گالری بازبینی بصری](VISUAL-REVIEW.fa.md) و [فهرست تصویرها](assets/screenshots/README.fa.md) وضعیت رابط را نشان می‌دهند. مجوزدهی بومی و وضعیت واقعی خزانه همچنان مرجع هستند.

## بخش‌های اصلی

| حوزه | مرجع |
|---|---|
| پوسته دسکتاپ (Tauri 2) | `apps/desktop/` |
| هسته خزانه و نمایه‌ساز | `crates/vault`, `crates/indexer` |
| ارتباط IPC موتور بدون رابط | [IPC](architecture/IPC_DAEMON.md) |
| رابط ترمینالی | [TUI](architecture/TUI_PARITY.md) |
| افزونه‌ها، حالت امن و فهرست داخلی | [Plugin system](architecture/PLUGIN_SYSTEM.md) |
| راهنمای ساخت افزونه و Hello World | [Author guide](plugins/AUTHOR_GUIDE.md) |
| ۲۲ ابزار MCP با پیش‌نویس قابل‌بازبینی | `packages/mcp/` |
| خروجی‌گیری با Pandoc | `crates/export-runner`, `@scriptor/export` |
| موتور Canvas با worker مربوط به resvg | `crates/canvas-engine`, `@scriptor/canvas` |
| درخت مجازی‌شده خزانه | `src/components/app/VirtualNoteList.tsx` |
| توکن‌های طراحی | `src/styles/tokens/components.css` |
| آزمون پسرفت بصری | `playwright.visual.config.ts` |
| دروازه axe-core در CI | `check:a11y-axe`, `check:release` |
| تصویرهای مستندات | `docs/assets/screenshots/` |
| بسته‌بندی انتشار و شواهد سیاست بدون امضا | `scripts/release/`, `.github/workflows/release.yml` |

ممیزی پایدار تغییرهای MCP در `crates/vault/src/mcp_audit.rs` و `crates/daemon/src/automation_stdio.rs` قرار دارد.

## گردش‌کارهای آزمایشی

| گردش‌کار | رفتار و راهنما |
|---|---|
| فایل‌های مستقل منبع | ویرایش LaTeX، کد و قالب‌های متنی مرتبط با ذخیره محافظت‌شده؛ اجرا و کامپایل باید صریحاً آغاز شوند. [وضعیت بلوغ](CAPABILITY-MATURITY.md) را ببینید. |
| اتصال‌های گوگل | اتصال مستقل حساب‌ها، نسخه‌های بررسی‌شده Drive/Docs، برنامه‌ریزی Calendar/Tasks و ایمیل اختیاری. [راهنمای گوگل](guides/GOOGLE_INTEGRATIONS.fa.md) را ببینید. |
| تبادل با Overleaf | تبادل بررسی‌شده فایل منبع از طریق Git با میزبان ثابت. [معماری](ARCHITECTURE.fa.md) را ببینید. |
| نشست اجرا و بررسی معنایی | اجرای کد با مجوز و بررسی بردارهای وابسته به سرویس. شواهد بومی، سرویس و بسته نصب، [دروازه‌های مستقل](VERIFICATION.fa.md) دارند. |
| ترکیب فضای کاری | بخش‌های اصلی و جانبی، پنل‌های جابه‌جاشدنی و میانبرهای قابل‌تنظیم؛ میانبر پنهان از پالت فرمان بازیابی می‌شود. [شروع کار](guides/GETTING_STARTED.fa.md) را ببینید. |

## موتور بدون رابط

با فعال شدن **Settings → Headless engine**، نمایه‌سازی، جست‌وجو، پیوندهای بازگشتی، گراف، وضعیت Git، تشخیص سلامت، ذخیره و تغییرنام یادداشت و خروجی‌گیری از daemon محلی عبور می‌کنند. باز کردن خزانه، اسکن و Canvas برای پاسخ سریع در همان فرایند باقی می‌مانند. [قرارداد IPC](architecture/IPC_DAEMON.md) مرز را توضیح می‌دهد.

## راستی‌آزمایی

روش‌ها در [راهنمای مشارکت](../CONTRIBUTING.fa.md)، نتیجه‌های فعلی و دروازه‌های باز در [گزارش راستی‌آزمایی](VERIFICATION.fa.md) هستند. همه بررسی‌های اجرایی این بازبینی روی workerهای GitHub انجام می‌شوند. داده آزمون مرورگر، رفتار و چیدمان کنترل‌شده را نشان می‌دهد؛ دسترسی واقعی به سرویس، کارکرد نسخه نصب‌شده یا آمادگی انتشار را ثابت نمی‌کند. شواهد گردش‌کار باید شناسه commit و فایل‌های تشخیصی را حفظ کنند.

</div>

<div dir="ltr">

```powershell
pnpm check:release
pnpm check:daemon
pnpm check:tui
pnpm check:a11y
pnpm check:a11y-axe
pnpm check:plugins
pnpm check:mcp
pnpm check:contracts
pnpm check:canvas
pnpm check:editor
pnpm check:renderer
pnpm check:export
pnpm check:knowledge
pnpm check:citations
pnpm check:headless
pnpm check:perf
pnpm test:rust
pnpm test:visual
pnpm test:e2e
```

</div>

<div dir="rtl" lang="fa" align="right">

[CI](../.github/workflows/ci.yml)

## سندهای مرتبط

[پیش‌نیاز Pandoc](release/PANDOC_STRATEGY.md) · [اعتماد نصب‌کننده](release/SIGNING.md) · [اصول محصول](../PRODUCT.md) · [تغییرات](../CHANGELOG.md)

</div>
