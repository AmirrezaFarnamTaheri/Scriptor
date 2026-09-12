<div align="center">

# Scriptor

**Un espacio de trabajo Markdown, local-first, para escritura e investigación exigentes.**

[English](README.md) · [فارسی](README.fa.md) · [简体中文](README.zh-CN.md) · [Русский](README.ru.md) · [Deutsch](README.de.md) · **Español**

[![Version](https://img.shields.io/badge/version-1.0.8-0f766e.svg)](VERSION)
[![License: AGPL-3.0-or-later](https://img.shields.io/badge/license-AGPL--3.0--or--later-0f766e.svg)](LICENSE)
[![Platforms](https://img.shields.io/badge/platforms-Windows%20%7C%20macOS%20%7C%20Linux-0f766e.svg)](#download)
[![Stack](https://img.shields.io/badge/stack-Tauri%202%20%C2%B7%20React%2019%20%C2%B7%20Rust%201.96-0f766e.svg)](#tech-stack)
[![CI](https://img.shields.io/github/actions/workflow/status/AmirrezaFarnamTaheri/Scriptor/ci.yml?branch=main&label=CI)](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/workflows/ci.yml)

Tus notas siguen siendo archivos Markdown normales. Scriptor añade edición, backlinks, citas, historial de versiones, publicación y automatización con permisos explícitos.

[Descargar](#download) · [Primeros pasos](docs/guides/GETTING_STARTED.es.md) · [Capacidades](docs/CAPABILITIES.es.md) · [Desarrollo de plugins](docs/plugins/AUTHOR_GUIDE.es.md) · [Contribuir](CONTRIBUTING.es.md)

</div>

![Espacio de trabajo de Scriptor con editor, vista previa renderizada, inspector y barra de estado compacta](docs/assets/screenshots/workspace-light.png)

## El producto

Scriptor abre una carpeta de Markdown y añade búsqueda, backlinks, historial, vistas previas y comprobaciones de estado. Markdown sigue siendo la fuente de verdad, de modo que cada nota continúa siendo legible en otros editores.

Scriptor está pensado para proyectos de larga duración como libros, tesis, documentación técnica, colecciones de investigación y bases de conocimiento mantenidas a lo largo del tiempo. Una shell de escritorio basada en Tauri proporciona la interfaz, mientras los servicios en Rust gestionan el acceso al vault, la indexación, Git, la exportación y el IPC local.

| Trabaja con tu material | Lo que aporta Scriptor |
|---|---|
| **Escribir y revisar** | Vistas de código fuente, dividida y renderizada; navegación por esquema; snippets; editor configurable; historial de notas |
| **Construir evidencia** | Wikilinks, backlinks, citas, exploración del grafo, comprobaciones de estado y reparación de enlaces sin resolver |
| **Publicar de forma reproducible** | Perfiles Pandoc con nombre para HTML, PDF, DOCX, LaTeX, ePub y Reveal.js |
| **Automatizar con límites claros** | Flujos conscientes de Git, herramientas MCP auditables, plugins con permisos y un daemon local |

## Scriptor en uso

| Escribe con fuente y vista previa | Inspecciona la estructura y la calidad de las notas |
|---|---|
| ![Editor y vista previa](docs/assets/screenshots/editor-preview.png) | ![Vista previa del inspector](docs/assets/screenshots/inspector-preview.png) |

| Explora conexiones | Repara y organiza el vault |
|---|---|
| ![Grafo](docs/assets/screenshots/graph.png) | ![Banco de trabajo de conocimiento](docs/assets/screenshots/knowledge-workbench.png) |

| Amplía el espacio de trabajo | Publica desde perfiles con nombre |
|---|---|
| ![Mercado de plugins](docs/assets/screenshots/plugins.png) | ![Centro de publicación](docs/assets/screenshots/publish-center.png) |

El [catálogo de capturas](docs/assets/screenshots/README.es.md) también cubre modo oscuro, Git, resolución de conflictos, paleta de comandos, MCP, ajustes, salud del vault, historial de notas, atajos de teclado, onboarding y diseños compactos. El script de captura espera a que los datos y paneles terminen de cargar y falla si una pantalla permanece en estado de carga o degradado.

## Funciones

- **Escritura** — CodeMirror 6 por defecto, con Monaco como opción; modos dividido y de vista previa; barra de formato; snippets; modo sin distracciones; editor de atajos de teclado
- **Organización** — árbol de vault virtualizado, inbox, notas diarias, tipos de nota, plantillas y vistas guardadas
- **Conexión** — Wikilinks, backlinks, grafo de conocimiento con navegación por teclado, banco de trabajo de conocimiento y reparación de enlaces sin resolver
- **Citas** — estilos CSL, citas inline `[@key]`, vista previa de bibliografía y archivos bibliográficos locales
- **Publicación** — perfiles de exportación Pandoc para HTML, PDF, DOCX, LaTeX, ePub y Reveal.js, además de publicación Starlight local
- **Automatización** — Git con resolución de conflictos a tres bandas, 22 herramientas MCP con auditoría de mutaciones JSONL encadenada por hash, catálogo de plugins con modo seguro y daemon headless con tracing
- **Visualización** — tableros Canvas con carga diferida y descarga de `resvg` a un worker, más captura rápida mediante Portal
- **Operación** — paleta de comandos, modos del espacio de trabajo, panel de salud del vault, interfaz de terminal y snapshots programados
- **Ortografía** — Hunspell multirregional y LanguageTool opcional

Consulta [`docs/CAPABILITY-MATURITY.es.md`](docs/CAPABILITY-MATURITY.es.md) para conocer el estado actual de las funciones publicadas, experimentales y únicamente diseñadas.

<a id="download"></a>
## Obtener Scriptor

Los instaladores de producción se publican como assets de GitHub Release. La versión actual es **1.0.8**.

- **Windows x86_64** — `.msi` y `.exe` (NSIS)
- **macOS Apple Silicon (aarch64)** — `.dmg`
- **Linux x86_64 y ARM64** — `.deb` y `.AppImage`

> **Estado de confianza.** Los instaladores oficiales upstream se distribuyen intencionadamente **sin firma digital**. Cada release incluye sumas SHA-256, un SBOM CycloneDX, un recibo de publicación, evidencia de identidad del código fuente y attestations de procedencia de GitHub. Antes de instalar, sigue el flujo completo de verificación descrito en [`docs/RELEASE-SECURITY.es.md`](docs/RELEASE-SECURITY.es.md).

[Descarga la última versión](https://github.com/AmirrezaFarnamTaheri/Scriptor/releases) o [compila desde el código fuente](#build-from-source).

<a id="tech-stack"></a>
## Stack tecnológico

- **Shell de escritorio** — Tauri 2
- **Renderer** — React 19, Vite 8, TypeScript 6, Lucide React
- **Kernel** — workspace de Rust 1.96 (Edition 2024) con crates (`vault`, `indexer`, `native-git`, `daemon`, `ipc`, `system-bridge`, `export-runner`, `publish-runner`, `canvas-engine`, `cli`, `embeddings`, `tantivy-indexer`, `citation-engine`, `wasm-runtime`, `capture`)
- **Persistencia** — SQLite WAL + FTS5 en el kernel del vault
- **IPC** — RPC local con framing postcard y autenticación HMAC (`scriptor-ipc` → `scriptor-daemon`)
- **Contratos** — tipos TypeScript generados desde Rust mediante `ts-rs`
- **Estilos** — CSS custom properties semánticas; sin Tailwind ni fuentes remotas
- **Editor** — CodeMirror 6 por defecto, con Monaco como opción avanzada no predeterminada

<a id="build-from-source"></a>
## Compilar desde el código fuente

### Requisitos

- Node.js `22.16.0` (engines: `>=22.12.0`)
- pnpm `10.33.0` (gestionado por Corepack)
- Rust `1.96.0` mediante `rustup`, con los componentes `rustfmt` y `clippy`
- PowerShell 7 (`pwsh`) para scripts de release, contenedores y benchmarks
- Dependencias de plataforma de Tauri 2 para tu sistema operativo

### Primera configuración

```powershell
corepack enable
corepack prepare pnpm@10.33.0 --activate
pnpm install --frozen-lockfile
rustup toolchain install 1.96.0 --profile minimal --component rustfmt --component clippy
rustup default 1.96.0
```

### Ejecutar

```powershell
pnpm web:dev          # solo la shell web (desarrollo y pruebas visuales)
pnpm desktop:dev      # shell de escritorio Tauri
```

### Verificar

Comprobaciones rápidas nativas del repositorio:

```powershell
pnpm version:check
pnpm lint:actions
pnpm lint:boundaries
pnpm check:i18n
pnpm check:docs
pnpm check:source
pnpm check:frontend-quality
```

Gate completo de release:

```powershell
pnpm install --frozen-lockfile
pnpm lint
pnpm build
pnpm check:release
cargo fmt --all --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
```

`pnpm check:release` ejecuta contract runners, pruebas de Rust, suites E2E y visuales de Playwright, auditorías de accesibilidad, smoke tests del daemon y la TUI, y gates de rendimiento. El empaquetado y la verificación de evidencia del release están documentados en [`scripts/release/README.md`](scripts/release/README.md).

## Arquitectura

La topología actual de runtime, los límites de confianza y la propiedad de los crates se documentan en [`docs/ARCHITECTURE.es.md`](docs/ARCHITECTURE.es.md). Los diagramas de Container y Context están en [`docs/architecture/c4-container.es.md`](docs/architecture/c4-container.es.md) y [`docs/architecture/c4-context.es.md`](docs/architecture/c4-context.es.md).

| Plano | Puntos de entrada |
|---|---|
| Desktop | `apps/desktop/src-tauri/src/lib.rs`, `src/App.tsx` |
| Vault | `crates/vault/src/lib.rs` |
| Index / search / graph | `crates/indexer/src/lib.rs` |
| Daemon IPC | `crates/daemon/src/lib.rs`, `crates/ipc/src/lib.rs` |
| Git | `crates/native-git/src/lib.rs` |
| External tools | `crates/system-bridge/src/process.rs` |
| Frontend packages | `packages/*/src/index.ts` |

## Principios

- **Local-first.** Markdown sigue siendo la fuente de verdad y se mantiene portable.
- **Autoridad explícita.** Las acciones destructivas y las relacionadas con secretos, red, procesos, copias de seguridad y publicación requieren una autorización explícita y limitada en alcance.
- **Trabajo acotado.** Los escaneos, recorridos de grafos, colas de eventos, salida de subprocess, logs y colas de auditoría tienen límites definidos.
- **Mutaciones recuperables.** Los commits de Git aíslan el índice, las escrituras MCP usan registros intent/outcome y las restauraciones verifican manifests antes de promover los cambios.
- **Un contrato por frontera.** Las definiciones IPC de Rust generan contratos TypeScript; el JSON de runtime se valida antes de usarse.
- **Madurez expresada con honestidad.** Las capacidades implementadas, experimentales y solo diseñadas se documentan por separado en [`docs/CAPABILITY-MATURITY.es.md`](docs/CAPABILITY-MATURITY.es.md).

## Documentación

| Público | Empieza aquí |
|---|---|
| Usuario nuevo | [`docs/guides/GETTING_STARTED.es.md`](docs/guides/GETTING_STARTED.es.md) |
| Interesado en las capacidades | [`docs/CAPABILITIES.es.md`](docs/CAPABILITIES.es.md) y [`docs/CAPABILITY-MATURITY.es.md`](docs/CAPABILITY-MATURITY.es.md) |
| Autor de plugins | [`docs/plugins/AUTHOR_GUIDE.es.md`](docs/plugins/AUTHOR_GUIDE.es.md) |
| Contribuidor | [`CONTRIBUTING.es.md`](CONTRIBUTING.es.md) y [`AGENTS.md`](AGENTS.md) |
| Investigador de seguridad | [`SECURITY.es.md`](SECURITY.es.md) y [`docs/ENCRYPTION-THREAT-MODEL.es.md`](docs/ENCRYPTION-THREAT-MODEL.es.md) |
| Responsable de release | [`docs/RELEASE-CHECKLIST.es.md`](docs/RELEASE-CHECKLIST.es.md) y [`docs/RELEASE-SECURITY.es.md`](docs/RELEASE-SECURITY.es.md) |
| Arquitecto | [`docs/ARCHITECTURE.es.md`](docs/ARCHITECTURE.es.md) y [`docs/architecture/`](docs/architecture/) |
| Auditor | [`docs/_archived/AUDIT-2026-08-23.md`](docs/_archived/AUDIT-2026-08-23.md) y [`docs/FINAL-REMEDIATION-REPORT.es.md`](docs/FINAL-REMEDIATION-REPORT.es.md) |

Índice completo: [`docs/README.es.md`](docs/README.es.md).

## Soporte

- **Issues** — <https://github.com/AmirrezaFarnamTaheri/Scriptor/issues>
- **Correo** — Amirreza "Farnam" Taheri, [taherifarnam@gmail.com](mailto:taherifarnam@gmail.com)
- **Seguridad** — sigue [`SECURITY.es.md`](SECURITY.es.md); no abras issues públicos para vulnerabilidades

## Contribuir

Scriptor acepta contribuciones. El flujo completo, las expectativas para contribuidores y los gates de evidencia obligatorios están en [`CONTRIBUTING.es.md`](CONTRIBUTING.es.md). Antes de abrir un pull request:

1. Lee [`PRODUCT.es.md`](PRODUCT.es.md), [`DESIGN.es.md`](DESIGN.es.md), [`docs/ARCHITECTURE.es.md`](docs/ARCHITECTURE.es.md) y [`docs/CAPABILITY-MATURITY.es.md`](docs/CAPABILITY-MATURITY.es.md).
2. Cuando sea práctico, añade primero una prueba de comportamiento que falle antes de la corrección.
3. Ejecuta toda la lista de verificación anterior; cada gate debe pasar sobre exactamente el mismo commit.
4. Actualiza [`CHANGELOG.md`](CHANGELOG.md) y cualquier documentación afectada junto con el cambio.

## Estado del proyecto

**Desarrollo activo.** `v1.0.8` es el candidato actual para producción. Las superficies Desktop, vault, indexer, knowledge, Git, export, daemon y web están implementadas y distribuidas. El registro de capacidades de [`docs/CAPABILITY-MATURITY.es.md`](docs/CAPABILITY-MATURITY.es.md) es la fuente autoritativa para saber qué está soportado, qué es experimental y qué existe únicamente como diseño. Mobile, vaults cifrados, embeddings locales, Tantivy y el host WASM siguen siendo experimentales o design-only.

## Licencia

Scriptor se distribuye bajo **GNU AGPL-3.0-or-later**. El uso comercial está permitido siempre que se cumplan las obligaciones de la licencia. Las organizaciones que no quieran cumplir la AGPL pueden solicitar una licencia comercial independiente; consulta [`COMMERCIAL-LICENSING.es.md`](COMMERCIAL-LICENSING.es.md).

## Mantenedor

Amirreza "Farnam" Taheri · [taherifarnam@gmail.com](mailto:taherifarnam@gmail.com) · [GitHub](https://github.com/AmirrezaFarnamTaheri/Scriptor)
