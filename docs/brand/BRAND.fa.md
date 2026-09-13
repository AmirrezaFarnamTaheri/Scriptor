<div dir="ltr" align="center">

[English](BRAND.md) · **فارسی** · [简体中文](BRAND.zh-CN.md) · [Русский](BRAND.ru.md) · [Deutsch](BRAND.de.md) · [Español](BRAND.es.md)

</div>

<div dir="rtl" lang="fa" align="right">

# برند Scriptor

## نام

**Scriptor** — واژه لاتین به‌معنای «نویسنده». نام محصولی که برای کاربران فضای کاری دانش استفاده می‌شود.

**شعار:** The instrument for serious writing

## نشان

حرف **S** با جزئیات بالا که از tileهای شبیه keycap ساخته شده و bevel، shadow، glyphهای کدنویسی و پراکندگی particleها را حفظ می‌کند. فایل canonical یک SVG واقعی شامل pathهای vector است و هیچ تصویر raster جاسازی‌شده‌ای ندارد.

| asset | path | کاربرد |
|---|---|---|
| wrapper داخل برنامه | `src/brand/BrandMark.tsx` | نوار بالا، glass shell |
| SVG داخل برنامه | `src/brand/BrandMark.tsx` | SVG inline که با theme tokenهای فعال کنترل می‌شود |
| منبع canonical | `docs/brand/logo-mark.svg` | master برداری static برای مستندات و export |
| asset زمان اجرا | `public/brand-mark.svg` | fallback static برای کاربرد بیرونی/static |
| Favicon | `public/favicon.svg` | tab مرورگر |
| master آیکون برنامه | `docs/brand/app-icon.svg` | آیکون installer دسکتاپ/موبایل |
| نشان transparent | `docs/brand/logo-mark.svg` | مستندات و background روشن |

### ساختار

- **فرمت منبع:** SVG فقط با path؛ بدون payload از نوع `<image>`.
- **ترکیب:** tileهای keycap فیروزه‌ای با highlight، shadow، glyphهای حک‌شده و particleهای پراکنده.
- **مقیاس‌پذیری:** جایی که تطبیق theme لازم است از SVG inline داخل برنامه استفاده کنید؛ برای assetهای static از SVG canonical استفاده کنید.

### رنگ

| context | نحوه نمایش |
|---|---|
| shell داخل برنامه | SVG inline با `--surface-raised`، `--border`، `--primary` و `--ink-strong` |
| Favicon / installer | صفحه فیروزه‌ای با گوشه گرد و S tileشده |
| Wordmark | متن gradient از `--ink-strong` به `--primary-strong` |

پس از تغییر نشان، assetهای PNG/ICO مربوط به installer را دوباره تولید کنید:

</div>

<div dir="ltr" align="left">

```powershell
pnpm icons:regenerate
```

</div>

<div dir="rtl" lang="fa" align="right">

## Wordmark

- نمایش: **Sora** (`--font-display`) با weight 700 و letter-spacing برابر −0.04em
- <bdi dir="ltr">Gradient:</bdi> کلاس `.brand-wordmark` در `src/App.css`

## استفاده در کد

</div>

<div dir="ltr" align="left">

```ts
import { BRAND_NAME, BRAND_TAGLINE, BRAND_WORKSPACE_LABEL } from './brand/identity'
import { BrandMark, BrandWordmark } from './brand/BrandMark'
```

</div>
