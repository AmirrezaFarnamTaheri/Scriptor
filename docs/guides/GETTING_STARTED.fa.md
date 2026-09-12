<div dir="ltr" align="center">

[English](GETTING_STARTED.md) · **فارسی** · [简体中文](GETTING_STARTED.zh-CN.md) · [Русский](GETTING_STARTED.ru.md) · [Deutsch](GETTING_STARTED.de.md) · [Español](GETTING_STARTED.es.md)

</div>

<div dir="rtl" lang="fa" align="right">

# شروع کار با Scriptor

Scriptor یک فضای کاری دانش Markdown با رویکرد local-first است. این راهنما نصب، باز کردن نخستین vault و گردش‌کارهای اصلی روزمره را پوشش می‌دهد.

برای **ساخت از کد منبع**، بخش **Build from source** را در [`README.fa.md`](../../README.fa.md) ببینید.

## نصب

آخرین نسخه مناسب پلتفرم خود را از [GitHub Releases](https://github.com/AmirrezaFarnamTaheri/Scriptor/releases) دریافت کنید:

| پلتفرم | قالب‌ها |
|---|---|
| Windows | نصب‌کننده MSI یا NSIS |
| macOS | DMG |
| Linux | DEB یا AppImage |

نصب‌کننده‌های production عمداً بدون امضای دیجیتال منتشر می‌شوند. فرایند کامل راستی‌آزمایی در [`docs/RELEASE-SECURITY.fa.md`](../RELEASE-SECURITY.fa.md) توضیح داده شده است.

## باز کردن vault

1. **Scriptor** را اجرا کنید.
2. **Open Vault** را انتخاب و هر پوشه‌ای را که شامل یادداشت‌های Markdown است باز کنید.
3. Scriptor در پس‌زمینه vault را index می‌کند؛ هیچ پایگاه‌داده اختصاصی لازم نیست.

فایل‌های شما روی دیسک همان Markdown معمولی باقی می‌مانند و Scriptor مستقیماً آن‌ها را می‌خواند و می‌نویسد.

### پیکربندی vault

تنظیمات vault در `.scriptor/config.json` قرار دارد. snippetها، profileهای export و manifestهای plugin نیز زیر `.scriptor/` نگهداری می‌شوند.

## فضای کاری

| ناحیه | کاربرد |
|---|---|
| **نوار کناری vault** | مرور، جست‌وجو و فیلتر یادداشت‌ها؛ ساخت یادداشت روزانه و template |
| **ویرایشگر** | نوشتن در حالت Source، Split یا Preview با Monaco یا CodeMirror |
| **ریل Inspector** | outline، link، backlink، citation، سلامت یادداشت و profileهای export |
| **Status dock** | log خروجی، نتیجه‌های جست‌وجو، diagnostic و jobهای پس‌زمینه |

از modeهای workspace در نوار بالا — **Writing**، **Knowledge**، **Publish**، **Review** و **Automation** — برای متمرکز کردن toolbar و command palette بر کار فعلی استفاده کنید.

## گردش‌کارهای اصلی

| کار | Desktop | Terminal (`scriptor tui`) |
|---|---|---|
| مرور یادداشت‌ها | نوار کناری vault | `j` / `k` |
| جست‌وجو | جست‌وجوی نوار کناری یا `Ctrl+K` | `/` و سپس عبارت جست‌وجو |
| Command palette | `Ctrl+K` یا جست‌وجوی نوار بالا | — |
| Preview | حالت **Split** یا **Preview** ویرایشگر | `p` |
| Backlinkها | ریل Inspector | `b` |
| Graph | دکمه **Graph** در toolbar؛ پیمایش با کلیدهای جهت، Enter و Escape | `g` |
| سلامت vault | **Note Health** در Inspector یا Settings | `h` |
| Export | profileهای export در Inspector یا **Publish** | `scriptor export` |
| وضعیت Git | نشانگر Git در نوار بالا | — |
| حل تعارض | رابط تعارض سه‌طرفه با ستون base | — |
| میانبرهای صفحه‌کلید | Settings → Keyboard Shortcuts | — |
| پشتیبان‌گیری زمان‌بندی‌شده | Settings → Vault Snapshots | — |

## تنظیم export

Scriptor از [Pandoc](https://pandoc.org/) برای export استفاده می‌کند. برای export واقعی به HTML، PDF، DOCX، LaTeX، ePub و Reveal.js، Pandoc را روی سیستم نصب کنید:

</div>

<div dir="ltr" align="left">

```powershell
# Windows
winget install --id JohnMacFarlane.Pandoc

# macOS
brew install pandoc
```

</div>

<div dir="rtl" lang="fa" align="right">

پیش‌نمایش dry-run export بدون Pandoc کار می‌کند. برای discovery، override و عیب‌یابی به [`docs/release/PANDOC_STRATEGY.fa.md`](../release/PANDOC_STRATEGY.fa.md) مراجعه کنید.

## اختیاری: موتور headless

با فعال کردن **Settings → Headless engine**، index، جست‌وجو، backlink، graph، وضعیت Git و jobهای export از طریق daemon محلی انجام می‌شوند. باز کردن vault و canvas برای پاسخ‌گویی سریع در همان process باقی می‌مانند. به [`docs/architecture/IPC_DAEMON.fa.md`](../architecture/IPC_DAEMON.fa.md) مراجعه کنید.

## مطالعه بیشتر

- [`docs/CAPABILITIES.fa.md`](../CAPABILITIES.fa.md) — نقشه کامل قابلیت‌ها
- [`docs/contracts/COMMAND_CATALOG.fa.md`](../contracts/COMMAND_CATALOG.fa.md) — فرمان‌های Tauri، daemon و CLI
- [`docs/architecture/PLUGIN_SYSTEM.fa.md`](../architecture/PLUGIN_SYSTEM.fa.md) — pluginها و marketplace
- [`docs/plugins/AUTHOR_GUIDE.fa.md`](../plugins/AUTHOR_GUIDE.fa.md) — راهنمای نویسنده plugin و نمونه hello-world
- [`DESIGN.fa.md`](../../DESIGN.fa.md) — سطح ویرایشگر، design system و قرارداد دسترس‌پذیری
- [`docs/design/DESIGN_SYSTEM.fa.md`](../design/DESIGN_SYSTEM.fa.md) — tokenهای سیستم بصری
- [`docs/brand/BRAND.md`](../brand/BRAND.md) — لوگو و wordmark
- [`docs/assets/screenshots/README.fa.md`](../assets/screenshots/README.fa.md) — بازتولید screenshotهای رابط کاربری

</div>
