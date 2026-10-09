# Verificación

[English](VERIFICATION.md) · [فارسی](VERIFICATION.fa.md) · [简体中文](VERIFICATION.zh-CN.md) · [Русский](VERIFICATION.ru.md) · [Deutsch](VERIFICATION.de.md) · **Español**

Cada resultado debe identificar el commit exacto, entorno, arquitectura y artefactos. Un resultado anterior no certifica una implementación nueva.

## Evidencia y estado actual

Toda verificación ejecutable de esta revisión corre en trabajadores de GitHub. No se autoriza ejecutar localmente la aplicación, instalación, pruebas, compilación, lint, comprobación de tipos ni formateador. La inspección de código y las pruebas de regresión redactadas se registran aparte de las ejecuciones aprobadas.

| Evidencia | Significado |
|---|---|
| Verificado | El comando indicado pasó sobre el código identificado. |
| Validado estáticamente | Se comprobaron código o metadatos sin ejecutar el producto. |
| Revisado | Se inspeccionaron código, contratos o imágenes sin prueba ejecutable. |
| Pendiente | Falta ejecución requerida o evidencia manual. |
| Fallido | El comando se ejecutó y no pasó. |

El [registro Google](validation/GOOGLE-INTEGRATIONS-2026-10-09.md) recoge los cinco servicios, resultados de trabajadores y límites del proveedor. Las [limitaciones de dependencias](validation/SUPPLY-CHAIN-2026-10-04.md) no desaparecen por aprobar otra vía.

La evidencia actual reside en registros fechados: [revisión del producto](validation/CROSS-PRODUCT-REVIEW-2026-10-04.md), [zoom](validation/LEGACY-DIALOG-ZOOM-2026-10-08.md), [procedencia de capturas](validation/SCREENSHOT-REFRESH-2026-10-08.md), [personalización](validation/WORKSPACE-SHORTCUTS-2026-10-08.md) e [historia](validation/HISTORICAL_VERIFICATION.md). La versión española anterior conserva el [texto histórico con los destinos de los enlaces ajustados](validation/localized-verification-history/VERIFICATION.es.md). Las cifras históricas son procedencia, no afirmaciones actuales de finalización. La localización se exige en guías activas; los archivos de auditoría sensibles a procedencia quedan exentos.

## Comprobaciones del repositorio

Los trabajadores ejecutan desde la raíz:

```bash
pnpm check:source
pnpm check:governance
pnpm check:mcp
pnpm check:plugins
pnpm check:canvas
pnpm check:editor
pnpm check:portal
pnpm check:renderer
pnpm check:export
pnpm check:headless
pnpm check:citations
pnpm check:knowledge
pnpm check:merge
```

`check:source` cubre contratos IPC, módulos/procesos/unsafe de Rust, autorización nativa, política frontend, propiedad de módulos, benchmarks, confianza de releases y excepciones RustSec. `check:governance` cubre versiones, Actions inmutables, límites de paquetes, idiomas y contratos documentales/de licencia.

## Validación completa de ingeniería

Un candidato requiere un entorno limpio de GitHub, herramientas fijadas por los manifiestos y lockfiles congelados:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm lint
pnpm check:contracts
pnpm build
pnpm check:release
cargo fmt --all --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
cargo deny check
pnpm audit --prod
```

`pnpm build` incluye el grafo de producción y presupuesto gzip inicial; `pnpm lint` no permite advertencias ESLint. `check:release` requiere PowerShell 7 (`pwsh`) también en Linux/macOS. Axe requiere ChromeDriver compatible con Chrome; si falla su detección, `CHROMEWEBDRIVER` debe apuntar al directorio del controlador.

## Interfaz y accesibilidad

```bash
pnpm test:e2e
pnpm test:visual
pnpm check:a11y
pnpm check:a11y-axe
```

La matriz manual incluye 320/375/768/1024/1440 píxeles CSS, temas claro/oscuro/alto contraste, Windows/macOS/Linux, teclado, lector de pantalla, zoom de texto al 200 %, movimiento reducido y estados vacío, carga, error, éxito, confirmación destructiva y contenido largo.

Los menús Typography/Insert deben salir del recorte de la barra mediante portal, permanecer dentro del viewport tras redimensionar/desplazar y reposicionarse con cambios DOM acotados sin bucles React. La apertura por teclado enfoca el primer elemento; funcionan flechas, Home, End, Escape, Tab y clic exterior. Escape devuelve el foco al activador.

Las capturas esperan el encabezado previsto sin `.preview-error`. Solo las superficies estables usan baselines; las capturas de estado se adjuntan al trabajo alojado. El [catálogo](assets/screenshots/README.es.md) distingue capturas documentales nuevas de baselines guardadas.

## Release y recuperación

Todos los instaladores proceden del tag exacto auditado. Antes del empaquetado, la arquitectura del trabajador debe coincidir: Windows x86_64, macOS aarch64 y Linux x86_64/aarch64. La publicación separa exactamente siete instaladores en `release-artifacts` y cuatro registros `signing-evidence-<platform>-<architecture>.json` en `release-evidence`.

Los registros oficiales declaran `signed: false`, `notarized: false`, `signatureType: "none"`. Antes del recibo se ejecuta `node scripts/release/verify-signing-evidence.mjs release-evidence production`. `SHA256SUMS` incluye solo siete instaladores; el recibo de esquema 4 incorpora los cuatro registros normalizados. `node scripts/release/verify-release-evidence.mjs release-artifacts release-evidence` rechaza deriva del código, checkout sucio, archivos faltantes/adicionales, rutas inseguras, enlaces simbólicos, discrepancias checksum/SBOM e identidades incompletas.

Verifique procedencia GitHub, atestaciones SBOM y linaje inmutable por instalador. Las notas explican editor desconocido y comandos de checksum/atestación individuales. Registre instalaciones limpias y avisos del sistema. Pruebe rechazo de backups corruptos y restauración en cada OS, recuperación determinista tras interrupciones de restore/MCP y límites de rendimiento para escaneo, memoria, índice, búsqueda, grafo, editor y exportación.

## Invariantes e historial canónico

El despacho manual es una vista previa; publicar exige `publish: true` sobre un tag `v*` existente. **Release Kickoff** comprueba CI aprobada del commit exacto, exige la `VERSION` exacta, crea solo tags nuevos inmutables y despacha Release explícitamente. Cambiar la versión no crea tags; uno que apunta a otro commit falla y nunca se mueve.

La publicación automática sigue a builds y controles del tag aprobados. Pages conserva protección `github-pages`. Los manifiestos de actualización pertenecen al release inmutable; no hay tag móvil ni force-push. **Release** es el único propietario de releases. Los nombres con arquitectura evitan colisiones. No se suben internos desempaquetados ni evidencia CI; checksums de instaladores y metadatos de confianza se verifican por separado.

Desde un clon canónico completo:

```bash
bash scripts/governance/history-audit.sh . .history-audit
```

También se requiere un escáner autorizado de secretos de toda la historia y evidencia alojada de protección de ramas, revisiones, entornos y linaje. Un contrato de código no demuestra publicación. La finalización exige CI y **Visual review** del commit actual exacto, después el flujo de tag de producción y assets publicados. Los PR borrador aplazan controles pesados; `ready_for_review` inicia la matriz completa.
