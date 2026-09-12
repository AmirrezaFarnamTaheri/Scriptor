# Produkt

**Scriptor** · *Das Werkzeug für anspruchsvolles Schreiben* · Versionsquelle: [`VERSION`](VERSION)

## Positionierung

Scriptor ist ein Local-first-Markdown-Arbeitsbereich für anspruchsvolles Schreiben und Forschen. Er verbindet Schreiben, Evidenzverwaltung, Zitieren, Graph-Navigation, Git-aware Revision, reproduzierbares Publizieren und berechtigungsgebundene Automatisierung, während die Markdown-Dateien auf dem Datenträger maßgeblich bleiben.

## Betriebskontext

- Die Tauri-Desktop-Anwendung ist die primäre Produktoberfläche.
- Die Web-Shell dient Entwicklung und visuellen Tests.
- daemon, CLI/TUI, MCP-Server und der eingeschränkte Plugin-Katalog sind betriebliche Erweiterungen desselben Vault-Modells.
- Mobile, verschlüsselte Vaults, Embeddings, Tantivy und der WASM-Host bleiben gemäß [`docs/CAPABILITY-MATURITY.de.md`](docs/CAPABILITY-MATURITY.de.md) experimentell oder design-only.

## Vorliegende Evidenz

Produktaussagen stützen sich auf Repository-Artefakte und nicht auf Roadmap-Sprache:

- [`README.de.md`](README.de.md) definiert den aktuellen Release-Status und unterstützte Einstiegspunkte.
- [`docs/CAPABILITY-MATURITY.de.md`](docs/CAPABILITY-MATURITY.de.md) trennt implementierte, experimentelle und rein konzeptionelle Fähigkeiten.
- [`docs/ARCHITECTURE.de.md`](docs/ARCHITECTURE.de.md) hält Komponentenverantwortung und Vertrauensgrenzen fest.
- [`docs/VERIFICATION.de.md`](docs/VERIFICATION.de.md) definiert, was aktuelle Prüfungen beweisen und wo Evidenz aus einer sauberen Umgebung erforderlich ist.
- [`DESIGN.de.md`](DESIGN.de.md) legt Interaktions-, Accessibility- und Visual-System-Anforderungen fest.

## Produktgrundsätze

1. **Dateien bleiben maßgeblich.** Markdown bleibt portabel, prüfbar und wiederherstellbar.
2. **Befugnisse sind explizit.** Native-, Netzwerk-, Prozess-, Plugin-, MCP-, Backup-, Publishing- und destruktive Aktionen überschreiten benannte Berechtigungsgrenzen.
3. **Arbeit ist begrenzt.** Scans, Graph-Traversierungen, Process Output, Logs, Queues und aufbewahrte Records haben explizite Limits.
4. **Änderungen sind wiederherstellbar.** Hochwirksame Änderungen legen Umfang, geordnete Side Effects, Fehlerzustand und Recovery Evidence offen.
5. **Reife wird ehrlich dargestellt.** Implementiertes Verhalten, experimentelle Arbeit und Designoptionen werden nie als gleichwertige Garantien präsentiert.
6. **Der Workspace dient dem Schreiben.** Navigation, Diagnose und Automatisierung unterstützen das Dokument, statt es zu verdrängen.

## Nutzer und Aufgabe

Scriptor richtet sich an Schreibende, Forschende, Studierende, technische Autoren und Wissensarbeiter, die langfristige Markdown-Vaults pflegen. Sie nutzen Scriptor, um Material zu erfassen, Belege zu verknüpfen, lange Texte zu entwerfen und zu überarbeiten, Zitate zu verwalten, Wissensqualität zu prüfen, reproduzierbar zu veröffentlichen und begrenzte Aufgaben zu automatisieren, ohne die Dateikontrolle abzugeben.

## Produktversprechen

1. Markdown-Dateien bleiben portabel und maßgeblich.
2. Vor einer Hochrisikoaktion kann ein Nutzer erkennen, was gelesen, geschrieben, gesendet, ausgeführt oder gelöscht wird.
3. Zustand von Index, Graph, Git, Export und Backup ist beobachtbar und wiederherstellbar.
4. Der Schreibbereich bleibt auch bei dichter Forschungsarbeit ruhig und lesbar.
5. Experimentelle Fähigkeiten werden gekennzeichnet und nie als ausgelieferte Garantien dargestellt.

## Unterstützte Oberflächen

| Oberfläche | Reifegrad |
|---|---|
| Web development shell | für Entwicklung und visuelle Tests unterstützt |
| Tauri desktop (Windows, macOS, Linux) | primäre Produktoberfläche |
| Headless daemon und CLI/TUI | unterstützte Betriebsoberflächen |
| MCP stdio integration | mit scoped tools und dauerhaften Audit Records unterstützt |
| Plugin catalog | manifest-first, eingeschränkte experimentelle Plattform |
| Google Calendar und Tasks | experimentelle, opt-in Desktop-Integrationen |
| Mobile, encrypted vaults, embeddings, Tantivy, WASM host | experimentell oder design-only |

Die maßgebliche Matrix ist [`docs/CAPABILITY-MATURITY.de.md`](docs/CAPABILITY-MATURITY.de.md).

## Erfolgsmaßstäbe

- kein stiller Datenverlust und keine cross-vault mutation;
- begrenzter Speicherbedarf und begrenzte Latenz bei wachsendem Vault;
- reproduzierbare, quellzuordenbare Releases mit explizitem Trust Status, Checksums, CycloneDX-SBOMs, Receipts und Provenance Attestations;
- vollständig per Tastatur bedienbare, WCAG-2.2-AA-konforme Workflows;
- neue Beitragende finden Ownership, Contracts, Tests und Betriebsnachweise ohne Archäologie;
- zentrale Nutzerabläufe funktionieren ohne externen Netzwerkzugriff, außer bei ausdrücklich aktivierten Diensten.

## Produktausschlüsse

- proprietärer Speicher als Source of Truth;
- Ambient-AI- oder Plugin-Befugnisse;
- versteckte Netzwerk-Fallbacks;
- Chat-first-Navigation, die Schreiben verdrängt;
- dekoratives Dashboard-Chrome, das Arbeitsfläche reduziert;
- Sicherheitsbehauptungen für Prototyp-Verschlüsselung oder nicht isolierten Drittcode;
- Produktionskanäle, die den bewusst unsigned Trust Status offizieller Upstream-Installer verbergen oder falsch darstellen.

## Betriebsmodell

Scriptor ist local-first. Der Renderer gilt relativ zur nativen Autorität als nicht vertrauenswürdig. Tauri Commands, daemon RPC, MCP, externe Prozesse, Git, Keychain-Zugriff sowie Backup/Restore sind explizite Grenzen. Lokale Logs und Audit Records sind begrenzt und redigiert; hochintegre Mutation Records sind per Hash-Chain verkettet.

## Roadmap-Richtlinie

Roadmaps beschreiben Optionen, nicht aktuelles Verhalten. Eine Capability steigt erst auf, wenn sie Folgendes besitzt:

- benannten Owner und Source Entry Point;
- explizite Trust- und Failure-Semantik;
- positive, negative, restart-, cancellation- und recovery-Tests;
- Authorization-/Privacy-Modell;
- begrenzte Performance-Evidence;
- User-/Operator-Dokumentation;
- Release Inclusion und Support Status im Capability Ledger.
