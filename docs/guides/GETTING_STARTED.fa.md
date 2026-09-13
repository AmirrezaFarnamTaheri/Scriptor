<div dir="ltr" align="center">

[English](GETTING_STARTED.md) · **فارسی** · [简体中文](GETTING_STARTED.zh-CN.md) · [Русский](GETTING_STARTED.ru.md) · [Deutsch](GETTING_STARTED.de.md) · [Español](GETTING_STARTED.es.md)

</div>

<div dir="rtl" lang="fa" align="right">

# شروع کار با <bdi dir="ltr">Scriptor</bdi>

<bdi dir="ltr">Scriptor</bdi> یک فضای کاری دانش <bdi dir="ltr">Markdown</bdi> با رویکرد <bdi dir="ltr">local-first</bdi> است. این راهنما نصب، باز کردن نخستین <bdi dir="ltr">vault</bdi> و گردش‌کارهای اصلی روزمره را پوشش می‌دهد.

برای **ساخت از کد منبع**، بخش **<bdi dir="ltr">Build from source</bdi>** را در [`README.fa.md`](../../README.fa.md) ببینید.

## نصب

آخرین نسخه مناسب پلتفرم خود را از [<bdi dir="ltr">GitHub Releases</bdi>](https://github.com/AmirrezaFarnamTaheri/Scriptor/releases) دریافت کنید:

| پلتفرم | قالب‌ها |
|---|---|
| <bdi dir="ltr">Windows</bdi> | نصب‌کننده <bdi dir="ltr">MSI</bdi> یا <bdi dir="ltr">NSIS</bdi> |
| <bdi dir="ltr">macOS</bdi> | <bdi dir="ltr">DMG</bdi> |
| <bdi dir="ltr">Linux</bdi> | <bdi dir="ltr">DEB</bdi> یا <bdi dir="ltr">AppImage</bdi> |

نصب‌کننده‌های <bdi dir="ltr">production</bdi> عمداً بدون امضای دیجیتال منتشر می‌شوند. فرایند کامل راستی‌آزمایی در [`docs/RELEASE-SECURITY.fa.md`](../RELEASE-SECURITY.fa.md) توضیح داده شده است.

## باز کردن <bdi dir="ltr">vault</bdi>

1. **<bdi dir="ltr">Scriptor</bdi>** را اجرا کنید.
2. **<bdi dir="ltr">Open Vault</bdi>** را انتخاب و هر پوشه‌ای را که شامل یادداشت‌های <bdi dir="ltr">Markdown</bdi> است باز کنید.
3. <bdi dir="ltr">Scriptor</bdi> در پس‌زمینه <bdi dir="ltr">vault</bdi> را <bdi dir="ltr">index</bdi> می‌کند؛ هیچ پایگاه‌داده اختصاصی لازم نیست.

فایل‌های شما روی دیسک همان <bdi dir="ltr">Markdown</bdi> معمولی باقی می‌مانند و <bdi dir="ltr">Scriptor</bdi> مستقیماً آن‌ها را می‌خواند و می‌نویسد.

### پیکربندی <bdi dir="ltr">vault</bdi>

تنظیمات <bdi dir="ltr">vault</bdi> در `.scriptor/config.json` قرار دارد. <bdi dir="ltr">snippet</bdi>ها، <bdi dir="ltr">profile</bdi>های <bdi dir="ltr">export</bdi> و <bdi dir="ltr">manifest</bdi>های <bdi dir="ltr">plugin</bdi> نیز زیر `.scriptor/` نگهداری می‌شوند.

## فضای کاری

| ناحیه | کاربرد |
|---|---|
| **نوار کناری <bdi dir="ltr">vault</bdi>** | مرور، جست‌وجو و فیلتر یادداشت‌ها؛ ساخت یادداشت روزانه و <bdi dir="ltr">template</bdi> |
| **ویرایشگر** | نوشتن در حالت <bdi dir="ltr">Source</bdi>، <bdi dir="ltr">Split</bdi> یا <bdi dir="ltr">Preview</bdi> با <bdi dir="ltr">Monaco</bdi> یا <bdi dir="ltr">CodeMirror</bdi> |
| **ریل <bdi dir="ltr">Inspector</bdi>** | <bdi dir="ltr">outline</bdi>، <bdi dir="ltr">link</bdi>، <bdi dir="ltr">backlink</bdi>، <bdi dir="ltr">citation</bdi>، سلامت یادداشت و <bdi dir="ltr">profile</bdi>های <bdi dir="ltr">export</bdi> |
| **<bdi dir="ltr">Status dock</bdi>** | <bdi dir="ltr">log</bdi> خروجی، نتیجه‌های جست‌وجو، <bdi dir="ltr">diagnostic</bdi> و <bdi dir="ltr">job</bdi>های پس‌زمینه |

از <bdi dir="ltr">mode</bdi>های <bdi dir="ltr">workspace</bdi> در نوار بالا — **<bdi dir="ltr">Writing</bdi>**، **<bdi dir="ltr">Knowledge</bdi>**، **<bdi dir="ltr">Publish</bdi>**، **<bdi dir="ltr">Review</bdi>** و **<bdi dir="ltr">Automation</bdi>** — برای متمرکز کردن <bdi dir="ltr">toolbar</bdi> و <bdi dir="ltr">command palette</bdi> بر کار فعلی استفاده کنید.

## گردش‌کارهای اصلی

| کار | <bdi dir="ltr">Desktop</bdi> | <bdi dir="ltr">Terminal</bdi> (`scriptor tui`) |
|---|---|---|
| مرور یادداشت‌ها | نوار کناری <bdi dir="ltr">vault</bdi> | `j` / `k` |
| جست‌وجو | جست‌وجوی نوار کناری یا `Ctrl+K` | `/` و سپس عبارت جست‌وجو |
| <bdi dir="ltr">Command palette</bdi> | `Ctrl+K` یا جست‌وجوی نوار بالا | — |
| <bdi dir="ltr">Preview</bdi> | حالت **<bdi dir="ltr">Split</bdi>** یا **<bdi dir="ltr">Preview</bdi>** ویرایشگر | `p` |
| <bdi dir="ltr">Backlink</bdi>ها | ریل <bdi dir="ltr">Inspector</bdi> | `b` |
| <bdi dir="ltr">Graph</bdi> | دکمه **<bdi dir="ltr">Graph</bdi>** در <bdi dir="ltr">toolbar</bdi>؛ پیمایش با کلیدهای جهت، <bdi dir="ltr">Enter</bdi> و <bdi dir="ltr">Escape</bdi> | `g` |
| سلامت <bdi dir="ltr">vault</bdi> | **<bdi dir="ltr">Note Health</bdi>** در <bdi dir="ltr">Inspector</bdi> یا <bdi dir="ltr">Settings</bdi> | `h` |
| <bdi dir="ltr">Export</bdi> | <bdi dir="ltr">profile</bdi>های <bdi dir="ltr">export</bdi> در <bdi dir="ltr">Inspector</bdi> یا **<bdi dir="ltr">Publish</bdi>** | `scriptor export` |
| وضعیت <bdi dir="ltr">Git</bdi> | نشانگر <bdi dir="ltr">Git</bdi> در نوار بالا | — |
| حل تعارض | رابط تعارض سه‌طرفه با ستون <bdi dir="ltr">base</bdi> | — |
| میانبرهای صفحه‌کلید | <bdi dir="ltr">Settings</bdi> → <bdi dir="ltr">Keyboard Shortcuts</bdi> | — |
| پشتیبان‌گیری زمان‌بندی‌شده | <bdi dir="ltr">Settings</bdi> → <bdi dir="ltr">Vault Snapshots</bdi> | — |

## تنظیم <bdi dir="ltr">export</bdi>

<bdi dir="ltr">Scriptor</bdi> از [<bdi dir="ltr">Pandoc</bdi>](https://pandoc.org/) برای <bdi dir="ltr">export</bdi> استفاده می‌کند. برای <bdi dir="ltr">export</bdi> واقعی به <bdi dir="ltr">HTML</bdi>، <bdi dir="ltr">PDF</bdi>، <bdi dir="ltr">DOCX</bdi>، <bdi dir="ltr">LaTeX</bdi>، <bdi dir="ltr">ePub</bdi> و <bdi dir="ltr">Reveal.js</bdi>، <bdi dir="ltr">Pandoc</bdi> را روی سیستم نصب کنید:

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

پیش‌نمایش <bdi dir="ltr">dry-run export</bdi> بدون <bdi dir="ltr">Pandoc</bdi> کار می‌کند. برای <bdi dir="ltr">discovery</bdi>، <bdi dir="ltr">override</bdi> و عیب‌یابی به [`docs/release/PANDOC_STRATEGY.fa.md`](../release/PANDOC_STRATEGY.fa.md) مراجعه کنید.

## اختیاری: موتور <bdi dir="ltr">headless</bdi>

با فعال کردن **<bdi dir="ltr">Settings</bdi> → <bdi dir="ltr">Headless engine</bdi>**، <bdi dir="ltr">index</bdi>، جست‌وجو، <bdi dir="ltr">backlink</bdi>، <bdi dir="ltr">graph</bdi>، وضعیت <bdi dir="ltr">Git</bdi> و <bdi dir="ltr">job</bdi>های <bdi dir="ltr">export</bdi> از طریق <bdi dir="ltr">daemon</bdi> محلی انجام می‌شوند. باز کردن <bdi dir="ltr">vault</bdi> و <bdi dir="ltr">canvas</bdi> برای پاسخ‌گویی سریع در همان <bdi dir="ltr">process</bdi> باقی می‌مانند. به [`docs/architecture/IPC_DAEMON.fa.md`](../architecture/IPC_DAEMON.fa.md) مراجعه کنید.

## مطالعه بیشتر

- [`docs/CAPABILITIES.fa.md`](../CAPABILITIES.fa.md) — نقشه کامل قابلیت‌ها
- [`docs/contracts/COMMAND_CATALOG.fa.md`](../contracts/COMMAND_CATALOG.fa.md) — فرمان‌های <bdi dir="ltr">Tauri</bdi>، <bdi dir="ltr">daemon</bdi> و <bdi dir="ltr">CLI</bdi>
- [`docs/architecture/PLUGIN_SYSTEM.fa.md`](../architecture/PLUGIN_SYSTEM.fa.md) — <bdi dir="ltr">plugin</bdi>ها و <bdi dir="ltr">marketplace</bdi>
- [`docs/plugins/AUTHOR_GUIDE.fa.md`](../plugins/AUTHOR_GUIDE.fa.md) — راهنمای نویسنده <bdi dir="ltr">plugin</bdi> و نمونه <bdi dir="ltr">hello-world</bdi>
- [`DESIGN.fa.md`](../../DESIGN.fa.md) — سطح ویرایشگر، <bdi dir="ltr">design system</bdi> و قرارداد دسترس‌پذیری
- [`docs/design/DESIGN_SYSTEM.fa.md`](../design/DESIGN_SYSTEM.fa.md) — <bdi dir="ltr">token</bdi>های سیستم بصری
- [`docs/brand/BRAND.md`](../brand/BRAND.md) — لوگو و <bdi dir="ltr">wordmark</bdi>
- [`docs/assets/screenshots/README.fa.md`](../assets/screenshots/README.fa.md) — بازتولید <bdi dir="ltr">screenshot</bdi>های رابط کاربری

</div>
