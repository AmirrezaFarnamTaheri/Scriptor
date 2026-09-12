# V1-Produktbasislinie

**Produktversion:** wird in [`VERSION`](../VERSION) geführt  
**Vertrag:** eine aktuelle Quelle, API und Schema für persistenten Zustand.

## Produktgrenze

Scriptor v1 hat für jeden dauerhaften Belang genau eine Autorität:

- der Vault besitzt Inhalte, Capability-Entscheidungen, Audit Records und Wiederherstellungsdaten;
- native Adapter validieren und autorisieren jede Filesystem-, Process-, IPC- und capability-sensitive Operation;
- der Renderer besitzt ausschließlich Presentation State, Request-Lifecycle und gecachte Read Models;
- Package Contracts definieren exakt die Schnittstellen von Renderer, Desktop, daemon, CLI, MCP und Plugins.

Persistierte Browser-Daten müssen den aktuellen validierten Envelope verwenden. Ungültige oder veraltete Werte werden quarantänisiert und niemals als Live-Zustand interpretiert. Plugin State ist vault-gebunden. Canvas Storage verwendet kanonische Kennungen und verwirft nicht-kanonische Dateien.

## V1-Release-Anforderungen

Ein Release ist nur zulässig, wenn der exakte Source Head die anwendbaren Prüfungen für locked dependencies, Rust, Browser, Accessibility, Desktop, Artifacts und Recovery aus [`VERIFICATION.de.md`](VERIFICATION.de.md) bestanden hat. Release-Artefakte müssen aus dem unveränderlichen Tag `v1.0.0` gebaut und gemäß [`RELEASE-SECURITY.de.md`](RELEASE-SECURITY.de.md) an Checksums, SBOMs, Receipts und GitHub Attestations gebunden sein.

Experimentelle Fähigkeiten bleiben aus Aussagen über unterstützte Produktfunktionen ausgeschlossen, bis sie die Graduation-Anforderungen aus [`CAPABILITY-MATURITY.de.md`](CAPABILITY-MATURITY.de.md) erfüllen.

## Repository-Hygiene

Der ausgelieferte Baum enthält nur aktuelle Produkt- und Betriebsdokumentation. Überholte Pläne, Review Packets, Forensic Snapshots und historische Changelog-Einträge sind bewusst nicht Teil des v1-Vertrags.
