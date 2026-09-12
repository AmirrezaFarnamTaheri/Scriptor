# Возможности Scriptor

[English](CAPABILITIES.md) · [فارسی](CAPABILITIES.fa.md) · [简体中文](CAPABILITIES.zh-CN.md) · **Русский** · [Deutsch](CAPABILITIES.de.md) · [Español](CAPABILITIES.es.md)

Визуальные эталоны для поверхностей, зависящих от возможностей, поддерживаются в [галерее visual review](./VISUAL-REVIEW.md) и [каноническом инвентаре screenshots](assets/screenshots/README.ru.md), включая [Graph](assets/screenshots/graph.png), [Canvas](assets/screenshots/canvas.png), [MCP](assets/screenshots/mcp-panel.png) и [Plugins](assets/screenshots/plugins.png). Screenshots показывают только состояние UI; нативная авторизация и состояние vault остаются авторитетными.

Поставляемые поверхности продукта и проверка release для **v1.0.0**.

Пользовательский обзор функций находится в основном [`README.ru.md`](../README.ru.md), а авторитетная оценка зрелости — в [`CAPABILITY-MATURITY.ru.md`](./CAPABILITY-MATURITY.ru.md). Эта страница фиксирует delivery manifest v1.0.0 и команды проверки release.

## Включено в v1.0.0

| Область | Ссылка |
|---|---|
| Desktop shell (Tauri 2) | `apps/desktop/` |
| Vault kernel + indexer | `crates/vault`, `crates/indexer` |
| Headless daemon IPC | [`architecture/IPC_DAEMON.ru.md`](./architecture/IPC_DAEMON.ru.md) |
| Terminal UI | [`architecture/TUI_PARITY.ru.md`](./architecture/TUI_PARITY.ru.md) |
| Plugin system (safe mode + marketplace) | [`architecture/PLUGIN_SYSTEM.ru.md`](./architecture/PLUGIN_SYSTEM.ru.md) |
| Руководство автора plugin + hello-world | [`plugins/AUTHOR_GUIDE.ru.md`](./plugins/AUTHOR_GUIDE.ru.md) |
| MCP: 22 инструмента с проверенными drafts | `packages/mcp/`; устойчивый аудит мутаций: `crates/vault/src/mcp_audit.rs`, `crates/daemon/src/automation_stdio.rs` |
| Export (Pandoc) | `crates/export-runner`, `@scriptor/export` |
| Canvas engine (resvg worker offload) | `crates/canvas-engine`, `@scriptor/canvas` |
| Виртуализированное дерево vault | `src/components/app/VirtualNoteList.tsx` |
| Design tokens (414 извлечённых строк) | `src/styles/tokens/components.css` |
| Visual regression tests | `playwright.visual.config.ts` |
| axe-core CI gate | `check:a11y-axe` в `check:release` |
| Документационные screenshots | `docs/assets/screenshots/` |
| Release packaging + trust evidence для неподписанных установщиков | `scripts/release/`, `.github/workflows/release.yml` |

## Headless engine

При включённом **Settings → Headless engine** индексирование, поиск, backlinks, graph, Git status, health diagnostics, сохранение/переименование заметок и export jobs проходят через локальный daemon. Открытие и сканирование vault, а также canvas остаются in-process ради отзывчивости. См. [`architecture/IPC_DAEMON.ru.md`](./architecture/IPC_DAEMON.ru.md).

## Проверка release

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

CI повторяет эти проверки в [`.github/workflows/ci.yml`](../.github/workflows/ci.yml).

## Связанные документы

| Документ | Назначение |
|---|---|
| [`guides/GETTING_STARTED.ru.md`](./guides/GETTING_STARTED.ru.md) | Руководство первого запуска |
| [`release/PANDOC_STRATEGY.ru.md`](./release/PANDOC_STRATEGY.ru.md) | Требования к экспорту |
| [`release/SIGNING.ru.md`](./release/SIGNING.ru.md) | Политика доверия и подписывания установщиков |
| [`../PRODUCT.ru.md`](../PRODUCT.ru.md) | Принципы продукта |
| [`../CHANGELOG.md`](../CHANGELOG.md) | История releases |
