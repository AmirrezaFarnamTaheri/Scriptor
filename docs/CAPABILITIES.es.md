# Capacidades de Scriptor

[English](CAPABILITIES.md) · [فارسی](CAPABILITIES.fa.md) · [简体中文](CAPABILITIES.zh-CN.md) · [Русский](CAPABILITIES.ru.md) · [Deutsch](CAPABILITIES.de.md) · **Español**

Las referencias visuales de las superficies sujetas a capacidades se mantienen en la [galería de revisión visual](./VISUAL-REVIEW.md) y en el [inventario canónico de screenshots](assets/screenshots/README.es.md), incluidos [Graph](assets/screenshots/graph.png), [Canvas](assets/screenshots/canvas.png), [MCP](assets/screenshots/mcp-panel.png) y [Plugins](assets/screenshots/plugins.png). Los screenshots solo ilustran el estado de la UI; la autorización nativa y el estado del vault siguen siendo la autoridad.

Superficies del producto publicadas y validación de release para **v1.0.0**.

El recorrido de funciones para usuarios está en el [`README.es.md`](../README.es.md) principal y la postura de madurez que actúa como fuente de verdad está en [`CAPABILITY-MATURITY.es.md`](./CAPABILITY-MATURITY.es.md). Esta página registra el manifiesto de entrega de v1.0.0 y los comandos de validación de release.

## Incluido en v1.0.0

| Área | Referencia |
|---|---|
| Shell de escritorio (Tauri 2) | `apps/desktop/` |
| Kernel del vault + indexer | `crates/vault`, `crates/indexer` |
| IPC del daemon headless | [`architecture/IPC_DAEMON.es.md`](./architecture/IPC_DAEMON.es.md) |
| UI de terminal | [`architecture/TUI_PARITY.es.md`](./architecture/TUI_PARITY.es.md) |
| Sistema de plugins (safe mode + marketplace) | [`architecture/PLUGIN_SYSTEM.es.md`](./architecture/PLUGIN_SYSTEM.es.md) |
| Guía de autores de plugins + hello-world | [`plugins/AUTHOR_GUIDE.es.md`](./plugins/AUTHOR_GUIDE.es.md) |
| MCP: 22 herramientas con drafts revisados | `packages/mcp/`; auditoría durable de mutaciones: `crates/vault/src/mcp_audit.rs`, `crates/daemon/src/automation_stdio.rs` |
| Exportación (Pandoc) | `crates/export-runner`, `@scriptor/export` |
| Motor Canvas (offload de resvg a worker) | `crates/canvas-engine`, `@scriptor/canvas` |
| Árbol virtualizado del vault | `src/components/app/VirtualNoteList.tsx` |
| Tokens de diseño (414 líneas extraídas) | `src/styles/tokens/components.css` |
| Pruebas de regresión visual | `playwright.visual.config.ts` |
| Gate CI de axe-core | `check:a11y-axe` en `check:release` |
| Screenshots de documentación | `docs/assets/screenshots/` |
| Empaquetado de release + evidencia de confianza de instaladores sin firmar | `scripts/release/`, `.github/workflows/release.yml` |

## Motor headless

Cuando **Settings → Headless engine** está activado, la indexación, búsqueda, backlinks, grafo, estado Git, diagnósticos de salud, guardado/renombrado de notas y jobs de exportación pasan por el daemon local. Abrir el vault, escanearlo y canvas permanecen in-process para responder con rapidez. Consulte [`architecture/IPC_DAEMON.es.md`](./architecture/IPC_DAEMON.es.md).

## Validación de release

```powershell
pnpm check:release   # Full local release gate (includes axe-core CI gate)
pnpm check:daemon    # IPC smoke
pnpm check:tui       # Terminal UI smoke
pnpm check:a11y      # Static accessibility checks
pnpm check:a11y-axe  # axe-core WCAG 2a/2aa/2.1aa automated audit
pnpm check:plugins   # Plugin manifest + marketplace catalog
pnpm check:mcp       # MCP tool manifest validation
pnpm check:contracts # TypeScript contract packages
pnpm check:canvas    # Canvas engine contracts
pnpm check:editor    # Editor engine contracts
pnpm check:renderer  # Renderer contracts
pnpm check:export    # Export pipeline contracts
pnpm check:knowledge # Knowledge graph contracts
pnpm check:citations # Citation engine contracts
pnpm check:headless  # Headless runner contracts
pnpm check:perf      # Performance baseline check
pnpm test:rust       # Rust unit and integration tests
pnpm test:visual     # Visual regression Playwright tests
pnpm test:e2e        # Playwright end-to-end tests
```

CI replica estas comprobaciones en [`.github/workflows/ci.yml`](../.github/workflows/ci.yml).

## Documentos relacionados

| Documento | Propósito |
|---|---|
| [`guides/GETTING_STARTED.es.md`](./guides/GETTING_STARTED.es.md) | Guía de primer uso |
| [`release/PANDOC_STRATEGY.es.md`](./release/PANDOC_STRATEGY.es.md) | Requisitos de exportación |
| [`release/SIGNING.es.md`](./release/SIGNING.es.md) | Política de confianza y firma de instaladores |
| [`../PRODUCT.es.md`](../PRODUCT.es.md) | Principios del producto |
| [`../CHANGELOG.md`](../CHANGELOG.md) | Historial de releases |
