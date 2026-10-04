<div dir="ltr" align="center">

[English](MOBILE_IMPLEMENTATION.md) · **فارسی** · [简体中文](MOBILE_IMPLEMENTATION.zh-CN.md) · [Русский](MOBILE_IMPLEMENTATION.ru.md) · [Deutsch](MOBILE_IMPLEMENTATION.de.md) · [Español](MOBILE_IMPLEMENTATION.es.md)

</div>

<div dir="rtl" lang="fa" align="right">

# پیاده‌سازی و راستی‌آزمایی موبایل

برنامه موبایل از ویرایشگر مشترک و یک <bdi dir="ltr">adapter</bdi> برای <bdi dir="ltr">Rust kernel</bdi> درون‌پردازشی استفاده می‌کند. دسترسی به <bdi dir="ltr">vault</bdi> از محدوده ذخیره‌سازی موبایل پیروی می‌کند؛ ذخیره یادداشت‌ها به‌جای <bdi dir="ltr">daemon</bdi> دسکتاپ از <bdi dir="ltr">content hash</bdi> و تاریخچه استفاده می‌کند. کنترل‌های لمسی، جهت متن و پیش‌نویس‌های بازیابی‌پذیر پوشش متمرکز مرورگری دارند.

کامپایل بومی <bdi dir="ltr">Android ARM64</bdi> و بسته‌بندی <bdi dir="ltr">debug</bdi> راستی‌آزمایی شده‌اند. فایل <bdi dir="ltr">APK</bdi> دیباگ شامل <bdi dir="ltr">`classes.dex`</bdi>، <bdi dir="ltr">`AndroidManifest.xml`</bdi> و <bdi dir="ltr">`lib/arm64-v8a/libscriptor_mobile_lib.so`</bdi> است؛ راستی‌آزمایی یکپارچگی <bdi dir="ltr">ZIP</bdi> هیچ ورودی خرابی گزارش نمی‌کند. اندازه بسته دیباگ 151,488,290 بایت است که یک کتابخانه بومی <bdi dir="ltr">unstripped</bdi> با اندازه 144,335,032 بایت را دربر می‌گیرد. این یک مصنوع توسعه است، نه نسخه انتشار بهینه‌شده از نظر اندازه.

بازرسی مستقل بسته، وجود یک کتابخانه بومی <bdi dir="ltr">AArch64 ELF64</bdi> (ماشین <bdi dir="ltr">ELF</bdi> شماره 183) را تأیید می‌کند. راستی‌آزمایی امضای نصب‌شده اندروید، فایل <bdi dir="ltr">APK</bdi> را با <bdi dir="ltr">Signature Scheme v2</bdi> و یک امضاکننده می‌پذیرد. مقدار <bdi dir="ltr">SHA-256</bdi> فایل بازرسی‌شده <bdi dir="ltr">APK</bdi> برابر <bdi dir="ltr">`54eeb734857bce66273a2f30219e62dd1a85d2ee3fccb2d772a0a50a48d94e6e`</bdi> است؛ این مقدار همین مصنوع دیباگ محلی را شناسایی می‌کند و گواه انتشار نیست.

فرمان استاندارد اندروید هنگام آماده‌سازی کتابخانه بومی با محدودیت مجوز <bdi dir="ltr">symlink</bdi> در ویندوز روبه‌رو شد. ابزار کمکی بسته‌بندی پروژه یک کتابخانه بومی از پیش کامپایل‌شده را می‌پذیرد، آن را در مسیر آماده‌سازی <bdi dir="ltr">ARM64</bdi> تولیدشده کپی می‌کند و فرایند ساخت تولیدشده را با کلید امضای دیباگ متعلق به پروژه فرا می‌خواند. این ابزار مقصد را اعتبارسنجی می‌کند، محیط پردازش خود را بازمی‌گرداند، مصرف <bdi dir="ltr">worker</bdi>/حافظه را محدود می‌کند و <bdi dir="ltr">Android keystore</bdi> سراسری را بدون تغییر باقی می‌گذارد. مصنوعات ساخت و کلید دیباگ محلی توسط <bdi dir="ltr">Git</bdi> نادیده گرفته می‌شوند.

در حال حاضر هیچ دستگاه اندرویدی متصل نیست. نصب روی دستگاه، رفتار چرخه‌عمر/مجوزها و بسته‌بندی انتشار امضاشده هنوز باید راستی‌آزمایی شوند. کامپایل و راستی‌آزمایی روی دستگاه برای <bdi dir="ltr">iOS</bdi> به زنجیره‌ابزار اپل نیاز دارد و از این میزبان ویندوزی ادعا نمی‌شود.

</div>
