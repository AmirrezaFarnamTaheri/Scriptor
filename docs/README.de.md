# Scriptor-Dokumentation

[English](README.md) · [فارسی](README.fa.md) · [简体中文](README.zh-CN.md) · [Русский](README.ru.md) · **Deutsch** · [Español](README.es.md)

> Die englische Dokumentation ist die kanonische Quelle. Diese Übersetzung ist auf natürliche und präzise Lesbarkeit ausgelegt; Code, Befehle, Pfade, API-Namen und Vertragskennungen bleiben unverändert.

## Maßgebliche Dokumente zum aktuellen Stand

| Dokument | Zweck |
|---|---|
| [`../README.de.md`](../README.de.md) | Überblick, Einrichtung, Verifikation und Release-Status |
| [`ARCHITECTURE.de.md`](ARCHITECTURE.de.md) | Laufzeittopologie, Zuständigkeiten sowie Vertrauens- und Fehlergrenzen |
| [`CAPABILITY-MATURITY.de.md`](CAPABILITY-MATURITY.de.md) | Status ausgelieferter, experimenteller, evaluierter und rein konzeptioneller Funktionen |
| [`../PRODUCT.de.md`](../PRODUCT.de.md) | Nutzerziele, Produktversprechen und Ausschlüsse |
| [`../DESIGN.de.md`](../DESIGN.de.md) | UI-System, Responsivität und Barrierefreiheit |
| [`../SECURITY.de.md`](../SECURITY.de.md) | Sicherheitsgrenzen und Meldeverfahren |
| [`RELEASE-SECURITY.de.md`](RELEASE-SECURITY.de.md) | Signierung, SBOM, Provenance und Verifikation durch Nutzer |
| [`ENCRYPTION-THREAT-MODEL.de.md`](ENCRYPTION-THREAT-MODEL.de.md) | Entscheidungsgate für experimentelle Verschlüsselung |
| [`OPERATIONS.de.md`](OPERATIONS.de.md) | Tracing, Korrelation, Zustand und Vorfälle |
| [`FINAL-REMEDIATION-REPORT.de.md`](FINAL-REMEDIATION-REPORT.de.md) | aktuelle v1-Produkt-, Schema- und Release-Basislinie |
| [`VERIFICATION.de.md`](VERIFICATION.de.md) | ausgeführte, statische, ausstehende, Release- und historische Nachweis-Gates |
| [`RELEASE-CHECKLIST.de.md`](RELEASE-CHECKLIST.de.md) | Go/No-Go-Checkliste für Produktion |

## Leitfäden für Nutzer und Beitragende

- [`guides/GETTING_STARTED.de.md`](guides/GETTING_STARTED.de.md)
- [`CAPABILITIES.de.md`](CAPABILITIES.de.md)
- [`../CONTRIBUTING.de.md`](../CONTRIBUTING.de.md)
- [`plugins/AUTHOR_GUIDE.de.md`](plugins/AUTHOR_GUIDE.de.md)
- [`contracts/COMMAND_CATALOG.de.md`](contracts/COMMAND_CATALOG.de.md)
- [`contracts/CONTRACT_INDEX.de.md`](contracts/CONTRACT_INDEX.de.md)
- [`contracts/CONTRACT_GOVERNANCE.de.md`](contracts/CONTRACT_GOVERNANCE.de.md)

## Design und Validierung

- [`design/DESIGN_SYSTEM.de.md`](design/DESIGN_SYSTEM.de.md)
- [`design/LAYOUT_BLUEPRINTS.de.md`](design/LAYOUT_BLUEPRINTS.de.md)
- [`validation/ACCESSIBILITY_AUDIT.de.md`](validation/ACCESSIBILITY_AUDIT.de.md)
- [`validation/FRONTEND_QUALITY.de.md`](validation/FRONTEND_QUALITY.de.md)
- [`assets/screenshots/README.de.md`](assets/screenshots/README.de.md)

## Architekturunterlagen

| Datei | Umfang |
|---|---|
| [`ARCHITECTURE.de.md`](ARCHITECTURE.de.md) | Laufzeittopologie, Zuständigkeiten, Vertrauens- und Fehlergrenzen |
| [`architecture/c4-container.de.md`](architecture/c4-container.de.md) | Laufzeitdiagramm auf Container-Ebene (Mermaid) |
| [`architecture/c4-context.de.md`](architecture/c4-context.de.md) | Context-Diagramm (Mermaid) |
| [`architecture/IPC_DAEMON.de.md`](architecture/IPC_DAEMON.de.md) | daemon-RPC-Oberfläche, Invarianten und Validierung |
| [`architecture/PLUGIN_SYSTEM.de.md`](architecture/PLUGIN_SYSTEM.de.md) | Plugin-Manifest, Safe Mode, Marketplace und Autorenerstellung |
| [`architecture/PERFORMANCE_ARCHITECTURE.de.md`](architecture/PERFORMANCE_ARCHITECTURE.de.md) | Optimierungsebenen, Zuständigkeiten und Performance-Budgets |
| [`architecture/TUI_PARITY.de.md`](architecture/TUI_PARITY.de.md) | Paritätsmodell der TTY-TUI zur Desktop-Oberfläche |

Alle Funktionsaussagen in diesen Dateien müssen mit [`CAPABILITY-MATURITY.de.md`](CAPABILITY-MATURITY.de.md) übereinstimmen. Ein Designdokument ist kein Nachweis dafür, dass eine Funktion ausgeliefert wird.

## Archivmaterial

Forschung vor v1 und überholte Designbewertungen bleiben unter [`_archived/`](_archived/) für historische Referenz erhalten und gehören nicht zum aktuellen Produktvertrag oder aktiven Übersetzungsumfang.

## Release-Referenzen

- [`release/SIGNING.de.md`](release/SIGNING.de.md)
- [`release/PANDOC_STRATEGY.de.md`](release/PANDOC_STRATEGY.de.md)
