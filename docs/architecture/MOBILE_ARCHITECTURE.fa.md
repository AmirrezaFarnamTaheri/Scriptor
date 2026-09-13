<div dir="ltr" align="center">

[English](MOBILE_ARCHITECTURE.md) · **فارسی** · [简体中文](MOBILE_ARCHITECTURE.zh-CN.md) · [Русский](MOBILE_ARCHITECTURE.ru.md) · [Deutsch](MOBILE_ARCHITECTURE.de.md) · [Español](MOBILE_ARCHITECTURE.es.md)

</div>

<div dir="rtl" lang="fa" align="right">

# معماری موبایل

**بلوغ:** فقط طراحی / در حال <bdi dir="ltr">incubation.</bdi>  
**وضعیت انتشار:** بخشی از محصول دسکتاپ پشتیبانی‌شده <bdi dir="ltr">Scriptor</bdi> 1.0 نیست.  
**مرجع:** [`PRODUCT.fa.md`](../../PRODUCT.fa.md) و [`CAPABILITY-MATURITY.fa.md`](../CAPABILITY-MATURITY.fa.md).

## هدف

این سند مرز معماری برای کارهای آینده موبایل را ثبت می‌کند، بدون آن‌که وجود یک برنامه منتشرشده <bdi dir="ltr">Android</bdi> یا <bdi dir="ltr">iOS</bdi> را القا کند. محصول پشتیبانی‌شده <bdi dir="ltr">Scriptor</bdi> همچنان برنامه دسکتاپ <bdi dir="ltr">Tauri</bdi> روی <bdi dir="ltr">Windows</bdi>، <bdi dir="ltr">macOS</bdi> و <bdi dir="ltr">Linux</bdi> است. کار موبایل می‌تواند منطق <bdi dir="ltr">domain</bdi> قابل‌حمل و جریان‌های کاربر را نمونه‌سازی کند، اما نباید قرارداد پشتیبانی محصول را بی‌سروصدا گسترش دهد.

## قرارداد معماری

یک <bdi dir="ltr">client</bdi> موبایل آینده باید <bdi dir="ltr">invariant</bdi>های همان محصول دسکتاپ را حفظ کند:

1. **<bdi dir="ltr">Markdown</bdi> مرجع است.** یادداشت‌ها فایل‌های عادی می‌مانند؛ <bdi dir="ltr">index</bdi> موبایل مشتق‌شده و قابل بازسازی است.
2. **منطق <bdi dir="ltr">domain</bdi> قابل‌حمل پایین‌تر از <bdi dir="ltr">adapter</bdi>های <bdi dir="ltr">platform</bdi> می‌ماند.** <bdi dir="ltr">parsing</bdi>، <bdi dir="ltr">semantics</bdi> کار، <bdi dir="ltr">link resolution</bdi>، <bdi dir="ltr">template</bdi>، <bdi dir="ltr">merge logic</bdi> و <bdi dir="ltr">policy</bdi>های قطعی دیگر، وقتی <bdi dir="ltr">API</bdi> آن‌ها <bdi dir="ltr">platform-neutral</bdi> است، در <bdi dir="ltr">package/crate</bdi>های مشترک قرار می‌گیرند.
3. **قابلیت‌های <bdi dir="ltr">native adapter</bdi>های صریح‌اند.** <bdi dir="ltr">file picking</bdi>، <bdi dir="ltr">background work</bdi>، <bdi dir="ltr">notification</bdi>، <bdi dir="ltr">secure storage</bdi>، <bdi dir="ltr">share sheet</bdi> و رفتار <bdi dir="ltr">lifecycle</bdi> پلتفرم باید پشت مرزهای ویژه موبایل قرار گیرند.
4. **وابستگی مخفی <bdi dir="ltr">cloud</bdi> وجود ندارد.** <bdi dir="ltr">sync</bdi> آینده اختیاری و دارای <bdi dir="ltr">threat model</bdi> جداگانه است؛ موبایل به‌صورت پیش‌فرض مدل اختیار <bdi dir="ltr">local-first</bdi> را تغییر نمی‌دهد.
5. **مرزهای اعتماد <bdi dir="ltr">fail-closed</bdi> باقی می‌مانند.** <bdi dir="ltr">intent</bdi> خارجی، فایل <bdi dir="ltr">import</bdi>شده، اجرای <bdi dir="ltr">plugin/tool</bdi> و هر <bdi dir="ltr">sync</bdi> راه‌دور آینده نیازمند <bdi dir="ltr">validation</bdi> صریح و مصرف محدود منابع است.
6. **برابری رفتار بر پایه <bdi dir="ltr">contract</bdi> است، نه کپی <bdi dir="ltr">UI.</bdi>** <bdi dir="ltr">fixture</bdi>های مشترک و <bdi dir="ltr">contract</bdi>های <bdi dir="ltr">generated</bdi> باید <bdi dir="ltr">semantics</bdi> مربوط به <bdi dir="ltr">note/task/link</bdi> را در <bdi dir="ltr">desktop</bdi> و <bdi dir="ltr">mobile</bdi> اثبات کنند.

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

