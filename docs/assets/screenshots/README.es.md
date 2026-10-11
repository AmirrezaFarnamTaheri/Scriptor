[English](README.md) · [فارسی](README.fa.md) · [简体中文](README.zh-CN.md) · [Русский](README.ru.md) · [Deutsch](README.de.md) · **Español**

# Capturas de Scriptor

Capturas para documentación y marketing, generadas con Playwright en modo E2E.

## Capturas disponibles

| Captura | Descripción | Usada en |
|---|---|---|
| workspace-light.png | Workspace claro revisado | README / docs |
| workspace-dark.png | Workspace oscuro revisado | Docs + cobertura visual estable |
| workspace-tablet.png | Breakpoint del workspace a 1024 px | VISUAL-REVIEW |
| workspace-mobile.png | Workspace responsive a 820 px | VISUAL-REVIEW |
| editor-preview.png | Vista dividida editor/preview revisada | Docs + cobertura visual estable |
| inspector-preview.png | Inspector con controles editor/preview | VISUAL-REVIEW |
| command-palette.png | Command palette revisada | Docs + cobertura visual estable |
| graph.png | Grafo revisado | Docs + cobertura visual estable |
| canvas.png | Canvas espacial para organizar notas | VISUAL-REVIEW, STORE-MIGRATION, CAPABILITIES |
| git-panel.png | Estado, commit, pull/push de control de versiones | VISUAL-REVIEW, STORE-MIGRATION |
| mcp-panel.png | Autorización MCP y recetas guiadas | README / docs |
| mcp-tools.png | Outline de solo lectura en Tools | README / docs |
| mcp-audit.png | Audit tras Outline de solo lectura | README / docs |
| settings-appearance.png | Appearance: paleta, día/noche, fuente y densidad | README / docs |
| plugin-permissions.png | Permiso de lectura de Vault Lint antes de activar | README / docs |
| plugins-installed.png | Vault Lint activado con revocación por vault | README / docs |
| empty-note.png | Sin nota activa, acciones dentro del estado vacío | README / docs |
| settings.png | Config runtime/vault, apariencia, diagnóstico | VISUAL-REVIEW, STORE-MIGRATION |
| publish-center.png | Publish Center revisado | Docs + cobertura visual estable |
| vault-health.png | Dashboard de salud con lint y puntuaciones | VISUAL-REVIEW, RELEASE-CHECKLIST |
| knowledge-workbench.png | Knowledge Workbench | VISUAL-REVIEW |
| conflict-resolver.png | Merge de 3 vías con selección ours/theirs por hunk | VISUAL-REVIEW, STORE-MIGRATION |
| note-history.png | Historial de revisiones con restore | VISUAL-REVIEW |
| keyboard-shortcuts.png | Editor de atajos | VISUAL-REVIEW |
| onboarding-tour.png | Tour de primer inicio | VISUAL-REVIEW |
| plugins.png | Plugins propios instalados antes de revisar permisos | README / docs |
| editor-recovery.png | Estado fallback de recuperación del editor | VISUAL-REVIEW, RELEASE-CHECKLIST |
| mcp-sharing-inventory.png | Inventario de recursos y sharing MCP | VISUAL-REVIEW |
| toolbar-typography.png | Popover de tipografía | VISUAL-REVIEW |
| toolbar-insert.png | Popover de inserción | VISUAL-REVIEW |
| mobile-inspector.png | Inspector móvil a 390 px | VISUAL-REVIEW |
| mobile-vault.png | Panel vault móvil a 390 px | VISUAL-REVIEW |
| workspace-rendered.png | Modo de vista previa renderizada completa con encabezados markdown | VISUAL-REVIEW |
| task-list-preview.png | Elementos de lista de tareas renderizados con casillas interactivas | VISUAL-REVIEW |
| workspace-selector.png | Selector de espacio de trabajo e identidad de la bóveda activa en la barra superior | VISUAL-REVIEW |

### Cobertura de estados y límites de evidencia

**Workflow state screenshots** ejecuta suites seleccionadas de estados/recuperación de manera independiente y conserva informes del commit exacto; la suite funcional completa sigue siendo obligatoria aparte. `e2e/visual-state-evidence.ts` crea imágenes de viewport y detalle después de verificar contenido y layout. Son evidencia de estado separada de baselines y galería.

| Suite | Estados |
|---|---|
| `google-ecosystem-workflows.spec.ts` | Drive: selección, cancelación, binding y error de persistencia; Docs: vista previa, conflicto, consentimiento de pérdida y creación; Calendar: recursos, revisión/importación; RTL persa y zoom |
| `google-gmail-workflows.spec.ts` | Inbox, páginas deduplicadas, texto literal, importación, búsqueda, paginación, errores, desconexión, borradores conservados, modo oscuro/RTL/zoom |
| `source-files.spec.ts` | Formatos fuente, diagnósticos LaTeX, conflicto/descarte y modo oscuro |
| `overleaf-workflows.spec.ts` | Fuentes anidadas y rechazo de fuente obsoleta |
| `runtime-kernel.spec.ts` | Sesión, stdout, variables, plot decodificado y fallos de ciclo de vida |
| `asset-media.spec.ts` | Imagen decodificada, controles audio y rechazo |
| `workspace-shortcuts.spec.ts` | Personalización, overflow, error de persistencia y zoom |
| `workspace-leaves.spec.ts` | Grupos, paneles movidos y hojas inactivas restauradas |
| `semantic-visual-states.spec.ts` | Proyección 2D/3D, rotación, similitud, umbral vacío y fallo que conserva mediciones |

