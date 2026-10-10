# Возможности Scriptor

[English](CAPABILITIES.md) · [فارسی](CAPABILITIES.fa.md) · [简体中文](CAPABILITIES.zh-CN.md) · **Русский** · [Deutsch](CAPABILITIES.de.md) · [Español](CAPABILITIES.es.md)

Scriptor объединяет локальные Markdown-файлы с редактированием, исследованиями, публикацией и автоматизацией с явными разрешениями. Эта карта описывает текущие поверхности и границы ответственности. [Реестр зрелости](CAPABILITY-MATURITY.md) различает выпущенные, экспериментальные и только спроектированные возможности; наличие элемента управления само по себе не доказывает производственную поддержку.

[Визуальная галерея](VISUAL-REVIEW.ru.md) и [каталог снимков](assets/screenshots/README.ru.md) показывают состояния интерфейса. Полномочия определяются нативной проверкой и реальным состоянием хранилища.

## Основные поверхности

| Область | Источник |
|---|---|
| Настольная оболочка (Tauri 2) | `apps/desktop/` |
| Ядро хранилища и индексатор | `crates/vault`, `crates/indexer` |
| IPC локального фонового движка | [IPC](architecture/IPC_DAEMON.md) |
| Терминальный интерфейс | [TUI](architecture/TUI_PARITY.md) |
| Плагины, безопасный режим и собственный каталог | [Plugin system](architecture/PLUGIN_SYSTEM.md) |
| Руководство автора плагина и Hello World | [Author guide](plugins/AUTHOR_GUIDE.md) |
| 22 инструмента MCP с проверяемыми черновиками | `packages/mcp/` |
| Экспорт через Pandoc | `crates/export-runner`, `@scriptor/export` |
| Движок Canvas с worker resvg | `crates/canvas-engine`, `@scriptor/canvas` |
| Виртуализированное дерево хранилища | `src/components/app/VirtualNoteList.tsx` |
| Токены дизайна | `src/styles/tokens/components.css` |
| Визуальные регрессии | `playwright.visual.config.ts` |
| Проверка axe-core в CI | `check:a11y-axe`, `check:release` |
| Снимки документации | `docs/assets/screenshots/` |
| Упаковка выпуска и доказательства политики без подписи | `scripts/release/`, `.github/workflows/release.yml` |

Долговременный аудит изменений MCP находится в `crates/vault/src/mcp_audit.rs` и `crates/daemon/src/automation_stdio.rs`.

## Экспериментальные процессы

| Процесс | Поведение и руководство |
|---|---|
| Отдельные исходные файлы | Редактирование LaTeX, кода и связанных текстовых форматов с защищённым сохранением; запуск и компиляция явные. См. [зрелость](CAPABILITY-MATURITY.md). |
| Интеграции Google | Независимые подключения аккаунтов, проверяемые ревизии Drive/Docs, планирование Calendar/Tasks и опциональный Gmail. См. [руководство Google](guides/GOOGLE_INTEGRATIONS.ru.md). |
| Обмен с Overleaf | Проверяемый обмен исходными файлами через Git с фиксированным сервером. См. [архитектуру](ARCHITECTURE.ru.md). |
| Исполнение и семантическая инспекция | Запуск кода с разрешением и проверка эмбеддингов выбранного провайдера. Нативные проверки, провайдер и упакованный клиент требуют [отдельных доказательств](VERIFICATION.ru.md). |
| Состав рабочего пространства | Основные и боковые области, перемещаемые панели и настраиваемые ярлыки; скрытые команды доступны через палитру. См. [Начало работы](guides/GETTING_STARTED.ru.md). |

## Фоновый движок

При включении **Settings → Headless engine** индексирование, поиск, обратные ссылки, граф, статус Git, диагностика, сохранение/переименование и экспорт проходят через локальный daemon. Открытие хранилища, сканирование и Canvas остаются внутри процесса для быстрого отклика. См. [контракт IPC](architecture/IPC_DAEMON.md).

## Проверка

Процедуры описаны в [CONTRIBUTING.ru.md](../CONTRIBUTING.ru.md), актуальные результаты и незакрытые требования — в [VERIFICATION.ru.md](VERIFICATION.ru.md). В текущей проверке все исполняемые проверки выполняют workers GitHub. Браузерные тестовые данные доказывают управляемое поведение и компоновку, но не доступ к настоящему провайдеру, работу установленного клиента или готовность выпуска. Доказательства workflow сохраняют исходный commit и диагностические артефакты.

```powershell
pnpm check:release
pnpm check:daemon
pnpm check:tui
pnpm check:a11y
pnpm check:a11y-axe
pnpm check:plugins
pnpm check:mcp
pnpm check:contracts
pnpm check:canvas
pnpm check:editor
pnpm check:renderer
pnpm check:export
pnpm check:knowledge
pnpm check:citations
pnpm check:headless
pnpm check:perf
pnpm test:rust
pnpm test:visual
pnpm test:e2e
```

[CI](../.github/workflows/ci.yml)

## Другие документы

[Предпосылки Pandoc](release/PANDOC_STRATEGY.md) · [Доверие к установщику](release/SIGNING.md) · [Принципы продукта](../PRODUCT.md) · [Изменения](../CHANGELOG.md)
