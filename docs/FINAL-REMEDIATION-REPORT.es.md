<div dir="ltr" align="center">
[English](FINAL-REMEDIATION-REPORT.md) · [فارسی](FINAL-REMEDIATION-REPORT.fa.md) · [简体中文](FINAL-REMEDIATION-REPORT.zh-CN.md) · [Русский](FINAL-REMEDIATION-REPORT.ru.md) · [Deutsch](FINAL-REMEDIATION-REPORT.de.md) · **Español**
</div>

# Línea base del producto V1

**Versión del producto:** se controla en [`VERSION`](../VERSION)  
**Contrato:** una única fuente, API y schema actuales para el estado persistente.

## Frontera del producto

Scriptor v1 define una única autoridad para cada responsabilidad duradera:

- el vault es dueño del contenido, las decisiones de capability, los audit records y los datos de recuperación;
- los adaptadores native validan y autorizan cada operación de filesystem, process, IPC y capability-sensitive;
- el renderer solo posee presentation state, ciclo de vida de request y read models en caché;
- los package contracts definen exactamente las interfaces de renderer, desktop, daemon, CLI, MCP y plugins.

Los datos persistentes del browser deben usar el envelope actual y validado. Los valores inválidos u obsoletos se ponen en quarantine y nunca se interpretan como estado vivo. El plugin state se guarda en el vault. Canvas storage usa identificadores canónicos y rechaza archivos noncanonical.

## Requisitos de release V1

Un release solo es apto cuando el source head exacto ha superado las comprobaciones aplicables de locked dependencies, Rust, browser, accessibility, desktop, artifacts y recovery definidas en [`VERIFICATION.es.md`](VERIFICATION.es.md). Los release artifacts deben construirse desde el tag inmutable `v1.0.0` y quedar ligados a checksums, SBOMs, receipts y GitHub attestations según [`RELEASE-SECURITY.es.md`](RELEASE-SECURITY.es.md).

Las capacidades experimentales permanecen fuera de las afirmaciones de producto soportado hasta cumplir los requisitos de graduación de [`CAPABILITY-MATURITY.es.md`](CAPABILITY-MATURITY.es.md).

## Higiene del repositorio

El árbol distribuido contiene únicamente documentación actual de producto y operación. Los planes sustituidos, review packets, forensic snapshots y entradas históricas del changelog se excluyen deliberadamente del contrato v1.
