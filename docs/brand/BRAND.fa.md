<div dir="ltr" align="center">

[English](BRAND.md) · **فارسی** · [简体中文](BRAND.zh-CN.md) · [Русский](BRAND.ru.md) · [Deutsch](BRAND.de.md) · [Español](BRAND.es.md)

</div>

<div dir="rtl" lang="fa" align="right">

# برند <bdi dir="ltr">Scriptor</bdi>

## نام

**<bdi dir="ltr">Scriptor</bdi>** — واژه لاتین به‌معنای «نویسنده». نام محصولی که برای کاربران فضای کاری دانش استفاده می‌شود.

**شعار:** <bdi dir="ltr">The instrument for serious writing</bdi>

## نشان

حرف **<bdi dir="ltr">S</bdi>** با جزئیات بالا که از <bdi dir="ltr">tile</bdi>های شبیه <bdi dir="ltr">keycap</bdi> ساخته شده و <bdi dir="ltr">bevel</bdi>، <bdi dir="ltr">shadow</bdi>، <bdi dir="ltr">glyph</bdi>های کدنویسی و پراکندگی <bdi dir="ltr">particle</bdi>ها را حفظ می‌کند. فایل <bdi dir="ltr">canonical</bdi> یک <bdi dir="ltr">SVG</bdi> واقعی شامل <bdi dir="ltr">path</bdi>های <bdi dir="ltr">vector</bdi> است و هیچ تصویر <bdi dir="ltr">raster</bdi> جاسازی‌شده‌ای ندارد.

| <bdi dir="ltr">asset</bdi> | <bdi dir="ltr">path</bdi> | کاربرد |
|---|---|---|
| <bdi dir="ltr">wrapper</bdi> داخل برنامه | `src/brand/BrandMark.tsx` | نوار بالا، <bdi dir="ltr">glass shell</bdi> |
| <bdi dir="ltr">SVG</bdi> داخل برنامه | `src/brand/BrandMark.tsx` | <bdi dir="ltr">SVG inline</bdi> که با <bdi dir="ltr">theme token</bdi>های فعال کنترل می‌شود |
| منبع <bdi dir="ltr">canonical</bdi> | `docs/brand/logo-mark.svg` | <bdi dir="ltr">master</bdi> برداری <bdi dir="ltr">static</bdi> برای مستندات و <bdi dir="ltr">export</bdi> |
| <bdi dir="ltr">asset</bdi> زمان اجرا | `public/brand-mark.svg` | <bdi dir="ltr">fallback static</bdi> برای کاربرد بیرونی/<bdi dir="ltr">static</bdi> |
| <bdi dir="ltr">Favicon</bdi> | `public/favicon.svg` | <bdi dir="ltr">tab</bdi> مرورگر |
| <bdi dir="ltr">master</bdi> آیکون برنامه | `docs/brand/app-icon.svg` | آیکون <bdi dir="ltr">installer</bdi> دسکتاپ/موبایل |
| نشان <bdi dir="ltr">transparent</bdi> | `docs/brand/logo-mark.svg` | مستندات و <bdi dir="ltr">background</bdi> روشن |

### ساختار

- **فرمت منبع:** <bdi dir="ltr">SVG</bdi> فقط با <bdi dir="ltr">path</bdi>؛ بدون <bdi dir="ltr">payload</bdi> از نوع `<image>`.
- **ترکیب:** <bdi dir="ltr">tile</bdi>های <bdi dir="ltr">keycap</bdi> فیروزه‌ای با <bdi dir="ltr">highlight</bdi>، <bdi dir="ltr">shadow</bdi>، <bdi dir="ltr">glyph</bdi>های حک‌شده و <bdi dir="ltr">particle</bdi>های پراکنده.
- **مقیاس‌پذیری:** جایی که تطبیق <bdi dir="ltr">theme</bdi> لازم است از <bdi dir="ltr">SVG inline</bdi> داخل برنامه استفاده کنید؛ برای <bdi dir="ltr">asset</bdi>های <bdi dir="ltr">static</bdi> از <bdi dir="ltr">SVG canonical</bdi> استفاده کنید.

### رنگ

| <bdi dir="ltr">context</bdi> | نحوه نمایش |
|---|---|
| <bdi dir="ltr">shell</bdi> داخل برنامه | <bdi dir="ltr">SVG inline</bdi> با `--surface-raised`، `--border`، `--primary` و `--ink-strong` |
| <bdi dir="ltr">Favicon</bdi> / <bdi dir="ltr">installer</bdi> | صفحه فیروزه‌ای با گوشه گرد و <bdi dir="ltr">S tile</bdi>شده |
| <bdi dir="ltr">Wordmark</bdi> | متن <bdi dir="ltr">gradient</bdi> از `--ink-strong` به `--primary-strong` |

پس از تغییر نشان، <bdi dir="ltr">asset</bdi>های <bdi dir="ltr">PNG/ICO</bdi> مربوط به <bdi dir="ltr">installer</bdi> را دوباره تولید کنید:

</div>

<div dir="ltr" align="left">

```powershell
pnpm icons:regenerate
```

</div>

<div dir="rtl" lang="fa" align="right">

## <bdi dir="ltr">Wordmark</bdi>

- نمایش: **<bdi dir="ltr">Sora</bdi>** (`--font-display`) با <bdi dir="ltr">weight</bdi> 700 و <bdi dir="ltr">letter-spacing</bdi> برابر −0.04<bdi dir="ltr">em</bdi>
- <bdi dir="ltr">Gradient:</bdi> کلاس `.brand-wordmark` در `src/App.css`

## استفاده در کد

</div>

<div dir="ltr" align="left">

```ts
import { BRAND_NAME, BRAND_TAGLINE, BRAND_WORKSPACE_LABEL } from './brand/identity'
import { BrandMark, BrandWordmark } from './brand/BrandMark'
```

</div>
