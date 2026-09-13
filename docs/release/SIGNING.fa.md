<div dir="ltr" align="center">
[English](SIGNING.md) · **فارسی** · [简体中文](SIGNING.zh-CN.md) · [Русский](SIGNING.ru.md) · [Deutsch](SIGNING.de.md) · [Español](SIGNING.es.md)
</div>

<div dir="rtl" lang="fa" align="right">

<div dir="rtl" lang="fa">

# وضعیت اعتماد انتشار و امضای توزیع‌کنندگان پایین‌دست

[English](SIGNING.md) · [简体中文](SIGNING.zh-CN.md) · [Русский](SIGNING.ru.md) · [Deutsch](SIGNING.de.md) · [Español](SIGNING.es.md) · **فارسی**

<bdi dir="ltr">Scriptor</bdi> تمامیت انتشار بالادست را از امضای ناشری که سیستم‌عامل بررسی می‌کند جدا می‌کند.

## سیاست بالادست

نسخه‌های رسمی GitHub عمداً **بدون امضای ناشر** منتشر می‌شوند:

- گواهی Windows لازم نیست؛
- <bdi dir="ltr">Apple</bdi> Developer ID یا اعتبارنامه notarization لازم نیست؛
- کلید خصوصی OpenPGP لینوکس لازم نیست؛
- <bdi dir="ltr">workflow</bdi> انتشار هیچ secret مربوط به امضا را نمی‌خواند؛
- <bdi dir="ltr">preview</bdi> و production از یک سیاست صریح و یکسان برای انتشار بدون امضا استفاده می‌کنند؛
- انتشار production همچنان به شواهد کامل checksum، SBOM، release receipt، هویت منبع، exact-subject و GitHub attestation نیاز دارد.

این سیاست تناقض قبلی را از بین می‌برد؛ زمانی ساخت release ظاهراً پشتیبانی می‌شد اما با نبود signing secret در مخزن، هر job تولیدی پیش از کامپایل متوقف می‌شد.

## شواهد وضعیت هدف

هر build با schema 2 فایلی به نام <bdi dir="ltr">`signing-evidence-<platform>-<architecture>.json`</bdi> می‌نویسد. این رکورد شامل موارد زیر است:

- <bdi dir="ltr">platform</bdi> و architecture؛
- کانال preview یا production؛
- مقادیر <bdi dir="ltr">`signed`، `notarized` و `signatureType`</bdi>؛
- دستورالعمل verifier؛
- <bdi dir="ltr">source</bdi> commit دقیق؛
- <bdi dir="ltr">timestamp</bdi> ایجاد.

workflow رسمی مقادیر <bdi dir="ltr">`signed: false`، `notarized: false` و `signatureType: "none"`</bdi> را ثبت می‌کند. verifier انتشار ماتریس کامل هدف را الزامی می‌داند:

- Windows <bdi dir="ltr">`x86_64`</bdi>؛
- macOS <bdi dir="ltr">`aarch64`</bdi>؛
- Linux <bdi dir="ltr">`x86_64`</bdi>؛
- Linux <bdi dir="ltr">`aarch64`</bdi>.

verifier رکورد تکراری، هدف گم‌شده یا غیرمنتظره، کانال اشتباه و عدم تطابق source commit را رد می‌کند. هنگام انتشار، چهار رکورد به <bdi dir="ltr">`release-evidence`</bdi> منتقل می‌شوند؛ release receipt با schema 4 همان رکوردهای نرمال‌شده را در خود قرار می‌دهد و تطابق byte-for-byte آن‌ها با metadata را بررسی می‌کند. رکوردهای اعتماد خودشان subject مربوط به checksum یا attestation نصب‌کننده نیستند.

## رفتار سیستم‌عامل

چون نصب‌کننده‌های بالادست بدون امضا هستند:

- <bdi dir="ltr">Windows</bdi> SmartScreen ممکن است ناشر را ناشناخته گزارش کند؛
- <bdi dir="ltr">macOS</bdi> Gatekeeper ممکن است از کاربر بخواهد بازکردن برنامه را از System Settings یا منوی زمینه Finder تأیید کند؛
- بسته‌های Linux به checksum دانلودشده و GitHub attestation متکی‌اند، نه امضای OpenPGP بالادست برای بسته.

<bdi dir="ltr">release</bdi> notes باید این محدودیت‌ها را به‌وضوح بیان کنند. برنامه هرگز نباید وجود Authenticode، Apple notarization یا امضای OpenPGP را در حالی ادعا کند که واقعاً وجود ندارد.

## امضای توزیع‌کننده پایین‌دست

یک توزیع‌کننده پایین‌دست می‌تواند نسخه‌ای از نصب‌کننده را با گواهی خودش یا فرایند repository بسته‌های خود امضا کند. در این حالت bytes فایل تغییر می‌کنند و در نتیجه checksum و attestation subject با GitHub Release بالادست متفاوت خواهد بود.

توزیع‌کننده پایین‌دست باید:

1. ابتدا checksum بالادست و GitHub attestation را راستی‌آزمایی کند؛
2. <bdi dir="ltr">receipt</bdi> بالادست و source commit را نگه دارد؛
3. فقط در محیط توزیع کنترل‌شده خودش امضا کند؛
4. <bdi dir="ltr">checksum</bdi>های جدید و دستورالعمل راستی‌آزمایی امضا را با هویت خودش منتشر کند؛
5. هرگز assetهای بالادست را در release رسمی Scriptor جایگزین نکند.

<bdi dir="ltr">schema</bdi> شواهد می‌تواند یک artifact درست امضاشده را برای ابزارهای مستقل نمایش دهد، اما CI رسمی بالادست هیچ ماده خصوصی امضا را import یا مصرف نمی‌کند.

## اعتبارسنجی محلی

سیاست بدون secret و ماتریس هدف را بررسی کنید:

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

با اینکه امضای ناشر پیش‌نیاز نیست، release verifier همچنان برای تمامیت و کامل‌بودن شواهد fail-closed باقی می‌ماند.

</div>


</div>
