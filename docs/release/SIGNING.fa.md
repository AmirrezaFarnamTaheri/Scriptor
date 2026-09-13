<div dir="ltr" align="center">
[English](SIGNING.md) · **فارسی** · [简体中文](SIGNING.zh-CN.md) · [Русский](SIGNING.ru.md) · [Deutsch](SIGNING.de.md) · [Español](SIGNING.es.md)
</div>

<div dir="rtl" lang="fa" align="right">

<div dir="rtl" lang="fa">

# وضعیت اعتماد انتشار و امضای توزیع‌کنندگان پایین‌دست

[<bdi dir="ltr">English</bdi>](SIGNING.md) · [简体中文](SIGNING.zh-CN.md) · [Русский](SIGNING.ru.md) · [<bdi dir="ltr">Deutsch</bdi>](SIGNING.de.md) · [<bdi dir="ltr">Espa</bdi>ñ<bdi dir="ltr">ol</bdi>](SIGNING.es.md) · **فارسی**

<bdi dir="ltr">Scriptor</bdi> تمامیت انتشار بالادست را از امضای ناشری که سیستم‌عامل بررسی می‌کند جدا می‌کند.

## سیاست بالادست

نسخه‌های رسمی <bdi dir="ltr">GitHub</bdi> عمداً **بدون امضای ناشر** منتشر می‌شوند:

- گواهی <bdi dir="ltr">Windows</bdi> لازم نیست؛
- <bdi dir="ltr">Apple</bdi> <bdi dir="ltr">Developer ID</bdi> یا اعتبارنامه <bdi dir="ltr">notarization</bdi> لازم نیست؛
- کلید خصوصی <bdi dir="ltr">OpenPGP</bdi> لینوکس لازم نیست؛
- <bdi dir="ltr">workflow</bdi> انتشار هیچ <bdi dir="ltr">secret</bdi> مربوط به امضا را نمی‌خواند؛
- <bdi dir="ltr">preview</bdi> و <bdi dir="ltr">production</bdi> از یک سیاست صریح و یکسان برای انتشار بدون امضا استفاده می‌کنند؛
- انتشار <bdi dir="ltr">production</bdi> همچنان به شواهد کامل <bdi dir="ltr">checksum</bdi>، <bdi dir="ltr">SBOM</bdi>، <bdi dir="ltr">release receipt</bdi>، هویت منبع، <bdi dir="ltr">exact-subject</bdi> و <bdi dir="ltr">GitHub attestation</bdi> نیاز دارد.

این سیاست تناقض قبلی را از بین می‌برد؛ زمانی ساخت <bdi dir="ltr">release</bdi> ظاهراً پشتیبانی می‌شد اما با نبود <bdi dir="ltr">signing secret</bdi> در مخزن، هر <bdi dir="ltr">job</bdi> تولیدی پیش از کامپایل متوقف می‌شد.

## شواهد وضعیت هدف

هر <bdi dir="ltr">build</bdi> با <bdi dir="ltr">schema</bdi> 2 فایلی به نام <bdi dir="ltr">`signing-evidence-<platform>-<architecture>.json`</bdi> می‌نویسد. این رکورد شامل موارد زیر است:

- <bdi dir="ltr">platform</bdi> و <bdi dir="ltr">architecture</bdi>؛
- کانال <bdi dir="ltr">preview</bdi> یا <bdi dir="ltr">production</bdi>؛
- مقادیر <bdi dir="ltr">`signed`، `notarized` و `signatureType`</bdi>؛
- دستورالعمل <bdi dir="ltr">verifier</bdi>؛
- <bdi dir="ltr">source</bdi> <bdi dir="ltr">commit</bdi> دقیق؛
- <bdi dir="ltr">timestamp</bdi> ایجاد.

<bdi dir="ltr">workflow</bdi> رسمی مقادیر <bdi dir="ltr">`signed: false`، `notarized: false` و `signatureType: "none"`</bdi> را ثبت می‌کند. <bdi dir="ltr">verifier</bdi> انتشار ماتریس کامل هدف را الزامی می‌داند:

- <bdi dir="ltr">Windows</bdi> <bdi dir="ltr">`x86_64`</bdi>؛
- <bdi dir="ltr">macOS</bdi> <bdi dir="ltr">`aarch64`</bdi>؛
- <bdi dir="ltr">Linux</bdi> <bdi dir="ltr">`x86_64`</bdi>؛
- <bdi dir="ltr">Linux</bdi> <bdi dir="ltr">`aarch64`</bdi>.

