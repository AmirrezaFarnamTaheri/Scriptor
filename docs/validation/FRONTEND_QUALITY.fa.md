<div dir="ltr" align="center">
[English](FRONTEND_QUALITY.md) · **فارسی** · [简体中文](FRONTEND_QUALITY.zh-CN.md) · [Русский](FRONTEND_QUALITY.ru.md) · [Deutsch](FRONTEND_QUALITY.de.md) · [Español](FRONTEND_QUALITY.es.md)
</div>

<div dir="rtl" lang="fa" align="right">

<div dir="rtl" lang="fa">

# استاندارد کیفیت <bdi dir="ltr">Frontend</bdi>

[<bdi dir="ltr">English</bdi>](FRONTEND_QUALITY.md) · [简体中文](FRONTEND_QUALITY.zh-CN.md) · [Русский](FRONTEND_QUALITY.ru.md) · [<bdi dir="ltr">Deutsch</bdi>](FRONTEND_QUALITY.de.md) · [<bdi dir="ltr">Espa</bdi>ñ<bdi dir="ltr">ol</bdi>](FRONTEND_QUALITY.es.md) · **فارسی**

<bdi dir="ltr">Scriptor</bdi> یک رابط **<bdi dir="ltr">operate</bdi>** است. کیفیت یعنی <bdi dir="ltr">hierarchy</bdi> آرام، تکمیل سریع <bdi dir="ltr">task</bdi>، <bdi dir="ltr">interaction state</bdi> کامل، <bdi dir="ltr">keyboard access</bdi>، <bdi dir="ltr">responsive density</bdi> و بدون <bdi dir="ltr">authority</bdi> مخفی؛ نه نمایش تزئینی.

## <bdi dir="ltr">Source Gate</bdi> خودکار

</div>

<div dir="ltr">

<div dir="ltr">
```bash
npm run check:frontend-quality --silent
```
</div>

</div>

<div dir="rtl" lang="fa">

این <bdi dir="ltr">gate</bdi> در <bdi dir="ltr">TypeScript/CSS</bdi> مربوط به <bdi dir="ltr">production</bdi> موارد زیر را بررسی می‌کند:

- <bdi dir="ltr">`any`</bdi> صریح در <bdi dir="ltr">UI/runtime contract</bdi>؛
- استفاده از <bdi dir="ltr">emoji glyph</bdi> به‌جای <bdi dir="ltr">icon system</bdi>؛
- <bdi dir="ltr">remote</bdi> <bdi dir="ltr">font/CSS import</bdi>؛
- <bdi dir="ltr">static</bdi> <bdi dir="ltr">inline style</bdi> در <bdi dir="ltr">critical workspace surface</bdi>؛
- <bdi dir="ltr">modal</bdi> <bdi dir="ltr">focus containment</bdi> و <bdi dir="ltr">naming</bdi>؛
- <bdi dir="ltr">typed</bdi> <bdi dir="ltr">editor/preview action contract</bdi>؛
- <bdi dir="ltr">CSS</bdi> <bdi dir="ltr">responsive</bdi> برای <bdi dir="ltr">editor</bdi>، <bdi dir="ltr">graph</bdi>، <bdi dir="ltr">modal</bdi> و <bdi dir="ltr">error state</bdi>؛
- <bdi dir="ltr">error</bdi> <bdi dir="ltr">UI</bdi> خودبسنده و <bdi dir="ltr">inclusion</bdi> سیستم طراحی.

<bdi dir="ltr">package import</bdi> به‌صورت جداگانه با <bdi dir="ltr">`lint:boundaries`</bdi> <bdi dir="ltr">enforce</bdi> می‌شود.

## جهت بصری

- <bdi dir="ltr">foundation</bdi> خنثی <bdi dir="ltr">charcoal/slate</bdi> با یک <bdi dir="ltr">accent</bdi> محدود <bdi dir="ltr">teal</bdi>؛
- <bdi dir="ltr">hierarchy</bdi> با <bdi dir="ltr">typography</bdi>، <bdi dir="ltr">divider</bdi>، <bdi dir="ltr">rhythm</bdi> و <bdi dir="ltr">negative space</bdi>، نه <bdi dir="ltr">nested card</bdi>؛
- بدون <bdi dir="ltr">purple AI gradient</bdi>، <bdi dir="ltr">neon glow</bdi>، <bdi dir="ltr">glass</bdi> بی‌دلیل، <bdi dir="ltr">generic dashboard tile</bdi>، <bdi dir="ltr">emoji control</bdi> یا <bdi dir="ltr">motion</bdi> تزئینی دائمی؛
- <bdi dir="ltr">system</bdi> <bdi dir="ltr">UI font</bdi> و <bdi dir="ltr">system monospace</bdi>؛ بدون <bdi dir="ltr">network font dependency</bdi>؛
- <bdi dir="ltr">motion</bdi> فقط برای <bdi dir="ltr">state continuity</bdi> و همیشه در صورت درخواست <bdi dir="ltr">disabled/reduced.</bdi>

