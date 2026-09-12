# Sicherheitsrichtlinie

[English](SECURITY.md) · [فارسی](SECURITY.fa.md) · [简体中文](SECURITY.zh-CN.md) · [Русский](SECURITY.ru.md) · **Deutsch** · [Español](SECURITY.es.md)

## Sicherheitslücke melden

Öffnen Sie bei einer vermuteten Sicherheitslücke kein öffentliches Issue. Senden Sie stattdessen eine E-Mail an **taherifarnam@gmail.com** mit folgenden Angaben:

- betroffene Version bzw. betroffener Commit;
- Umgebung und Voraussetzungen;
- reproduzierbare Schritte oder Proof of Concept;
- Auswirkungen sowie überschrittene Daten- oder Berechtigungsgrenzen;
- gewünschte Embargofrist oder sonstiger Koordinationsbedarf.

Fügen Sie keine echten Geheimnisse oder personenbezogenen Daten Dritter bei. Meldungen werden so bald wie praktikabel bestätigt; der Zeitpunkt einer Veröffentlichung wird abgestimmt, sobald Auswirkungen und Behebung hinreichend verstanden sind.

## Unterstützte Version

Sicherheitskorrekturen werden nur für die aktuelle getaggte Version und den aktuellen `main`-Branch bereitgestellt. Die Release-Identität wird durch [`VERSION`](VERSION) festgelegt.

## Vertrauensgrenzen

- **Renderer:** gilt gegenüber nativen Dateisystem-, Schlüsselbund-, Prozess-, Backup-, Git-, Netzwerk- und Veröffentlichungsrechten als nicht vertrauenswürdig.
- **Tauri-Befehle:** werden nach Operation klassifiziert; sensible Befehle benötigen eine neue, einmalig verwendbare und auf den jeweiligen Umfang beschränkte Freigabe, die nach nativer Bestätigung durch den Benutzer erteilt wird.
- **Daemon/IPC:** lokaler Endpunkt für denselben Benutzer mit HMAC-geschützten Endpunkt-Metadaten, einem endpunktspezifischen Nonce für jede Anfrage und jedes Event-Abonnement, typisierten/versionierten Nachrichten, begrenzten Frames/Queues, automatischer authentifizierter Neuanmeldung sowie expliziter Zustandssynchronisierung nach Unterbrechung des Event-Streams. Unter Windows beruht die Sicherheit lokaler TCP-/Named-Pipe-Endpunkte auf HMAC-SHA256-Bearer-Token-Authentifizierung; das Token liegt im benutzerspezifischen `%LOCALAPPDATA%` oder im OS Credential Manager und nicht unter Unix-Socket-Dateisystemberechtigungen.
- **MCP:** explizite Tools, dauerhafte Intent-/Outcome-Audit-Datensätze, Idempotency Keys, begrenzte Logs und Wiederherstellung ausstehender Intents.
- **Externe Tools/Code-Chunks:** werden über den Process Broker gestartet, einschließlich Auflösung der ausführbaren Datei, Bereinigung der Umgebung, Netzwerkregeln, Zeit-/Ausgabelimits, Abbruch des Prozessbaums und Receipts.
- **Plugins:** die aktuelle Laufzeit ist eingeschränkt und manifest-first; Berechtigungszustimmung, signierte Drittanbieter-Verteilung und isolierte Ausführung bleiben Voraussetzungen für die Freigabe als ausgereifte Funktion.
- **KI-Anbieter:** Zugangsdaten verbleiben innerhalb der nativen Schlüsselbundgrenze; Netzwerkaufrufe werden von Rust über validierte Endpunkte ausgeführt und geben JavaScript keine Rohgeheimnisse preis.

## Daten und Datenschutz

Scriptor ist local-first und benötigt keine Telemetrie. Diagnosedaten sind opt-in und dürfen nur freigegebene, redigierte Felder enthalten. Remote-PlantUML und entfernte Schriftarten sind deaktiviert. Jede optionale Remote-Integration muss Endpunkt und übertragene Daten ausdrücklich benennen.

## Verschlüsselungsstatus

`crates/vault/src/encryption.rs` enthält versionierte kryptografische Primitive und Tests. **Verschlüsselte Vaults sind experimentell und keine unterstützte Ende-zu-Ende-Sicherheitsfunktion.** Indizes, Backups, Git-Verlauf, temporäre Dateien, Metadatenlecks, Schlüsselwiederherstellung und Migration werden nicht allein durch ein dateibezogenes kryptografisches Primitiv gelöst. Siehe [`docs/ENCRYPTION-THREAT-MODEL.de.md`](docs/ENCRYPTION-THREAT-MODEL.de.md).

## Release-Integrität

Die offiziellen Upstream-Produktionsinstaller sind absichtlich nicht signiert. Ihre Vertrauensdatensätze weisen ausdrücklich aus, dass Plattformsignierung und Notarisierung fehlen. Eine Produktionsveröffentlichung verlangt stattdessen für jedes Ziel einen expliziten Trust-Status-Datensatz, SHA-256-Prüfsummen, eine CycloneDX-SBOM, einen unveränderlichen Release-Receipt, die exakte Quellidentität und GitHub-Provenance-Attestierungen. Verifikationsanleitung: [`docs/RELEASE-SECURITY.de.md`](docs/RELEASE-SECURITY.de.md).
Die Go/No-Go-Abfolge für die Produktion steht in [`docs/RELEASE-CHECKLIST.de.md`](docs/RELEASE-CHECKLIST.de.md); die aktuelle Terminologie für Nachweise und noch nicht verifizierte Bereiche ist in [`docs/VERIFICATION.de.md`](docs/VERIFICATION.de.md) dokumentiert.

## Abhängigkeits- und CI-Richtlinie

- Lockfiles sind Validierungseingaben und dürfen von Audit-Jobs nicht verändert werden;
- externe GitHub Actions verwenden geprüfte, unveränderliche Commit-SHAs mit exakten Versionskommentaren;
- Node, pnpm, Rust, Runner und Release-Werkzeuge sind versioniert festgelegt;
- `cargo deny`, `pnpm audit --prod` sowie Gates für Action-Pins, Versionen, Grenzen, Dokumentation und Source Contracts laufen in CI;
- Abhängigkeitsaktualisierungen erfolgen in separaten, geprüften Änderungen.