بنابراین محتوای موجود در `apps/mobile/`، هرگاه وجود داشته باشد، <bdi dir="ltr">exploratory</bdi> است. <bdi dir="ltr">gate</bdi>های <bdi dir="ltr">release</bdi> دسکتاپ نباید آن را به‌عنوان <bdi dir="ltr">target production</bdi> مصرف کنند و توضیحات <bdi dir="ltr">packaging</bdi> نباید <bdi dir="ltr">Android/iOS</bdi> را <bdi dir="ltr">platform</bdi> انتشار پشتیبانی‌شده فعلی معرفی کنند.

## <bdi dir="ltr">gate</bdi>های ارتقا

موبایل فقط زمانی می‌تواند از **<bdi dir="ltr">Design-only</bdi>** به **<bdi dir="ltr">Experimental</bdi>** برود که همه موارد زیر وجود داشته باشند:

- <bdi dir="ltr">runtime/toolchain</bdi> مشخص و نقطه ورود <bdi dir="ltr">build</bdi> قابل بازتولید؛
- طراحی اختیار داده پلتفرم که <bdi dir="ltr">portability Markdown</bdi> را حفظ کند؛
- <bdi dir="ltr">threat</bdi> <bdi dir="ltr">model</bdi> برای <bdi dir="ltr">permission</bdi>، <bdi dir="ltr">background execution</bdi> و <bdi dir="ltr">secure storage</bdi>؛
- <bdi dir="ltr">contract</bdi> <bdi dir="ltr">test</bdi> برای <bdi dir="ltr">semantics</bdi> مشترک <bdi dir="ltr">note/task/link</bdi>؛
- رفتار <bdi dir="ltr">migration/backup/recovery</bdi> برای فایل‌های نوشته‌شده توسط کاربر؛
- آزمون <bdi dir="ltr">accessibility</bdi> و <bdi dir="ltr">lifecycle</bdi> روی دست‌کم یک کلاس <bdi dir="ltr">device</bdi> واقعی؛
- <bdi dir="ltr">support</bdi> <bdi dir="ltr">matrix</bdi> صریح در `PRODUCT.md` و `CAPABILITY-MATURITY.md`.

ارتقا به **<bdi dir="ltr">Production</bdi>** علاوه بر این‌ها به <bdi dir="ltr">release packaging</bdi>، <bdi dir="ltr">signing/trust policy</bdi>، پشتیبانی <bdi dir="ltr">crash/diagnostic</bdi>، رفتار <bdi dir="ltr">upgrade/rollback</bdi> و همان استانداردهای <bdi dir="ltr">release evidence</bdi> دسکتاپ نیاز دارد.

## مواردی که هدف <bdi dir="ltr">release</bdi> فعلی نیستند

- هیچ ادعایی درباره <bdi dir="ltr">feature parity Android</bdi> یا <bdi dir="ltr">iOS</bdi> وجود ندارد؛
- هیچ <bdi dir="ltr">installer/package</bdi> موبایل در مجموعه <bdi dir="ltr">release</bdi> دسکتاپ نیست؛
- هیچ <bdi dir="ltr">compatibility burden</bdi> ویژه موبایل به <bdi dir="ltr">internals</bdi> دسکتاپ تحمیل نمی‌شود؛
- صرفاً برای کار موبایل آینده، <bdi dir="ltr">cloud account</bdi> اجباری نمی‌شود.

</div>
