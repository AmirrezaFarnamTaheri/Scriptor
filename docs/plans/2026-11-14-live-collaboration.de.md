# Scriptor: Implementierungsplan für Echtzeit-Zusammenarbeit

[English](2026-11-14-live-collaboration.md) · [فارسی](2026-11-14-live-collaboration.fa.md) · [简体中文](2026-11-14-live-collaboration.zh-CN.md) · [Русский](2026-11-14-live-collaboration.ru.md) · **Deutsch** · [Español](2026-11-14-live-collaboration.es.md)

> Für implementierende Agenten: Die Aufgaben werden mit Kontrollkästchen verfolgt; jeder Abschnitt muss unabhängig testbar bleiben.

**Ziel:** Opt-in-Zusammenarbeit mehrerer Autoren mit lokaler Ausfallsicherheit ermöglichen, ohne Google Docs oder Overleaf-Git fälschlich als Live-Editor zu bezeichnen.

**Architektur:** Ein versioniertes, an Vault/Dokument/Raum/Epoche gebundenes Protokoll transportiert Updates eines bewährten Yjs-kompatiblen Text-CRDT. Native Scriptor-Komponenten besitzen das dauerhafte lokale Journal und die Dateischreibgrenze; ein authentifizierter WSS-Relay bestätigt Updates erst nach dauerhafter Speicherung. CodeMirror und Monaco liefern inkrementelle Änderungen. Externe Anbieter erhalten ausschließlich kontrollierte, getrennt geprüfte Projektionen.

**Technik:** TypeScript/Node.js 22, React, CodeMirror 6, Monaco, Rust/Tauri, SQLite mit WAL, Yjs, authentifizierte WebSockets.

## Übergreifende Sicherheitsanforderungen