Las imágenes/plots son PNG deterministas de 320×200 con dimensiones decodificadas comprobadas. Demuestran layout, no una cámara ni un plot real de Python. Google nunca accede a cuentas reales. Una captura constituye evidencia ejecutada solo tras aprobar la suite alojada del commit e inspeccionar imágenes. Los estados docs-only incluyen permisos/activación/revocación de plugins, Outline/Audit MCP, Appearance, Canvas, grafo denso, triage, ayuda, selector nativo, RTL, alemán compacto, zoom/escala, carga, vault grande y diálogos oscuros. No prueban cliente MCP externo, autorización nativa ni instalación de terceros. El `<select>` nativo se comprueba semánticamente; su popup del OS no es un objetivo fiable de captura.

### Actualidad y aceptación

Los PNG de documentación son **capturas frescas del código fuente actual**, no copias de las líneas base de comparación de Playwright. Las pruebas primero capturan la página ya estabilizada directamente en `docs/assets/screenshots/` y, por separado, ejecutan `toHaveScreenshot` contra las líneas base estables de Windows en `e2e/screenshots.spec.ts-snapshots/`.

La separación es intencional. Una línea base almacenada puede seguir aceptándose si el render actual difiere dentro de la tolerancia visual configurada; copiar después esa línea base sobre la imagen fresca dejaría la documentación obsoleta aunque la suite visual pasara.

Las líneas base estables de Windows siguen siendo la superficie de aceptación de regresión visual. Los cambios intencionados de píxeles deben revisarse y actualizarse explícitamente con `--update-snapshots=all`; nunca se ocultan fallos aumentando la tolerancia global.

**Visual review** hace una sola comparación en Windows fijado con `--update-snapshots=none`; los PR no reescriben baselines. Los fallos ya conservan actual/diff, trazas, vídeos y capturas nuevas. Solo el refresh explícito cambia baselines. `visual-review.zip` contiene imágenes actuales únicas en `images/`; `image-manifest.json` registra SHA-256, tamaño y todas las rutas de origen. Los duplicados exactos se guardan una vez; no se suben árboles paralelos de resultados/baselines.

Las capturas responsive y de estados (`workspace-mobile`, `workspace-tablet`, vault/inspector móvil, recuperación del editor, inventario MCP y popovers) se generan desde salida de prueba en vivo y no se convierten en baseline estable salvo que la prueba use expresamente `toHaveScreenshot`.

## Regeneración

Las capturas se generan con Playwright en modo E2E. El bridge IPC simulado aporta fixtures, por lo que no hace falta un vault real ni un binario Tauri. Antes de escribir los píxeles, el capture espera fuentes, imágenes visibles, paneles lazy, transiciones finitas y un preview no degradado.

Captura local normal:

```powershell
pnpm screenshots:capture:web
```

Refresh visual intencional en Windows fijado:

```powershell
./scripts/screenshots/capture.ps1 -SkipDesktopBuild -UpdateBaselines
```

`-UpdateBaselines` regenera todos los snapshots estables de Windows con `--update-snapshots=all`, actualiza las capturas docs-only desde salida Playwright fresca y conserva las capturas escritas por `screenshots.spec.ts`. **No** copia PNG de baseline sobre el directorio de docs.

Después de publicar, `release.yml` despacha **Refresh documentation screenshots** sobre `main`. Captura el código actual de main, no píxeles del tag; el flujo separado debe concluir correctamente. También puede ejecutarse en un branch de revisión. Windows/Edge fijados comprueban contratos, actualizan docs/baselines, verifican sin actualizaciones y commitean solo PNG generados. El paquete con manifiesto deduplica SHA-256. El push no es forzado: si avanzó el branch, falla con seguridad y debe repetirse.

### Build en modo E2E

```powershell
pnpm exec vite build --mode e2e
```

Vite carga `.env.e2e`; no exporte `VITE_E2E_MODE` en la shell padre. Los builds E2E usan directorios de salida aislados en las configs Playwright. La validación del bundle de producción rechaza marcadores de fault injection de test si un entorno E2E se filtra en assets de release.

### Ejecutar pruebas de screenshots Playwright

```powershell
$env:VITE_SCREENSHOT_MODE = 'true'
$env:SCRIPTOR_CAPTURE_SCREENSHOTS = 'true'
pnpm exec playwright test --config playwright.e2e.config.ts e2e/screenshots.spec.ts --workers=1
```

### Sobrescribir canal del navegador

```powershell
$env:PLAYWRIGHT_CHANNEL = 'chrome'
```

## Arquitectura

La pipeline de screenshots usa el mismo bridge IPC E2E simulado que las pruebas funcionales:

- **`playwright.e2e.config.ts`** — config Playwright para E2E y capturas de documentación
- **`playwright.visual.config.ts`** — regresión visual estable y verificación de estados
- **`e2e/screenshots.spec.ts`** — escenarios estables; escribe capturas frescas y valida baselines
- **`e2e/visual-review.spec.ts`** — evidencia responsive/de estados
- **`scripts/screenshots/capture.ps1`** — contrato determinista de captura/orquestación
- **`scripts/validation/screenshot-capture-contracts.test.mjs`** — protección contra sobrescribir capturas frescas con baselines obsoletos
- **`src/e2e/bootstrap.ts`** — bridge simulado con datos de vault, Git, indexer y export
- **`src/e2e/state.ts`** — estado de notas in-memory del mock vault
- **`src/screenshot/fixture.ts`** — fixtures de vault, scan, graph y diagnósticos

Tras cambios UI que afecten layout o copy, regenere y revise los PNG. Registre navegador/canal, SO, commit fuente, viewport y resultado en el PR de release. Consulte [`../../validation/FRONTEND_QUALITY.es.md`](../../validation/FRONTEND_QUALITY.es.md).
