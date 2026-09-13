<div dir="ltr" align="center">

[English](RUSTSEC-EXCEPTIONS.md) · **فارسی** · [简体中文](RUSTSEC-EXCEPTIONS.zh-CN.md) · [Русский](RUSTSEC-EXCEPTIONS.ru.md) · [Deutsch](RUSTSEC-EXCEPTIONS.de.md) · [Español](RUSTSEC-EXCEPTIONS.es.md)

</div>

<div dir="rtl" lang="fa" align="right">

# دفتر استثناهای advisory در RustSec

این دفتر مرجع همه advisoryهایی است که `cargo-deny` به‌طور موقت ignore می‌کند. ignore به‌معنای رد ریسک نیست؛ بلکه constraint یک dependency بازبینی‌شده و reachable را با owner مشخص، تاریخ بازبینی دوباره و شرط خروج روشن ثبت می‌کند. vulnerabilityهایی که امکان upgrade دارند همچنان توسط CI رد می‌شوند.

**مالک:** maintainerهای release و security در Scriptor  
**تناوب بازبینی:** ماهانه و پیش از هر production tag  
**آخرین بازبینی کامل:** 2026-09-03  
**بازبینی کامل بعدی:** 2026-10-01

### شواهد بازبینی 2026-09-03

- <bdi dir="ltr">advisory</bdi>های ignored مربوط به GTK3/Tauri، `proc-macro-error`، `atomic-polyfill`، `paste` و `rust-unic` همچنان RustSec **INFO / unmaintained** هستند و نسخه patched ندارند. packageهای locked هنوز وجود دارند چون graph پشتیبانی‌شده Tauri/Linux یا dependency graph transitively محصول در این checkout جایگزین maintained و compatible ندارد.
- `RUSTSEC-2025-0057` (`fxhash`) هم از این دفتر و هم از `deny.toml` حذف شد: `fxhash` دیگر در `Cargo.lock` نیست؛ نگه‌داشتن exception فقط reintroduction آینده را مخفی می‌کرد، نه reachability فعلی را مستند.
- این بازبینی vulnerabilityهای تازه‌منتشرشده را suppress نمی‌کند. `cargo deny` برای advisoryهای بیرون این فهرست دقیق همچنان مرجع production است؛ محیط production-capable بعدی باید پیش از tagging آن را در برابر advisory database فعلی اجرا کند.

### follow-up ممیزی integration در 2026-09-05

یک RustSec database تازه هیچ advisory از نوع vulnerability گزارش نکرد، اما 18 package از نوع unmaintained و advisoryهای informational unsoundness برای `glib` و دو نسخه `lru` گزارش شد. dependency مربوط به TUI از `lru` 0.18.1 به نسخه patched یعنی 0.18.2 به‌روزرسانی شد. Tantivy 0.26.1 همچنان `lru` 0.16.4 را resolve می‌کند و در محدوده release سازگار جایگزینی ارائه نشد. stack لینوکس Tauri نیز همچنان `glib` 0.18.5 را resolve می‌کند که تحت‌تأثیر RUSTSEC-2024-0429 است. این دو finding مربوط به unsoundness **به ignore list اضافه نمی‌شوند**. آن‌ها کار dependency در upstream باقی می‌مانند و باید پیش از production release ارزیابی شوند. ممیزی lookup مربوط به yanked version را خاموش کرده بود، بنابراین ثابت نمی‌کند lockfile عاری از releaseهای yanked است.

