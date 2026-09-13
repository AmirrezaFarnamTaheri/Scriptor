<div dir="ltr" align="center">
[English](PANDOC_STRATEGY.md) · **فارسی** · [简体中文](PANDOC_STRATEGY.zh-CN.md) · [Русский](PANDOC_STRATEGY.ru.md) · [Deutsch](PANDOC_STRATEGY.de.md) · [Español](PANDOC_STRATEGY.es.md)
</div>

<div dir="rtl" lang="fa" align="right">

<div dir="rtl" lang="fa">

# راهبرد Pandoc

[English](PANDOC_STRATEGY.md) · [简体中文](PANDOC_STRATEGY.zh-CN.md) · [Русский](PANDOC_STRATEGY.ru.md) · [Deutsch](PANDOC_STRATEGY.de.md) · [Español](PANDOC_STRATEGY.es.md) · **فارسی**

Scriptor خروجی‌گیری را از طریق Pandoc و با مجموعه‌ای صریح از آرگومان‌های allow-listed انجام می‌دهد. برنامه دسکتاپ و CLI منطق discovery مشترک <bdi dir="ltr">`scriptor-export-runner`</bdi> را استفاده می‌کنند.

## ترتیب پیدا کردن Pandoc

1. <bdi dir="ltr">**`SCRIPTOR_PANDOC_PATH`**</bdi> — مسیر absolute به executable پنداک؛ زمانی استفاده می‌شود که IT، Pandoc را خارج از <bdi dir="ltr">`PATH`</bdi> نصب کرده باشد یا چند نسخه روی سیستم وجود داشته باشد.
2. <bdi dir="ltr">**`pandoc` در `PATH`**</bdi> — حالت پیش‌فرض. در Windows مسیر با <bdi dir="ltr">`where pandoc`</bdi> و در Unix با <bdi dir="ltr">`which pandoc`</bdi> پیدا می‌شود.

برای بررسی discovery:

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
| Pandoc سیستمی در <bdi dir="ltr">`PATH`</bdi> | **پیش‌فرض** | مطابق setup معمول کاربران حرفه‌ای و با کمترین اندازه نصب‌کننده. |
| override با <bdi dir="ltr">`SCRIPTOR_PANDOC_PATH`</bdi> | **پشتیبانی می‌شود** | مناسب deployment سازمانی. |
| Pandoc همراه نصب‌کننده | **اختیاری** | <bdi dir="ltr">`SCRIPTOR_BUNDLED_PANDOC_DIR` + `scripts/release/install-bundled-pandoc.ps1`</bdi> |

export dry-run بدون نصب Pandoc هم کار می‌کند و فقط آرگومان‌ها را پیش‌نمایش می‌دهد. خروجی واقعی به یک binary سالم Pandoc و engineهای مربوط به فرمت، مثل LaTeX برای PDF، نیاز دارد.

## راه‌اندازی پیشنهادی

**Windows (winget):**

</div>

<div dir="ltr">

<div dir="ltr">
```powershell
winget install --id JohnMacFarlane.Pandoc
```
</div>

</div>

<div dir="rtl" lang="fa">

**macOS (Homebrew):**

</div>

<div dir="ltr">

<div dir="ltr">
```bash
brew install pandoc
```
</div>

</div>

<div dir="rtl" lang="fa">

**Linux:** بسته توزیع یا archive رسمی release پنداک.

## حالت‌های خرابی

| نشانه | راه‌حل |
|---|---|
| <bdi dir="ltr">`pandoc was not found on PATH`</bdi> | Pandoc را نصب کنید یا <bdi dir="ltr">`SCRIPTOR_PANDOC_PATH`</bdi> را تنظیم کنید. |
| dry-run موفق است اما خروجی واقعی شکست می‌خورد | filter یا engine لازم برای فرمت انتخابی در Pandoc موجود نیست. |
| نسخه اشتباه Pandoc انتخاب می‌شود | <bdi dir="ltr">`SCRIPTOR_PANDOC_PATH`</bdi> را به binary موردنظر تنظیم کنید. |

## مرز مجوزهای GPL / AGPL برای Pandoc

Pandoc تحت **GPL-2.0-or-later** و Scriptor تحت **AGPL-3.0-or-later** منتشر می‌شود. این دو مجوز برای توزیع سازگارند، اما نحوه فراخوانی Pandoc مرز مهمی است.

### Scriptor چگونه از Pandoc استفاده می‌کند

Scriptor در <bdi dir="ltr">`crates/export-runner`</bdi> با <bdi dir="ltr">`std::process::Command`</bdi>، Pandoc را به‌عنوان **فرایند خارجی** اجرا می‌کند. هیچ کد منبعی از Pandoc به‌صورت static یا dynamic داخل binary اسکریپتور link نمی‌شود و کد GPL پنداک وارد address space برنامه نمی‌شود.

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
| Scriptor بدون Pandoc توزیع شود | تعهد GPL برای Pandoc ایجاد نمی‌شود؛ کاربر آن را جدا نصب می‌کند. |
| Scriptor، Pandoc را داخل نصب‌کننده قرار دهد | Pandoc همچنان اثر جداگانه است؛ نصب‌کننده باید برای binary پنداک الزامات GPL-2.0+، از جمله پیشنهاد source و اعلان مجوز، را رعایت کند. AGPL-3.0+ فقط بر کد Scriptor اعمال می‌شود. |
| Scriptor هنگام اجرا Pandoc را فراخوانی کند | تعهد combined-work ایجاد نمی‌شود؛ فراخوانی سطح process همان linking نیست. |
| Scriptor filterهای Pandoc را توزیع کند | filterهایی که moduleهای Pandoc را import می‌کنند آثار مشتق GPL-2.0+ هستند. filterهای نوشته‌شده توسط Scriptor که فقط از stdin/stdout ارتباط دارند آثار جداگانه‌اند. |

### allowlist مربوط به <bdi dir="ltr">`extra_pandoc_args`</bdi>

مقادیر <bdi dir="ltr">`extra_pandoc_args`</bdi> که کاربر می‌دهد از allowlist موجود در <bdi dir="ltr">`crates/export-runner/src/allowlist.rs`</bdi> عبور می‌کنند. این کار تزریق دلخواه آرگومان را متوقف می‌کند و فقط flagهای مستند و امن را به subprocess پنداک می‌رساند. این allowlist یک مرز امنیتی است، نه سازوکار مجوزدهی نرم‌افزار.

### Pandoc همراه برنامه (اختیاری)

اگر در آینده Pandoc داخل نصب‌کننده قرار گیرد (<bdi dir="ltr">`SCRIPTOR_BUNDLED_PANDOC_DIR`</bdi>)، فرایند release باید:

1. فایل مجوز خود Pandoc را کنار binary آن قرار دهد؛
2. مطابق GPL-2.0 §6 پیشنهاد کتبی برای source code پنداک ارائه کند؛
3. نسخه و مجوز Pandoc را در release notes مستند کند.

این تعهدات فقط برای binary Pandoc است، نه خود Scriptor.

## امنیت

- آرگومان‌های export از typeهای ساخت‌یافته Rust ساخته می‌شوند، نه با concatenation رشته shell؛
- <bdi dir="ltr">`extra_pandoc_args`</bdi> از allowlist در <bdi dir="ltr">`export-runner`</bdi> عبور می‌کند؛
- اگر Pandoc همراه برنامه شود، خروجی <bdi dir="ltr">`export-discover`</bdi> باید metadata نسخه pinned را برای تشخیص پشتیبانی نمایش دهد.

</div>


</div>
