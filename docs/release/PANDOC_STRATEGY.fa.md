<div dir="ltr" align="center">
[English](PANDOC_STRATEGY.md) · **فارسی** · [简体中文](PANDOC_STRATEGY.zh-CN.md) · [Русский](PANDOC_STRATEGY.ru.md) · [Deutsch](PANDOC_STRATEGY.de.md) · [Español](PANDOC_STRATEGY.es.md)
</div>

<div dir="rtl" lang="fa" align="right">

<div dir="rtl" lang="fa">

# راهبرد <bdi dir="ltr">Pandoc</bdi>

[<bdi dir="ltr">English</bdi>](PANDOC_STRATEGY.md) · [简体中文](PANDOC_STRATEGY.zh-CN.md) · [Русский](PANDOC_STRATEGY.ru.md) · [<bdi dir="ltr">Deutsch</bdi>](PANDOC_STRATEGY.de.md) · [<bdi dir="ltr">Espa</bdi>ñ<bdi dir="ltr">ol</bdi>](PANDOC_STRATEGY.es.md) · **فارسی**

<bdi dir="ltr">Scriptor</bdi> خروجی‌گیری را از طریق <bdi dir="ltr">Pandoc</bdi> و با مجموعه‌ای صریح از آرگومان‌های <bdi dir="ltr">allow-listed</bdi> انجام می‌دهد. برنامه دسکتاپ و <bdi dir="ltr">CLI</bdi> منطق <bdi dir="ltr">discovery</bdi> مشترک <bdi dir="ltr">`scriptor-export-runner`</bdi> را استفاده می‌کنند.

## ترتیب پیدا کردن <bdi dir="ltr">Pandoc</bdi>

1. <bdi dir="ltr">**`SCRIPTOR_PANDOC_PATH`**</bdi> — مسیر <bdi dir="ltr">absolute</bdi> به <bdi dir="ltr">executable</bdi> پنداک؛ زمانی استفاده می‌شود که <bdi dir="ltr">IT</bdi>، <bdi dir="ltr">Pandoc</bdi> را خارج از <bdi dir="ltr">`PATH`</bdi> نصب کرده باشد یا چند نسخه روی سیستم وجود داشته باشد.
2. <bdi dir="ltr">**`pandoc` در `PATH`**</bdi> — حالت پیش‌فرض. در <bdi dir="ltr">Windows</bdi> مسیر با <bdi dir="ltr">`where pandoc`</bdi> و در <bdi dir="ltr">Unix</bdi> با <bdi dir="ltr">`which pandoc`</bdi> پیدا می‌شود.

برای بررسی <bdi dir="ltr">discovery:</bdi>

</div>

<div dir="ltr">

<div dir="ltr">
```powershell
pnpm cli -- export-discover
```
</div>

</div>

<div dir="rtl" lang="fa">

## گزینه‌های نصب

| روش | وضعیت | توضیح |
|---|---|---|
| <bdi dir="ltr">Pandoc</bdi> سیستمی در <bdi dir="ltr">`PATH`</bdi> | **پیش‌فرض** | مطابق <bdi dir="ltr">setup</bdi> معمول کاربران حرفه‌ای و با کمترین اندازه نصب‌کننده. |
| <bdi dir="ltr">override</bdi> با <bdi dir="ltr">`SCRIPTOR_PANDOC_PATH`</bdi> | **پشتیبانی می‌شود** | مناسب <bdi dir="ltr">deployment</bdi> سازمانی. |
| <bdi dir="ltr">Pandoc</bdi> همراه نصب‌کننده | **اختیاری** | <bdi dir="ltr">`SCRIPTOR_BUNDLED_PANDOC_DIR` + `scripts/release/install-bundled-pandoc.ps1`</bdi> |

<bdi dir="ltr">export</bdi> <bdi dir="ltr">dry-run</bdi> بدون نصب <bdi dir="ltr">Pandoc</bdi> هم کار می‌کند و فقط آرگومان‌ها را پیش‌نمایش می‌دهد. خروجی واقعی به یک <bdi dir="ltr">binary</bdi> سالم <bdi dir="ltr">Pandoc</bdi> و <bdi dir="ltr">engine</bdi>های مربوط به فرمت، مثل <bdi dir="ltr">LaTeX</bdi> برای <bdi dir="ltr">PDF</bdi>، نیاز دارد.

