[English](VERIFICATION.md) · [فارسی](VERIFICATION.fa.md) · [简体中文](VERIFICATION.zh-CN.md) · [Русский](VERIFICATION.ru.md) · [Deutsch](VERIFICATION.de.md) · **Español**

# Evidencia de verificación

**Fecha:** 2026-08-23 (evidencia local del repositorio; no implica que cada comando listado se haya vuelto a ejecutar en esta sesión)

Este documento describe la cadena de evidencia almacenada en el repositorio para higiene, contratos, seguridad, build, pruebas, packaging y provenance de release. Los comandos, nombres de archivo, identificadores, hashes y salidas de herramientas registrados se conservan sin traducir porque son evidencia técnica, no copy de producto.

## 1. Higiene local, descubrimiento y revisión de alcance

Antes de interpretar resultados se establece qué commit y qué fuentes son autoritativos. Se descartan deriva del working tree, archivos generados inesperados, artefactos locales obsoletos y documentación contradictoria.

Comprobaciones habituales del propio repositorio:

```powershell
git status --short
git rev-parse HEAD
git ls-files
pnpm version:check
pnpm check:source
pnpm check:docs
pnpm check:i18n
```

Esta fase también revisa `package.json`, `pnpm-lock.yaml`, `Cargo.toml`, `Cargo.lock`, `rust-toolchain.toml`, configuración Tauri, workflows de `.github/workflows/`, scripts de release y documentación de arquitectura/madurez. La implementación del commit exacto es la fuente de verdad; planes o auditorías históricas no sustituyen esta comprobación.

**Regla de aceptación:** una evidencia solo se atribuye a un candidato si está vinculada al mismo commit fuente o si su contrato de provenance demuestra una derivación explícitamente verificada.

## 2. Gate de seguridad y dependencias

La revisión cubre Node/pnpm, Rust/Cargo, GitHub Actions y herramientas externas. Los gates nativos del repositorio comprueban pinning de workflows, políticas de dependencias, inventario de lanzamiento de procesos y advisories conocidos.

```powershell
pnpm lint:actions
pnpm check:release-security
cargo deny check
cargo tree --workspace
```

Las excepciones RustSec no son una supresión general. La única superficie permitida es el registro versionado [`security/RUSTSEC-EXCEPTIONS.es.md`](security/RUSTSEC-EXCEPTIONS.es.md), con responsable, alcanzabilidad, fecha de revisión y condición de salida. Una vulnerabilidad nueva o actualizable sigue bloqueando el release.

La frontera de procesos también pertenece al gate: los procesos externos de producción deben atravesar la system bridge aprobada y validarse contra el inventario. Secrets, red, filesystem, mutaciones MCP y permisos de plugins se validan fail-closed en su frontera nativa de confianza.

## 3. Superficie de tipos, contratos y límites

Scriptor utiliza contratos Rust/TypeScript generados y contratos de fuente adicionales para impedir divergencia silenciosa entre renderer, Tauri, daemon, CLI/TUI y MCP.

```powershell
pnpm check:contracts
pnpm check:generated-contracts
pnpm lint:boundaries
pnpm check:source
pnpm check:frontend-quality
pnpm check:i18n
```

La superficie de comandos está documentada en [`contracts/COMMAND_CATALOG.es.md`](contracts/COMMAND_CATALOG.es.md). Los resultados de límites siguen [`contracts/BOUNDARY_OUTCOMES.es.md`](contracts/BOUNDARY_OUTCOMES.es.md): `value`, `absent-optional`, `invalid`, `degraded`, `failed` y `recovered` no pueden colapsarse en un único valor por defecto.

**Regla de aceptación:** todo command, RPC, tool MCP o entrada CLI nueva necesita owner, clase de permiso, entrada/salida tipada, semántica de fallo, auditoría y contrato de rollback o no-mutación.

## 4. Build y smoke de UI

El build de frontend y desktop verifica que TypeScript/React, el host Tauri y los assets empaquetados sean compatibles.

```powershell
pnpm install --frozen-lockfile
pnpm lint
pnpm build
cargo check --workspace
cargo fmt --all --check
cargo clippy --workspace --all-targets -- -D warnings
```

La evidencia específica de escritorio ejecuta las rutas Tauri en los sistemas soportados. Un web build verde no demuestra por sí solo integración desktop, capacidades nativas ni producción correcta de instaladores.

El smoke de UI cubre al menos apertura de vault, lectura/escritura de notas, readiness de índice/búsqueda, estados de error/recovery y navegación principal. Los modos E2E/screenshot no deben entrar en bundles de producción.

## 5. Suites de pruebas

