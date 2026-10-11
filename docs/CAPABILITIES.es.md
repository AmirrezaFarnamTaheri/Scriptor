# Capacidades de Scriptor

[English](CAPABILITIES.md) · [فارسی](CAPABILITIES.fa.md) · [简体中文](CAPABILITIES.zh-CN.md) · [Русский](CAPABILITIES.ru.md) · [Deutsch](CAPABILITIES.de.md) · **Español**

Scriptor combina archivos Markdown locales con edición, investigación, publicación y automatización con permisos explícitos. Este mapa describe la superficie actual y sus responsables. El [registro de madurez](CAPABILITY-MATURITY.md) distingue funciones publicadas, experimentales y propuestas de diseño; un control visible no demuestra soporte de producción.

La [galería visual](VISUAL-REVIEW.es.md) y el [inventario de capturas](assets/screenshots/README.es.md) ilustran estados de la interfaz. La autorización nativa y el estado real del vault siguen siendo la referencia.

## Superficies principales

| Área | Referencia |
|---|---|
| Aplicación de escritorio (Tauri 2) | `apps/desktop/` |
| Núcleo del vault e indexador | `crates/vault`, `crates/indexer` |
| IPC del daemon sin interfaz | [IPC](architecture/IPC_DAEMON.md) |
| Interfaz de terminal | [TUI](architecture/TUI_PARITY.md) |
| Plugins, modo seguro y catálogo propio | [Plugin system](architecture/PLUGIN_SYSTEM.md) |
| Guía de autores de plugins y Hello World | [Author guide](plugins/AUTHOR_GUIDE.md) |
| 22 herramientas MCP con borradores revisados | `packages/mcp/` |
| Exportación con Pandoc | `crates/export-runner`, `@scriptor/export` |
| Motor Canvas con worker resvg | `crates/canvas-engine`, `@scriptor/canvas` |
| Árbol virtualizado del vault | `src/components/app/VirtualNoteList.tsx` |
| Tokens de diseño | `src/styles/tokens/components.css` |
| Regresión visual | `playwright.visual.config.ts` |
| Control axe-core en CI | `check:a11y-axe`, `check:release` |
| Capturas de documentación | `docs/assets/screenshots/` |
| Empaquetado y evidencia de confianza sin firma | `scripts/release/`, `.github/workflows/release.yml` |

La auditoría persistente de cambios MCP está en `crates/vault/src/mcp_audit.rs` y `crates/daemon/src/automation_stdio.rs`.

## Flujos experimentales

| Flujo | Comportamiento y referencia |
|---|---|
| Archivos fuente independientes | Edición de LaTeX, código y formatos de texto relacionados con guardado protegido; ejecución y compilación explícitas. Consulte la [madurez](CAPABILITY-MATURITY.md). |
| Integraciones Google | Cuentas independientes, revisiones Drive/Docs revisadas, planificación Calendar/Tasks y Gmail opcional. Consulte la [guía Google](guides/GOOGLE_INTEGRATIONS.es.md). |
| Intercambio Overleaf | Intercambio revisado de fuentes mediante Git con servidor fijo. Consulte la [arquitectura](ARCHITECTURE.es.md). |
| Sesiones de ejecución e inspección semántica | Ejecución autorizada e inspección de embeddings dependiente del proveedor. Las pruebas nativas, del proveedor y del cliente empaquetado son [requisitos independientes](VERIFICATION.es.md). |
| Composición del espacio | Paneles principales y laterales, pestañas móviles y accesos personalizables; los ocultos se recuperan desde la paleta. Consulte [Primeros pasos](guides/GETTING_STARTED.es.md). |

## Motor sin interfaz

Con **Settings → Headless engine**, indexación, búsqueda, enlaces inversos, grafo, estado Git, diagnóstico, guardado/renombrado y exportación pasan por el daemon local. Abrir el vault, escanear y Canvas permanecen en el proceso por capacidad de respuesta. Véase el [contrato IPC](architecture/IPC_DAEMON.md).

## Verificación

Los procedimientos están en [CONTRIBUTING.es.md](../CONTRIBUTING.es.md); resultados actuales y controles pendientes, en [VERIFICATION.es.md](VERIFICATION.es.md). Durante esta revisión, toda verificación ejecutable se realiza en workers de GitHub. Los datos controlados del navegador demuestran comportamiento y diseño, no acceso real al proveedor, comportamiento del cliente instalado ni preparación para publicar. Los workflows conservan commit y artefactos de diagnóstico.

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

## Documentos relacionados

[Requisitos Pandoc](release/PANDOC_STRATEGY.md) · [Confianza del instalador](release/SIGNING.md) · [Principios del producto](../PRODUCT.md) · [Cambios](../CHANGELOG.md)
