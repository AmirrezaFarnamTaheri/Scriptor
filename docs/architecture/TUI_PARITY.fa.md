<div dir="ltr" align="center">
[English](TUI_PARITY.md) · **فارسی** · [简体中文](TUI_PARITY.zh-CN.md) · [Русский](TUI_PARITY.ru.md) · [Deutsch](TUI_PARITY.de.md) · [Español](TUI_PARITY.es.md)
</div>

<div dir="rtl" lang="fa" align="right">

<div dir="rtl" lang="fa">

# ماتریس برابری TUI

[English](TUI_PARITY.md) · [简体中文](TUI_PARITY.zh-CN.md) · [Русский](TUI_PARITY.ru.md) · [Deutsch](TUI_PARITY.de.md) · [Español](TUI_PARITY.es.md) · **فارسی**

## Invariant

سطح terminal باید همان مدل local-first مربوط به vault را که desktop shell استفاده می‌کند ارائه دهد: بازکردن vault، بررسی noteهای indexشده، جست‌وجو، preview، راهنمای export، وضعیت Git و health diagnostics، بدون اینکه backend موازی جدیدی ایجاد شود.

## سطح فعلی

- <bdi dir="ltr">`cargo run -p scriptor-cli -- tui <vault>`</bdi>
  - مرورگر note با رویکرد keyboard-first و rendering پاک‌سازی‌شده بر اساس grapheme width
  - ورود به جست‌وجوی incremental با <bdi dir="ltr">`/`</bdi>
  - حالت‌های pane راست: preview با <bdi dir="ltr">`p`</bdi>، backlinks با <bdi dir="ltr">`b`</bdi>، graph با <bdi dir="ltr">`g`</bdi> و health با <bdi dir="ltr">`h`</bdi>؛ جابه‌جایی با <bdi dir="ltr">`Tab`</bdi>
  - preview غنی Markdown با terminal renderer مربوط به pulldown-cmark
  - scroll pane با <bdi dir="ltr">`PgUp` / `PgDn`</bdi>؛ overlay راهنما با <bdi dir="ltr">`?`</bdi>
  - footer، Git branch/cleanliness و تعداد health issueها را نمایش می‌دهد
  - backend درون‌فرایندی با <bdi dir="ltr">`scriptor-vault` + `scriptor-indexer` + `scriptor-native-git`</bdi>

- <bdi dir="ltr">`cargo run -p scriptor-cli -- tui <vault> --via-daemon`</bdi>
  - همان UX که از RPC مربوط به <bdi dir="ltr">`scriptor-daemon`</bdi> عبور می‌کند: OpenVault، ListNotes، SearchNotes، ReadNote، GitStatus، HealthDiagnostics، Backlinks و GraphSummary

- <bdi dir="ltr">`cargo run -p scriptor-cli -- tui <vault> --smoke-test`</bdi>
  - validation غیرتعاملی: بازشدن vault، index، کشف note، همه حالت‌های pane و بارگذاری preview

## نگاشت Desktop / Terminal

| قابلیت | Desktop | TUI | استفاده مجدد از Backend |
|---|---|---|---|
| بازکردن vault | <bdi dir="ltr">`vault_open`</bdi> | <bdi dir="ltr">`tui`</bdi> | <bdi dir="ltr">`scriptor-vault::open_vault`</bdi> |
| rebuild index | automatic / command | startup | <bdi dir="ltr">`scriptor-indexer::rebuild_index`</bdi> |
| مرور noteها | sidebar | left list pane | <bdi dir="ltr">`list_note_summaries`</bdi> |
| جست‌وجوی note | sidebar + dock | query mode با <bdi dir="ltr">`/`</bdi> | <bdi dir="ltr">`search_notes`</bdi> |
| خواندن note | editor/preview | preview pane با <bdi dir="ltr">`p`</bdi> | <bdi dir="ltr">`read_note`</bdi> |
| export note | export profiles | CLI hint در health pane | <bdi dir="ltr">`scriptor export`</bdi> command |
| وضعیت Git | Git panel | footer + refresh با <bdi dir="ltr">`r`</bdi> | <bdi dir="ltr">`scriptor-native-git::git_status`</bdi> |
| Diagnostics | dock / panels | health pane با <bdi dir="ltr">`h`</bdi> | <bdi dir="ltr">`health_diagnostics_json`</bdi> |
| Backlinks | inspector | backlinks pane با <bdi dir="ltr">`b`</bdi> | <bdi dir="ltr">`backlinks_for_path`</bdi> |
| Graph summary | graph panel | graph pane با <bdi dir="ltr">`g`</bdi> | <bdi dir="ltr">`query_focused_graph`</bdi> |

## اعتبارسنجی

- Unit: تست‌های grapheme مربوط به <bdi dir="ltr">`safe_fit`</bdi> و assertion شبیه snapshot با نام <bdi dir="ltr">`footer_includes_git_and_health_slots`</bdi>
- Smoke: <bdi dir="ltr">`pnpm check:tui`</bdi> و <bdi dir="ltr">`pnpm check:daemon`</bdi> برای TUI از مسیر daemon
- CI: TUI smoke و unit testهای daemon IPC در <bdi dir="ltr">`validate-frontend`</bdi>

</div>


</div>