La verificación combina contratos rápidos de fuente, pruebas JavaScript/TypeScript, Rust, Playwright E2E, accesibilidad y regresión visual. Ningún tipo sustituye a los demás.

```powershell
pnpm test:source
pnpm test:rust
pnpm test:e2e
pnpm test:visual
pnpm test:a11y
pnpm check:release
```

`pnpm check:release` es el gate agregado del release y ejecuta contract runners, verificaciones Rust, suites Playwright, auditorías de accesibilidad, smokes de daemon/TUI y gates de rendimiento exigidos para un candidato.

### E2E y visual

Playwright usa configuraciones y directorios de salida separados para E2E funcional y regresión visual estable. Las capturas canónicas de documentación son imágenes frescas del source actual; los snapshots estables de Windows son una superficie de aceptación separada. Consulte [`assets/screenshots/README.es.md`](assets/screenshots/README.es.md) y [`VISUAL-REVIEW.es.md`](VISUAL-REVIEW.es.md).

Los cambios intencionados de píxeles se revisan y actualizan expresamente. Nunca se aumenta la tolerancia global para ocultar una regresión.

### Accesibilidad

La evidencia combina axe con contratos manuales/automatizados de teclado y foco para modales, menús, Canvas/Graph, listas virtualizadas y controles de seguridad. El objetivo mínimo de las superficies de producto es WCAG 2.2 AA; los objetivos coarse-pointer son como mínimo de 44×44 px.

### Rendimiento

Los benchmarks tienen baselines versionados y umbrales definidos. Los gates detectan regresiones de arranque, indexación, búsqueda, grafo, vaults grandes y superficies intensivas en memoria; no pretenden comparar hardware arbitrario en términos absolutos.

## 6. Packaging e instaladores

Un release solo es un release de escritorio después de empaquetar correctamente cada plataforma. La matriz soportada corresponde a Windows, macOS y Linux declarados en README y documentación de release.

La evidencia de packaging comprueba:

- tipos de archivo y arquitecturas esperados;
- igualdad de versión entre `VERSION`, npm, Cargo y Tauri;
- contenido del bundle sin marcadores E2E/fault-injection;
- nombres y checksums de instaladores/bundles;
- ausencia de symlinks inesperados y rutas absolutas/traversal;
- asociación reproducible con el commit de release.

Los puntos de entrada están documentados bajo `scripts/release/`; el workflow de release crea los artefactos de plataforma y después los reúne en una etapa común de evidencia.

## 7. Evidencia de release, SBOM y provenance

La pipeline crea los archivos finales **después** de descargar todos los artefactos de plataforma. Entre los archivos autoritativos están:

```text
release-receipt.json
scriptor.cyclonedx.json
SHA256SUMS
```

El verificador trata el receipt como allowlist exacta. Artefactos ausentes, artefactos extra, checksums duplicados, symlinks, rutas absolutas/traversal, deriva del árbol fuente o deriva de metadata SBOM bloquean la promoción. Consulte [`evidence/README.es.md`](evidence/README.es.md) y [`RELEASE-SECURITY.es.md`](RELEASE-SECURITY.es.md).

Las attestations de GitHub y la identidad fuente registrada se generan solo después de verificar correctamente la evidencia local. Un archivo producido sin checkout Git canónico sirve para diagnóstico, pero no se acepta como provenance de producción.

## Verificación visual y artefactos de documentación

Los screenshots del repositorio son artefactos de documentación; por sí solos no prueban un release. Evidencia visual sólida registra commit exacto, SO/runner, browser/channel, viewport o device scale y resultado de la suite Playwright correspondiente.

La galería, reglas de captura y disciplina de revisión están en [`assets/screenshots/README.es.md`](assets/screenshots/README.es.md) y [`VISUAL-REVIEW.es.md`](VISUAL-REVIEW.es.md).

## Límites conocidos de la evidencia del repositorio

- Este documento registra evidencia local; la fecha no significa que cada comando haya sido reejecutado en sesiones posteriores.
- Un job verde aislado no sustituye la cadena de gates ligada al commit exacto.
- Logs locales o históricos de CI no pueden reasignarse a otro commit.
- Packaging, signing e instaladores dependientes de plataforma deben verificarse en la plataforma o workflow correspondiente.
- La existencia de tests no convierte capacidades design-only/experimentales en features de producción soportadas. El ledger de madurez sigue siendo autoritativo.

## Interpretación para release

Para publicar en producción, los gates actuales deben estar verdes sobre el commit exacto de release y los artefactos generados deben referenciar demostrablemente ese mismo commit. Si la evidencia histórica contradice la implementación actual, prevalecen la implementación reproducible actual y la verificación ligada al commit.
