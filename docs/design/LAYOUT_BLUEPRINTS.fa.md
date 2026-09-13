<div dir="ltr" align="center">
[English](LAYOUT_BLUEPRINTS.md) · **فارسی** · [简体中文](LAYOUT_BLUEPRINTS.zh-CN.md) · [Русский](LAYOUT_BLUEPRINTS.ru.md) · [Deutsch](LAYOUT_BLUEPRINTS.de.md) · [Español](LAYOUT_BLUEPRINTS.es.md)
</div>

<div dir="rtl" lang="fa" align="right">

<div dir="rtl" lang="fa">

# نقشه‌های <bdi dir="ltr">Layout</bdi>

[<bdi dir="ltr">English</bdi>](LAYOUT_BLUEPRINTS.md) · [简体中文](LAYOUT_BLUEPRINTS.zh-CN.md) · [Русский](LAYOUT_BLUEPRINTS.ru.md) · [<bdi dir="ltr">Deutsch</bdi>](LAYOUT_BLUEPRINTS.de.md) · [<bdi dir="ltr">Espa</bdi>ñ<bdi dir="ltr">ol</bdi>](LAYOUT_BLUEPRINTS.es.md) · **فارسی**

قراردادهای ساختاری <bdi dir="ltr">layout</bdi> در <bdi dir="ltr">Scriptor</bdi> برای <bdi dir="ltr">form factor</bdi>های مختلف.

## <bdi dir="ltr">Desktop</bdi> (≥1321<bdi dir="ltr">px</bdi>)

</div>

<div dir="ltr">

<div dir="ltr">
```text
┌─────────────────────────────────────────────────────────────┐
│  Topbar (glass): brand · history · command search · actions │
├──────────┬──────────────────────────────┬───────────────────┤
│  Vault   │  Editor workspace           │  Inspector rail   │
│  318px   │  tabs · toolbar · editor    │  408px            │
│  sidebar │  optional split preview     │  plugins/health   │
├──────────┴──────────────────────────────┴───────────────────┤
│  Status strip: jobs · diagnostics · repo state             │
└─────────────────────────────────────────────────────────────┘
```
</div>

</div>

<div dir="rtl" lang="fa">

- **<bdi dir="ltr">Command palette</bdi>** با <bdi dir="ltr">`Ctrl+K`</bdi> در بالا-وسط <bdi dir="ltr">overlay</bdi> می‌شود و <bdi dir="ltr">navigation</bdi> اصلی <bdi dir="ltr">power user</bdi> است.
- **<bdi dir="ltr">Graph</bdi> / <bdi dir="ltr">Canvas</bdi> / <bdi dir="ltr">Settings</bdi>** به‌صورت <bdi dir="ltr">glass modal layer</bdi> با <bdi dir="ltr">`z-index: 60+`</bdi> باز می‌شوند.
- <bdi dir="ltr">panel</bdi>ها مستقل <bdi dir="ltr">scroll</bdi> می‌شوند؛ <bdi dir="ltr">editor</bdi> از <bdi dir="ltr">split preview</bdi> با <bdi dir="ltr">drag handle</bdi> پشتیبانی می‌کند.
- گروه‌های <bdi dir="ltr">toolbar</bdi> داخل <bdi dir="ltr">writing column wrap</bdi> می‌شوند. یک <bdi dir="ltr">area</bdi> محدود <bdi dir="ltr">vertical scroll</bdi> جلوی اشغال <bdi dir="ltr">viewport</bdi> کوتاه توسط <bdi dir="ltr">toolbar</bdi> را می‌گیرد؛ <bdi dir="ltr">control</bdi>ها زیر <bdi dir="ltr">inspector rail</bdi> نمی‌روند.
- <bdi dir="ltr">side rail</bdi>ها <bdi dir="ltr">resizable</bdi> هستند و تا <bdi dir="ltr">track</bdi> با عرض صفر <bdi dir="ltr">collapse</bdi> می‌شوند. عرض موثر با <bdi dir="ltr">viewport</bdi> کم می‌شود تا فضای <bdi dir="ltr">editor</bdi> حفظ شود. فرمول مرجع در <bdi dir="ltr">`src/styles/app/foundation.css`</bdi> است.
- هر <bdi dir="ltr">rail</bdi> مستقل <bdi dir="ltr">scroll</bdi> می‌شود. <bdi dir="ltr">card</bdi>های <bdi dir="ltr">note-health/quality</bdi> متعلق به <bdi dir="ltr">inspector/preview mode</bdi> هستند؛ <bdi dir="ltr">store section</bdi>های خودش را مستقیم نشان می‌دهد.
- <bdi dir="ltr">status</bdi> <bdi dir="ltr">dock</bdi> پیش‌فرض <bdi dir="ltr">collapsed</bdi> است و <bdi dir="ltr">preference</bdi> کاربر را نگه می‌دارد.

