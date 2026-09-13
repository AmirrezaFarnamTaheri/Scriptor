<div dir="ltr" align="center">
[English](TUI_PARITY.md) · **فارسی** · [简体中文](TUI_PARITY.zh-CN.md) · [Русский](TUI_PARITY.ru.md) · [Deutsch](TUI_PARITY.de.md) · [Español](TUI_PARITY.es.md)
</div>

<div dir="rtl" lang="fa" align="right">

<div dir="rtl" lang="fa">

# ماتریس برابری <bdi dir="ltr">TUI</bdi>

[<bdi dir="ltr">English</bdi>](TUI_PARITY.md) · [简体中文](TUI_PARITY.zh-CN.md) · [Русский](TUI_PARITY.ru.md) · [<bdi dir="ltr">Deutsch</bdi>](TUI_PARITY.de.md) · [<bdi dir="ltr">Espa</bdi>ñ<bdi dir="ltr">ol</bdi>](TUI_PARITY.es.md) · **فارسی**

## <bdi dir="ltr">Invariant</bdi>

سطح <bdi dir="ltr">terminal</bdi> باید همان مدل <bdi dir="ltr">local-first</bdi> مربوط به <bdi dir="ltr">vault</bdi> را که <bdi dir="ltr">desktop shell</bdi> استفاده می‌کند ارائه دهد: بازکردن <bdi dir="ltr">vault</bdi>، بررسی <bdi dir="ltr">note</bdi>های <bdi dir="ltr">index</bdi>شده، جست‌وجو، <bdi dir="ltr">preview</bdi>، راهنمای <bdi dir="ltr">export</bdi>، وضعیت <bdi dir="ltr">Git</bdi> و <bdi dir="ltr">health diagnostics</bdi>، بدون اینکه <bdi dir="ltr">backend</bdi> موازی جدیدی ایجاد شود.

## سطح فعلی

- <bdi dir="ltr">`cargo run -p scriptor-cli -- tui <vault>`</bdi>
  - مرورگر <bdi dir="ltr">note</bdi> با رویکرد <bdi dir="ltr">keyboard-first</bdi> و <bdi dir="ltr">rendering</bdi> پاک‌سازی‌شده بر اساس <bdi dir="ltr">grapheme width</bdi>
  - ورود به جست‌وجوی <bdi dir="ltr">incremental</bdi> با <bdi dir="ltr">`/`</bdi>
  - حالت‌های <bdi dir="ltr">pane</bdi> راست: <bdi dir="ltr">preview</bdi> با <bdi dir="ltr">`p`</bdi>، <bdi dir="ltr">backlinks</bdi> با <bdi dir="ltr">`b`</bdi>، <bdi dir="ltr">graph</bdi> با <bdi dir="ltr">`g`</bdi> و <bdi dir="ltr">health</bdi> با <bdi dir="ltr">`h`</bdi>؛ جابه‌جایی با <bdi dir="ltr">`Tab`</bdi>
  - <bdi dir="ltr">preview</bdi> غنی <bdi dir="ltr">Markdown</bdi> با <bdi dir="ltr">terminal renderer</bdi> مربوط به <bdi dir="ltr">pulldown-cmark</bdi>
  - <bdi dir="ltr">scroll pane</bdi> با <bdi dir="ltr">`PgUp` / `PgDn`</bdi>؛ <bdi dir="ltr">overlay</bdi> راهنما با <bdi dir="ltr">`?`</bdi>
  - <bdi dir="ltr">footer</bdi>، <bdi dir="ltr">Git branch/cleanliness</bdi> و تعداد <bdi dir="ltr">health issue</bdi>ها را نمایش می‌دهد
  - <bdi dir="ltr">backend</bdi> درون‌فرایندی با <bdi dir="ltr">`scriptor-vault` + `scriptor-indexer` + `scriptor-native-git`</bdi>

- <bdi dir="ltr">`cargo run -p scriptor-cli -- tui <vault> --via-daemon`</bdi>
  - همان <bdi dir="ltr">UX</bdi> که از <bdi dir="ltr">RPC</bdi> مربوط به <bdi dir="ltr">`scriptor-daemon`</bdi> عبور می‌کند: <bdi dir="ltr">OpenVault</bdi>، <bdi dir="ltr">ListNotes</bdi>، <bdi dir="ltr">SearchNotes</bdi>، <bdi dir="ltr">ReadNote</bdi>، <bdi dir="ltr">GitStatus</bdi>، <bdi dir="ltr">HealthDiagnostics</bdi>، <bdi dir="ltr">Backlinks</bdi> و <bdi dir="ltr">GraphSummary</bdi>

