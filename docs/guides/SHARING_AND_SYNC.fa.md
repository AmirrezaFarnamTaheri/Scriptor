<div dir="ltr" align="center">

[English](SHARING_AND_SYNC.md) · **فارسی** · [简体中文](SHARING_AND_SYNC.zh-CN.md) · [Русский](SHARING_AND_SYNC.ru.md) · [Deutsch](SHARING_AND_SYNC.de.md) · [Español](SHARING_AND_SYNC.es.md)

</div>

<div dir="rtl" lang="fa" align="right">

# اشتراک‌گذاری و همگام‌سازی

Scriptor resourceهای local agent را inventory می‌کند و skillهای اعتبارسنجی‌شده را از برنامه دسکتاپ میان applicationها، IDEها و CLIهای پشتیبانی‌شده sync می‌کند.

## مدل اعتماد

discovery و mutation دو عملیات جدا هستند. وجود یک دایرکتوری configuration به‌تنهایی هرگز نصب‌بودن یک application را تأیید نمی‌کند. تأیید حداقل به یک signal هویت محدود نیاز دارد:

- executableای که به path مشخص resolve شود، version probe محدود را با موفقیت پاسخ دهد و SHA-256 hash ثبت‌شده داشته باشد؛
- binary شناخته‌شده یک application نصب‌شده با hash ثبت‌شده؛ یا
- extension نصب‌شده editor که publisher و extension identifier دقیق آن با package metadata تطبیق داشته باشد.

هر resource کشف‌شده physical target، scope، canonical path، manifest path، ownership marker، validation issueها و content fingerprint نرمال‌شده خود را حفظ می‌کند. resourceهای نامعتبر قابل مشاهده می‌مانند اما نمی‌توان آن‌ها را به‌عنوان source همگام‌سازی انتخاب کرد.

## سطح‌های پشتیبانی

- **Native:** AgentStack، Claude Code، Codex و دایرکتوری vendor-neutral مربوط به Agent Skills.
- **Compatible:** targetهایی با دایرکتوری skill مستند؛ در حال حاضر Visual Studio Code و Copilot، Windsurf، Zed، Gemini CLI و OpenCode.
- **Inventory only:** محصول‌های شناسایی‌شده‌ای که قرارداد write مستند و به‌اندازه کافی پایدار ندارند. Scriptor شواهدشان را نشان می‌دهد اما فایل‌هایشان را تغییر نمی‌دهد.

سطح پشتیبانی و وضعیت نصب مستقل‌اند. یک target پشتیبانی‌شده فقط پس از تأیید هویت application قابل write است، به‌جز کتابخانه صریحاً vendor-neutral به مسیر `~/.agents/skills`.

## plan و اجرا

همگام‌سازی و deduplication همیشه با یک plan immutable آغاز می‌شوند. plan:

- به fingerprint کامل inventory متصل است؛
- fingerprint مورد انتظار source و destination را شامل می‌شود؛
- پس از طول عمر محدود تعریف‌شده در `PLAN_TTL_MS` منقضی می‌شود؛
- یک بار مصرف می‌شود؛
- چند محصول انتخاب‌شده که یک physical destination مشترک دارند را در یک operation ادغام می‌کند؛
- destinationهای overlapشده را پیش از mutation رد می‌کند؛ و
- به authorization بومی یک‌بارمصرف با scope محدود به identifier plan نیاز دارد.

destinationهای مستقل می‌توانند با تعداد worker محدود موازی اجرا شوند. در هر لحظه فقط یک plan resourceها را تغییر می‌دهد. frontend progress و receipt ساخت‌یافته دریافت می‌کند، نه stdout یا stderr خام process.

## حذف تکرار

Scriptor سه حالت را تفکیک می‌کند:

- **Exact mirror:** محتوای یکسان که عمداً برای target یا scope متفاوت نصب شده است.
- **Redundant:** محتوای یکسان که در همان target و scope تکرار شده است.
- **Diverged:** یک identity منطقی با محتوای متفاوت.

فقط copyهای exact و redundant می‌توانند plan خودکار deduplication بسازند. copy به recovery quarantine در Scriptor منتقل و با hash راستی‌آزمایی می‌شود؛ به‌صورت دائمی حذف نمی‌شود. mirrorها حفظ می‌شوند و resourceهای diverged نیازمند تصمیم merge دستی‌اند.

## بازیابی

updateها replacement را پیش از promotion stage و hash می‌کنند. محتوای فعلی ابتدا به recovery quarantine منتقل می‌شود. اگر promotion یا verification پس از write شکست بخورد، Scriptor تلاش می‌کند محتوای قبلی را restore کند و failure receipt ساخت‌یافته گزارش می‌دهد.

</div>
