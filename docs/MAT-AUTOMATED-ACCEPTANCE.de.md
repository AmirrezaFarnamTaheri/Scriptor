[English](MAT-AUTOMATED-ACCEPTANCE.md) · [فارسی](MAT-AUTOMATED-ACCEPTANCE.fa.md) · [简体中文](MAT-AUTOMATED-ACCEPTANCE.zh-CN.md) · [Русский](MAT-AUTOMATED-ACCEPTANCE.ru.md) · **Deutsch** · [Español](MAT-AUTOMATED-ACCEPTANCE.es.md)

# Automatisierte MAT-Abnahme (MAT-001–024)

**Gültig ab 2. November 2026.** Diese Regel ersetzt die früheren Abschlusskriterien, die eine reale Installation, menschliche Freigabe, Nutzerstudien oder Live-Konten bei Drittanbietern verlangten. Historische Ergebnisse bleiben historische Ergebnisse.

## Erforderliche automatisierte Nachweise

1. **Vollständige Implementierung:** Alle Funktionen und Fehlerfälle des jeweiligen MAT-Issues sind implementiert; ein geänderter Haken oder ein Teil-PR reicht nicht.
2. **Reproduzierbare Tests:** Wenn praktikabel zuerst ein fehlschlagender Verhaltenstest; anschließend positive, negative, Vault-/Revisionswechsel-, Abbruch-, Neustart- und Wiederherstellungstests.
3. **CI für denselben Commit:** Native/Rust, TypeScript, Sicherheits- und Berechtigungstests, Browser-E2E, Barrierefreiheit, visuelle Tests, Leistung und Artefaktprüfungen müssen für denselben integrierten SHA erfolgreich sein. Wartende oder veraltete Ergebnisse zählen nicht.
4. **Gehostete Plattformen:** Windows/macOS/Linux auf CI-Runnern oder virtuellen Umgebungen; kein physisches Gerät und keine manuelle Installation. Nicht getestete Plattformen nicht als verifiziert ausgeben.
5. **Automatisierte Abläufe:** Schreiben/Wiederherstellen, Datenbank, Recherche bis Veröffentlichung sowie Offline-/Providerfehler. Tastatur, Fokus, Accessibility-Tree, RTL, 320–1440 px und 200 % Zoom soweit relevant. Ein Accessibility-Tree-Test ist kein Beleg für echte Screenreader-Nutzung.
6. **Provider und Leistung:** Deterministische Testadapter statt Live-Zugang; nur simuliertes Verhalten beanspruchen. Echte Programme/Fixtures messen, Streuung, Schwellen, Kalt-/Warmstart sowie Build-Hashes, SBOM und Provenienz prüfen.
7. **Nachweise und Abschluss:** Testbefehl, Quell-SHA, OS/Architektur, Ergebnis und Artefakt-Link dokumentieren. Ein MAT wird nur nach erfolgreichen Prüfungen des gesamten Umfangs geschlossen; menschliche Unterschrift ist nicht nötig.

## Unveränderte Sicherheitsregeln

Die Abschaffung menschlicher **Projektabnahme** beseitigt nicht die **Nutzereinwilligung im Produkt** für destruktive Wiederherstellung, externe Prozesse, Remote-Schreibzugriffe, Zugangsdaten oder Plugin-/MCP-Rechte. Native Berechtigungen, Vault- und Revisionsprüfung, Schutz gegen unbestätigte Wiederholung und unveränderliche Release-Nachweise bleiben Pflicht. Ein Mock belegt keine reale Provider-Verfügbarkeit; MAT-Abschluss bedeutet nicht automatisch „Supported“ oder veröffentlichte Software.

Die vollständige normative Fassung steht im [englischen Dokument](MAT-AUTOMATED-ACCEPTANCE.md).