<bdi dir="ltr">verifier</bdi> رکورد تکراری، هدف گم‌شده یا غیرمنتظره، کانال اشتباه و عدم تطابق <bdi dir="ltr">source commit</bdi> را رد می‌کند. هنگام انتشار، چهار رکورد به <bdi dir="ltr">`release-evidence`</bdi> منتقل می‌شوند؛ <bdi dir="ltr">release receipt</bdi> با <bdi dir="ltr">schema</bdi> 4 همان رکوردهای نرمال‌شده را در خود قرار می‌دهد و تطابق <bdi dir="ltr">byte-for-byte</bdi> آن‌ها با <bdi dir="ltr">metadata</bdi> را بررسی می‌کند. رکوردهای اعتماد خودشان <bdi dir="ltr">subject</bdi> مربوط به <bdi dir="ltr">checksum</bdi> یا <bdi dir="ltr">attestation</bdi> نصب‌کننده نیستند.

## رفتار سیستم‌عامل

چون نصب‌کننده‌های بالادست بدون امضا هستند:

- <bdi dir="ltr">Windows</bdi> <bdi dir="ltr">SmartScreen</bdi> ممکن است ناشر را ناشناخته گزارش کند؛
- <bdi dir="ltr">macOS</bdi> <bdi dir="ltr">Gatekeeper</bdi> ممکن است از کاربر بخواهد بازکردن برنامه را از <bdi dir="ltr">System Settings</bdi> یا منوی زمینه <bdi dir="ltr">Finder</bdi> تأیید کند؛
- بسته‌های <bdi dir="ltr">Linux</bdi> به <bdi dir="ltr">checksum</bdi> دانلودشده و <bdi dir="ltr">GitHub attestation</bdi> متکی‌اند، نه امضای <bdi dir="ltr">OpenPGP</bdi> بالادست برای بسته.

<bdi dir="ltr">release</bdi> <bdi dir="ltr">notes</bdi> باید این محدودیت‌ها را به‌وضوح بیان کنند. برنامه هرگز نباید وجود <bdi dir="ltr">Authenticode</bdi>، <bdi dir="ltr">Apple notarization</bdi> یا امضای <bdi dir="ltr">OpenPGP</bdi> را در حالی ادعا کند که واقعاً وجود ندارد.

## امضای توزیع‌کننده پایین‌دست

یک توزیع‌کننده پایین‌دست می‌تواند نسخه‌ای از نصب‌کننده را با گواهی خودش یا فرایند <bdi dir="ltr">repository</bdi> بسته‌های خود امضا کند. در این حالت <bdi dir="ltr">bytes</bdi> فایل تغییر می‌کنند و در نتیجه <bdi dir="ltr">checksum</bdi> و <bdi dir="ltr">attestation subject</bdi> با <bdi dir="ltr">GitHub Release</bdi> بالادست متفاوت خواهد بود.

توزیع‌کننده پایین‌دست باید:

1. ابتدا <bdi dir="ltr">checksum</bdi> بالادست و <bdi dir="ltr">GitHub attestation</bdi> را راستی‌آزمایی کند؛
2. <bdi dir="ltr">receipt</bdi> بالادست و <bdi dir="ltr">source commit</bdi> را نگه دارد؛
3. فقط در محیط توزیع کنترل‌شده خودش امضا کند؛
4. <bdi dir="ltr">checksum</bdi>های جدید و دستورالعمل راستی‌آزمایی امضا را با هویت خودش منتشر کند؛
5. هرگز <bdi dir="ltr">asset</bdi>های بالادست را در <bdi dir="ltr">release</bdi> رسمی <bdi dir="ltr">Scriptor</bdi> جایگزین نکند.

<bdi dir="ltr">schema</bdi> شواهد می‌تواند یک <bdi dir="ltr">artifact</bdi> درست امضاشده را برای ابزارهای مستقل نمایش دهد، اما <bdi dir="ltr">CI</bdi> رسمی بالادست هیچ ماده خصوصی امضا را <bdi dir="ltr">import</bdi> یا مصرف نمی‌کند.

## اعتبارسنجی محلی

سیاست بدون <bdi dir="ltr">secret</bdi> و ماتریس هدف را بررسی کنید:

</div>

<div dir="ltr">

<div dir="ltr">
```bash
node scripts/release/validate-signing-policy.mjs \
  --platform linux \
  --architecture x86_64 \
  --channel production
node --test scripts/release/signing-policy.test.mjs
```
</div>

</div>

<div dir="rtl" lang="fa">

یک رکورد وضعیت محلی و بدون امضا بنویسید:

</div>

<div dir="ltr">

<div dir="ltr">
```bash
node scripts/release/write-signing-evidence.mjs \
  --platform linux \
  --architecture x86_64 \
  --channel production \
  --signed false \
  --notarized false \
  --signature-type none \
  --verifier "unsigned artifact; verify SHA-256 and GitHub attestation"
```
</div>

</div>

<div dir="rtl" lang="fa">

با اینکه امضای ناشر پیش‌نیاز نیست، <bdi dir="ltr">release verifier</bdi> همچنان برای تمامیت و کامل‌بودن شواهد <bdi dir="ltr">fail-closed</bdi> باقی می‌ماند.

</div>


</div>
