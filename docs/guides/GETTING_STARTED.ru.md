# Начало работы со Scriptor

[English](GETTING_STARTED.md) · [فارسی](GETTING_STARTED.fa.md) · [简体中文](GETTING_STARTED.zh-CN.md) · **Русский** · [Deutsch](GETTING_STARTED.de.md) · [Español](GETTING_STARTED.es.md)

Scriptor — local-first рабочее пространство знаний на Markdown. В этом руководстве описаны установка, открытие первого vault и основные ежедневные рабочие процессы.

Для **сборки из исходного кода** см. раздел **Build from source** в [`README.ru.md`](../../README.ru.md).

## Установка

Загрузите последнюю версию для своей платформы со страницы [GitHub Releases](https://github.com/AmirrezaFarnamTaheri/Scriptor/releases):

| Платформа | Форматы |
|---|---|
| Windows | MSI или NSIS installer |
| macOS | DMG |
| Linux | DEB или AppImage |

Production-инсталляторы намеренно выпускаются без подписи. Полный процесс проверки описан в [`docs/RELEASE-SECURITY.ru.md`](../RELEASE-SECURITY.ru.md).

## Открытие vault

1. Запустите **Scriptor**.
2. Выберите **Open Vault** и любую папку с Markdown-заметками.
3. Scriptor индексирует vault в фоне — собственная закрытая база данных не требуется.

Файлы остаются обычным Markdown на диске. Scriptor читает и записывает их напрямую.

### Настройка vault

Настройки находятся в `.scriptor/config.json`. Snippets, профили экспорта и манифесты plugins также расположены под `.scriptor/`.

## Рабочее пространство

| Область | Назначение |
|---|---|
| **Боковая панель vault** | Просмотр, поиск и фильтрация заметок; создание ежедневных заметок и шаблонов |
| **Editor** | Работа в режимах Source, Split или Preview с Monaco или CodeMirror |
| **Inspector rail** | Структура, ссылки, backlinks, цитаты, здоровье заметки и профили экспорта |
| **Status dock** | Лог вывода, результаты поиска, диагностика и фоновые jobs |

Используйте режимы workspace в верхней панели — **Writing**, **Knowledge**, **Publish**, **Review**, **Automation** — чтобы адаптировать toolbar и command palette к текущей задаче.

## Основные рабочие процессы

| Задача | Desktop | Terminal (`scriptor tui`) |
|---|---|---|
| Просмотр заметок | Боковая панель vault | `j` / `k` |
| Поиск | Поиск в боковой панели или `Ctrl+K` | `/`, затем запрос |
| Command palette | `Ctrl+K` или поиск сверху | — |
| Preview | Режим **Split** или **Preview** | `p` |
| Backlinks | Inspector rail | `b` |
| Graph | Кнопка **Graph** (клавиатура: стрелки, Enter, Escape) | `g` |
| Здоровье vault | **Note Health** или Settings | `h` |
| Экспорт | Профили экспорта Inspector или **Publish** | `scriptor export` |
| Git status | Индикатор Git сверху | — |
| Разрешение конфликтов | Трёхсторонний интерфейс с base-колонкой | — |
| Горячие клавиши | Settings → Keyboard Shortcuts | — |
| Плановые backup | Settings → Vault Snapshots | — |

## Настройка экспорта

Scriptor экспортирует через [Pandoc](https://pandoc.org/). Установите Pandoc для реального экспорта в HTML, PDF, DOCX, LaTeX, ePub и Reveal.js:

```powershell
# Windows
winget install --id JohnMacFarlane.Pandoc

# macOS
brew install pandoc
```

Dry-run preview экспорта работает без Pandoc. Обнаружение, overrides и устранение неполадок описаны в [`docs/release/PANDOC_STRATEGY.ru.md`](../release/PANDOC_STRATEGY.ru.md).

## Опционально: headless engine

Включите **Settings → Headless engine**, чтобы индексирование, поиск, backlinks, graph, Git status и export jobs выполнялись через локальный daemon. Открытие vault и canvas остаются in-process ради отзывчивости. См. [`docs/architecture/IPC_DAEMON.ru.md`](../architecture/IPC_DAEMON.ru.md).

## Дополнительные материалы

- [`docs/CAPABILITIES.ru.md`](../CAPABILITIES.ru.md) — полная карта возможностей
- [`docs/contracts/COMMAND_CATALOG.ru.md`](../contracts/COMMAND_CATALOG.ru.md) — команды Tauri, daemon и CLI
- [`docs/architecture/PLUGIN_SYSTEM.ru.md`](../architecture/PLUGIN_SYSTEM.ru.md) — plugins и marketplace
- [`docs/plugins/AUTHOR_GUIDE.ru.md`](../plugins/AUTHOR_GUIDE.ru.md) — руководство автора plugin и hello-world
- [`DESIGN.ru.md`](../../DESIGN.ru.md) — поверхность editor, design system и accessibility contract
- [`docs/design/DESIGN_SYSTEM.ru.md`](../design/DESIGN_SYSTEM.ru.md) — токены визуальной системы
- [`docs/brand/BRAND.md`](../brand/BRAND.md) — логотип и wordmark
- [`docs/assets/screenshots/README.ru.md`](../assets/screenshots/README.ru.md) — повторная генерация UI screenshots
