<div dir="ltr" align="center">
[English](ENCRYPTION-THREAT-MODEL.md) · **فارسی** · [简体中文](ENCRYPTION-THREAT-MODEL.zh-CN.md) · [Русский](ENCRYPTION-THREAT-MODEL.ru.md) · [Deutsch](ENCRYPTION-THREAT-MODEL.de.md) · [Español](ENCRYPTION-THREAT-MODEL.es.md)
</div>

<div dir="rtl" lang="fa" align="right">

# مدل تهدید مخزن رمزگذاری‌شده

**تصمیم:** رمزگذاری همچنان آزمایشی است. وجود <bdi dir="ltr">primitive</bdi>های رمزنگاری به‌معنای داشتن یک محصول مخزن رمزگذاری‌شده سرتاسری نیست.

## دارایی‌ها

محتوای <bdi dir="ltr">Markdown</bdi>، پیوست‌ها، پیکربندی، ایندکس‌ها، عبارت‌های جست‌وجو، فراداده گراف/پیوند، تاریخچه <bdi dir="ltr">Git</bdi>، نسخه‌های پشتیبان، خروجی‌های موقت، لاگ‌ها، آرگومان‌های فرایند، کلیدها و داده‌های بازیابی.

## تهدیدهای داخل دامنه

- دستگاه خاموشِ گم‌شده یا دزدیده‌شده؛
- کپی آفلاین از یک <bdi dir="ltr">vault</bdi> یا <bdi dir="ltr">backup</bdi>؛
- باقی‌ماندن ناخواسته متن ساده هنگام <bdi dir="ltr">migration/export/restore</bdi>؛
- عبارت عبور ضعیف و <bdi dir="ltr">downgrade</bdi> پارامترها؛
- از دست رفتن کلید و <bdi dir="ltr">rekey/migration</bdi> ناتمام؛
- نشت فراداده از مسیرها، ایندکس‌ها، <bdi dir="ltr">Git</bdi>، لاگ‌ها، <bdi dir="ltr">thumbnail</bdi>ها، <bdi dir="ltr">swap</bdi> یا <bdi dir="ltr">crash dump</bdi>ها.

## تهدیدهایی که رمزگذاری فایل‌به‌فایل حل نمی‌کند

سیستم‌عامل یا نشست کاربری در حال اجرا که <bdi dir="ltr">compromise</bdi> شده باشد، <bdi dir="ltr">renderer</bdi> مخربی که از قبل اختیار دریافت کرده، <bdi dir="ltr">keylogger</bdi>، ابزار خارجی مخرب، متن ساده‌ای که در حافظه نمایش داده می‌شود، یا مهاجمی که به <bdi dir="ltr">keychain</bdi> یا داده‌های نشستِ بازشده دسترسی دارد.

## معماری لازم پیش از ارتقا

1. <bdi dir="ltr">envelope</bdi> نسخه‌بندی‌شده شامل شناسه‌ها و پارامترهای الگوریتم/<bdi dir="ltr">KDF</bdi>؛
2. طراحی بازیابی با <bdi dir="ltr">OS keychain</bdi> و عبارت عبور، همراه با <bdi dir="ltr">semantics</bdi> صریح برای از دست رفتن دسترسی؛
3. راهبرد ایندکس/گراف/<bdi dir="ltr">cache</bdi> که یا رمزگذاری شده باشد یا آگاهانه از دامنه خارج شده باشد؛
4. <bdi dir="ltr">journal</bdi> اتمیک برای <bdi dir="ltr">migration/rekey</bdi> همراه با <bdi dir="ltr">rollback</bdi>؛
5. <bdi dir="ltr">backup</bdi> خارجی رمزگذاری‌شده و تمرین <bdi dir="ltr">restore</bdi>؛
6. سیاست <bdi dir="ltr">Git</bdi> برای جلوگیری از ثبت تاریخچه <bdi dir="ltr">plaintext</bdi>؛
7. مدیریت امن فایل‌های موقت/<bdi dir="ltr">export</bdi>؛
8. بازبینی مستقل رمزنگاری، <bdi dir="ltr">known-answer test</bdi>، <bdi dir="ltr">fuzzing</bdi>، <bdi dir="ltr">fault injection</bdi> و آزمون <bdi dir="ltr">migration</bdi> پارامترها؛
9. <bdi dir="ltr">UI</bdi> که وضعیت <bdi dir="ltr">locked/unlocked</bdi> و میزان نشت فراداده را دقیق بیان کند.

## پیاده‌سازی فعلی

`crates/vault/src/encryption.rs` از <bdi dir="ltr">authenticated encryption</bdi> و مشتق‌سازی عبارت عبور مبتنی بر <bdi dir="ltr">Argon2id</bdi> با بررسی نسخه و آزمون‌های منفی استفاده می‌کند. این یک ماژول کتابخانه‌ای نمونه است و به‌عنوان حالت شفاف و پشتیبانی‌شده <bdi dir="ltr">vault</bdi> متصل نشده است. مستندات محصول و امنیت باید این تمایز را حفظ کنند.


</div>
