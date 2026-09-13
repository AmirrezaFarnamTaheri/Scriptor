<div dir="ltr" align="center">

[English](COLOR-SEMANTICS.md) · **فارسی** · [简体中文](COLOR-SEMANTICS.zh-CN.md) · [Русский](COLOR-SEMANTICS.ru.md) · [Deutsch](COLOR-SEMANTICS.de.md) · [Español](COLOR-SEMANTICS.es.md)

</div>

<div dir="rtl" lang="fa" align="right">

# معناشناسی و مالکیت رنگ

**وضعیت:** قرارداد فعال طراحی

<bdi dir="ltr">Scriptor</bdi> مقدارهای رنگ را بر اساس مسئولیت تفکیک می‌کند تا state محصول با literalهای بدون مالک کدنویسی نشود.

## ۱. رنگ‌های theme و رنگ‌های معنایی UI

<bdi dir="ltr">state</bdi> تعاملی، status، selection، focus، warning، error، success، border و surfaceهای برنامه باید از CSS custom propertyهای نام‌دار استفاده کنند. لایه سازگاری فعلی متغیرهایی مانند `--primary`، `--danger`، `--success`، `--selected`، `--surface` و `--border` را ارائه می‌کند؛ سیستم token لایه‌بندی‌شده در `src/styles/tokens/` مالک paletteهای primitive و semantic متناظر است.

<bdi dir="ltr">CSS</bdi> مؤلفه‌ها و کد rendering در React نباید برای نمایش یک status برنامه یا interaction state یک hex جدید بسازند. به‌جای آن token اضافه یا map کنید.

## ۲. paletteهای محتوا و visualization

داده بصری persistشده یا نوشته‌شده توسط کاربر با chrome برنامه متفاوت است. fill/stroke بلوک‌های Canvas، رنگ sticky note، annotation، paletteهای series/folder در graph، تعریف themeهای syntax/editor، defaultهای SVG exportشده و paletteهای theme قابل انتخاب توسط کاربر می‌توانند literal رنگ داشته باشند، وقتی آن literal بخشی از format محتوا یا palette نام‌دار باشد. این مقدارها نباید به‌عنوان رنگ ضمنی status برنامه دوباره استفاده شوند.

## ۳. fallbackها

یک مؤلفه نباید مالکیت token را با fallback خام معنایی مثل `var(--danger, #b42318)` دور بزند. tokenهای لازم برنامه توسط قرارداد theme تعریف شده‌اند. rendererهای محتوا هنگام بارگذاری داده کاربر که style ندارد می‌توانند fallback literal پایدار داشته باشند، چون این مقدارها محتوای سند را توصیف می‌کنند، نه state رابط کاربری.

## ۴. APIهای Canvas

<bdi dir="ltr">attribute</bdi>های presentation در SVG می‌توانند مستقیم به CSS variable ارجاع دهند. APIهای Canvas 2D به رنگ resolveشده نیاز دارند؛ بنابراین رنگ‌های Canvas با semantics برنامه از custom propertyهای computed عنصر فعال خوانده می‌شوند. palette visualization فقط می‌تواند fallback rendering باشد، نه منبع semantics مربوط به status.

</div>