## <bdi dir="ltr">Tablet</bdi> و <bdi dir="ltr">Desktop</bdi> باریک (821<bdi dir="ltr">px</bdi>–1320<bdi dir="ltr">px</bdi>)

- <bdi dir="ltr">Vault</bdi>، <bdi dir="ltr">editor</bdi> و <bdi dir="ltr">inspector</bdi> کنار هم با عرض <bdi dir="ltr">rail</bdi> پویا می‌مانند؛ <bdi dir="ltr">inspector</bdi> زیر <bdi dir="ltr">editor stack</bdi> نمی‌شود.
- <bdi dir="ltr">top</bdi> <bdi dir="ltr">bar</bdi> تک‌ردیفه می‌ماند و <bdi dir="ltr">control</bdi>های کم‌اولویت فضا واگذار می‌کنند. <bdi dir="ltr">Publish</bdi> از <bdi dir="ltr">workspace mode</bdi> و <bdi dir="ltr">support</bdi> از <bdi dir="ltr">command palette</bdi> قابل دسترسی است.
- <bdi dir="ltr">panel</bdi> کمکی <bdi dir="ltr">dock</bdi>شده عرض واقعی خود را در <bdi dir="ltr">workspace</bdi> رزرو می‌کند.

## <bdi dir="ltr">Mobile</bdi> (≤820<bdi dir="ltr">px</bdi>)

</div>

<div dir="ltr">

<div dir="ltr">
```text
┌─────────────────────────┐
│  Compact topbar         │
├─────────────────────────┤
│  Active workspace pane  │
│  vault OR editor OR     │
│  inspector — one at a   │
│  time via bottom nav    │
├─────────────────────────┤
│  Mobile bottom dock     │
│  Vault · Write · Lens · │
│  Command                │
└─────────────────────────┘
```
</div>

</div>

<div dir="rtl" lang="fa">

- **<bdi dir="ltr">Bottom dock</bdi>** با <bdi dir="ltr">`MobileWorkspaceNav`</bdi> <bdi dir="ltr">pane</bdi> اصلی را بدون از دست‌دادن <bdi dir="ltr">vault context</bdi> جابه‌جا می‌کند.
- **<bdi dir="ltr">Command</bdi>** در <bdi dir="ltr">viewport</bdi> باریک <bdi dir="ltr">palette</bdi> را به‌صورت <bdi dir="ltr">sheet</bdi> متصل به پایین باز می‌کند.
- حداقل <bdi dir="ltr">touch target</bdi> برابر 44<bdi dir="ltr">px</bdi> و <bdi dir="ltr">action</bdi>های اصلی در <bdi dir="ltr">thumb-reach zone</bdi> هستند.

## <bdi dir="ltr">Terminal</bdi> (<bdi dir="ltr">TUI</bdi>)

</div>

<div dir="ltr">

<div dir="ltr">
```text
┌ Command Surface ────────────────────────────────────────────┐
├ Notes (34%) ──┬── Preview / Backlinks / Graph / Health ───┤
├───────────────┴────────────────────────────────────────────┤
│ Footer: status · git · health · selection · key hints      │
└────────────────────────────────────────────────────────────┘
```
</div>

</div>

<div dir="rtl" lang="fa">

- <bdi dir="ltr">navigation</bdi> شبیه <bdi dir="ltr">Vim</bdi> با <bdi dir="ltr">`j/k`</bdi>؛ جست‌وجو با <bdi dir="ltr">`/`</bdi>؛ <bdi dir="ltr">help overlay</bdi> با <bdi dir="ltr">`?`</bdi>.
- <bdi dir="ltr">`PgUp`/`PgDn`</bdi> <bdi dir="ltr">preview pane</bdi> را <bdi dir="ltr">scroll</bdi> می‌کنند؛ <bdi dir="ltr">rich Markdown rendering</bdi> با <bdi dir="ltr">pulldown-cmark.</bdi>
- <bdi dir="ltr">daemon</bdi> و <bdi dir="ltr">in-process backend keymap</bdi> یکسان دارند.

## <bdi dir="ltr">Z-index stack</bdi>

| <bdi dir="ltr">Layer</bdi> | <bdi dir="ltr">z-index</bdi> |
|---|---|
| <bdi dir="ltr">Workspace grid</bdi> | 0 |
| <bdi dir="ltr">Status strip</bdi> | 10 |
| <bdi dir="ltr">Mobile dock</bdi> | 40 |
| <bdi dir="ltr">Overlays</bdi> / <bdi dir="ltr">modals</bdi> | 60 |
| <bdi dir="ltr">Command palette</bdi> | 70 |
| <bdi dir="ltr">Toasts</bdi> | 80 |

</div>


</div>