- Raum, Dokument, Epoche, Peer und Vault müssen übereinstimmen. Eine Zustimmung gilt ausschließlich für ein explizit ausgewähltes Dokument.
- Verbindliche Grenzwerte stehen ausschließlich in den [Global Constraints](2026-11-14-live-collaboration.md#global-constraints); diese Übersetzung definiert keine eigenen Normwerte.
- Entzogenen Teilnehmern werden sämtliche Zugriffe verweigert; Betrachter dürfen nicht schreiben. Antworten alter Sitzungen dürfen keine andere Sitzung verändern.
- Eine ACK-Bestätigung setzt eine abgeschlossene, dauerhafte Relay-Transaktion voraus. Senden allein genügt nicht. Lokale bestätigte Änderungen müssen einen Neustart überstehen.
- Google Drive/Docs mit unveränderlichen Revisionen, begrenztes Polling, bestehende Git-Synchronisierung und CAS-/Wiederherstellungsfunktionen bleiben unabhängig funktionsfähig.
- Keine undokumentierten Overleaf-Editor-Endpunkte; keine irreführende Aussage über nativen Live-Abgleich bei Google oder Overleaf.
- Entwicklung auf separatem Branch gegen main, nicht in PR #336; Draft bis alle Prüfungen bestanden sind.

## Aufgabe 1: Drahtprotokoll und wiederholbare Update-Warteschlange

**Dateien:** src/lib/liveCollaborationProtocol.ts, src/lib/liveCollaborationProtocol.test.ts, src/lib/liveCollaborationQueue.ts, src/lib/liveCollaborationQueue.test.ts.

**Schnittstellen:** parseLiveCollaborationScope, parseLiveCollaborationEnvelope und PendingCollaborationQueue; Eingaben sind nicht vertrauenswürdige Nachrichten und erwartete Sitzungsidentitäten.

- [ ] Fehlende Funktionalität durch Tests für falschen Vault/Raum/Dokument/Epoche, Base64-Schäden, Übergröße, doppelte IDs und Sequenzen, fremde ACKs, Wiederherstellung und Speichergrenzen nachweisen.
- [ ] Fehlgeschlagenen Testlauf dokumentieren: node --experimental-strip-types --test src/lib/liveCollaborationProtocol.test.ts src/lib/liveCollaborationQueue.test.ts.
- [ ] Strenge Laufzeitvalidierung, identische Wiederholungen, exakte Bestätigungen und unveränderte Warteschlange bei Quotenfehlern implementieren.
- [ ] Dieselben fokussierten Tests erfolgreich wiederholen.
- [ ] Integration prüfen: pnpm check:contracts && pnpm test:source.
- [ ] Nur nach erfolgreicher Prüfung eine getrennte Commit-Einheit erstellen.

## Aufgabe 2: Natives dauerhaftes Journal und Dateiprojektion

**Dateien:** neue apps/desktop/src-tauri/src/commands/collaboration_live.rs; Integration in commands/mod.rs und lib.rs; native Tests.

**Schnittstellen:** Beginnen, Anhängen, offene Updates lesen, bestätigen, wiederholen und beenden; Journalbeleg und CAS-Projektionsbeleg.

- [ ] Tests für falschen Vault, symbolische Links, alte Epochen, fehlerhafte fsync-Vorgänge, Neustart, doppelte ACKs, konkurrierende Dateischreiber und abgebrochene Wiederherstellung erstellen.
- [ ] Fehlende Implementierung anhand des fokussierten Rust-Tests zeigen: cargo test -p scriptor-desktop collaboration_live.
- [ ] Vault-gebundenes SQLite-WAL-Journal mit eindeutigen Update-IDs, atomaren Statuswechseln und Quoten implementieren. Vor jeder Dateiprojektion vorhandene Autorisierung, CAS und Wiederherstellungsgrenzen verwenden.
- [ ] Bei Fehlern die Sitzung anhalten und nicht bestätigten lokalen Inhalt wiederherstellbar aufbewahren.
- [ ] Fokussierte Tests sowie cargo check --locked und die Quelltextverträge erfolgreich ausführen.
- [ ] Journal und zugehörige Tests getrennt committen.

## Aufgabe 3: Selbst betriebener, authentifizierter Relay

**Dateien:** services/collaboration-relay/ samt eigenen Tests und Betriebshinweisen.

**Schnittstellen:** signierte Schlüssel-Challenge, aktuelle Zugriffsrollen, Raum/Dokument/Epoche und Update-IDs; SYNC, UPDATE, ACK, RESYNC sowie Entzugsereignisse.

- [ ] Tests mit drei authentifizierten Peers, abgewiesenen Betrachtern, entzogenen Offline-Autoren, wiederholten Updates, Absturz vor/nach Commit, Reihenfolgefehlern und Kompaktierung schreiben.
- [ ] Fehler vor Implementierung mit npm test im Relay-Paket reproduzieren.
- [ ] WSS-only im Produktionsbetrieb, aktuelle Mitgliedschaftsprüfung bei jeder Nachricht, transaktionale Persistenz vor ACK, sichere Snapshot-/Cursor-Kompaktierung und zeitlich begrenzte Präsenz implementieren.
- [ ] Integrations-, TLS-/Schlüssel-, Berechtigungs-, Belastungs- und Neustarttests erfolgreich ausführen.
- [ ] Relay ohne automatischen Netzwerkstart und ohne unsichere Standardkonfiguration committen.

## Aufgabe 4: Editorbindung und Sitzungssteuerung

**Dateien:** neuer src/hooks/useLiveCollaboration.ts; Anpassungen an packages/editor/src/codemirror.tsx, src/components/editor/MonacoMarkdownEditor.tsx, src/components/SourceMonacoEditor.tsx und src/hooks/useWorkspaceEditor.ts.

- [ ] Zunächst Tests für unterschiedliche Editoren, Undo pro Autor, Cursor, IME, Unicode, Vault-/Tab-Wechsel, verspätete Antworten und konkurrierende lokale Speicherung schreiben.
- [ ] Testfehler nachweisen; danach inkrementelle Editortransaktionen an das CRDT anbinden. Eingehende Änderungen dürfen nicht durch vollständiges setValue den Undo-Verlauf zerstören.
- [ ] Sitzungsstatus, explizite Aktivierung, zugängliche Fehlermeldungen und genau einen verantwortlichen Projektionspfad bereitstellen.
- [ ] Editor-/Browser-Tests und pnpm check:editor && pnpm check:contracts && pnpm test:e2e erfolgreich abschließen.
- [ ] Adapter erst dann committen.

## Aufgabe 5: Wiederherstellung und Freigabenachweise

**Dateien:** e2e/live-collaboration-workflows.spec.ts und docs/VERIFICATION.md.

- [ ] 100 deterministische Seeds mit jeweils 1.000 Änderungen von drei Peers; Netztrennungen, doppelte ACKs, Neustarts, Zugriffsverlust, beschädigte Snapshots und konkurrierende Dateischreiber testen.
- [ ] Fehler dokumentieren und nur belegte Datenverlust-, Sicherheits-, Leistungs- oder Barrierefreiheitsfehler beheben.
- [ ] Byte-identische Konvergenz, erhaltene lokale bestätigte Änderungen und abgewiesene unberechtigte Schreibvorgänge nachweisen.
- [ ] Genaue Commit-ID, Release-Quellchecks, paketierte Plattformtests, TLS-Prüfung und verbleibende Einschränkungen dokumentieren.
- [ ] Experimentell belassen, bis Tests mit echten Geräten und Diensten abgeschlossen sind.

## Getrennte Folgemeilensteine

**M2 Overleaf:** Vollständiger Projektbaum über offizielle Git-Schnittstelle; sichere Pfad-/Binärdatenprüfung, explizite Lösch- und Konfliktfreigabe, niemals Force-Push.

**M3 Google Docs:** Strukturierte Dokumentrepräsentation mit Tabs, Tabellen, Stilen und Links; selektive batchUpdate-Anfragen, Revisionskontrolle, Überprüfung bei unklarem Schreibresultat; unbekannte Objekte nicht stillschweigend entfernen.

**M4 Provider-Abgleich:** Provider-Checkpoints sind unabhängig von CRDT-ACKs; externe Divergenzen verlangen sichere neue Prüfung.

**M5 Overleaf-Live-Editor:** Nur nach Verfügbarkeit und Überprüfung einer offiziell unterstützten Schnittstelle.

**Bereits getroffene Entscheidung:** Die erste Bereitstellung ist selbst gehostet und nicht Ende-zu-Ende-verschlüsselt; der Zugriff des Relay-Betreibers muss sichtbar offengelegt werden. Managed Hosting, automatische Provider-Schreibvorgänge oder inoffizielle Live-Anbindungen benötigen eine neue Zustimmung.
