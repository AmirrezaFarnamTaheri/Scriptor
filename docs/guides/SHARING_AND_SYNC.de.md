[English](SHARING_AND_SYNC.md) · [فارسی](SHARING_AND_SYNC.fa.md) · [简体中文](SHARING_AND_SYNC.zh-CN.md) · [Русский](SHARING_AND_SYNC.ru.md) · **Deutsch** · [Español](SHARING_AND_SYNC.es.md)

# Teilen und Synchronisieren

Scriptor inventarisiert lokale Agent-Ressourcen und synchronisiert validierte Skills aus der Desktop-App heraus zwischen unterstützten Anwendungen, IDEs und CLIs.

## Vertrauensmodell

Erkennung und Mutation sind getrennte Operationen. Ein Konfigurationsverzeichnis allein bestätigt niemals, dass eine Anwendung installiert ist. Bestätigung erfordert mindestens ein begrenztes Identitätssignal:

- eine ausführbare Datei, die zu einem konkreten Pfad aufgelöst wird, einen erfolgreichen begrenzten Versionsprobe liefert und einen aufgezeichneten SHA-256-Hash besitzt;
- ein bekanntes installiertes Anwendungsbinary mit aufgezeichnetem Hash; oder
- eine installierte Editor-Erweiterung, deren exakter Publisher und Extension-Identifier mit ihren Paketmetadaten übereinstimmen.

Jede gefundene Ressource bewahrt physisches Ziel, Scope, kanonischen Pfad, Manifestpfad, Ownership-Marker, Validierungsprobleme und normalisierten Inhaltsfingerprint. Ungültige Ressourcen bleiben sichtbar, können aber nicht als Synchronisierungsquelle ausgewählt werden.

## Supportstufen

- **Native:** AgentStack, Claude Code, Codex und das herstellerneutrale Agent-Skills-Verzeichnis.
- **Compatible:** Ziele mit dokumentierten Skill-Verzeichnissen; aktuell Visual Studio Code und Copilot, Windsurf, Zed, Gemini CLI und OpenCode.
- **Inventory only:** erkannte Produkte ohne ausreichend stabilen dokumentierten Schreibvertrag. Scriptor zeigt deren Evidenz, verändert ihre Dateien aber nicht.

Supportstufe und Installationsstatus sind unabhängig. Ein unterstütztes Ziel ist erst nach bestätigter Anwendungsidentität beschreibbar, außer der ausdrücklich herstellerneutralen Bibliothek `~/.agents/skills`.

## Pläne und Ausführung

Synchronisation und Deduplizierung beginnen immer mit einem unveränderlichen Plan. Ein Plan:

- ist an den vollständigen Inventar-Fingerprint gebunden;
- enthält erwartete Quell- und Ziel-Fingerprints;
- läuft nach der durch `PLAN_TTL_MS` begrenzten Lebenszeit ab;
- wird einmal verbraucht;
- fasst mehrere ausgewählte Produkte mit demselben physischen Ziel zu einer Operation zusammen;
- lehnt überlappende Ziele vor Mutation ab; und
- verlangt eine native einmalige Autorisierung für die Plan-ID.

Unabhängige Ziele dürfen mit begrenzter Worker-Anzahl parallel laufen. Es mutiert immer nur ein Plan Ressourcen. Das Frontend erhält strukturierte Fortschritte und Receipts, niemals rohes stdout/stderr eines Prozesses.

## Deduplizierung

Scriptor unterscheidet:

- **Exact mirror:** identischer Inhalt, absichtlich für verschiedene Ziele oder Scopes installiert.
- **Redundant:** identischer Inhalt mehrfach im selben Ziel und Scope.
- **Diverged:** dieselbe logische Identität mit unterschiedlichem Inhalt.

Nur redundante exakte Kopien können einen automatisierten Deduplizierungsplan erzeugen. Die Kopie wird in Scriptors Recovery-Quarantäne verschoben und per Hash verifiziert, nicht dauerhaft gelöscht. Mirrors bleiben erhalten; divergierte Ressourcen erfordern eine manuelle Merge-Entscheidung.

## Wiederherstellung

Updates stagen und hashen den Ersatz vor Promotion. Bestehender Inhalt wird zuerst in die Recovery-Quarantäne verschoben. Falls Promotion oder Post-Write-Verifikation fehlschlägt, versucht Scriptor den vorherigen Inhalt wiederherzustellen und meldet ein strukturiertes Failure-Receipt.
