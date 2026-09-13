<div align="center">

# Scriptor

**Локальное Markdown-пространство для серьёзной работы с текстами и исследованиями.**

[English](README.md) · [فارسی](README.fa.md) · [简体中文](README.zh-CN.md) · **Русский** · [Deutsch](README.de.md) · [Español](README.es.md)

[![Version](https://img.shields.io/badge/version-1.0.9-0f766e.svg)](VERSION)
[![License: AGPL-3.0-or-later](https://img.shields.io/badge/license-AGPL--3.0--or--later-0f766e.svg)](LICENSE)
[![Platforms](https://img.shields.io/badge/platforms-Windows%20%7C%20macOS%20%7C%20Linux-0f766e.svg)](#download)
[![Stack](https://img.shields.io/badge/stack-Tauri%202%20%C2%B7%20React%2019%20%C2%B7%20Rust%201.96-0f766e.svg)](#tech-stack)
[![CI](https://img.shields.io/github/actions/workflow/status/AmirrezaFarnamTaheri/Scriptor/ci.yml?branch=main&label=CI)](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/workflows/ci.yml)

Ваши заметки остаются обычными файлами Markdown. Scriptor добавляет редактирование, обратные ссылки, цитирование, историю версий, публикацию и автоматизацию с явными границами полномочий.

[Скачать](#download) · [Начало работы](docs/guides/GETTING_STARTED.ru.md) · [Возможности](docs/CAPABILITIES.ru.md) · [Разработка плагинов](docs/plugins/AUTHOR_GUIDE.ru.md) · [Участие в проекте](CONTRIBUTING.ru.md)

</div>

![Рабочее пространство Scriptor: редактор, отрисованный предпросмотр, инспектор и компактная строка состояния](docs/assets/screenshots/workspace-light.png)

## О продукте

Scriptor открывает папку с Markdown-файлами и добавляет поиск, обратные ссылки, историю, предпросмотр и проверки состояния. Markdown остаётся единственным источником истины, поэтому любая заметка по-прежнему читается в других редакторах.

Scriptor рассчитан на долгосрочные проекты: книги, диссертации, техническую документацию, исследовательские коллекции и поддерживаемые базы знаний. Оболочка Tauri отвечает за настольный интерфейс, а сервисы на Rust — за доступ к хранилищу, индексацию, Git, экспорт и локальный IPC.

| Работа с материалом | Что даёт Scriptor |
|---|---|
| **Писать и редактировать** | Исходный, разделённый и отрисованный режимы; навигация по структуре; сниппеты; настраиваемый редактор; история заметок |
| **Выстраивать доказательную базу** | Wikilinks, обратные ссылки, цитаты, исследование графа, проверки состояния и исправление неразрешённых ссылок |
| **Публиковать воспроизводимо** | Именованные профили Pandoc для HTML, PDF, DOCX, LaTeX, ePub и Reveal.js |
| **Автоматизировать с чёткими границами** | Git-aware workflow, аудируемые инструменты MCP, плагины с разрешениями и локальный daemon |

## Scriptor в работе

| Работа с исходным текстом и предпросмотром | Анализ структуры и качества заметки |
|---|---|
| ![Редактор и предпросмотр](docs/assets/screenshots/editor-preview.png) | ![Предпросмотр инспектора](docs/assets/screenshots/inspector-preview.png) |

| Исследование связей | Исправление и организация хранилища |
|---|---|
| ![Граф](docs/assets/screenshots/graph.png) | ![Рабочая панель знаний](docs/assets/screenshots/knowledge-workbench.png) |

| Расширение рабочего пространства | Публикация через именованные профили |
|---|---|
| ![Каталог плагинов](docs/assets/screenshots/plugins.png) | ![Центр публикации](docs/assets/screenshots/publish-center.png) |

[Каталог скриншотов](docs/assets/screenshots/README.ru.md) также показывает тёмную тему, Git, разрешение конфликтов, палитру команд, MCP, настройки, состояние хранилища, историю заметок, горячие клавиши, onboarding и компактные макеты. Скрипт захвата ждёт полной загрузки данных и панелей и завершает работу с ошибкой, если экран остаётся в состоянии загрузки или деградации.

## Возможности

- **Письмо** — CodeMirror 6 по умолчанию с возможностью выбрать Monaco; раздельный и preview-режимы; панель форматирования; сниппеты; режим без отвлечений; редактор сочетаний клавиш
- **Организация** — виртуализированное дерево хранилища, inbox, ежедневные заметки, типы заметок, шаблоны и сохранённые представления
- **Связи** — Wikilinks, обратные ссылки, граф знаний с навигацией с клавиатуры, рабочая панель знаний и исправление неразрешённых ссылок
- **Цитирование** — стили CSL, встроенные ссылки `[@key]`, предпросмотр библиографии и локальные файлы библиографии
- **Публикация** — профили экспорта Pandoc для HTML, PDF, DOCX, LaTeX, ePub и Reveal.js, а также локальная публикация Starlight
- **Автоматизация** — Git с трёхсторонним разрешением конфликтов, 22 инструмента MCP с хеш-цепочкой аудита изменений в JSONL, каталог плагинов с безопасным режимом и headless-daemon с tracing
- **Визуализация** — Canvas-доски с ленивой загрузкой и выносом `resvg` в worker, а также быстрый захват через Portal
- **Эксплуатация** — палитра команд, режимы рабочего пространства, панель состояния хранилища, терминальный интерфейс и запланированные снимки
- **Проверка орфографии** — многоязычный Hunspell и необязательная интеграция LanguageTool

Актуальный статус выпущенных, экспериментальных и находящихся только на этапе дизайна возможностей см. в [`docs/CAPABILITY-MATURITY.ru.md`](docs/CAPABILITY-MATURITY.ru.md).

<a id="download"></a>
## Скачать Scriptor

Продакшен-установщики публикуются как артефакты GitHub Release. Текущая версия — **1.0.9**.

- **Windows x86_64** — `.msi` и `.exe` (NSIS)
- **macOS Apple Silicon (aarch64)** — `.dmg`
- **Linux x86_64 и ARM64** — `.deb` и `.AppImage`

> **Статус доверия.** Официальные upstream-установщики намеренно распространяются **без цифровой подписи**. Релизы содержат контрольные суммы SHA-256, SBOM в формате CycloneDX, release receipt, доказательства идентичности исходного кода и GitHub provenance attestations. Перед установкой выполните полный процесс проверки из [`docs/RELEASE-SECURITY.ru.md`](docs/RELEASE-SECURITY.ru.md).

[Скачать последнюю версию](https://github.com/AmirrezaFarnamTaheri/Scriptor/releases) или [собрать из исходного кода](#build-from-source).

<a id="tech-stack"></a>
## Технологический стек

- **Оболочка desktop-приложения** — Tauri 2
- **Renderer** — React 19, Vite 8, TypeScript 6, Lucide React
- **Ядро** — workspace Rust 1.96 (Edition 2024) с crate'ами (`vault`, `indexer`, `native-git`, `daemon`, `ipc`, `system-bridge`, `export-runner`, `publish-runner`, `canvas-engine`, `cli`, `embeddings`, `tantivy-indexer`, `citation-engine`, `wasm-runtime`, `capture`)
- **Хранение данных** — SQLite WAL + FTS5 в ядре хранилища
- **IPC** — локальный RPC с postcard-framing и HMAC-аутентификацией (`scriptor-ipc` → `scriptor-daemon`)
- **Контракты** — TypeScript-типы, генерируемые из Rust через `ts-rs`
- **Стили** — семантические CSS custom properties; без Tailwind и удалённых шрифтов
- **Редактор** — CodeMirror 6 по умолчанию; Monaco — расширенная, но не стандартная опция

<a id="build-from-source"></a>
## Сборка из исходного кода

### Требования

- Node.js `22.16.0` (engines: `>=22.12.0`)
- pnpm `10.33.0` (управляется Corepack)
- Rust `1.96.0` через `rustup`, компоненты `rustfmt` и `clippy`
- PowerShell 7 (`pwsh`) для release-, container- и benchmark-скриптов
- платформенные зависимости Tauri 2 для вашей ОС

### Первый запуск

```powershell
corepack enable
corepack prepare pnpm@10.33.0 --activate
pnpm install --frozen-lockfile
rustup toolchain install 1.96.0 --profile minimal --component rustfmt --component clippy
rustup default 1.96.0
```

### Запуск

```powershell
pnpm web:dev          # только web-оболочка (разработка и визуальные тесты)
pnpm desktop:dev      # desktop-оболочка Tauri
```

### Проверка

Быстрые проверки, встроенные в репозиторий:

```powershell
pnpm version:check
pnpm lint:actions
pnpm lint:boundaries
pnpm check:i18n
pnpm check:docs
pnpm check:source
pnpm check:frontend-quality
```

Полный release gate:

```powershell
pnpm install --frozen-lockfile
pnpm lint
pnpm build
pnpm check:release
cargo fmt --all --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
```

`pnpm check:release` запускает contract runners, Rust-тесты, E2E- и визуальные наборы Playwright, аудиты доступности, smoke-тесты daemon и TUI, а также performance gates. Упаковка и проверка release evidence описаны в [`scripts/release/README.md`](scripts/release/README.md).

## Архитектура

Актуальная runtime-топология, границы доверия и владение crate'ами описаны в [`docs/ARCHITECTURE.ru.md`](docs/ARCHITECTURE.ru.md). Диаграммы Container и Context находятся в [`docs/architecture/c4-container.ru.md`](docs/architecture/c4-container.ru.md) и [`docs/architecture/c4-context.ru.md`](docs/architecture/c4-context.ru.md).

| Уровень | Точки входа |
|---|---|
| Desktop | `apps/desktop/src-tauri/src/lib.rs`, `src/App.tsx` |
| Vault | `crates/vault/src/lib.rs` |
| Index / search / graph | `crates/indexer/src/lib.rs` |
| Daemon IPC | `crates/daemon/src/lib.rs`, `crates/ipc/src/lib.rs` |
| Git | `crates/native-git/src/lib.rs` |
| External tools | `crates/system-bridge/src/process.rs` |
| Frontend packages | `packages/*/src/index.ts` |

## Принципы

- **Local-first.** Markdown остаётся источником истины и сохраняет переносимость.
- **Явные полномочия.** Разрушительные операции, работа с секретами, сетью, процессами, резервными копиями и публикацией требуют ограниченной и явно выданной авторизации.
- **Ограниченный объём работы.** Сканирование, обходы графа, очереди событий, вывод subprocess, логи и audit tails имеют явные пределы.
- **Восстанавливаемые изменения.** Git commit'ы изолируют индекс, записи MCP используют пары intent/outcome, а restore проверяет manifest перед окончательной заменой.
- **Один контракт на границу.** Определения Rust IPC генерируют TypeScript-контракты; runtime JSON проверяется до использования.
- **Честное описание зрелости.** Реализованные, экспериментальные и design-only возможности документируются отдельно в [`docs/CAPABILITY-MATURITY.ru.md`](docs/CAPABILITY-MATURITY.ru.md).

## Документация

| Для кого | С чего начать |
|---|---|
| Новый пользователь | [`docs/guides/GETTING_STARTED.ru.md`](docs/guides/GETTING_STARTED.ru.md) |
| Интерес к возможностям | [`docs/CAPABILITIES.ru.md`](docs/CAPABILITIES.ru.md) и [`docs/CAPABILITY-MATURITY.ru.md`](docs/CAPABILITY-MATURITY.ru.md) |
| Автор плагина | [`docs/plugins/AUTHOR_GUIDE.ru.md`](docs/plugins/AUTHOR_GUIDE.ru.md) |
| Участник проекта | [`CONTRIBUTING.ru.md`](CONTRIBUTING.ru.md) и [`AGENTS.md`](AGENTS.md) |
| Исследователь безопасности | [`SECURITY.ru.md`](SECURITY.ru.md) и [`docs/ENCRYPTION-THREAT-MODEL.ru.md`](docs/ENCRYPTION-THREAT-MODEL.ru.md) |
| Release manager | [`docs/RELEASE-CHECKLIST.ru.md`](docs/RELEASE-CHECKLIST.ru.md) и [`docs/RELEASE-SECURITY.ru.md`](docs/RELEASE-SECURITY.ru.md) |
| Архитектор | [`docs/ARCHITECTURE.ru.md`](docs/ARCHITECTURE.ru.md) и [`docs/architecture/`](docs/architecture/) |
| Аудитор | [`docs/_archived/AUDIT-2026-08-23.md`](docs/_archived/AUDIT-2026-08-23.md) и [`docs/FINAL-REMEDIATION-REPORT.ru.md`](docs/FINAL-REMEDIATION-REPORT.ru.md) |

Полный индекс: [`docs/README.ru.md`](docs/README.ru.md).

## Поддержка

- **Issues** — <https://github.com/AmirrezaFarnamTaheri/Scriptor/issues>
- **Email** — Amirreza "Farnam" Taheri, [taherifarnam@gmail.com](mailto:taherifarnam@gmail.com)
- **Безопасность** — следуйте [`SECURITY.ru.md`](SECURITY.ru.md); не создавайте публичные issue для сообщений об уязвимостях

## Участие в проекте

Scriptor приветствует вклад сообщества. Полный workflow, требования к участникам и обязательные verification gates описаны в [`CONTRIBUTING.ru.md`](CONTRIBUTING.ru.md). Перед открытием pull request:

1. Прочитайте [`PRODUCT.ru.md`](PRODUCT.ru.md), [`DESIGN.ru.md`](DESIGN.ru.md), [`docs/ARCHITECTURE.ru.md`](docs/ARCHITECTURE.ru.md) и [`docs/CAPABILITY-MATURITY.ru.md`](docs/CAPABILITY-MATURITY.ru.md).
2. Когда это возможно, сначала добавьте поведенческий тест, который до исправления падает.
3. Запустите полный список проверок выше; каждый gate должен пройти на одном и том же точном commit.
4. Вместе с изменением обновите [`CHANGELOG.md`](CHANGELOG.md) и затронутую документацию.

## Статус проекта

**Активная разработка.** `v1.0.9` — текущий кандидат на production-релиз. Desktop, vault, indexer, knowledge, Git, export, daemon и web-поверхности реализованы и поставляются. Реестр возможностей в [`docs/CAPABILITY-MATURITY.ru.md`](docs/CAPABILITY-MATURITY.ru.md) является авторитетным источником статуса: поддерживается, экспериментально или только спроектировано. Mobile, зашифрованные vault'ы, локальные embeddings, Tantivy и WASM host остаются экспериментальными или design-only.

## Лицензия

Scriptor распространяется по лицензии **GNU AGPL-3.0-or-later**. Коммерческое использование разрешено при соблюдении её условий. Организации, которые не хотят выполнять требования AGPL, могут запросить отдельную коммерческую лицензию; см. [`COMMERCIAL-LICENSING.ru.md`](COMMERCIAL-LICENSING.ru.md).

## Сопровождающий

Amirreza "Farnam" Taheri · [taherifarnam@gmail.com](mailto:taherifarnam@gmail.com) · [GitHub](https://github.com/AmirrezaFarnamTaheri/Scriptor)