| Advisory | خانواده dependency | reachability | owner | Upstream | بازبینی تا | شرط خروج |
|---|---|---|---|---|---|---|
| RUSTSEC-2024-0370 | stack دسکتاپ GTK/Tauri Linux | packaging و runtime دسکتاپ Linux | Release/Security | https://rustsec.org/advisories/RUSTSEC-2024-0370.html | 2026-10-01 | وقتی Tauri/WebKitGTK دیگر crate unmaintained تحت‌تأثیر را resolve نکند، حذف شود |
| RUSTSEC-2024-0411 | stack دسکتاپ GTK/Tauri Linux | packaging و runtime دسکتاپ Linux | Release/Security | https://rustsec.org/advisories/RUSTSEC-2024-0411.html | 2026-10-01 | وقتی stack پشتیبانی‌شده Tauri Linux جایگزین maintained داشته باشد، حذف شود |
| RUSTSEC-2024-0412 | stack دسکتاپ GTK/Tauri Linux | packaging و runtime دسکتاپ Linux | Release/Security | https://rustsec.org/advisories/RUSTSEC-2024-0412.html | 2026-10-01 | وقتی stack پشتیبانی‌شده Tauri Linux جایگزین maintained داشته باشد، حذف شود |
| RUSTSEC-2024-0413 | stack دسکتاپ GTK/Tauri Linux | packaging و runtime دسکتاپ Linux | Release/Security | https://rustsec.org/advisories/RUSTSEC-2024-0413.html | 2026-10-01 | وقتی stack پشتیبانی‌شده Tauri Linux جایگزین maintained داشته باشد، حذف شود |
| RUSTSEC-2024-0414 | stack دسکتاپ GTK/Tauri Linux | packaging و runtime دسکتاپ Linux | Release/Security | https://rustsec.org/advisories/RUSTSEC-2024-0414.html | 2026-10-01 | وقتی stack پشتیبانی‌شده Tauri Linux جایگزین maintained داشته باشد، حذف شود |
| RUSTSEC-2024-0415 | stack دسکتاپ GTK/Tauri Linux | packaging و runtime دسکتاپ Linux | Release/Security | https://rustsec.org/advisories/RUSTSEC-2024-0415.html | 2026-10-01 | وقتی stack پشتیبانی‌شده Tauri Linux جایگزین maintained داشته باشد، حذف شود |
| RUSTSEC-2024-0416 | stack دسکتاپ GTK/Tauri Linux | packaging و runtime دسکتاپ Linux | Release/Security | https://rustsec.org/advisories/RUSTSEC-2024-0416.html | 2026-10-01 | وقتی stack پشتیبانی‌شده Tauri Linux جایگزین maintained داشته باشد، حذف شود |
| RUSTSEC-2024-0417 | stack دسکتاپ GTK/Tauri Linux | packaging و runtime دسکتاپ Linux | Release/Security | https://rustsec.org/advisories/RUSTSEC-2024-0417.html | 2026-10-01 | وقتی stack پشتیبانی‌شده Tauri Linux جایگزین maintained داشته باشد، حذف شود |
| RUSTSEC-2024-0418 | stack دسکتاپ GTK/Tauri Linux | packaging و runtime دسکتاپ Linux | Release/Security | https://rustsec.org/advisories/RUSTSEC-2024-0418.html | 2026-10-01 | وقتی stack پشتیبانی‌شده Tauri Linux جایگزین maintained داشته باشد، حذف شود |
| RUSTSEC-2024-0419 | stack دسکتاپ GTK/Tauri Linux | packaging و runtime دسکتاپ Linux | Release/Security | https://rustsec.org/advisories/RUSTSEC-2024-0419.html | 2026-10-01 | وقتی stack پشتیبانی‌شده Tauri Linux جایگزین maintained داشته باشد، حذف شود |
| RUSTSEC-2024-0420 | stack دسکتاپ GTK/Tauri Linux | packaging و runtime دسکتاپ Linux | Release/Security | https://rustsec.org/advisories/RUSTSEC-2024-0420.html | 2026-10-01 | وقتی stack پشتیبانی‌شده Tauri Linux جایگزین maintained داشته باشد، حذف شود |
| RUSTSEC-2023-0089 | dependency transitively محصول | graph محصول؛ upgrade امن و compatible ثبت نشده | Release/Security | https://rustsec.org/advisories/RUSTSEC-2023-0089.html | 2026-10-01 | با release patched والد حذف شود یا parent dependency جایگزین شود |
| RUSTSEC-2024-0436 | dependency transitively محصول | graph محصول؛ upgrade امن و compatible ثبت نشده | Release/Security | https://rustsec.org/advisories/RUSTSEC-2024-0436.html | 2026-10-01 | با release patched والد حذف شود یا parent dependency جایگزین شود |
| RUSTSEC-2025-0075 | `rust-unic` از طریق Tauri `urlpattern` | parsing الگوی URL دسکتاپ | Release/Security | https://rustsec.org/advisories/RUSTSEC-2025-0075.html | 2026-10-01 | وقتی Tauri خانواده unmaintained `rust-unic` را جایگزین کند، حذف شود |
| RUSTSEC-2025-0080 | `rust-unic` از طریق Tauri `urlpattern` | parsing الگوی URL دسکتاپ | Release/Security | https://rustsec.org/advisories/RUSTSEC-2025-0080.html | 2026-10-01 | وقتی Tauri خانواده unmaintained `rust-unic` را جایگزین کند، حذف شود |
| RUSTSEC-2025-0081 | `rust-unic` از طریق Tauri `urlpattern` | parsing الگوی URL دسکتاپ | Release/Security | https://rustsec.org/advisories/RUSTSEC-2025-0081.html | 2026-10-01 | وقتی Tauri خانواده unmaintained `rust-unic` را جایگزین کند، حذف شود |
| RUSTSEC-2025-0098 | `rust-unic` از طریق Tauri `urlpattern` | parsing الگوی URL دسکتاپ | Release/Security | https://rustsec.org/advisories/RUSTSEC-2025-0098.html | 2026-10-01 | وقتی Tauri خانواده unmaintained `rust-unic` را جایگزین کند، حذف شود |
| RUSTSEC-2025-0100 | `rust-unic` از طریق Tauri `urlpattern` | parsing الگوی URL دسکتاپ | Release/Security | https://rustsec.org/advisories/RUSTSEC-2025-0100.html | 2026-10-01 | وقتی Tauri خانواده unmaintained `rust-unic` را جایگزین کند، حذف شود |

## روش بازبینی

1. `cargo deny check` و `cargo tree -i <crate>` را در برابر graph locked اجرا کنید.
2. تأیید کنید advisory همچنان فقط unmaintained است یا به vulnerability قابل بهره‌برداری تبدیل شده است.
3. سطح reachable در Scriptor و parent مستقیم مانع حذف را ثبت کنید.
4. به‌محض وجود path compatible و maintained، ignore را فوراً حذف کنید.
5. تاریخ گذشته `Review by` را blocker برای production release بدانید.

</div>