## راه‌اندازی پیشنهادی

**<bdi dir="ltr">Windows</bdi> (<bdi dir="ltr">winget</bdi>):**

</div>

<div dir="ltr">

<div dir="ltr">
```powershell
winget install --id JohnMacFarlane.Pandoc
```
</div>

</div>

<div dir="rtl" lang="fa">

**<bdi dir="ltr">macOS</bdi> (<bdi dir="ltr">Homebrew</bdi>):**

</div>

<div dir="ltr">

<div dir="ltr">
```bash
brew install pandoc
```
</div>

</div>

<div dir="rtl" lang="fa">

**<bdi dir="ltr">Linux:</bdi>** بسته توزیع یا <bdi dir="ltr">archive</bdi> رسمی <bdi dir="ltr">release</bdi> پنداک.

## حالت‌های خرابی

| نشانه | راه‌حل |
|---|---|
| <bdi dir="ltr">`pandoc was not found on PATH`</bdi> | <bdi dir="ltr">Pandoc</bdi> را نصب کنید یا <bdi dir="ltr">`SCRIPTOR_PANDOC_PATH`</bdi> را تنظیم کنید. |
| <bdi dir="ltr">dry-run</bdi> موفق است اما خروجی واقعی شکست می‌خورد | <bdi dir="ltr">filter</bdi> یا <bdi dir="ltr">engine</bdi> لازم برای فرمت انتخابی در <bdi dir="ltr">Pandoc</bdi> موجود نیست. |
| نسخه اشتباه <bdi dir="ltr">Pandoc</bdi> انتخاب می‌شود | <bdi dir="ltr">`SCRIPTOR_PANDOC_PATH`</bdi> را به <bdi dir="ltr">binary</bdi> موردنظر تنظیم کنید. |

## مرز مجوزهای <bdi dir="ltr">GPL</bdi> / <bdi dir="ltr">AGPL</bdi> برای <bdi dir="ltr">Pandoc</bdi>

<bdi dir="ltr">Pandoc</bdi> تحت **<bdi dir="ltr">GPL-2.0-or-later</bdi>** و <bdi dir="ltr">Scriptor</bdi> تحت **<bdi dir="ltr">AGPL-3.0-or-later</bdi>** منتشر می‌شود. این دو مجوز برای توزیع سازگارند، اما نحوه فراخوانی <bdi dir="ltr">Pandoc</bdi> مرز مهمی است.

### <bdi dir="ltr">Scriptor</bdi> چگونه از <bdi dir="ltr">Pandoc</bdi> استفاده می‌کند

<bdi dir="ltr">Scriptor</bdi> در <bdi dir="ltr">`crates/export-runner`</bdi> با <bdi dir="ltr">`std::process::Command`</bdi>، <bdi dir="ltr">Pandoc</bdi> را به‌عنوان **فرایند خارجی** اجرا می‌کند. هیچ کد منبعی از <bdi dir="ltr">Pandoc</bdi> به‌صورت <bdi dir="ltr">static</bdi> یا <bdi dir="ltr">dynamic</bdi> داخل <bdi dir="ltr">binary</bdi> اسکریپتور <bdi dir="ltr">link</bdi> نمی‌شود و کد <bdi dir="ltr">GPL</bdi> پنداک وارد <bdi dir="ltr">address space</bdi> برنامه نمی‌شود.

</div>

<div dir="ltr">

<div dir="ltr">
```
┌──────────────┐   subprocess   ┌──────────────┐
│ Scriptor      │ ─────────────→ │ pandoc        │
│ (AGPL-3.0)   │ ←───────────── │ (GPL-2.0+)   │
└──────────────┘   stdout/file  └──────────────┘
```
</div>

</div>

<div dir="rtl" lang="fa">

### نتیجه عملی

