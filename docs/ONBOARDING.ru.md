[English](ONBOARDING.md) · [فارسی](ONBOARDING.fa.md) · [简体中文](ONBOARDING.zh-CN.md) · **Русский** · [Deutsch](ONBOARDING.de.md) · [Español](ONBOARDING.es.md)

# Введение для участников Scriptor

> **Для кого:** новых участников, сопровождающих и аудиторов кода. Новым пользователям следует начать с [`README.md`](../README.md) и [`docs/guides/GETTING_STARTED.ru.md`](guides/GETTING_STARTED.ru.md).
>
> Правила для агентов сначала читайте в [`AGENTS.md`](../AGENTS.md). Процесс внесения изменений, PR и обязательные проверки описаны в [`CONTRIBUTING.ru.md`](../CONTRIBUTING.ru.md).

## Технологический стек

| Слой | Технология | Источник истины |
|---|---|---|
| **Desktop shell** | Tauri 2 (Rust) | `apps/desktop/src-tauri/` |
| **Основные движки** | crates рабочего пространства Rust (1.96.0, Edition 2024) | `crates/`, `rust-toolchain.toml` |
| **Frontend** | React 19, Vite 8, TypeScript 6, Lucide React | `package.json` |
| **Менеджер пакетов** | pnpm 10.33.0 | `package.json` (`packageManager`) |
| **Стили** | семантический OKLCH + CSS custom properties; без Tailwind и удалённых шрифтов | `src/index.css`, `src/styles/` |
| **IPC** | Rust `ts-rs` → TypeScript-контракты | `crates/ipc/src/lib.rs` → `tsconfig.contracts.json` |
| **Тестирование** | Cargo test, Playwright E2E + visual, axe-core a11y | `playwright.e2e.config.ts`, `playwright.visual.config.ts` |

Команды установки приведены в разделе **Build from source** файла [`README.ru.md`](../README.ru.md). Полный список обязательных проверок — в [`CONTRIBUTING.ru.md`](../CONTRIBUTING.ru.md).

> Быстрые локальные gates: `pnpm test:source`, `pnpm check:changelog`, `pnpm test:rust` (Rust-gate, согласованный с CI; без scriptor-desktop и инкубируемых движков), `pnpm check:i18n` (паритет локалей).

## Архитектура в двух словах

Топология runtime, границы доверия и владение crates описаны в [`docs/ARCHITECTURE.ru.md`](ARCHITECTURE.ru.md):

```
React renderer
  → typed bridge commands
  → Tauri command adapters
  → authorization broker
  → application/kernel crates (vault, indexer, native-git, export-runner, canvas-engine)
  → filesystem / SQLite / Git / keychain / approved external tools

CLI/TUI and MCP
  → daemon IPC (scriptor-ipc envelopes)
  → daemon handlers and shared kernel crates
```

Renderer не является границей полномочий. Нативные операции независимо от состояния UI проверяют scope, авторизацию, runtime payload, пути, политику процессов и отмену.

## Ключевые точки входа

| Компонент | Точка входа |
|---|---|
| Desktop shell | `apps/desktop/src-tauri/src/lib.rs` |
| React SPA | `src/App.tsx`, `src/main.tsx` |
| Vault kernel | `crates/vault/src/lib.rs` |
| Indexer / поиск / graph | `crates/indexer/src/lib.rs` |
| IPC definitions | `crates/ipc/src/lib.rs` |
| Daemon IPC | `crates/daemon/src/lib.rs` |
| Sandbox запуска процессов | `crates/system-bridge/src/process.rs` |
| Design tokens & theme | `src/index.css`, `src/styles/` |
| Design contract | [`DESIGN.ru.md`](../DESIGN.ru.md) |

## Карта каталогов

```
apps/desktop/         → desktop shell Tauri 2
crates/               → Rust-движки (vault, indexer, citation, canvas, IPC, daemon, CLI)
packages/             → TypeScript-пакеты (@scriptor/core, editor, canvas, portal, mcp, renderer, export)
src/                  → основное React SPA, UI-компоненты, hooks, styles
scripts/validation/   → автоматическая проверка контрактов, governance, a11y и source
scripts/benchmarks/   → benchmarks задержки, памяти и пропускной способности
docs/                 → архитектура, реестр зрелости, документация проверки
e2e/                  → Playwright E2E и визуальная регрессия
```

## Конвенции и минимальный уровень качества

Полный список находится в [`CONTRIBUTING.ru.md`](../CONTRIBUTING.ru.md) и [`AGENTS.md`](../AGENTS.md). Обязательные правила:

- **Local-first и Markdown-native** — Markdown-файлы на диске являются источником истины.
- **IPC-контракты** — каждой Rust IPC-команде соответствует TypeScript-интерфейс; runtime JSON из `unknown` валидируется до использования.
- **Process sandbox** — внешние процессы запускаются через `crates/system-bridge/src/process.rs` и проверяются по `process-launch-inventory.json`.
- **UI & anti-slop** — следуйте [`DESIGN.ru.md`](../DESIGN.ru.md): без фиолетово-индиговых AI-градиентов, только системные шрифты, минимум WCAG 2.2 AA, touch-target ≥ 44×44 px.
- **Rust safety** — production-код избегает `.unwrap()`; `thiserror` в библиотеках, `anyhow` в бинарниках; каждый `unsafe` имеет явный комментарий `// SAFETY:`.

## Где искать

| Задача | Путь |
|---|---|
| Логика файлов vault | `crates/vault/src/` |
| Indexer или graph search | `crates/indexer/src/` |
| IPC-методы | `crates/ipc/src/` & `tsconfig.contracts.json` |
| Editor | `packages/editor/src/` |
| Canvas workspace | `packages/canvas/src/` & `crates/canvas-engine/` |
| Theme / styling | `src/index.css` & `src/styles/` |
| E2E / visual test | `e2e/` & `playwright.e2e.config.ts` |
| Performance benchmark | `scripts/benchmarks/` & `perf-baselines.json` |
