# Documentación de Scriptor

[English](README.md) · [فارسی](README.fa.md) · [简体中文](README.zh-CN.md) · [Русский](README.ru.md) · [Deutsch](README.de.md) · **Español**

> La documentación en inglés es la fuente canónica. Esta traducción busca una lectura natural y precisa; el código, los comandos, las rutas, los nombres de API y los identificadores de contrato se mantienen sin cambios.

## Documentos autoritativos del estado actual

| Documento | Propósito |
|---|---|
| [`../README.es.md`](../README.es.md) | visión general, instalación, verificación y postura de release |
| [`ARCHITECTURE.es.md`](ARCHITECTURE.es.md) | topología de runtime, propiedad y fronteras de confianza y fallo |
| [`CAPABILITY-MATURITY.es.md`](CAPABILITY-MATURITY.es.md) | estado de funciones publicadas, experimentales, en evaluación y solo diseñadas |
| [`../PRODUCT.es.md`](../PRODUCT.es.md) | resultados para el usuario, promesas y exclusiones |
| [`../DESIGN.es.md`](../DESIGN.es.md) | sistema de UI, responsividad y accesibilidad |
| [`../SECURITY.es.md`](../SECURITY.es.md) | frontera de seguridad y política de reporte |
| [`RELEASE-SECURITY.es.md`](RELEASE-SECURITY.es.md) | firma, SBOM, provenance y verificación del consumidor |
| [`ENCRYPTION-THREAT-MODEL.es.md`](ENCRYPTION-THREAT-MODEL.es.md) | gate de decisión para cifrado experimental |
| [`OPERATIONS.es.md`](OPERATIONS.es.md) | tracing, correlación, salud e incidentes |
| [`FINAL-REMEDIATION-REPORT.es.md`](FINAL-REMEDIATION-REPORT.es.md) | línea base actual de producto v1, schema y release |
| [`VERIFICATION.es.md`](VERIFICATION.es.md) | gates de evidencia ejecutada, estática, pendiente, de release e histórica |
| [`RELEASE-CHECKLIST.es.md`](RELEASE-CHECKLIST.es.md) | checklist go/no-go de producción |

## Guías para usuarios y contribuidores

- [`guides/GETTING_STARTED.es.md`](guides/GETTING_STARTED.es.md)
- [`CAPABILITIES.es.md`](CAPABILITIES.es.md)
- [`../CONTRIBUTING.es.md`](../CONTRIBUTING.es.md)
- [`plugins/AUTHOR_GUIDE.es.md`](plugins/AUTHOR_GUIDE.es.md)
- [`contracts/COMMAND_CATALOG.es.md`](contracts/COMMAND_CATALOG.es.md)
- [`contracts/CONTRACT_INDEX.es.md`](contracts/CONTRACT_INDEX.es.md)
- [`contracts/CONTRACT_GOVERNANCE.es.md`](contracts/CONTRACT_GOVERNANCE.es.md)

## Diseño y validación

- [`design/DESIGN_SYSTEM.es.md`](design/DESIGN_SYSTEM.es.md)
- [`design/LAYOUT_BLUEPRINTS.es.md`](design/LAYOUT_BLUEPRINTS.es.md)
- [`validation/ACCESSIBILITY_AUDIT.es.md`](validation/ACCESSIBILITY_AUDIT.es.md)
- [`validation/FRONTEND_QUALITY.es.md`](validation/FRONTEND_QUALITY.es.md)
- [`assets/screenshots/README.es.md`](assets/screenshots/README.es.md)

## Registros de arquitectura

| Archivo | Alcance |
|---|---|
| [`ARCHITECTURE.es.md`](ARCHITECTURE.es.md) | topología de runtime, propiedad, confianza y fronteras de fallo |
| [`architecture/c4-container.es.md`](architecture/c4-container.es.md) | diagrama de runtime a nivel Container (Mermaid) |
| [`architecture/c4-context.es.md`](architecture/c4-context.es.md) | diagrama Context (Mermaid) |
| [`architecture/IPC_DAEMON.es.md`](architecture/IPC_DAEMON.es.md) | superficie RPC del daemon, invariantes y validación |
| [`architecture/PLUGIN_SYSTEM.es.md`](architecture/PLUGIN_SYSTEM.es.md) | manifest de plugins, modo seguro, marketplace y autoría |
| [`architecture/PERFORMANCE_ARCHITECTURE.es.md`](architecture/PERFORMANCE_ARCHITECTURE.es.md) | capas de optimización, responsables y presupuestos de rendimiento |
| [`architecture/TUI_PARITY.es.md`](architecture/TUI_PARITY.es.md) | modelo de paridad de la TTY TUI con la superficie desktop |

Todas las afirmaciones sobre capacidades en estos archivos deben concordar con [`CAPABILITY-MATURITY.es.md`](CAPABILITY-MATURITY.es.md). Un documento de diseño no demuestra por sí solo que una capacidad se distribuya.

## Material archivado

La investigación previa a v1 y las evaluaciones de diseño sustituidas se conservan en [`_archived/`](_archived/) como referencia histórica y no forman parte del contrato actual del producto ni del alcance activo de localización.

## Referencias de release

- [`release/SIGNING.es.md`](release/SIGNING.es.md)
- [`release/PANDOC_STRATEGY.es.md`](release/PANDOC_STRATEGY.es.md)
