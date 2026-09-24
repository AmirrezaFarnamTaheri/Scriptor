# Visuelle Prüfung der Benutzeroberfläche — 2026-09-24

[English](ui-visual-review-2026-09-24.md) · [فارسی](ui-visual-review-2026-09-24.fa.md) · [简体中文](ui-visual-review-2026-09-24.zh-CN.md) · [Русский](ui-visual-review-2026-09-24.ru.md) · **Deutsch** · [Español](ui-visual-review-2026-09-24.es.md)

Diese Prüfung umfasst die vom Nutzer bereitgestellten Detailaufnahmen und die Screenshot-Galerie der Dokumentation. Die Galerie zeigt statische Aufnahmen eines Beispiel-Vaults. Sie belegt daher nur den sichtbaren Zustand und nicht, dass jeder Ablauf mit einem echten Vault getestet wurde.

Die aktualisierte Galerie enthält 35 PNG-Dateien. Alle Bilder wurden in Kontaktbögen geprüft; die Aufnahmen des leeren Editors und des Tablets zusätzlich in voller Auflösung. Alle 108 visuellen Zustände bestanden nach den abschließenden Änderungen. Zusätzlich bestanden gezielte Regressionstests für Tablet-Geometrie, Umschalten der Top-Bar-Panels und die Karte des leeren Editors.

## In dieser Änderung behoben

| Bereich | Befund und Korrektur |
| --- | --- |
| Leerer Editor | Der Rahmen endete oberhalb von Schaltflächen und Hinweistext. Jetzt umfasst eine einzige Karte den gesamten Inhalt; der dekorative Verlauf wurde entfernt. Ein Browser-Geometrietest prüft Desktop- und Tabletbreiten. |
| Verlauf und Vault-Auswahl | Die zusätzliche Umrandung und der innere horizontale Bildlauf erzeugten abgeschnittene Enden. Die unnötige äußere Fläche wurde entfernt; die einzelnen Bedienelemente behalten ihre eigenen Grenzen. |
| Top-Bar-Aktionen | Git und Quick Capture öffneten Panels bei jedem Klick erneut. Die Aktionen schalten ihr Panel jetzt beim nächsten Klick wieder zu. Befehle und Direktlinks öffnen weiterhin ausdrücklich. |
| Support | Das Herzsymbol ist jetzt standardmäßig auf dem Desktop sichtbar. Ein unveränderter früherer Standard wird einmalig migriert; angepasste Einstellungen bleiben erhalten. Auf schmalen Mobilansichten bleibt Support über die Befehlspalette erreichbar. |
| Hinweise in der Top-Bar | Positionierte Tooltips konnten über ihre Schaltfläche hinausragen. Top-Bar-Symbole verwenden jetzt native Titel und barrierefreie Namen. |
| Tablet-Navigation | Inspector-Tabs, Tagesdatum und Modusleiste wurden bei schmalen Breiten abgeschnitten oder überlappt. Tabs dürfen umbrechen, das Datum erscheint kompakt und die Moduswahl nutzt ein Auswahlfeld. |

## Genauere Prüfung der wiederholt gezeigten Ausschnitte

1. **Leerer Zustand:** Der wesentliche Fehler war der Rahmen, der nicht den gesamten Inhalt umfasste. Die Meldung darf bei der gezeigten Breite auf zwei Zeilen umbrechen. Die Schaltflächen sind klar als primär und sekundär unterscheidbar. Der Kontrast des kleinen Hinweises „Local-first…“ sollte bei 200 % Zoom und im dunklen Modus erneut geprüft werden.
2. **Verlaufsleiste:** Zurück und Vorwärts sind Navigationsaktionen; der Ordner öffnet einen Vault und das Auswahlfeld wechselt zwischen zuletzt verwendeten Vaults. Die frühere gemeinsame Umrandung ließ diese getrennten Aktionen wie ein einziges Eingabefeld wirken. Die Darstellung sollte zusätzlich bei 320, 375, 768, 1024 und 1440 Pixeln geprüft werden.
3. **Quelltext und Vorschau:** Die gezeigte Notiz beginnt mit `[@citekey]---` und danach `_organized: true`. Gültiges YAML-Frontmatter muss mit `---` in einer eigenen ersten Zeile beginnen. Der Renderer lässt fehlerhaftes Frontmatter sichtbar, statt Nutzerdaten zu verbergen. Die bearbeitbare **Preview** in der Mitte und rechts in **Split** verwendet zudem nicht die vollständige HTML-Pipeline. **Rendered output** im Inspector verwendet den bereinigten Renderer und ist die maßgebliche Ansicht für HTML, Zitate und erweiterte Markdown-Funktionen. Die Bezeichnung „Preview“ erklärt diesen Unterschied nicht. Als Folgeschritt sollte entweder vollständiges Rendering mit direkter Bearbeitung ermöglicht oder die Ansicht als „Visual edit“ bezeichnet und mit „Rendered output“ verknüpft werden.

Die spätere Detailaufnahme der Outline-Karte zeigt keinen abgeschnittenen Titel, überlappenden Rand oder fehlenden Hinweis. Der markierte Tablet-Ausschnitt zeigte hingegen die inzwischen behobene Überlappung zwischen Verlauf und Moduswahl.

Die Aktion **T Typography** sollte ihren Text behalten: Das Menü bietet auch typografische Umwandlungen und Bereinigung, nicht nur Schriftwahl. „Font“ wäre daher ungenau und ein einzelnes „F“ neben Insert und Tools missverständlich.

## Weitere Beobachtungen und offene Punkte

| Ansichten | Beobachtung | Priorität |
| --- | --- | --- |
| `workspace-light`, `workspace-dark`, `inspector-preview`, `workspace-rendered`, `editor-preview` | Bearbeitbare Preview und vollständig gerenderte Ausgabe nutzen unterschiedliche Rendering-Wege; die Oberfläche erklärt den Unterschied nicht. | Hoch |
| `workspace-tablet` | Die abgeschnittenen Beschriftungen sind behoben. Der Statusbereich bildet weiterhin eine hohe Fußzeile; ihre Hierarchie sollte überarbeitet werden. | Mittel |
| `graph`, `canvas` | Wenige Inhalte belegen eine sehr große leere Fläche. Zoom, Einpassen und die erste Aktion sollten in der laufenden Anwendung geprüft werden. | Mittel |
| `mcp-tools`, `plugin-permissions`, `plugins-installed` | Die rechte Seitenleiste enthält dichte Erklärungen und eng angeordnete Berechtigungen. Tastaturreihenfolge, 200-%-Zoom und sichtbare Hauptaktion prüfen. | Mittel |
| `publish-center`, `settings`, `settings-appearance` | Lange Formulare benötigen viel Bildlauf und verwenden viele ähnliche Vollbreitenfelder. | Mittel |
| `knowledge-workbench`, `note-history`, `vault-health` | Leere, Vergleichs- und Statusansichten sind lesbar. In der Knowledge Workbench könnte die nächste Aktion näher an die Überschrift rücken. | Niedrig |
| `command-palette`, `conflict-resolver` | Auswahl und Konflikte sind sichtbar. Konfliktauflösung benötigt vor Layoutänderungen noch Prüfungen bei schmaler Breite, Zoom und ausschließlich per Tastatur. | Mittel |

Der visuelle Lauf umfasst schmale Desktopfenster, Tablet, Mobilgeräte, dunkles Design und 200 % Zoom. Die bearbeitbare Preview mit rohem HTML sowie angedockte und modale Panels benötigen noch eine gesonderte Prüfung der Interaktionen.
