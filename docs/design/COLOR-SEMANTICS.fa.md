<div dir="ltr" align="center">

[English](COLOR-SEMANTICS.md) · **فارسی** · [简体中文](COLOR-SEMANTICS.zh-CN.md) · [Русский](COLOR-SEMANTICS.ru.md) · [Deutsch](COLOR-SEMANTICS.de.md) · [Español](COLOR-SEMANTICS.es.md)

</div>

<div dir="rtl" lang="fa" align="right">

# معناشناسی و مالکیت رنگ

**وضعیت:** قرارداد فعال طراحی

<bdi dir="ltr">Scriptor</bdi> مقدارهای رنگ را بر اساس مسئولیت تفکیک می‌کند تا <bdi dir="ltr">state</bdi> محصول با <bdi dir="ltr">literal</bdi>های بدون مالک کدنویسی نشود.

## ۱. رنگ‌های <bdi dir="ltr">theme</bdi> و رنگ‌های معنایی <bdi dir="ltr">UI</bdi>

<bdi dir="ltr">state</bdi> تعاملی، <bdi dir="ltr">status</bdi>، <bdi dir="ltr">selection</bdi>، <bdi dir="ltr">focus</bdi>، <bdi dir="ltr">warning</bdi>، <bdi dir="ltr">error</bdi>، <bdi dir="ltr">success</bdi>، <bdi dir="ltr">border</bdi> و <bdi dir="ltr">surface</bdi>های برنامه باید از <bdi dir="ltr">CSS custom property</bdi>های نام‌دار استفاده کنند. لایه سازگاری فعلی متغیرهایی مانند `--primary`، `--danger`، `--success`، `--selected`، `--surface` و `--border` را ارائه می‌کند؛ سیستم <bdi dir="ltr">token</bdi> لایه‌بندی‌شده در `src/styles/tokens/` مالک <bdi dir="ltr">palette</bdi>های <bdi dir="ltr">primitive</bdi> و <bdi dir="ltr">semantic</bdi> متناظر است.

<bdi dir="ltr">CSS</bdi> مؤلفه‌ها و کد <bdi dir="ltr">rendering</bdi> در <bdi dir="ltr">React</bdi> نباید برای نمایش یک <bdi dir="ltr">status</bdi> برنامه یا <bdi dir="ltr">interaction state</bdi> یک <bdi dir="ltr">hex</bdi> جدید بسازند. به‌جای آن <bdi dir="ltr">token</bdi> اضافه یا <bdi dir="ltr">map</bdi> کنید.

## ۲. <bdi dir="ltr">palette</bdi>های محتوا و <bdi dir="ltr">visualization</bdi>

داده بصری <bdi dir="ltr">persist</bdi>شده یا نوشته‌شده توسط کاربر با <bdi dir="ltr">chrome</bdi> برنامه متفاوت است. <bdi dir="ltr">fill/stroke</bdi> بلوک‌های <bdi dir="ltr">Canvas</bdi>، رنگ <bdi dir="ltr">sticky note</bdi>، <bdi dir="ltr">annotation</bdi>، <bdi dir="ltr">palette</bdi>های <bdi dir="ltr">series/folder</bdi> در <bdi dir="ltr">graph</bdi>، تعریف <bdi dir="ltr">theme</bdi>های <bdi dir="ltr">syntax/editor</bdi>، <bdi dir="ltr">default</bdi>های <bdi dir="ltr">SVG export</bdi>شده و <bdi dir="ltr">palette</bdi>های <bdi dir="ltr">theme</bdi> قابل انتخاب توسط کاربر می‌توانند <bdi dir="ltr">literal</bdi> رنگ داشته باشند، وقتی آن <bdi dir="ltr">literal</bdi> بخشی از <bdi dir="ltr">format</bdi> محتوا یا <bdi dir="ltr">palette</bdi> نام‌دار باشد. این مقدارها نباید به‌عنوان رنگ ضمنی <bdi dir="ltr">status</bdi> برنامه دوباره استفاده شوند.

## ۳. <bdi dir="ltr">fallback</bdi>ها

یک مؤلفه نباید مالکیت <bdi dir="ltr">token</bdi> را با <bdi dir="ltr">fallback</bdi> خام معنایی مثل `var(--danger, #b42318)` دور بزند. <bdi dir="ltr">token</bdi>های لازم برنامه توسط قرارداد <bdi dir="ltr">theme</bdi> تعریف شده‌اند. <bdi dir="ltr">renderer</bdi>های محتوا هنگام بارگذاری داده کاربر که <bdi dir="ltr">style</bdi> ندارد می‌توانند <bdi dir="ltr">fallback literal</bdi> پایدار داشته باشند، چون این مقدارها محتوای سند را توصیف می‌کنند، نه <bdi dir="ltr">state</bdi> رابط کاربری.

## ۴. <bdi dir="ltr">API</bdi>های <bdi dir="ltr">Canvas</bdi>

<bdi dir="ltr">attribute</bdi>های <bdi dir="ltr">presentation</bdi> در <bdi dir="ltr">SVG</bdi> می‌توانند مستقیم به <bdi dir="ltr">CSS variable</bdi> ارجاع دهند. <bdi dir="ltr">API</bdi>های <bdi dir="ltr">Canvas</bdi> 2<bdi dir="ltr">D</bdi> به رنگ <bdi dir="ltr">resolve</bdi>شده نیاز دارند؛ بنابراین رنگ‌های <bdi dir="ltr">Canvas</bdi> با <bdi dir="ltr">semantics</bdi> برنامه از <bdi dir="ltr">custom property</bdi>های <bdi dir="ltr">computed</bdi> عنصر فعال خوانده می‌شوند. <bdi dir="ltr">palette visualization</bdi> فقط می‌تواند <bdi dir="ltr">fallback rendering</bdi> باشد، نه منبع <bdi dir="ltr">semantics</bdi> مربوط به <bdi dir="ltr">status.</bdi>

</div>
