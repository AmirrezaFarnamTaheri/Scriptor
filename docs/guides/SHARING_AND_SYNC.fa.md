<div dir="ltr" align="center">

[English](SHARING_AND_SYNC.md) · **فارسی** · [简体中文](SHARING_AND_SYNC.zh-CN.md) · [Русский](SHARING_AND_SYNC.ru.md) · [Deutsch](SHARING_AND_SYNC.de.md) · [Español](SHARING_AND_SYNC.es.md)

</div>

<div dir="rtl" lang="fa" align="right">

# اشتراک‌گذاری و همگام‌سازی

<bdi dir="ltr">Scriptor</bdi> <bdi dir="ltr">resource</bdi>های <bdi dir="ltr">local agent</bdi> را <bdi dir="ltr">inventory</bdi> می‌کند و <bdi dir="ltr">skill</bdi>های اعتبارسنجی‌شده را از برنامه دسکتاپ میان <bdi dir="ltr">application</bdi>ها، <bdi dir="ltr">IDE</bdi>ها و <bdi dir="ltr">CLI</bdi>های پشتیبانی‌شده <bdi dir="ltr">sync</bdi> می‌کند.

## مدل اعتماد

<bdi dir="ltr">discovery</bdi> و <bdi dir="ltr">mutation</bdi> دو عملیات جدا هستند. وجود یک دایرکتوری <bdi dir="ltr">configuration</bdi> به‌تنهایی هرگز نصب‌بودن یک <bdi dir="ltr">application</bdi> را تأیید نمی‌کند. تأیید حداقل به یک <bdi dir="ltr">signal</bdi> هویت محدود نیاز دارد:

- <bdi dir="ltr">executable</bdi>ای که به <bdi dir="ltr">path</bdi> مشخص <bdi dir="ltr">resolve</bdi> شود، <bdi dir="ltr">version probe</bdi> محدود را با موفقیت پاسخ دهد و <bdi dir="ltr">SHA-256 hash</bdi> ثبت‌شده داشته باشد؛
- <bdi dir="ltr">binary</bdi> شناخته‌شده یک <bdi dir="ltr">application</bdi> نصب‌شده با <bdi dir="ltr">hash</bdi> ثبت‌شده؛ یا
- <bdi dir="ltr">extension</bdi> نصب‌شده <bdi dir="ltr">editor</bdi> که <bdi dir="ltr">publisher</bdi> و <bdi dir="ltr">extension identifier</bdi> دقیق آن با <bdi dir="ltr">package metadata</bdi> تطبیق داشته باشد.

هر <bdi dir="ltr">resource</bdi> کشف‌شده <bdi dir="ltr">physical target</bdi>، <bdi dir="ltr">scope</bdi>، <bdi dir="ltr">canonical path</bdi>، <bdi dir="ltr">manifest path</bdi>، <bdi dir="ltr">ownership marker</bdi>، <bdi dir="ltr">validation issue</bdi>ها و <bdi dir="ltr">content fingerprint</bdi> نرمال‌شده خود را حفظ می‌کند. <bdi dir="ltr">resource</bdi>های نامعتبر قابل مشاهده می‌مانند اما نمی‌توان آن‌ها را به‌عنوان <bdi dir="ltr">source</bdi> همگام‌سازی انتخاب کرد.

## سطح‌های پشتیبانی

- **<bdi dir="ltr">Native:</bdi>** <bdi dir="ltr">AgentStack</bdi>، <bdi dir="ltr">Claude Code</bdi>، <bdi dir="ltr">Codex</bdi> و دایرکتوری <bdi dir="ltr">vendor-neutral</bdi> مربوط به <bdi dir="ltr">Agent Skills.</bdi>
- **<bdi dir="ltr">Compatible:</bdi>** <bdi dir="ltr">target</bdi>هایی با دایرکتوری <bdi dir="ltr">skill</bdi> مستند؛ در حال حاضر <bdi dir="ltr">Visual Studio Code</bdi> و <bdi dir="ltr">Copilot</bdi>، <bdi dir="ltr">Windsurf</bdi>، <bdi dir="ltr">Zed</bdi>، <bdi dir="ltr">Gemini CLI</bdi> و <bdi dir="ltr">OpenCode.</bdi>
- **<bdi dir="ltr">Inventory only:</bdi>** محصول‌های شناسایی‌شده‌ای که قرارداد <bdi dir="ltr">write</bdi> مستند و به‌اندازه کافی پایدار ندارند. <bdi dir="ltr">Scriptor</bdi> شواهدشان را نشان می‌دهد اما فایل‌هایشان را تغییر نمی‌دهد.

