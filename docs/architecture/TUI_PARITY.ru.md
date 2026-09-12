# Матрица паритета TUI

[English](TUI_PARITY.md) · [简体中文](TUI_PARITY.zh-CN.md) · **Русский** · [Deutsch](TUI_PARITY.de.md) · [Español](TUI_PARITY.es.md) · [فارسی](TUI_PARITY.fa.md)

## Инвариант

Терминальная поверхность должна предоставлять ту же local-first модель vault, что и desktop shell: открытие vault, просмотр индексированных заметок, поиск, preview, подсказки экспорта, состояние Git и health diagnostics — без отдельного параллельного backend.

## Текущая поверхность

- `cargo run -p scriptor-cli -- tui <vault>`
  - Keyboard-first браузер заметок с рендерингом, нормализованным по ширине grapheme
  - Инкрементальный поиск через `/`
  - Режимы правой панели: preview (`p`), backlinks (`b`), graph (`g`), health (`h`); переключение `Tab`
  - Rich Markdown preview через terminal renderer pulldown-cmark
  - Прокрутка панели `PgUp` / `PgDn`; overlay справки по `?`
  - Footer показывает Git branch/cleanliness и число health issues
  - In-process backend через `scriptor-vault` + `scriptor-indexer` + `scriptor-native-git`

- `cargo run -p scriptor-cli -- tui <vault> --via-daemon`
  - Тот же UX, маршрутизируемый через RPC `scriptor-daemon` (OpenVault, ListNotes, SearchNotes, ReadNote, GitStatus, HealthDiagnostics, Backlinks, GraphSummary)

- `cargo run -p scriptor-cli -- tui <vault> --smoke-test`
  - Неинтерактивная проверка: открытие vault, индекс, обнаружение заметок, все режимы панелей, загрузка preview

## Соответствие Desktop / Terminal

| Возможность | Desktop | TUI | Повторное использование backend |
|---|---|---|---|
| Открыть vault | `vault_open` | `tui` | `scriptor-vault::open_vault` |
| Перестроить index | automatic / command | startup | `scriptor-indexer::rebuild_index` |
| Просмотр заметок | sidebar | left list pane | `list_note_summaries` |
| Поиск заметок | sidebar + dock | `/` query mode | `search_notes` |
| Чтение заметки | editor/preview | preview pane (`p`) | `read_note` |
| Экспорт заметки | export profiles | подсказка CLI в health pane | `scriptor export` command |
| Состояние Git | Git panel | footer + `r` refresh | `scriptor-native-git::git_status` |
| Diagnostics | dock / panels | health pane (`h`) | `health_diagnostics_json` |
| Backlinks | inspector | backlinks pane (`b`) | `backlinks_for_path` |
| Graph summary | graph panel | graph pane (`g`) | `query_focused_graph` |

## Проверка

- Unit: grapheme-тесты `safe_fit`, snapshot-style assertion `footer_includes_git_and_health_slots`
- Smoke: `pnpm check:tui`, `pnpm check:daemon` (TUI через daemon)
- CI: TUI smoke + daemon IPC unit tests в `validate-frontend`
