<div dir="ltr" align="center">
[English](FRONTEND_QUALITY.md) · **فارسی** · [简体中文](FRONTEND_QUALITY.zh-CN.md) · [Русский](FRONTEND_QUALITY.ru.md) · [Deutsch](FRONTEND_QUALITY.de.md) · [Español](FRONTEND_QUALITY.es.md)
</div>

<div dir="rtl" lang="fa" align="right">

<div dir="rtl" lang="fa">

# استاندارد کیفیت Frontend

[English](FRONTEND_QUALITY.md) · [简体中文](FRONTEND_QUALITY.zh-CN.md) · [Русский](FRONTEND_QUALITY.ru.md) · [Deutsch](FRONTEND_QUALITY.de.md) · [Español](FRONTEND_QUALITY.es.md) · **فارسی**

<bdi dir="ltr">Scriptor</bdi> یک رابط **operate** است. کیفیت یعنی hierarchy آرام، تکمیل سریع task، interaction state کامل، keyboard access، responsive density و بدون authority مخفی؛ نه نمایش تزئینی.

## Source Gate خودکار

</div>

<div dir="ltr">

<div dir="ltr">
```bash
npm run check:frontend-quality --silent
```
</div>

</div>

<div dir="rtl" lang="fa">

این gate در TypeScript/CSS مربوط به production موارد زیر را بررسی می‌کند:

- <bdi dir="ltr">`any`</bdi> صریح در UI/runtime contract؛
- استفاده از emoji glyph به‌جای icon system؛
- <bdi dir="ltr">remote</bdi> font/CSS import؛
- <bdi dir="ltr">static</bdi> inline style در critical workspace surface؛
- <bdi dir="ltr">modal</bdi> focus containment و naming؛
- <bdi dir="ltr">typed</bdi> editor/preview action contract؛
- <bdi dir="ltr">CSS</bdi> responsive برای editor، graph، modal و error state؛
- <bdi dir="ltr">error</bdi> UI خودبسنده و inclusion سیستم طراحی.

package import به‌صورت جداگانه با <bdi dir="ltr">`lint:boundaries`</bdi> enforce می‌شود.

## جهت بصری

- <bdi dir="ltr">foundation</bdi> خنثی charcoal/slate با یک accent محدود teal؛
- <bdi dir="ltr">hierarchy</bdi> با typography، divider، rhythm و negative space، نه nested card؛
- بدون purple AI gradient، neon glow، glass بی‌دلیل، generic dashboard tile، emoji control یا motion تزئینی دائمی؛
- <bdi dir="ltr">system</bdi> UI font و system monospace؛ بدون network font dependency؛
- <bdi dir="ltr">motion</bdi> فقط برای state continuity و همیشه در صورت درخواست disabled/reduced.

## پذیرش Component

هر async surface باید loading، empty مفید، error قابل اقدام و success قابل مشاهده داشته باشد. long-running work وقتی operation زیرین پشتیبانی کند cancellation ارائه می‌دهد. high-risk operation پیش از native confirmation، scope و consequence را توضیح می‌دهد.

Dialog به programmatic title/description، <bdi dir="ltr">`aria-modal`</bdi>، initial focus، focus containment، Escape، backdrop behavior، scroll containment و focus restoration نیاز دارد. Tab از roving focus + Arrow/Home/End استفاده می‌کند. control فقط-icon دارای accessible name است.

<bdi dir="ltr">Top-bar/toolbar</bdi> overflow check، viewport باریک و 200% text zoom را پوشش می‌دهد. portaled menu و customization popover باید داخل visual viewport بمانند، با Escape بسته شوند، trigger focus را restore کنند و پس از resize یا ancestor scrolling position را update کنند. plugin/store preset باید به‌صورت یک state transition قابل‌مشاهده اعمال شود، third-party plugin IDهایی را که مالکشان نیست حفظ کند و empty/persistence-error state واقعی نشان دهد.

## Evidence بصری ضروری

مجموعه screenshotهای Playwright، workspace، editor/preview، command palette، graph، canvas، Git، MCP، settings، publish، health، knowledge، conflict resolution، history، shortcuts، mobile layout، onboarding و plugins را پوشش می‌دهد. release reviewer باید snapshotها را از frozen source دوباره تولید و diffها را بررسی کند؛ PNG تاریخی اثبات current source state نیست.

</div>


</div>
