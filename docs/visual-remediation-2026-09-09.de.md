[English](visual-remediation-2026-09-09.md) · [فارسی](visual-remediation-2026-09-09.fa.md) · [简体中文](visual-remediation-2026-09-09.zh-CN.md) · [Русский](visual-remediation-2026-09-09.ru.md) · **Deutsch** · [Español](visual-remediation-2026-09-09.es.md)

# Visuelle Remediation — 2026-09-09

Diese Checkliste verfolgt die zweite Native-Vision-Prüfung des Windows-Workspace und verwandter Oberflächen. Sie bleibt bewusst im Implementierungsbranch, damit jede Korrektur schrittweise integriert und verifiziert werden kann.

## P1 — Informationsarchitektur von Shell und Editor

- [x] Die dauerhaft dreizeilige Editor-Toolbar auf eine primäre Zeile reduzieren und sekundäre Werkzeuge progressiv offenlegen.
- [x] Semantische Duplizierung zwischen Source/Preview/Split und Editor-Optionssymbolen entfernen.
- [x] Aktive Modi, Toggles und momentane Befehle visuell und semantisch unterscheiden.
- [x] Befehlsdichte der globalen Topbar reduzieren und doppelte Einstiegspunkte zusammenführen.
- [x] Scopes von globaler Suche, Notizsuche und Command Palette klären: der globale Trigger heißt ausdrücklich `Commands and notes`, die Sidebar sucht nur Notizen, und die Palette erklärt den Start der Notizsuche.
- [x] Redundante `Vault`-/Recent-Note-Navigation entfernen und Utility-Aktionen der Sidebar klären.
- [x] Chrome im Split-Modus reduzieren und brauchbare Editor/Preview-Breiten erhalten.
- [x] Zweistufiges unteres Status/Output-Chrome vereinfachen; doppelte Jobs-Affordances und abgeschlossenen Progress-Rausch entfernen.
- [x] Tatsächliche Probleme über passive Subsystem-Statusmeldungen stellen.

## P1 — Vertrauen, Zustand und Benennung

- [x] Citation-Metriken im Inspector abgleichen und Note- vs. Vault-Level klar unterscheiden.
- [x] Überlappende Formulierungen Note Health / Note quality durch Vault-spezifische Health und Note-spezifische Publish readiness ersetzen.
- [x] Namenskollision „Preview“ zwischen Editor-Modus und Inspector-Tab entfernen (`Rendered output`).
- [x] Inspector-Profile als Single-Choice-Control klarstellen und Beschreibung der Auswahl ohne Tooltip anzeigen.
- [x] Terminologie im Publish Center, Trennung von Profil-Label/Pfad und Hierarchie der Exportaktionen korrigieren.
- [x] Onboarding zustandsbewusst machen und keine blockierten Hintergrundkontrollen empfehlen.
- [x] Rohe/mehrdeutige Merge-Terminologie ersetzen und ausdrückliche Hunk-Auflösung vor Apply verlangen.

## P2 — einzelne Oberflächen

- [x] Settings in navigierbare Bereiche mit explizitem Persistenzmodell und weniger Implementierungsjargon umarbeiten.
- [x] Verwaltung installierter Plugins/Berechtigungen vom Marketplace-Browsing trennen; vier Store-Top-Level-Tabs in einer Zeile behalten.
- [x] MCP-Autorisierungsstufen als Security States statt normale Tabs darstellen und Vault-Scope klären.
- [x] Gesunden Vault-Health-Zustand als positive Zusammenfassung darstellen und Wartungsaktionen zurückstufen.
- [x] Note History comparison-first und restore-second gestalten, mit konsistenten Zeitstempeln und fail-closed Preview-Reads.
- [x] Positive, nicht redundante Empty States für Knowledge Workbench.
- [x] Graph-Richtung, reziproke Kanten, Fokuslabel, Controls, Tastaturnavigation und Canvas-Nutzung verbessern.
- [x] Git-Rail-Aktionen, Statusformulierungen, Pull-Strategie, Bestätigungen und Commit-Workflow-Hierarchie vereinfachen.
- [x] Konfliktlöser visuell diff-first, konsistent schließbar und standardmäßig sicher machen.
- [x] Command-Palette-Kategorien, Shortcut-Ausrichtung und folgenreiche Aktionen klären.
- [x] Leerem Canvas eine offensichtliche erste Aktion geben; Exportkontrollen bis Inhalt vorhanden ist zurückstufen und Developer-CLI-Leakage entfernen.
- [x] Eine echte Verwaltung für Tastaturkürzel implementieren statt Settings wiederzuverwenden.