- <bdi dir="ltr">`cargo run -p scriptor-cli -- tui <vault> --smoke-test`</bdi>
  - <bdi dir="ltr">validation</bdi> غیرتعاملی: بازشدن <bdi dir="ltr">vault</bdi>، <bdi dir="ltr">index</bdi>، کشف <bdi dir="ltr">note</bdi>، همه حالت‌های <bdi dir="ltr">pane</bdi> و بارگذاری <bdi dir="ltr">preview</bdi>

## نگاشت <bdi dir="ltr">Desktop</bdi> / <bdi dir="ltr">Terminal</bdi>

| قابلیت | <bdi dir="ltr">Desktop</bdi> | <bdi dir="ltr">TUI</bdi> | استفاده مجدد از <bdi dir="ltr">Backend</bdi> |
|---|---|---|---|
| بازکردن <bdi dir="ltr">vault</bdi> | <bdi dir="ltr">`vault_open`</bdi> | <bdi dir="ltr">`tui`</bdi> | <bdi dir="ltr">`scriptor-vault::open_vault`</bdi> |
| <bdi dir="ltr">rebuild index</bdi> | <bdi dir="ltr">automatic</bdi> / <bdi dir="ltr">command</bdi> | <bdi dir="ltr">startup</bdi> | <bdi dir="ltr">`scriptor-indexer::rebuild_index`</bdi> |
| مرور <bdi dir="ltr">note</bdi>ها | <bdi dir="ltr">sidebar</bdi> | <bdi dir="ltr">left list pane</bdi> | <bdi dir="ltr">`list_note_summaries`</bdi> |
| جست‌وجوی <bdi dir="ltr">note</bdi> | <bdi dir="ltr">sidebar</bdi> + <bdi dir="ltr">dock</bdi> | <bdi dir="ltr">query mode</bdi> با <bdi dir="ltr">`/`</bdi> | <bdi dir="ltr">`search_notes`</bdi> |
| خواندن <bdi dir="ltr">note</bdi> | <bdi dir="ltr">editor/preview</bdi> | <bdi dir="ltr">preview pane</bdi> با <bdi dir="ltr">`p`</bdi> | <bdi dir="ltr">`read_note`</bdi> |
| <bdi dir="ltr">export note</bdi> | <bdi dir="ltr">export profiles</bdi> | <bdi dir="ltr">CLI hint</bdi> در <bdi dir="ltr">health pane</bdi> | <bdi dir="ltr">`scriptor export`</bdi> <bdi dir="ltr">command</bdi> |
| وضعیت <bdi dir="ltr">Git</bdi> | <bdi dir="ltr">Git panel</bdi> | <bdi dir="ltr">footer</bdi> + <bdi dir="ltr">refresh</bdi> با <bdi dir="ltr">`r`</bdi> | <bdi dir="ltr">`scriptor-native-git::git_status`</bdi> |
| <bdi dir="ltr">Diagnostics</bdi> | <bdi dir="ltr">dock</bdi> / <bdi dir="ltr">panels</bdi> | <bdi dir="ltr">health pane</bdi> با <bdi dir="ltr">`h`</bdi> | <bdi dir="ltr">`health_diagnostics_json`</bdi> |
| <bdi dir="ltr">Backlinks</bdi> | <bdi dir="ltr">inspector</bdi> | <bdi dir="ltr">backlinks pane</bdi> با <bdi dir="ltr">`b`</bdi> | <bdi dir="ltr">`backlinks_for_path`</bdi> |
| <bdi dir="ltr">Graph summary</bdi> | <bdi dir="ltr">graph panel</bdi> | <bdi dir="ltr">graph pane</bdi> با <bdi dir="ltr">`g`</bdi> | <bdi dir="ltr">`query_focused_graph`</bdi> |

## اعتبارسنجی

- <bdi dir="ltr">Unit:</bdi> تست‌های <bdi dir="ltr">grapheme</bdi> مربوط به <bdi dir="ltr">`safe_fit`</bdi> و <bdi dir="ltr">assertion</bdi> شبیه <bdi dir="ltr">snapshot</bdi> با نام <bdi dir="ltr">`footer_includes_git_and_health_slots`</bdi>
- <bdi dir="ltr">Smoke:</bdi> <bdi dir="ltr">`pnpm check:tui`</bdi> و <bdi dir="ltr">`pnpm check:daemon`</bdi> برای <bdi dir="ltr">TUI</bdi> از مسیر <bdi dir="ltr">daemon</bdi>
- <bdi dir="ltr">CI: TUI smoke</bdi> و <bdi dir="ltr">unit test</bdi>های <bdi dir="ltr">daemon IPC</bdi> در <bdi dir="ltr">`validate-frontend`</bdi>

</div>


</div>
