<div dir="ltr" align="center">

[English](README.md) · **فارسی** · [简体中文](README.zh-CN.md) · [Русский](README.ru.md) · [Deutsch](README.de.md) · [Español](README.es.md)

</div>

<div dir="rtl" lang="fa" align="right">

# سیاست شواهد

شواهد release از یک Git checkout تمیز و canonical تولید می‌شوند و هم به commit checkoutشده و هم به یک هویت deterministic مبتنی بر SHA-256 برای source tree متصل‌اند. فایل‌های `release-receipt.json`، `scriptor.cyclonedx.json` و `SHA256SUMS` در publish job پس از دانلود همه artifactهای platform ساخته می‌شوند و پیش از attestation یا upload راستی‌آزمایی می‌شوند.

pathهای local شامل `artifacts/`، `ci-logs/`، `job_log.txt` و `ci.log` موقتی و ignored هستند. خروجی تاریخی CI ناموفق می‌تواند برای diagnosis بیرون source tree نگه داشته شود، اما هرگز به‌عنوان evidence برای commit یا release candidate دیگری پذیرفته نمی‌شود.

verifier، receipt را یک allowlist دقیق می‌داند. artifact گمشده، artifact اضافی که در receipt ثبت نشده، symbolic link، path traversal یا absolute، checksum تکراری، source-tree drift یا SBOM metadata drift همگی promotion را مسدود می‌کنند. تولید و verification شواهد به Git checkout تمیز و canonical نیاز دارد؛ archive mode فقط برای گزارش‌های diagnostic مربوط به source identity وجود دارد و promotion verifier آن را نمی‌پذیرد.

</div>