سطح پشتیبانی و وضعیت نصب مستقل‌اند. یک <bdi dir="ltr">target</bdi> پشتیبانی‌شده فقط پس از تأیید هویت <bdi dir="ltr">application</bdi> قابل <bdi dir="ltr">write</bdi> است، به‌جز کتابخانه صریحاً <bdi dir="ltr">vendor-neutral</bdi> به مسیر `~/.agents/skills`.

## <bdi dir="ltr">plan</bdi> و اجرا

همگام‌سازی و <bdi dir="ltr">deduplication</bdi> همیشه با یک <bdi dir="ltr">plan immutable</bdi> آغاز می‌شوند. <bdi dir="ltr">plan:</bdi>

- به <bdi dir="ltr">fingerprint</bdi> کامل <bdi dir="ltr">inventory</bdi> متصل است؛
- <bdi dir="ltr">fingerprint</bdi> مورد انتظار <bdi dir="ltr">source</bdi> و <bdi dir="ltr">destination</bdi> را شامل می‌شود؛
- پس از طول عمر محدود تعریف‌شده در `PLAN_TTL_MS` منقضی می‌شود؛
- یک بار مصرف می‌شود؛
- چند محصول انتخاب‌شده که یک <bdi dir="ltr">physical destination</bdi> مشترک دارند را در یک <bdi dir="ltr">operation</bdi> ادغام می‌کند؛
- <bdi dir="ltr">destination</bdi>های <bdi dir="ltr">overlap</bdi>شده را پیش از <bdi dir="ltr">mutation</bdi> رد می‌کند؛ و
- به <bdi dir="ltr">authorization</bdi> بومی یک‌بارمصرف با <bdi dir="ltr">scope</bdi> محدود به <bdi dir="ltr">identifier plan</bdi> نیاز دارد.

<bdi dir="ltr">destination</bdi>های مستقل می‌توانند با تعداد <bdi dir="ltr">worker</bdi> محدود موازی اجرا شوند. در هر لحظه فقط یک <bdi dir="ltr">plan resource</bdi>ها را تغییر می‌دهد. <bdi dir="ltr">frontend progress</bdi> و <bdi dir="ltr">receipt</bdi> ساخت‌یافته دریافت می‌کند، نه <bdi dir="ltr">stdout</bdi> یا <bdi dir="ltr">stderr</bdi> خام <bdi dir="ltr">process.</bdi>

## حذف تکرار

<bdi dir="ltr">Scriptor</bdi> سه حالت را تفکیک می‌کند:

- **<bdi dir="ltr">Exact mirror:</bdi>** محتوای یکسان که عمداً برای <bdi dir="ltr">target</bdi> یا <bdi dir="ltr">scope</bdi> متفاوت نصب شده است.
- **<bdi dir="ltr">Redundant:</bdi>** محتوای یکسان که در همان <bdi dir="ltr">target</bdi> و <bdi dir="ltr">scope</bdi> تکرار شده است.
- **<bdi dir="ltr">Diverged:</bdi>** یک <bdi dir="ltr">identity</bdi> منطقی با محتوای متفاوت.

فقط <bdi dir="ltr">copy</bdi>های <bdi dir="ltr">exact</bdi> و <bdi dir="ltr">redundant</bdi> می‌توانند <bdi dir="ltr">plan</bdi> خودکار <bdi dir="ltr">deduplication</bdi> بسازند. <bdi dir="ltr">copy</bdi> به <bdi dir="ltr">recovery quarantine</bdi> در <bdi dir="ltr">Scriptor</bdi> منتقل و با <bdi dir="ltr">hash</bdi> راستی‌آزمایی می‌شود؛ به‌صورت دائمی حذف نمی‌شود. <bdi dir="ltr">mirror</bdi>ها حفظ می‌شوند و <bdi dir="ltr">resource</bdi>های <bdi dir="ltr">diverged</bdi> نیازمند تصمیم <bdi dir="ltr">merge</bdi> دستی‌اند.

## بازیابی

<bdi dir="ltr">update</bdi>ها <bdi dir="ltr">replacement</bdi> را پیش از <bdi dir="ltr">promotion stage</bdi> و <bdi dir="ltr">hash</bdi> می‌کنند. محتوای فعلی ابتدا به <bdi dir="ltr">recovery quarantine</bdi> منتقل می‌شود. اگر <bdi dir="ltr">promotion</bdi> یا <bdi dir="ltr">verification</bdi> پس از <bdi dir="ltr">write</bdi> شکست بخورد، <bdi dir="ltr">Scriptor</bdi> تلاش می‌کند محتوای قبلی را <bdi dir="ltr">restore</bdi> کند و <bdi dir="ltr">failure receipt</bdi> ساخت‌یافته گزارش می‌دهد.

</div>
