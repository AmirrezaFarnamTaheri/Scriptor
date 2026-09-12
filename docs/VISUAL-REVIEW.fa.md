<div dir="ltr" align="center">

[English](VISUAL-REVIEW.md) · **فارسی** · [简体中文](VISUAL-REVIEW.zh-CN.md) · [Русский](VISUAL-REVIEW.ru.md) · [Deutsch](VISUAL-REVIEW.de.md) · [Español](VISUAL-REVIEW.es.md)

</div>

<div dir="rtl" lang="fa" align="right">

# یادداشت‌های بازبینی بصری

گالری بصری baselineهای بازبینی‌شده Windows مرجع همه screenshotهایی است که این سند درباره آن‌ها صحبت می‌کند. بخش screenshot در README، فایل `docs/assets/screenshots/README.md` و PNGهای ثبت‌شده در `docs/assets/screenshots/` مرجع اصلی هستند؛ این صفحه **روایت و انضباط بازبینی** را ثبت می‌کند، نه نسخه‌ای تکراری از تصاویر.

## مجموعه آزمون بصری چه چیزهایی را تضمین می‌کند

- بارگذاری lazy پنل‌ها، overflow نوار بالا، چیدمان‌های فشرده، focus پنجره‌های modal و پاک‌بودن console/network در مجموعه آزمون منبع Playwright بررسی می‌شوند و باید روی release candidate فریز‌شده دوباره اجرا شوند.
- حالت تاریک و breakpointهای 1024 / 768 / 375 px بخشی از ماتریس‌اند؛ جفت تصویر workspace در README و captureهای responsive، baselineهای بازبینی‌شده را مستند می‌کنند.
- جریان‌های reader، tasks و kanban توسط مجموعه regression عملکردی Playwright اجرا می‌شوند و هنگام فعال بودن سطح‌های آزمایشی آن‌ها، به‌عنوان شواهد runtime ثبت می‌شوند.
- برای fallbackهای recovery، popoverهای صفحه‌کلید، مدیریت plugin و آمادگی indexing تصویرهای مشخصی وجود دارد که از گالری لینک شده‌اند.

## انضباط بازبینی

- هر تغییر baseline نیازمند بررسی بصری diff و ثبت یک یادداشت بازبینی صریح در بسته تغییرات است.
- snapshotهای قدیمی فقط پس از بررسی diff توسط reviewer جایگزین می‌شوند؛ failureهای بصری هرگز با افزایش tolerance سراسری پنهان نمی‌شوند.
- مجموعه آزمون منبع Playwright و PNGهای ثبت‌شده باید با هم سازگار باشند. PNGهای ثبت‌شده artifact مستنداتی‌اند و به‌تنهایی مدرک release نیستند. commit دقیق، مرورگر، viewport و نتیجه `pnpm test:visual` همچنان مرجع قطعی‌اند.

## ارجاع‌های مرتبط

- بخش screenshot در README — گردش کاربرمحور در workspace و سطح‌های نوشتن، دانش، بصری‌سازی، خودکارسازی و operation/publish.
- `docs/assets/screenshots/README.md` — همه PNGهای ثبت‌شده، اندازه آن‌ها و سندهایی که به آن‌ها ارجاع می‌دهند.
- `docs/RELEASE-CHECKLIST.md` — موارد gate بصری در زمان release.
- `docs/VERIFICATION.md` — زنجیره شواهد verification بصری.

</div>