## پذیرش <bdi dir="ltr">Component</bdi>

هر <bdi dir="ltr">async surface</bdi> باید <bdi dir="ltr">loading</bdi>، <bdi dir="ltr">empty</bdi> مفید، <bdi dir="ltr">error</bdi> قابل اقدام و <bdi dir="ltr">success</bdi> قابل مشاهده داشته باشد. <bdi dir="ltr">long-running work</bdi> وقتی <bdi dir="ltr">operation</bdi> زیرین پشتیبانی کند <bdi dir="ltr">cancellation</bdi> ارائه می‌دهد. <bdi dir="ltr">high-risk operation</bdi> پیش از <bdi dir="ltr">native confirmation</bdi>، <bdi dir="ltr">scope</bdi> و <bdi dir="ltr">consequence</bdi> را توضیح می‌دهد.

<bdi dir="ltr">Dialog</bdi> به <bdi dir="ltr">programmatic title/description</bdi>، <bdi dir="ltr">`aria-modal`</bdi>، <bdi dir="ltr">initial focus</bdi>، <bdi dir="ltr">focus containment</bdi>، <bdi dir="ltr">Escape</bdi>، <bdi dir="ltr">backdrop behavior</bdi>، <bdi dir="ltr">scroll containment</bdi> و <bdi dir="ltr">focus restoration</bdi> نیاز دارد. <bdi dir="ltr">Tab</bdi> از <bdi dir="ltr">roving focus</bdi> + <bdi dir="ltr">Arrow/Home/End</bdi> استفاده می‌کند. <bdi dir="ltr">control</bdi> فقط-<bdi dir="ltr">icon</bdi> دارای <bdi dir="ltr">accessible name</bdi> است.

<bdi dir="ltr">Top-bar/toolbar</bdi> <bdi dir="ltr">overflow check</bdi>، <bdi dir="ltr">viewport</bdi> باریک و 200% <bdi dir="ltr">text zoom</bdi> را پوشش می‌دهد. <bdi dir="ltr">portaled menu</bdi> و <bdi dir="ltr">customization popover</bdi> باید داخل <bdi dir="ltr">visual viewport</bdi> بمانند، با <bdi dir="ltr">Escape</bdi> بسته شوند، <bdi dir="ltr">trigger focus</bdi> را <bdi dir="ltr">restore</bdi> کنند و پس از <bdi dir="ltr">resize</bdi> یا <bdi dir="ltr">ancestor scrolling position</bdi> را <bdi dir="ltr">update</bdi> کنند. <bdi dir="ltr">plugin/store preset</bdi> باید به‌صورت یک <bdi dir="ltr">state transition</bdi> قابل‌مشاهده اعمال شود، <bdi dir="ltr">third-party plugin ID</bdi>هایی را که مالکشان نیست حفظ کند و <bdi dir="ltr">empty/persistence-error state</bdi> واقعی نشان دهد.

## <bdi dir="ltr">Evidence</bdi> بصری ضروری

مجموعه <bdi dir="ltr">screenshot</bdi>های <bdi dir="ltr">Playwright</bdi>، <bdi dir="ltr">workspace</bdi>، <bdi dir="ltr">editor/preview</bdi>، <bdi dir="ltr">command palette</bdi>، <bdi dir="ltr">graph</bdi>، <bdi dir="ltr">canvas</bdi>، <bdi dir="ltr">Git</bdi>، <bdi dir="ltr">MCP</bdi>، <bdi dir="ltr">settings</bdi>، <bdi dir="ltr">publish</bdi>، <bdi dir="ltr">health</bdi>، <bdi dir="ltr">knowledge</bdi>، <bdi dir="ltr">conflict resolution</bdi>، <bdi dir="ltr">history</bdi>، <bdi dir="ltr">shortcuts</bdi>، <bdi dir="ltr">mobile layout</bdi>، <bdi dir="ltr">onboarding</bdi> و <bdi dir="ltr">plugins</bdi> را پوشش می‌دهد. <bdi dir="ltr">release reviewer</bdi> باید <bdi dir="ltr">snapshot</bdi>ها را از <bdi dir="ltr">frozen source</bdi> دوباره تولید و <bdi dir="ltr">diff</bdi>ها را بررسی کند؛ <bdi dir="ltr">PNG</bdi> تاریخی اثبات <bdi dir="ltr">current source state</bdi> نیست.

</div>


</div>