| سناریو | تعهد مجوز |
|---|---|
| <bdi dir="ltr">Scriptor</bdi> بدون <bdi dir="ltr">Pandoc</bdi> توزیع شود | تعهد <bdi dir="ltr">GPL</bdi> برای <bdi dir="ltr">Pandoc</bdi> ایجاد نمی‌شود؛ کاربر آن را جدا نصب می‌کند. |
| <bdi dir="ltr">Scriptor</bdi>، <bdi dir="ltr">Pandoc</bdi> را داخل نصب‌کننده قرار دهد | <bdi dir="ltr">Pandoc</bdi> همچنان اثر جداگانه است؛ نصب‌کننده باید برای <bdi dir="ltr">binary</bdi> پنداک الزامات <bdi dir="ltr">GPL-2.0+</bdi>، از جمله پیشنهاد <bdi dir="ltr">source</bdi> و اعلان مجوز، را رعایت کند. <bdi dir="ltr">AGPL-3.0+</bdi> فقط بر کد <bdi dir="ltr">Scriptor</bdi> اعمال می‌شود. |
| <bdi dir="ltr">Scriptor</bdi> هنگام اجرا <bdi dir="ltr">Pandoc</bdi> را فراخوانی کند | تعهد <bdi dir="ltr">combined-work</bdi> ایجاد نمی‌شود؛ فراخوانی سطح <bdi dir="ltr">process</bdi> همان <bdi dir="ltr">linking</bdi> نیست. |
| <bdi dir="ltr">Scriptor filter</bdi>های <bdi dir="ltr">Pandoc</bdi> را توزیع کند | <bdi dir="ltr">filter</bdi>هایی که <bdi dir="ltr">module</bdi>های <bdi dir="ltr">Pandoc</bdi> را <bdi dir="ltr">import</bdi> می‌کنند آثار مشتق <bdi dir="ltr">GPL-2.0+</bdi> هستند. <bdi dir="ltr">filter</bdi>های نوشته‌شده توسط <bdi dir="ltr">Scriptor</bdi> که فقط از <bdi dir="ltr">stdin/stdout</bdi> ارتباط دارند آثار جداگانه‌اند. |

### <bdi dir="ltr">allowlist</bdi> مربوط به <bdi dir="ltr">`extra_pandoc_args`</bdi>

مقادیر <bdi dir="ltr">`extra_pandoc_args`</bdi> که کاربر می‌دهد از <bdi dir="ltr">allowlist</bdi> موجود در <bdi dir="ltr">`crates/export-runner/src/allowlist.rs`</bdi> عبور می‌کنند. این کار تزریق دلخواه آرگومان را متوقف می‌کند و فقط <bdi dir="ltr">flag</bdi>های مستند و امن را به <bdi dir="ltr">subprocess</bdi> پنداک می‌رساند. این <bdi dir="ltr">allowlist</bdi> یک مرز امنیتی است، نه سازوکار مجوزدهی نرم‌افزار.

### <bdi dir="ltr">Pandoc</bdi> همراه برنامه (اختیاری)

اگر در آینده <bdi dir="ltr">Pandoc</bdi> داخل نصب‌کننده قرار گیرد (<bdi dir="ltr">`SCRIPTOR_BUNDLED_PANDOC_DIR`</bdi>)، فرایند <bdi dir="ltr">release</bdi> باید:

1. فایل مجوز خود <bdi dir="ltr">Pandoc</bdi> را کنار <bdi dir="ltr">binary</bdi> آن قرار دهد؛
2. مطابق <bdi dir="ltr">GPL-2.0</bdi> §6 پیشنهاد کتبی برای <bdi dir="ltr">source code</bdi> پنداک ارائه کند؛
3. نسخه و مجوز <bdi dir="ltr">Pandoc</bdi> را در <bdi dir="ltr">release notes</bdi> مستند کند.

این تعهدات فقط برای <bdi dir="ltr">binary Pandoc</bdi> است، نه خود <bdi dir="ltr">Scriptor.</bdi>

## امنیت

- آرگومان‌های <bdi dir="ltr">export</bdi> از <bdi dir="ltr">type</bdi>های ساخت‌یافته <bdi dir="ltr">Rust</bdi> ساخته می‌شوند، نه با <bdi dir="ltr">concatenation</bdi> رشته <bdi dir="ltr">shell</bdi>؛
- <bdi dir="ltr">`extra_pandoc_args`</bdi> از <bdi dir="ltr">allowlist</bdi> در <bdi dir="ltr">`export-runner`</bdi> عبور می‌کند؛
- اگر <bdi dir="ltr">Pandoc</bdi> همراه برنامه شود، خروجی <bdi dir="ltr">`export-discover`</bdi> باید <bdi dir="ltr">metadata</bdi> نسخه <bdi dir="ltr">pinned</bdi> را برای تشخیص پشتیبانی نمایش دهد.

</div>


</div>
