<div dir="ltr" align="center">
[English](ACCESSIBILITY_AUDIT.md) · **فارسی** · [简体中文](ACCESSIBILITY_AUDIT.zh-CN.md) · [Русский](ACCESSIBILITY_AUDIT.ru.md) · [Deutsch](ACCESSIBILITY_AUDIT.de.md) · [Español](ACCESSIBILITY_AUDIT.es.md)
</div>

<div dir="rtl" lang="fa" align="right">

<div dir="rtl" lang="fa">

# ممیزی دسترس‌پذیری

[<bdi dir="ltr">English</bdi>](ACCESSIBILITY_AUDIT.md) · [简体中文](ACCESSIBILITY_AUDIT.zh-CN.md) · [Русский](ACCESSIBILITY_AUDIT.ru.md) · [<bdi dir="ltr">Deutsch</bdi>](ACCESSIBILITY_AUDIT.de.md) · [<bdi dir="ltr">Espa</bdi>ñ<bdi dir="ltr">ol</bdi>](ACCESSIBILITY_AUDIT.es.md) · **فارسی**

چک‌لیست <bdi dir="ltr">release</bdi> برای <bdi dir="ltr">Scriptor desktop.</bdi> بررسی‌های <bdi dir="ltr">static</bdi> خودکار با <bdi dir="ltr">`pnpm check:a11y`</bdi> اجرا می‌شوند؛ موارد زیر مشخص می‌کنند چه چیزی را <bdi dir="ltr">CI</bdi> پوشش می‌دهد و چه چیزی پیش از <bdi dir="ltr">tag</bdi> نیاز به <bdi dir="ltr">spot-check</bdi> دستی دارد.

## <bdi dir="ltr">Keyboard</bdi>

- [ ] ترتیب <bdi dir="ltr">Tab</bdi> بدون <bdi dir="ltr">trap</bdi> به <bdi dir="ltr">vault search</bdi>، <bdi dir="ltr">note list</bdi>، <bdi dir="ltr">editor</bdi>، <bdi dir="ltr">inspector tabs</bdi> و <bdi dir="ltr">status controls</bdi> برسد. *(<bdi dir="ltr">manual release gate</bdi>)*
- [<bdi dir="ltr">x</bdi>] <bdi dir="ltr">`Escape`</bdi> <bdi dir="ltr">graph panel</bdi>، <bdi dir="ltr">rename dialog</bdi>، <bdi dir="ltr">diagnostics drawer</bdi>، <bdi dir="ltr">Git panel</bdi> و <bdi dir="ltr">modal overlay</bdi>های دیگر را می‌بندد (<bdi dir="ltr">`useEscapeToClose`</bdi>).
- [<bdi dir="ltr">x</bdi>] <bdi dir="ltr">shared panel</bdi>، <bdi dir="ltr">graph</bdi> و <bdi dir="ltr">Obsidian import</bdi> در حالت <bdi dir="ltr">modal focus</bdi> را <bdi dir="ltr">trap</bdi> می‌کنند و هنگام <bdi dir="ltr">close focus</bdi> قبلی را <bdi dir="ltr">restore</bdi> می‌کنند (<bdi dir="ltr">`useFocusTrap`</bdi>).
- [<bdi dir="ltr">x</bdi>] <bdi dir="ltr">note tab</bdi> برای <bdi dir="ltr">activate</bdi>، <bdi dir="ltr">pin</bdi> و <bdi dir="ltr">close control</bdi> جدا دارد، <bdi dir="ltr">interactive element</bdi> تو‌در‌تو ندارد و <bdi dir="ltr">Arrow/Home/End navigation</bdi> پشتیبانی می‌شود.
- [<bdi dir="ltr">x</bdi>] <bdi dir="ltr">editor</bdi> ورودی متن استاندارد را می‌پذیرد؛ <bdi dir="ltr">focus ring</bdi> در <bdi dir="ltr">CodeMirror</bdi> از <bdi dir="ltr">`--focus-ring` / `--focus-outline`</bdi> استفاده می‌کند.
- [<bdi dir="ltr">x</bdi>] <bdi dir="ltr">icon button</bdi> در <bdi dir="ltr">toolbar</bdi> و <bdi dir="ltr">close button</bdi> دارای <bdi dir="ltr">`aria-label`</bdi> است (<bdi dir="ltr">spot-check</bdi> در <bdi dir="ltr">shell component</bdi>).

## <bdi dir="ltr">Landmark</bdi> و نام‌ها

