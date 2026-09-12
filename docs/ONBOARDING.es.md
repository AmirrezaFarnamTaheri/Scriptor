[English](ONBOARDING.md) · [فارسی](ONBOARDING.fa.md) · [简体中文](ONBOARDING.zh-CN.md) · [Русский](ONBOARDING.ru.md) · [Deutsch](ONBOARDING.de.md) · **Español**

# Incorporación de colaboradores de Scriptor

> **Audiencia:** colaboradores nuevos, mantenedores y auditores de código. Los usuarios nuevos deberían empezar por [`README.md`](../README.md) y [`docs/guides/GETTING_STARTED.es.md`](guides/GETTING_STARTED.es.md).
>
> Para las reglas de agentes, lea primero [`AGENTS.md`](../AGENTS.md). El flujo de contribución, los PR y las comprobaciones obligatorias están en [`CONTRIBUTING.es.md`](../CONTRIBUTING.es.md).

## Pila tecnológica

| Capa | Tecnología | Fuente de verdad |
|---|---|---|
| **Shell de escritorio** | Tauri 2 (Rust) | `apps/desktop/src-tauri/` |
| **Motores principales** | crates del workspace Rust (1.96.0, Edition 2024) | `crates/`, `rust-toolchain.toml` |
| **Frontend** | React 19, Vite 8, TypeScript 6, Lucide React | `package.json` |
| **Gestor de paquetes** | pnpm 10.33.0 | `package.json` (`packageManager`) |
| **Estilos** | OKLCH semántico + propiedades personalizadas CSS; sin Tailwind ni fuentes remotas | `src/index.css`, `src/styles/` |
| **Protocolo IPC** | Rust `ts-rs` → contratos TypeScript | `crates/ipc/src/lib.rs` → `tsconfig.contracts.json` |
| **Pruebas** | Cargo test, Playwright E2E + visual, axe-core a11y | `playwright.e2e.config.ts`, `playwright.visual.config.ts` |

Los comandos de instalación están en **Build from source** de [`README.es.md`](../README.es.md). La lista completa de comprobaciones obligatorias está en [`CONTRIBUTING.es.md`](../CONTRIBUTING.es.md).

> Gates locales rápidos: `pnpm test:source` (contratos + gobernanza), `pnpm check:changelog` (protección de notas de versión), `pnpm test:rust` (gate Rust alineado con CI; excluye scriptor-desktop y motores en incubación), `pnpm check:i18n` (paridad de locales).

## Arquitectura de un vistazo

La topología de ejecución, los límites de confianza y la propiedad de crates están documentados en [`docs/ARCHITECTURE.es.md`](ARCHITECTURE.es.md). Resumen:

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

El renderer no es un límite de autoridad. Las operaciones nativas validan alcance, autorización, payloads de runtime, rutas, política de procesos y cancelación independientemente del estado de la UI.

## Puntos de entrada clave

| Componente | Punto de entrada |
|---|---|
| Shell de escritorio | `apps/desktop/src-tauri/src/lib.rs` |
| React SPA | `src/App.tsx`, `src/main.tsx` |
| Kernel del vault | `crates/vault/src/lib.rs` |
| Indexador / búsqueda / grafo | `crates/indexer/src/lib.rs` |
| Definiciones IPC | `crates/ipc/src/lib.rs` |
| IPC del daemon | `crates/daemon/src/lib.rs` |
| Sandbox de procesos | `crates/system-bridge/src/process.rs` |
| Tokens y tema | `src/index.css`, `src/styles/` |
| Contrato de diseño | [`DESIGN.es.md`](../DESIGN.es.md) |

## Mapa de directorios

```
apps/desktop/         → aplicación shell de escritorio Tauri 2
crates/               → motores Rust (vault, indexer, citation, canvas, IPC, daemon, CLI)
packages/             → paquetes TypeScript (@scriptor/core, editor, canvas, portal, mcp, renderer, export)
src/                  → SPA principal React, componentes UI, hooks y estilos
scripts/validation/   → verificación automatizada de contratos, gobernanza, a11y y código fuente
scripts/benchmarks/   → benchmarks de latencia, memoria y rendimiento
docs/                 → especificaciones de arquitectura, madurez y verificación
e2e/                  → especificaciones Playwright E2E y de regresión visual
```

## Convenciones y mínimo de calidad

La lista completa vive en [`CONTRIBUTING.es.md`](../CONTRIBUTING.es.md) y [`AGENTS.md`](../AGENTS.md). Elementos no negociables:

- **Local-first y Markdown nativo** — los archivos Markdown en disco son la fuente de verdad.
- **Contratos IPC** — cada comando IPC de Rust corresponde a una interfaz TypeScript; el JSON de runtime proveniente de `unknown` se valida antes de usarlo.
- **Sandbox de procesos** — toda ejecución externa debe pasar por `crates/system-bridge/src/process.rs` y validarse contra `process-launch-inventory.json`.
- **UI y anti-slop** — siga [`DESIGN.es.md`](../DESIGN.es.md): sin degradados púrpura/índigo de IA, solo fuentes del sistema, mínimo WCAG 2.2 AA y objetivos táctiles ≥ 44×44 px.
- **Seguridad Rust** — el código de producción evita `.unwrap()`; `thiserror` en librerías y `anyhow` en binarios; cada bloque `unsafe` lleva un comentario explícito `// SAFETY:`.

## Dónde buscar

| Tarea | Ubicación |
|---|---|
| Lógica de archivos del vault | `crates/vault/src/` |
| Indexador o búsqueda de grafo | `crates/indexer/src/` |
| Métodos IPC | `crates/ipc/src/` & `tsconfig.contracts.json` |
| Componente editor | `packages/editor/src/` |
| Workspace canvas | `packages/canvas/src/` & `crates/canvas-engine/` |
| Tema o estilos | `src/index.css` & `src/styles/` |
| Prueba E2E / visual | `e2e/` & `playwright.e2e.config.ts` |
| Benchmark | `scripts/benchmarks/` & `perf-baselines.json` |
