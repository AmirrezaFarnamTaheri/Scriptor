<div dir="rtl" lang="fa">

# ممیزی دسترس‌پذیری

[English](ACCESSIBILITY_AUDIT.md) · [简体中文](ACCESSIBILITY_AUDIT.zh-CN.md) · [Русский](ACCESSIBILITY_AUDIT.ru.md) · [Deutsch](ACCESSIBILITY_AUDIT.de.md) · [Español](ACCESSIBILITY_AUDIT.es.md) · **فارسی**

چک‌لیست release برای Scriptor desktop. بررسی‌های static خودکار با <bdi dir="ltr">`pnpm check:a11y`</bdi> اجرا می‌شوند؛ موارد زیر مشخص می‌کنند چه چیزی را CI پوشش می‌دهد و چه چیزی پیش از tag نیاز به spot-check دستی دارد.

## Keyboard

- [ ] ترتیب Tab بدون trap به vault search، note list، editor، inspector tabs و status controls برسد. *(manual release gate)*
- [x] <bdi dir="ltr">`Escape`</bdi> graph panel، rename dialog، diagnostics drawer، Git panel و modal overlayهای دیگر را می‌بندد (<bdi dir="ltr">`useEscapeToClose`</bdi>).
- [x] shared panel، graph و Obsidian import در حالت modal focus را trap می‌کنند و هنگام close focus قبلی را restore می‌کنند (<bdi dir="ltr">`useFocusTrap`</bdi>).
- [x] note tab برای activate، pin و close control جدا دارد، interactive element تو‌در‌تو ندارد و Arrow/Home/End navigation پشتیبانی می‌شود.
- [x] editor ورودی متن استاندارد را می‌پذیرد؛ focus ring در CodeMirror از <bdi dir="ltr">`--focus-ring` / `--focus-outline`</bdi> استفاده می‌کند.
- [x] icon button در toolbar و close button دارای <bdi dir="ltr">`aria-label`</bdi> است (spot-check در shell component).

## Landmark و نام‌ها

- [x] shell اصلی <bdi dir="ltr">`main`</bdi> با <bdi dir="ltr">`BRAND_WORKSPACE_LABEL`</bdi> نام‌گذاری شده است. *(تأیید با `check:a11y`)*
- [x] regionهای vault، editor و inspector از <bdi dir="ltr">`aria-label`</bdi> یا heading استفاده می‌کنند.
- [x] inspector و note tab از <bdi dir="ltr">`role="tablist"` / `role="tab"`</bdi> و <bdi dir="ltr">`aria-selected`</bdi> استفاده می‌کنند.
- [x] status banner برای error از <bdi dir="ltr">`role="status"`</bdi> یا <bdi dir="ltr">`role="alert"`</bdi> استفاده می‌کند. *(تأیید با `check:a11y`)*

## Visual

- [ ] contrast متن در default dark theme مطابق WCAG AA باشد. *(spot-check دستی)*
- [x] focus indicator در <bdi dir="ltr">`src/index.css`</bdi> تعریف شده است. *(تأیید با `check:a11y`)*
- [x] <bdi dir="ltr">`prefers-reduced-motion`</bdi> رعایت می‌شود و CSS برنامه animation غیرضروری را غیرفعال می‌کند.

## Screen reader (spot check)

- [x] vault note count و index progress از status region اعلام می‌شوند.
- [ ] issue count در Problems tab. *(دستی با screen reader)*
- [x] checkbox مربوط به diagnostics opt-in با “Send local crash diagnostics” label شده است.

## ابزارهای خودکار

</div>

<div dir="ltr">

```powershell
pnpm check:a11y
```

</div>

<div dir="rtl" lang="fa">

static source checkها در CI/release gate اجرا می‌شوند. برای browser coverage:

</div>

<div dir="ltr">

```powershell
pnpm dev --host 127.0.0.1
pnpm check:a11y-axe
pnpm test:visual
```

</div>

<div dir="rtl" lang="fa">

findingها را در release PR ثبت کنید. keyboard trap، نام گم‌شده برای primary action، از دست‌رفتن focus، contrast ناخوانا و critical/serious axe violation release را block می‌کنند.

## محدودیت‌های شناخته‌شده (v0.1)

- graph panel یک keyboard focus surface دارد با arrow navigation، Enter activation، live node summary و modal focus containment. screen-reader usability pass همچنان manual release gate است.
- command palette از arrow keys، Enter و Escape پشتیبانی می‌کند (<bdi dir="ltr">`CommandPalette.tsx`</bdi>).

</div>
