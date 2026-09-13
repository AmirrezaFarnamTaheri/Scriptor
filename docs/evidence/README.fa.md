<div dir="ltr" align="center">

[English](README.md) · **فارسی** · [简体中文](README.zh-CN.md) · [Русский](README.ru.md) · [Deutsch](README.de.md) · [Español](README.es.md)

</div>

<div dir="rtl" lang="fa" align="right">

# سیاست شواهد

شواهد <bdi dir="ltr">release</bdi> از یک <bdi dir="ltr">Git checkout</bdi> تمیز و <bdi dir="ltr">canonical</bdi> تولید می‌شوند و هم به <bdi dir="ltr">commit checkout</bdi>شده و هم به یک هویت <bdi dir="ltr">deterministic</bdi> مبتنی بر <bdi dir="ltr">SHA-256</bdi> برای <bdi dir="ltr">source tree</bdi> متصل‌اند. فایل‌های `release-receipt.json`، `scriptor.cyclonedx.json` و `SHA256SUMS` در <bdi dir="ltr">publish job</bdi> پس از دانلود همه <bdi dir="ltr">artifact</bdi>های <bdi dir="ltr">platform</bdi> ساخته می‌شوند و پیش از <bdi dir="ltr">attestation</bdi> یا <bdi dir="ltr">upload</bdi> راستی‌آزمایی می‌شوند.

<bdi dir="ltr">path</bdi>های <bdi dir="ltr">local</bdi> شامل `artifacts/`، `ci-logs/`، `job_log.txt` و `ci.log` موقتی و <bdi dir="ltr">ignored</bdi> هستند. خروجی تاریخی <bdi dir="ltr">CI</bdi> ناموفق می‌تواند برای <bdi dir="ltr">diagnosis</bdi> بیرون <bdi dir="ltr">source tree</bdi> نگه داشته شود، اما هرگز به‌عنوان <bdi dir="ltr">evidence</bdi> برای <bdi dir="ltr">commit</bdi> یا <bdi dir="ltr">release candidate</bdi> دیگری پذیرفته نمی‌شود.

<bdi dir="ltr">verifier</bdi>، <bdi dir="ltr">receipt</bdi> را یک <bdi dir="ltr">allowlist</bdi> دقیق می‌داند. <bdi dir="ltr">artifact</bdi> گمشده، <bdi dir="ltr">artifact</bdi> اضافی که در <bdi dir="ltr">receipt</bdi> ثبت نشده، <bdi dir="ltr">symbolic link</bdi>، <bdi dir="ltr">path traversal</bdi> یا <bdi dir="ltr">absolute</bdi>، <bdi dir="ltr">checksum</bdi> تکراری، <bdi dir="ltr">source-tree drift</bdi> یا <bdi dir="ltr">SBOM metadata drift</bdi> همگی <bdi dir="ltr">promotion</bdi> را مسدود می‌کنند. تولید و <bdi dir="ltr">verification</bdi> شواهد به <bdi dir="ltr">Git checkout</bdi> تمیز و <bdi dir="ltr">canonical</bdi> نیاز دارد؛ <bdi dir="ltr">archive mode</bdi> فقط برای گزارش‌های <bdi dir="ltr">diagnostic</bdi> مربوط به <bdi dir="ltr">source identity</bdi> وجود دارد و <bdi dir="ltr">promotion verifier</bdi> آن را نمی‌پذیرد.

</div>
