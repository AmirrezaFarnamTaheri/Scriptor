<div dir="rtl" lang="fa">

# نقشه‌های Layout

[English](LAYOUT_BLUEPRINTS.md) · [简体中文](LAYOUT_BLUEPRINTS.zh-CN.md) · [Русский](LAYOUT_BLUEPRINTS.ru.md) · [Deutsch](LAYOUT_BLUEPRINTS.de.md) · [Español](LAYOUT_BLUEPRINTS.es.md) · **فارسی**

قراردادهای ساختاری layout در Scriptor برای form factorهای مختلف.

## Desktop (≥1321px)

</div>

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

<div dir="rtl" lang="fa">

- **Command palette** با <bdi dir="ltr">`Ctrl+K`</bdi> در بالا-وسط overlay می‌شود و navigation اصلی power user است.
- **Graph / Canvas / Settings** به‌صورت glass modal layer با <bdi dir="ltr">`z-index: 60+`</bdi> باز می‌شوند.
- panelها مستقل scroll می‌شوند؛ editor از split preview با drag handle پشتیبانی می‌کند.
- گروه‌های toolbar داخل writing column wrap می‌شوند. یک area محدود vertical scroll جلوی اشغال viewport کوتاه توسط toolbar را می‌گیرد؛ controlها زیر inspector rail نمی‌روند.
- side railها resizable هستند و تا track با عرض صفر collapse می‌شوند. عرض موثر با viewport کم می‌شود تا فضای editor حفظ شود. فرمول مرجع در <bdi dir="ltr">`src/styles/app/foundation.css`</bdi> است.
- هر rail مستقل scroll می‌شود. cardهای note-health/quality متعلق به inspector/preview mode هستند؛ store sectionهای خودش را مستقیم نشان می‌دهد.
- status dock پیش‌فرض collapsed است و preference کاربر را نگه می‌دارد.

## Tablet و Desktop باریک (821px–1320px)

- Vault، editor و inspector کنار هم با عرض rail پویا می‌مانند؛ inspector زیر editor stack نمی‌شود.
- top bar تک‌ردیفه می‌ماند و controlهای کم‌اولویت فضا واگذار می‌کنند. Publish از workspace mode و support از command palette قابل دسترسی است.
- panel کمکی dockشده عرض واقعی خود را در workspace رزرو می‌کند.

## Mobile (≤820px)

</div>

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

<div dir="rtl" lang="fa">

- **Bottom dock** با <bdi dir="ltr">`MobileWorkspaceNav`</bdi> pane اصلی را بدون از دست‌دادن vault context جابه‌جا می‌کند.
- **Command** در viewport باریک palette را به‌صورت sheet متصل به پایین باز می‌کند.
- حداقل touch target برابر 44px و actionهای اصلی در thumb-reach zone هستند.

## Terminal (TUI)

</div>

<div dir="ltr">

```text
┌ Command Surface ────────────────────────────────────────────┐
├ Notes (34%) ──┬── Preview / Backlinks / Graph / Health ───┤
├───────────────┴────────────────────────────────────────────┤
│ Footer: status · git · health · selection · key hints      │
└────────────────────────────────────────────────────────────┘
```

</div>

<div dir="rtl" lang="fa">

- navigation شبیه Vim با <bdi dir="ltr">`j/k`</bdi>؛ جست‌وجو با <bdi dir="ltr">`/`</bdi>؛ help overlay با <bdi dir="ltr">`?`</bdi>.
- <bdi dir="ltr">`PgUp`/`PgDn`</bdi> preview pane را scroll می‌کنند؛ rich Markdown rendering با pulldown-cmark.
- daemon و in-process backend keymap یکسان دارند.

## Z-index stack

| Layer | z-index |
|---|---|
| Workspace grid | 0 |
| Status strip | 10 |
| Mobile dock | 40 |
| Overlays / modals | 60 |
| Command palette | 70 |
| Toasts | 80 |

</div>
