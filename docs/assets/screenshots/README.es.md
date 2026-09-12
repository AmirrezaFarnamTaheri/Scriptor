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
| mcp-panel.png | Panel MCP revisado | Docs + cobertura visual estable |
| settings.png | Config runtime/vault, apariencia, diagnóstico | VISUAL-REVIEW, STORE-MIGRATION |
| publish-center.png | Publish Center revisado | Docs + cobertura visual estable |
| vault-health.png | Dashboard de salud con lint y puntuaciones | VISUAL-REVIEW, RELEASE-CHECKLIST |
| knowledge-workbench.png | Knowledge Workbench | VISUAL-REVIEW |
| conflict-resolver.png | Merge de 3 vías con selección ours/theirs por hunk | VISUAL-REVIEW, STORE-MIGRATION |
| note-history.png | Historial de revisiones con restore | VISUAL-REVIEW |
| keyboard-shortcuts.png | Editor de atajos | VISUAL-REVIEW |
| onboarding-tour.png | Tour de primer inicio | VISUAL-REVIEW |
| plugins.png | Descubrimiento y gestión de plugins | VISUAL-REVIEW, STORE-MIGRATION, CAPABILITIES |
| editor-recovery.png | Estado fallback de recuperación del editor | VISUAL-REVIEW, RELEASE-CHECKLIST |
| mcp-sharing-inventory.png | Inventario de recursos y sharing MCP | VISUAL-REVIEW |
| toolbar-typography.png | Popover de tipografía | VISUAL-REVIEW |
| toolbar-insert.png | Popover de inserción | VISUAL-REVIEW |
| mobile-inspector.png | Inspector móvil a 390 px | VISUAL-REVIEW |
| mobile-vault.png | Panel vault móvil a 390 px | VISUAL-REVIEW |

### Actualidad y aceptación

Los PNG de documentación son **capturas frescas del código fuente actual**, no copias de las líneas base de comparación de Playwright. Las pruebas primero capturan la página ya estabilizada directamente en `docs/assets/screenshots/` y, por separado, ejecutan `toHaveScreenshot` contra las líneas base estables de Windows en `e2e/screenshots.spec.ts-snapshots/`.

La separación es intencional. Una línea base almacenada puede seguir aceptándose si el render actual difiere dentro de la tolerancia visual configurada; copiar después esa línea base sobre la imagen fresca dejaría la documentación obsoleta aunque la suite visual pasara.

Las líneas base estables de Windows siguen siendo la superficie de aceptación de regresión visual. Los cambios intencionados de píxeles deben revisarse y actualizarse explícitamente con `--update-snapshots=all`; nunca se ocultan fallos aumentando la tolerancia global.

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

El repositorio también ofrece el workflow manual **Refresh documentation screenshots**. Ejecútelo en una rama de revisión, no en `main`. Usa `windows-2025` fijado y Edge, ejecuta pruebas de contrato de captura, regenera docs y baselines de Windows, verifica la suite visual completa sin actualizar snapshots y commitea únicamente los PNG generados en la rama seleccionada.

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
