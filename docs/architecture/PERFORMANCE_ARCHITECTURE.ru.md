# Архитектура производительности

[English](PERFORMANCE_ARCHITECTURE.md) · [简体中文](PERFORMANCE_ARCHITECTURE.zh-CN.md) · **Русский** · [Deutsch](PERFORMANCE_ARCHITECTURE.de.md) · [Español](PERFORMANCE_ARCHITECTURE.es.md) · [فارسی](PERFORMANCE_ARCHITECTURE.fa.md)

## Тезис о производительности

Scriptor должен ощущаться быстрее Markdown-workspace эпохи Electron: тяжёлая работа вынесена из UI thread, native-код владеет границами IO и процессов, а производное состояние кэшируется с явной семантикой rebuild.

## Стек оптимизаций

| Слой | Оптимизация | Владелец | Проверка |
|---|---|---|---|
| Desktop shell | Tauri 2 вместо Electron. | Native Platform | Benchmark startup и idle memory. |
| File IO | Rust vault kernel с атомарными writes и пакетированием watcher events. | Vault Kernel | Save latency и watcher burst tests. |
| Cache | Производный SQLite/FTS cache. | Indexing And Search | Rebuild, warm search и migration tests. |
| Editor | CodeMirror adapter, lazy extensions, rich editor не используется по умолчанию. | Editor Experience | Keystroke frame budget. |
| Preview | Worker-based Markdown rendering и sanitizer boundary. | Publication | Preview render benchmark. |
| Graph | Предвычисленные edges, focused graph queries, worker layout. | Knowledge Graph | Graph query и layout benchmark. |
| Canvas | Native scene model, spatial index, lazy block renderers, snapshot jobs. | Canvas Experience | Hit-test, pan/zoom и snapshot benchmarks. |
| Export | Rust job runner, изолированные temp dirs, отменяемый Pandoc process. | Publication | Export duration и cancellation tests. |
| UI lists | Виртуализованные file tree, search results, backlinks, jobs. | Design Systems | Large list interaction test. |
| Automation | Сначала MCP read-only, затем write approval. | Automation And AI | Permission tests и audit logs. |

## Бюджеты производительности

| Бюджет | Цель | Первый measurement hook |
|---|---:|---|
| Холодный shell готов к работе | 2.0s | `scripts/benchmarks/startup` |
| Тёплый vault на 5k заметок готов | 1.5s | `scripts/benchmarks/vault-scan` |
| Обычное сохранение note до cache update | 150ms | Rust integration test timing |
| Warm search query | 100ms | `scripts/benchmarks/search` |
| Средняя стоимость frame редактора | 16ms | editor latency probe |
| Preview обычной note | 250ms | renderer worker benchmark |
| Rename dry run на 5k notes | 500ms | graph rename fixture |
| Стоимость Canvas pan/zoom frame | 16ms | canvas interaction probe |
| Canvas snapshot start latency | 250ms | canvas snapshot job benchmark |
| Реакция на отмену export | 250ms | export-runner integration test |

## Правила производительности UI

- Рендерить производные summaries, а не сырые структуры всего vault.
- Состояние editor держать локально в editor adapter.
- App shell state делать неглубоким и сериализуемым.
- Использовать стабильную высоту строк для file trees, backlinks, jobs и command results.
- Откладывать graph, canvas, export, plugin и AI panels до открытия.
- Plugin widgets размещать в ограниченных slots с явными data contracts.
- Использовать CSS containment для независимо прокручиваемых panels.
- Уважать reduced motion и избегать анимационной хореографии при загрузке страницы.

## Правила производительности Native

- Никогда не сканировать один vault path дважды параллельно.
- Пакетировать file watcher events перед cache update.
- Использовать content hashes, чтобы пропускать неизменившиеся notes.
- Выполнять index updates в SQLite transactions.
- Предпочитать явные process args строкам shell.
- Считать cache rebuild нормальным recovery path.
- Для долгих jobs выдавать progress и точки cancellation.

## Пути масштабирования

| Ограничение | Первый подход | Обновлять только при наличии измеренных доказательств |
|---|---|---|
| Search latency | SQLite FTS5 | Tantivy index crate. |
| Graph layout | Web worker layout | Rust layout precompute или WebGL renderer. |
| Canvas hit-testing | Rust spatial index | GPU renderer только после измеренного давления на interaction. |
| Large vault scans | Rust sequential scan с batching | Rayon parallel scan с IO backpressure. |
| Git process overhead | Safe Git CLI adapter | `git2` wrapper. |
| Export throughput | Одна очередь Pandoc jobs | Параллельная очередь с resource caps на профиль. |
