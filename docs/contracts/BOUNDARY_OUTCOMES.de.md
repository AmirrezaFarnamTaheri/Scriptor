[English](BOUNDARY_OUTCOMES.md) · [فارسی](BOUNDARY_OUTCOMES.fa.md) · [简体中文](BOUNDARY_OUTCOMES.zh-CN.md) · [Русский](BOUNDARY_OUTCOMES.ru.md) · **Deutsch** · [Español](BOUNDARY_OUTCOMES.es.md)

# Vertrag für Boundary-Ergebnisse

Scriptor-Boundary-Adapter verwenden eine gemeinsame Algebra mit sechs Ergebniszuständen. Damit werden fehlender optionaler Wert, fehlerhaft persistierter Zustand, Teilergebnis, Ausführungsfehler und erfolgreiche Wiederherstellung nicht auf denselben leeren/Default-Rückgabewert reduziert.

| Status | Vertrag | Default erlaubt? |
| --- | --- | --- |
| `value` | Autoritatives Operationsergebnis. | Nicht anwendbar. |
| `absent-optional` | Optionaler Zustand fehlt tatsächlich. Der Aufrufer darf ihn auf einen ausdrücklich dokumentierten Default/Leerwert abbilden. | **Ja, nur hier.** |
| `invalid` | Input, Konfiguration, serialisierter Zustand oder persistierte Daten sind fehlerhaft. Typisierten Code und Nachricht zurückgeben. | Nein. |
| `degraded` | Nutzbarer Teilzustand ist vorhanden; Warnungen kennzeichnen fehlende/nicht verfügbare Teile. | Kein stiller Default; Warnungen reisen mit dem Wert. |
| `failed` | Operation fehlgeschlagen. Code, Nachricht und Aussage zu Retry/Recovery zurückgeben. | Nein. |
| `recovered` | Operation war über einen ausdrücklichen Recovery-Pfad erfolgreich. Recovery-Receipt bewahren. | Recovery-Ereignis nicht still löschen. |

`contracts/operations.json` weist jedem katalogisierten Tauri-Befehl, Daemon-RPC, MCP-Tool und CLI-Befehl die erlaubten Status zu. Generierte TypeScript/Rust-Metadaten und Paritätsprüfungen sorgen dafür, dass neue Einträge fail-closed bleiben, bis ihre Boundary-Semantik deklariert ist.

## Adapter-Regeln

1. `unwrap_or_default`, `.ok()`, `filter_map(Result::ok)` oder Entsprechungen nicht an autoritativen Grenzen verwenden, außer der Quellvertrag stellt ausdrücklich `absent-optional` dar.
2. Ungültige Vault-Konfiguration ist `invalid`, nicht Abwesenheit.
3. Fehler beim Dekodieren von Datenbankzeilen sind `failed` oder `degraded` mit Warnungen und werden niemals still ausgelassen.
4. Prozess/IPC-Fehler verwenden strukturierte Codes und Recoverability statt untypisierter Strings.
5. Recovery nach Atomic-Write/Journal-Reparatur ist `recovered`; Receipt ausgeben oder erhalten, wenn die Grenze es exponiert.
