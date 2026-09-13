[English](MOBILE_ARCHITECTURE.md) · [فارسی](MOBILE_ARCHITECTURE.fa.md) · [简体中文](MOBILE_ARCHITECTURE.zh-CN.md) · [Русский](MOBILE_ARCHITECTURE.ru.md) · **Deutsch** · [Español](MOBILE_ARCHITECTURE.es.md)

# Mobile-Architektur

**Reifegrad:** nur Design / in Inkubation.  
**Auslieferungsstatus:** kein Bestandteil des unterstützten Scriptor-1.0-Desktopprodukts.  
**Autorität:** [`PRODUCT.de.md`](../../PRODUCT.de.md) und [`CAPABILITY-MATURITY.de.md`](../CAPABILITY-MATURITY.de.md).

## Zweck

Dieses Dokument definiert die Architekturgrenze für künftige Mobile-Arbeit, ohne eine ausgelieferte Android- oder iOS-Anwendung zu behaupten. Unterstütztes Produkt bleibt die Tauri-Desktopanwendung für Windows, macOS und Linux. Mobile-Prototypen dürfen portable Domänenlogik und User-Flows erproben, aber den Supportvertrag nicht stillschweigend erweitern.

## Architekturvertrag

Ein künftiger Mobile-Client muss dieselben Produktinvarianten wie Desktop bewahren:

1. **Markdown ist maßgeblich.** Notizen bleiben gewöhnliche Dateien; ein Mobile-Index ist abgeleitet und neu aufbaubar.
2. **Portable Domänenlogik bleibt unter Plattformadaptern.** Parsing, Task-Semantik, Link-Auflösung, Templates, Merge-Logik und andere deterministische Regeln gehören in gemeinsame Packages/Crates, wenn ihre APIs plattformneutral sind.
3. **Native Fähigkeiten sind explizite Adapter.** Dateiauswahl, Hintergrundarbeit, Benachrichtigungen, sichere Speicherung, Share Sheets und Plattform-Lifecycle liegen hinter Mobile-spezifischen Grenzen.
4. **Keine versteckte Cloud-Abhängigkeit.** Künftiger Sync ist optional und separat threat-modeled; Mobile ändert das local-first-Autoritätsmodell standardmäßig nicht.
5. **Vertrauensgrenzen bleiben fail-closed.** Externe Intents, importierte Dateien, Plugin/Tool-Ausführung und künftige Remote-Synchronisierung benötigen explizite Validierung und begrenzte Ressourcen.
6. **Verhaltensparität wird per Vertrag, nicht per UI-Kopie belegt.** Gemeinsame Fixtures und generierte Contracts sollen Note/Task/Link-Semantik über Desktop und Mobile beweisen.

## Vorgeschlagene Topologie

```text
mobile UI / navigation
        |
        v
mobile application adapter
        |
        +--> shared TypeScript domain packages
        |
        +--> native mobile capability adapters
                 |-- filesystem / document provider
                 |-- secure settings / credentials
                 |-- notifications / background scheduling
                 `-- optional sync transport (future, separately governed)
```

Vorhandenes Material unter `apps/mobile/` ist daher explorativ. Desktop-Release-Gates dürfen es nicht wie ein Produktionsziel behandeln; Packaging-Kommentare dürfen Android/iOS nicht als aktuell unterstützte Release-Plattformen darstellen.

## Promotion-Gates

Mobile kann von **Design-only** zu **Experimental** wechseln, wenn Folgendes vorhanden ist:

- benannte Runtime/Toolchain und reproduzierbarer Build-Einstieg;
- Plattform-Datenautoritätsdesign, das Markdown-Portabilität erhält;
- Threat Models für Berechtigungen, Hintergrundausführung und sichere Speicherung;
- Contract-Tests für gemeinsame Note/Task/Link-Semantik;
- Migration/Backup/Recovery für benutzerverfasste Dateien;
- Accessibility- und Lifecycle-Tests auf mindestens einer realen Geräteklasse;
- explizite Supportmatrix in `PRODUCT.md` und `CAPABILITY-MATURITY.md`.

Für **Production** sind zusätzlich Release-Packaging, Signing/Trust-Policy, Crash/Diagnostik-Support, Upgrade/Rollback und dieselben Release-Evidenzstandards wie auf Desktop erforderlich.

## Nichtziele der aktuellen Version

- keine Behauptung von Android- oder iOS-Feature-Parität;
- kein Mobile-Installer/Package im Desktop-Release;
- keine Mobile-spezifische Kompatibilitätslast für Desktop-Interna;
- keine Cloud-Kontopflicht allein für künftige Mobile-Arbeit.
