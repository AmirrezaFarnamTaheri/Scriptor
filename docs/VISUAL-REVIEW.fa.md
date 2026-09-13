<div dir="ltr" align="center">

[English](VISUAL-REVIEW.md) · **فارسی** · [简体中文](VISUAL-REVIEW.zh-CN.md) · [Русский](VISUAL-REVIEW.ru.md) · [Deutsch](VISUAL-REVIEW.de.md) · [Español](VISUAL-REVIEW.es.md)

</div>

<div dir="rtl" lang="fa" align="right">

# یادداشت‌های بازبینی بصری

گالری بصری <bdi dir="ltr">baseline</bdi>های بازبینی‌شده <bdi dir="ltr">Windows</bdi> مرجع همه <bdi dir="ltr">screenshot</bdi>هایی است که این سند درباره آن‌ها صحبت می‌کند. بخش <bdi dir="ltr">screenshot</bdi> در <bdi dir="ltr">README</bdi>، فایل `docs/assets/screenshots/README.md` و <bdi dir="ltr">PNG</bdi>های ثبت‌شده در `docs/assets/screenshots/` مرجع اصلی هستند؛ این صفحه **روایت و انضباط بازبینی** را ثبت می‌کند، نه نسخه‌ای تکراری از تصاویر.

## مجموعه آزمون بصری چه چیزهایی را تضمین می‌کند

- بارگذاری <bdi dir="ltr">lazy</bdi> پنل‌ها، <bdi dir="ltr">overflow</bdi> نوار بالا، چیدمان‌های فشرده، <bdi dir="ltr">focus</bdi> پنجره‌های <bdi dir="ltr">modal</bdi> و پاک‌بودن <bdi dir="ltr">console/network</bdi> در مجموعه آزمون منبع <bdi dir="ltr">Playwright</bdi> بررسی می‌شوند و باید روی <bdi dir="ltr">release candidate</bdi> فریز‌شده دوباره اجرا شوند.
- حالت تاریک و <bdi dir="ltr">breakpoint</bdi>های 1024 / 768 / 375 <bdi dir="ltr">px</bdi> بخشی از ماتریس‌اند؛ جفت تصویر <bdi dir="ltr">workspace</bdi> در <bdi dir="ltr">README</bdi> و <bdi dir="ltr">capture</bdi>های <bdi dir="ltr">responsive</bdi>، <bdi dir="ltr">baseline</bdi>های بازبینی‌شده را مستند می‌کنند.
- جریان‌های <bdi dir="ltr">reader</bdi>، <bdi dir="ltr">tasks</bdi> و <bdi dir="ltr">kanban</bdi> توسط مجموعه <bdi dir="ltr">regression</bdi> عملکردی <bdi dir="ltr">Playwright</bdi> اجرا می‌شوند و هنگام فعال بودن سطح‌های آزمایشی آن‌ها، به‌عنوان شواهد <bdi dir="ltr">runtime</bdi> ثبت می‌شوند.
- برای <bdi dir="ltr">fallback</bdi>های <bdi dir="ltr">recovery</bdi>، <bdi dir="ltr">popover</bdi>های صفحه‌کلید، مدیریت <bdi dir="ltr">plugin</bdi> و آمادگی <bdi dir="ltr">indexing</bdi> تصویرهای مشخصی وجود دارد که از گالری لینک شده‌اند.

## انضباط بازبینی

- هر تغییر <bdi dir="ltr">baseline</bdi> نیازمند بررسی بصری <bdi dir="ltr">diff</bdi> و ثبت یک یادداشت بازبینی صریح در بسته تغییرات است.
- <bdi dir="ltr">snapshot</bdi>های قدیمی فقط پس از بررسی <bdi dir="ltr">diff</bdi> توسط <bdi dir="ltr">reviewer</bdi> جایگزین می‌شوند؛ <bdi dir="ltr">failure</bdi>های بصری هرگز با افزایش <bdi dir="ltr">tolerance</bdi> سراسری پنهان نمی‌شوند.
- مجموعه آزمون منبع <bdi dir="ltr">Playwright</bdi> و <bdi dir="ltr">PNG</bdi>های ثبت‌شده باید با هم سازگار باشند. <bdi dir="ltr">PNG</bdi>های ثبت‌شده <bdi dir="ltr">artifact</bdi> مستنداتی‌اند و به‌تنهایی مدرک <bdi dir="ltr">release</bdi> نیستند. <bdi dir="ltr">commit</bdi> دقیق، مرورگر، <bdi dir="ltr">viewport</bdi> و نتیجه `pnpm test:visual` همچنان مرجع قطعی‌اند.

## ارجاع‌های مرتبط

- بخش <bdi dir="ltr">screenshot</bdi> در <bdi dir="ltr">README</bdi> — گردش کاربرمحور در <bdi dir="ltr">workspace</bdi> و سطح‌های نوشتن، دانش، بصری‌سازی، خودکارسازی و <bdi dir="ltr">operation/publish.</bdi>
- `docs/assets/screenshots/README.md` — همه <bdi dir="ltr">PNG</bdi>های ثبت‌شده، اندازه آن‌ها و سندهایی که به آن‌ها ارجاع می‌دهند.
- `docs/RELEASE-CHECKLIST.md` — موارد <bdi dir="ltr">gate</bdi> بصری در زمان <bdi dir="ltr">release.</bdi>
- `docs/VERIFICATION.md` — زنجیره شواهد <bdi dir="ltr">verification</bdi> بصری.

</div>