- [<bdi dir="ltr">x</bdi>] <bdi dir="ltr">shell</bdi> اصلی <bdi dir="ltr">`main`</bdi> با <bdi dir="ltr">`BRAND_WORKSPACE_LABEL`</bdi> نام‌گذاری شده است. *(تأیید با `check:a11y`)*
- [<bdi dir="ltr">x</bdi>] <bdi dir="ltr">region</bdi>های <bdi dir="ltr">vault</bdi>، <bdi dir="ltr">editor</bdi> و <bdi dir="ltr">inspector</bdi> از <bdi dir="ltr">`aria-label`</bdi> یا <bdi dir="ltr">heading</bdi> استفاده می‌کنند.
- [<bdi dir="ltr">x</bdi>] <bdi dir="ltr">inspector</bdi> و <bdi dir="ltr">note tab</bdi> از <bdi dir="ltr">`role="tablist"` / `role="tab"`</bdi> و <bdi dir="ltr">`aria-selected`</bdi> استفاده می‌کنند.
- [<bdi dir="ltr">x</bdi>] <bdi dir="ltr">status banner</bdi> برای <bdi dir="ltr">error</bdi> از <bdi dir="ltr">`role="status"`</bdi> یا <bdi dir="ltr">`role="alert"`</bdi> استفاده می‌کند. *(تأیید با `check:a11y`)*

## <bdi dir="ltr">Visual</bdi>

- [ ] <bdi dir="ltr">contrast</bdi> متن در <bdi dir="ltr">default dark theme</bdi> مطابق <bdi dir="ltr">WCAG AA</bdi> باشد. *(<bdi dir="ltr">spot-check</bdi> دستی)*
- [<bdi dir="ltr">x</bdi>] <bdi dir="ltr">focus indicator</bdi> در <bdi dir="ltr">`src/index.css`</bdi> تعریف شده است. *(تأیید با `check:a11y`)*
- [<bdi dir="ltr">x</bdi>] <bdi dir="ltr">`prefers-reduced-motion`</bdi> رعایت می‌شود و <bdi dir="ltr">CSS</bdi> برنامه <bdi dir="ltr">animation</bdi> غیرضروری را غیرفعال می‌کند.

## <bdi dir="ltr">Screen reader</bdi> (<bdi dir="ltr">spot check</bdi>)

- [<bdi dir="ltr">x</bdi>] <bdi dir="ltr">vault note count</bdi> و <bdi dir="ltr">index progress</bdi> از <bdi dir="ltr">status region</bdi> اعلام می‌شوند.
- [ ] <bdi dir="ltr">issue count</bdi> در <bdi dir="ltr">Problems tab.</bdi> *(دستی با <bdi dir="ltr">screen reader</bdi>)*
- [<bdi dir="ltr">x</bdi>] <bdi dir="ltr">checkbox</bdi> مربوط به <bdi dir="ltr">diagnostics opt-in</bdi> با “<bdi dir="ltr">Send local crash diagnostics</bdi>” <bdi dir="ltr">label</bdi> شده است.

## ابزارهای خودکار

</div>

<div dir="ltr">

<div dir="ltr">
```powershell
pnpm check:a11y
```
</div>

</div>

<div dir="rtl" lang="fa">

<bdi dir="ltr">static</bdi> <bdi dir="ltr">source check</bdi>ها در <bdi dir="ltr">CI/release gate</bdi> اجرا می‌شوند. برای <bdi dir="ltr">browser coverage:</bdi>

</div>

<div dir="ltr">

<div dir="ltr">
```powershell
pnpm dev --host 127.0.0.1
pnpm check:a11y-axe
pnpm test:visual
```
</div>

</div>

<div dir="rtl" lang="fa">

<bdi dir="ltr">finding</bdi>ها را در <bdi dir="ltr">release PR</bdi> ثبت کنید. <bdi dir="ltr">keyboard trap</bdi>، نام گم‌شده برای <bdi dir="ltr">primary action</bdi>، از دست‌رفتن <bdi dir="ltr">focus</bdi>، <bdi dir="ltr">contrast</bdi> ناخوانا و <bdi dir="ltr">critical/serious axe violation release</bdi> را <bdi dir="ltr">block</bdi> می‌کنند.

## محدودیت‌های شناخته‌شده (<bdi dir="ltr">v0.1</bdi>)

- <bdi dir="ltr">graph</bdi> <bdi dir="ltr">panel</bdi> یک <bdi dir="ltr">keyboard focus surface</bdi> دارد با <bdi dir="ltr">arrow navigation</bdi>، <bdi dir="ltr">Enter activation</bdi>، <bdi dir="ltr">live node summary</bdi> و <bdi dir="ltr">modal focus containment. screen-reader usability pass</bdi> همچنان <bdi dir="ltr">manual release gate</bdi> است.
- <bdi dir="ltr">command palette</bdi> از <bdi dir="ltr">arrow keys</bdi>، <bdi dir="ltr">Enter</bdi> و <bdi dir="ltr">Escape</bdi> پشتیبانی می‌کند (<bdi dir="ltr">`CommandPalette.tsx`</bdi>).

</div>


</div>
