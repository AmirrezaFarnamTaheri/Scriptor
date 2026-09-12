# Betrieb und Diagnose

## Strukturiertes Tracing

Desktop, daemon und CLI initialisieren strukturiertes JSON-Tracing über `crates/system-bridge/src/observability.rs`. Felder mit Secret-/Token-/Password-/Key-Namen werden redigiert. Lokale Dateien rotieren nach Größe; die Zahl der aufbewahrten Segmente ist begrenzt.

## Korrelation

Lang laufende und grenzüberschreitende Vorgänge sollten dieselbe operation/request ID vom Renderer-Befehl über den Tauri-/daemon-Adapter bis zum Receipt des externen Prozesses und zum Audit Event weitergeben. Ein Fehlerbericht soll anhand dieser ID diagnostizierbar sein, ohne Quellcode lesen zu müssen.

## Gesundheitssignale

- Watcher-Generation und rescan-required-Zustand;
- Index-Generation/-Aktualität;
- verlorene daemon subscriber;
- Ergebnisse von Process timeout/cancel/truncation;
- ausstehende MCP intents;
- Backup-Verifikation und Restore-Journal;
- Zustand von Log rotation/repair.

## Erfassung bei Vorfällen

Verwende ausschließlich redigierte Diagnosedaten. Hänge niemals einen echten Vault, Keychain-Werte, vollständige Request Bodies oder ungeprüfte Audit Logs an. Bewahre Source Commit, App-Version, OS/Arch, Reproduktion, operation ID und das kleinste relevante, begrenzte Log-Segment auf.

## Support Bundle

Settings → Diagnostics → **Export redacted support bundle** schreibt ein begrenztes JSON-Support-Artefakt nach `.scriptor/diagnostics/`. Es enthält App-/Systemidentität, aggregierte Vault-Health-Zähler und höchstens 100 bereits redigierte client diagnostic events. Vault-Root, Notizpfade, Notizinhalte, Request Bodies und Zugangsdaten sind absichtlich ausgeschlossen. Das client diagnostic journal rotiert bei 2 MiB und begrenzt message/detail bereits vor der Persistierung.
