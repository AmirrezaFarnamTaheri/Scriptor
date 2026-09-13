<div dir="ltr" align="center">

[English](MOBILE_ARCHITECTURE.md) · **فارسی** · [简体中文](MOBILE_ARCHITECTURE.zh-CN.md) · [Русский](MOBILE_ARCHITECTURE.ru.md) · [Deutsch](MOBILE_ARCHITECTURE.de.md) · [Español](MOBILE_ARCHITECTURE.es.md)

</div>

<div dir="rtl" lang="fa" align="right">

# معماری موبایل

**بلوغ:** فقط طراحی / در حال incubation.  
**وضعیت انتشار:** بخشی از محصول دسکتاپ پشتیبانی‌شده Scriptor 1.0 نیست.  
**مرجع:** [`PRODUCT.fa.md`](../../PRODUCT.fa.md) و [`CAPABILITY-MATURITY.fa.md`](../CAPABILITY-MATURITY.fa.md).

## هدف

این سند مرز معماری برای کارهای آینده موبایل را ثبت می‌کند، بدون آن‌که وجود یک برنامه منتشرشده Android یا iOS را القا کند. محصول پشتیبانی‌شده Scriptor همچنان برنامه دسکتاپ Tauri روی Windows، macOS و Linux است. کار موبایل می‌تواند منطق domain قابل‌حمل و جریان‌های کاربر را نمونه‌سازی کند، اما نباید قرارداد پشتیبانی محصول را بی‌سروصدا گسترش دهد.

## قرارداد معماری

یک client موبایل آینده باید invariantهای همان محصول دسکتاپ را حفظ کند:

1. **Markdown مرجع است.** یادداشت‌ها فایل‌های عادی می‌مانند؛ index موبایل مشتق‌شده و قابل بازسازی است.
2. **منطق domain قابل‌حمل پایین‌تر از adapterهای platform می‌ماند.** parsing، semantics کار، link resolution، template، merge logic و policyهای قطعی دیگر، وقتی API آن‌ها platform-neutral است، در package/crateهای مشترک قرار می‌گیرند.
3. **قابلیت‌های native adapterهای صریح‌اند.** file picking، background work، notification، secure storage، share sheet و رفتار lifecycle پلتفرم باید پشت مرزهای ویژه موبایل قرار گیرند.
4. **وابستگی مخفی cloud وجود ندارد.** sync آینده اختیاری و دارای threat model جداگانه است؛ موبایل به‌صورت پیش‌فرض مدل اختیار local-first را تغییر نمی‌دهد.
5. **مرزهای اعتماد fail-closed باقی می‌مانند.** intent خارجی، فایل importشده، اجرای plugin/tool و هر sync راه‌دور آینده نیازمند validation صریح و مصرف محدود منابع است.
6. **برابری رفتار بر پایه contract است، نه کپی UI.** fixtureهای مشترک و contractهای generated باید semantics مربوط به note/task/link را در desktop و mobile اثبات کنند.

## توپولوژی پیشنهادی

</div>

<div dir="ltr" align="left">

```text
mobile UI / navigation
        |
        v
mobile application adapter
        |
        +--> shared TypeScript domain packages
        |
        +--> native mobile capability adapters
                 |-- filesystem / document provider
                 |-- secure settings / credentials
                 |-- notifications / background scheduling
                 `-- optional sync transport (future, separately governed)
```

</div>

<div dir="rtl" lang="fa" align="right">

بنابراین محتوای موجود در `apps/mobile/`، هرگاه وجود داشته باشد، exploratory است. gateهای release دسکتاپ نباید آن را به‌عنوان target production مصرف کنند و توضیحات packaging نباید Android/iOS را platform انتشار پشتیبانی‌شده فعلی معرفی کنند.

## gateهای ارتقا

موبایل فقط زمانی می‌تواند از **Design-only** به **Experimental** برود که همه موارد زیر وجود داشته باشند:

- runtime/toolchain مشخص و نقطه ورود build قابل بازتولید؛
- طراحی اختیار داده پلتفرم که portability Markdown را حفظ کند؛
- threat model برای permission، background execution و secure storage؛
- contract test برای semantics مشترک note/task/link؛
- رفتار migration/backup/recovery برای فایل‌های نوشته‌شده توسط کاربر؛
- آزمون accessibility و lifecycle روی دست‌کم یک کلاس device واقعی؛
- support matrix صریح در `PRODUCT.md` و `CAPABILITY-MATURITY.md`.

ارتقا به **Production** علاوه بر این‌ها به release packaging، signing/trust policy، پشتیبانی crash/diagnostic، رفتار upgrade/rollback و همان استانداردهای release evidence دسکتاپ نیاز دارد.

## مواردی که هدف release فعلی نیستند

- هیچ ادعایی درباره feature parity Android یا iOS وجود ندارد؛
- هیچ installer/package موبایل در مجموعه release دسکتاپ نیست؛
- هیچ compatibility burden ویژه موبایل به internals دسکتاپ تحمیل نمی‌شود؛
- صرفاً برای کار موبایل آینده، cloud account اجباری نمی‌شود.

</div>