## P2 — Accessibility, Responsive, Themes, Lokalisierung

- [x] 44-px-Coarse-Pointer-Ziele durch die finale CSS-Kaskade erhalten.
- [x] Tastatursemantik für Canvas, Graph, Toolbar-Menüs, virtualisierte Git-Zeilen und Security-State-Controls verifizieren.
- [x] Dark Mode für jeden geprüften Dialog/Panel verifizieren, nicht nur den Haupt-Workspace. Automatische Abdeckung umfasst Settings, MCP, Graph, Knowledge Workbench, Note History, Canvas, Plugins, Git/Conflicts, Export & Publish, Vault Health und First-Run-Onboarding mit ausdrücklichen Dark-Surface-Assertions.
- [x] Visuelle Matrix für Windows-Skalierung, lange Namen, große Datenmengen, Loading/Error-States und destruktive Bestätigungen vervollständigen. Abdeckung umfasst Windows-Visual-Regression, 125% Device Scale und App Zoom, kompakte/mobile/tablet Breiten, große virtualisierte Vaults mit langen Dateinamen, Slow-Loading-Skeletons, Editor/Preview-Fehler, destruktive Bestätigungen, Persian RTL und deutsche Textexpansion.
- [x] Verbleibende hardcodierte Implementierungs-/Theme-Farben entfernen, wo semantische Tokens erforderlich sind. Der abschließende Repo-Sweep normalisierte Application Chrome, Statusfarben, Editor-Warnungen, Reader-Oberflächen, Error-Overlays und Primary-Action-Foregrounds auf semantische/Theme-Tokens. Verbleibende Literalfarben sind absichtliche Palettendefinitionen, Benutzer-/Inhaltsfarben, Export/Print-Farben, Datenvisualisierungs-/Kategoriepaletten oder Fallbackwerte hinter semantischen Variablen.

## Korrektheits- und Vertrauensprobleme des Detours

- [x] Heuristische Merge-Ancestor-Rekonstruktion entfernen und bei ungelösten/unvollständigen Konfliktblöcken fail-closed arbeiten.
- [x] Initiale Vault-Refreshes korrigieren, die direkt nach `setVault` veralteten React-State lasen.
- [x] Plugin-Consent least-privilege gestalten: standardmäßig nur erforderliche Berechtigungen, additive Grants pro Vault und Vault-spezifisches Revoke.
- [x] Mutationspfade der Vault-Konfiguration serialisieren und Runtime-eigenen MCP-State bei Settings-Saves erhalten.
- [x] LanguageTool über den unterstützten Desktop-Netzwerkpfad routen und Servicefehler anzeigen statt still „keine Probleme“ zu melden.
- [x] Erweiterte Task-States konsistent mit dem Task-Parser rendern.
- [x] Note-History-Restore deaktivieren, wenn ausgewählte Revision oder Current-Note-Vergleich nicht gelesen werden kann.
- [x] Die von der Native-Schicht unterstützte Git-Pull-Strategie exponieren statt Fast-Forward fest zu codieren.

## Verifikation

Jeder abgehakte Punkt besitzt mindestens eines von: fokussierter Unit/Component-Test, E2E-Interaktionsassertion, Accessibility-Assertion oder visueller Vertrag für den betroffenen Zustand. Screenshot-Tests werden verschärft, damit ein fehlendes Feature fehlschlägt statt still eine Fallback-Oberfläche aufzunehmen.

Der jüngste Recovery-Pass entfernte außerdem die zweite `splitPreview`-UI-Autorität: `chrome.editorSurfaceMode` steuert jetzt Source/Split/Rendered; Layout-Presets und Palette-Toggles laufen durch diese Autorität, und der Inspector erhält denselben effektiven Zustand. E2E-Workspace-Chrome-Fixtures verwenden nun den produktiven versionierten Storage-Envelope, damit Tests nicht still auf Default-Chrome zurückfallen, wenn sie ein Custom Layout prüfen wollten. Veraltete Accessible Names und zu breite Locators aus dem vorherigen CI-Lauf wurden gleichzeitig repariert.

Der temporäre branch-only Write-Workflow, der die große dateiübergreifende Recovery atomar anwendete, entfernte sich nach dem erfolgreichen Commit selbst; er gehört nicht zur vorgeschlagenen Produkt-/CI-Oberfläche.

Der PR bleibt Draft, bis CI, Desktop Compile und Visual Review auf dem aktuellen Head grün sind und alle offenen Punkte entweder implementiert oder mit Evidenz explizit als Follow-up abgegrenzt sind.
