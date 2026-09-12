# Primeros pasos con Scriptor

[English](GETTING_STARTED.md) · [فارسی](GETTING_STARTED.fa.md) · [简体中文](GETTING_STARTED.zh-CN.md) · [Русский](GETTING_STARTED.ru.md) · [Deutsch](GETTING_STARTED.de.md) · **Español**

Scriptor es un espacio de conocimiento Markdown local-first. Esta guía cubre la instalación, cómo abrir el primer vault y los flujos de trabajo principales que usará a diario.

Para **compilar desde el código fuente**, consulte la sección **Build from source** de [`README.es.md`](../../README.es.md).

## Instalación

Descargue la versión más reciente para su plataforma desde [GitHub Releases](https://github.com/AmirrezaFarnamTaheri/Scriptor/releases):

| Plataforma | Formatos |
|---|---|
| Windows | Instalador MSI o NSIS |
| macOS | DMG |
| Linux | DEB o AppImage |

Los instaladores de producción se publican intencionadamente sin firma. Consulte [`docs/RELEASE-SECURITY.es.md`](../RELEASE-SECURITY.es.md) para conocer el flujo completo de verificación.

## Abrir un vault

1. Inicie **Scriptor**.
2. Elija **Open Vault** y seleccione cualquier carpeta que contenga notas Markdown.
3. Scriptor indexa el vault en segundo plano; no necesita una base de datos propietaria.

Sus archivos siguen siendo Markdown normal en disco. Scriptor los lee y escribe directamente.

### Configuración del vault

La configuración vive en `.scriptor/config.json`. Los snippets, perfiles de exportación y manifiestos de plugins también se guardan bajo `.scriptor/`.

## El espacio de trabajo

| Región | Función |
|---|---|
| **Barra lateral del vault** | Explorar, buscar y filtrar notas; crear notas diarias y plantillas |
| **Editor** | Escribir en modo Source, Split o Preview con Monaco o CodeMirror |
| **Rail del inspector** | Esquema, enlaces, backlinks, citas, salud de notas y perfiles de exportación |
| **Dock de estado** | Log de salida, resultados de búsqueda, diagnósticos y jobs en segundo plano |

Use los modos de workspace de la barra superior — **Writing**, **Knowledge**, **Publish**, **Review**, **Automation** — para orientar la toolbar y la command palette a la tarea actual.

## Flujos de trabajo principales

| Tarea | Escritorio | Terminal (`scriptor tui`) |
|---|---|---|
| Explorar notas | Barra lateral del vault | `j` / `k` |
| Buscar | Búsqueda lateral o `Ctrl+K` | `/` y consulta |
| Command palette | `Ctrl+K` o búsqueda superior | — |
| Vista previa | Modo **Split** o **Preview** del editor | `p` |
| Backlinks | Rail del inspector | `b` |
| Grafo | Botón **Graph** (teclado: flechas, Enter, Escape) | `g` |
| Salud del vault | **Note Health** del inspector o Settings | `h` |
| Exportar | Perfiles del inspector o **Publish** | `scriptor export` |
| Estado Git | Indicador Git de la barra superior | — |
| Resolver conflictos | UI de conflicto de tres vías con columna base | — |
| Atajos de teclado | Settings → Keyboard Shortcuts | — |
| Backups programados | Settings → Vault Snapshots | — |

## Configurar la exportación

Scriptor exporta mediante [Pandoc](https://pandoc.org/). Instale Pandoc para realizar exportaciones reales a HTML, PDF, DOCX, LaTeX, ePub y Reveal.js:

```powershell
# Windows
winget install --id JohnMacFarlane.Pandoc

# macOS
brew install pandoc
```

Las previsualizaciones dry-run funcionan sin Pandoc. Consulte [`docs/release/PANDOC_STRATEGY.es.md`](../release/PANDOC_STRATEGY.es.md) para detección, overrides y resolución de problemas.

## Opcional: motor headless

Active **Settings → Headless engine** para enrutar indexación, búsqueda, backlinks, grafo, estado Git y jobs de exportación a través del daemon local. Abrir el vault y canvas permanecen in-process para mantener la respuesta rápida. Consulte [`docs/architecture/IPC_DAEMON.es.md`](../architecture/IPC_DAEMON.es.md).

## Lecturas adicionales

- [`docs/CAPABILITIES.es.md`](../CAPABILITIES.es.md) — mapa completo de funciones
- [`docs/contracts/COMMAND_CATALOG.es.md`](../contracts/COMMAND_CATALOG.es.md) — comandos Tauri, daemon y CLI
- [`docs/architecture/PLUGIN_SYSTEM.es.md`](../architecture/PLUGIN_SYSTEM.es.md) — plugins y marketplace
- [`docs/plugins/AUTHOR_GUIDE.es.md`](../plugins/AUTHOR_GUIDE.es.md) — guía de autores y tutorial hello-world
- [`DESIGN.es.md`](../../DESIGN.es.md) — superficie del editor, sistema de diseño y contrato de accesibilidad
- [`docs/design/DESIGN_SYSTEM.es.md`](../design/DESIGN_SYSTEM.es.md) — tokens del sistema visual
- [`docs/brand/BRAND.md`](../brand/BRAND.md) — logo y wordmark
- [`docs/assets/screenshots/README.es.md`](../assets/screenshots/README.es.md) — regenerar screenshots de UI
