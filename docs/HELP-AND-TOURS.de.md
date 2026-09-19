# Kontextbezogene Hilfe, Fragen und Touren

[English](HELP-AND-TOURS.md) · [فارسی](HELP-AND-TOURS.fa.md) · [简体中文](HELP-AND-TOURS.zh-CN.md) · [Русский](HELP-AND-TOURS.ru.md) · **Deutsch** · [Español](HELP-AND-TOURS.es.md)

## Produktvertrag

Die Hilfe funktioniert offline und schreibgeschützt. Sie erklärt die aktuelle Anwendung; sie ist weder ein KI-Supportchat noch ein Bedienungsautomat oder eine Berechtigungsinstanz. Kein Schritt führt Befehle aus, sendet E-Mails, aktiviert Plugins, startet Code, veröffentlicht, stellt Dateien wieder her oder löscht Daten. „Abgeschlossen“ bedeutet nur, dass die Anleitung gelesen wurde, nicht dass eine Operation erfolgreich war.

Die maßgebliche Sammlung liegt in `src/lib/help/catalog.ts`. Jeder Eintrag beschreibt Zugang, Voraussetzungen, Auswirkungen, Reifegrad, Quellcode-Eigentümer, Kontextselektoren, Schritte, Antworten, verwandte Anleitungen und Anzeigepolitik. Auch Widgets und Docks haben eigene Themen. Nicht verfügbare Funktionen bleiben mit klaren Voraussetzungen auffindbar, werden aber nie automatisch aktiviert.

## Wann Hinweise erscheinen

Beim ersten App-Start erscheint nur die kurze Arbeitsplatz-Einführung. Sie kann übersprungen und später über den vorhandenen Einführungsweg oder die Hilfe wiederholt werden.

Beim ersten Einsatz komplexer Funktionen erscheint höchstens eine kleine, schließbare Einladung: etwa für Werkzeugleistenanpassung, Zitate, Workbench, Graph, Canvas, Aufgaben, Kanban, Reader, Plugins, Google, Gmail, KI, MCP, Ressourcenabgleich, Portal, Schnellerfassung, Darstellung, Docks, Verlauf, Sicherung und Import. Sie übernimmt weder den Fokus noch startet sie eine vollständige Tour. Jede Funktion wird pro lokalem Hilfeprofil einmal angeboten.

Wiederherstellung, Konflikte, Umbenennen, Berechtigungen, Codeausführung, Anwenden von Vorschlägen und erweiterte Einstellungen bleiben ausschließlich auf Anfrage. Gewöhnliche Schreib- und Navigationshilfen öffnen ebenfalls keine automatischen Touren. Jede ausführliche Tour wird ausdrücklich vom Benutzer gestartet.

Einladungen können deaktiviert werden, ohne die Hilfe abzuschalten. Schließen bewahrt den aktuellen Schritt; erst „Abschließen“ markiert eine Tour als gelesen. Neustart betrifft nur diese Tour. Das bestätigte Zurücksetzen löscht ausschließlich Hilfefortschritt, nicht Notizen, Konten oder Programmeinstellungen.

## Bedienung und Barrierefreiheit

F1 verwendet zuerst die fokussierte Oberfläche, dann den zuletzt verwendeten Bereich und schließlich die Arbeitsplatzübersicht. Fragezeichen in Überschriften öffnen die passende Anleitung. Der Hilfedialog besitzt einen zugänglichen Titel, Schließen, eine eigene Tab-Reihenfolge und die oberste Escape-Registrierung. Darunterliegende Panels bleiben erhalten. Beim Schließen kehrt der Fokus zum noch vorhandenen Auslöser zurück.

„Dieses Steuerelement zeigen“ schließt die Hilfe und zeigt oder fokussiert ausschließlich ein bereits vorhandenes Element. Es wird nicht angeklickt und keine verborgene Funktion geöffnet. Fehlt das Ziel, erklärt die Hilfe Zugang und Voraussetzungen, ohne den Fortschritt unbemerkt weiterzuschalten. Inhalte sind Text, kein ausführbares HTML. Suchbegriffe, Notizen, Nachrichten, Pfade und Zugangsdaten werden nicht gesammelt oder versendet.

Die Bedienelemente unterstützen Englisch, Deutsch und Persisch. Der ausführliche, redaktionell erstellte Korpus ist derzeit Englisch und ausdrücklich mit `lang=en` und `dir=ltr` markiert. Ein übersetzter Hinweis macht diese Sprachgrenze sichtbar. Spätere Übersetzungen müssen stabile Themen-IDs und inhaltliche Gleichwertigkeit erhalten.

## Speicherung und Prüfung

Fortschritt verwendet den begrenzten, versionierten lokalen Schlüssel `scriptor:help-guides:v1`. Unbekannte IDs und ungültige Schritte werden verworfen oder normalisiert. Gesperrter, voller oder beschädigter Speicher führt zu einer funktionsfähigen Sitzung im Arbeitsspeicher mit Warnhinweis. Dieser Zustand ist von Einführungserledigung und Operationsberechtigung unabhängig.

`src/lib/help/help.test.ts` prüft Sammlung, Anzeigepolitik, Suche, Fortschritt, Speicherfehler, Wiederaufnahme und Anfragevalidierung. Browsertests prüfen Kontextaufruf über einem bestehenden Dialog, F1 beim Schreiben, Escape/Fokus-Rückgabe, Einladungen, Wiederholung, fehlende Ziele, Größenänderung, Zoom, RTL und das Ausbleiben automatischer Mutationen. Neue Oberflächen benötigen einen registrierten oder ausdrücklich zugeordneten Guide und überprüfbare Selektoren.

## Vorheriger Prüfstand

Vor dieser Ergänzung bestanden bei PR #135 und Commit `c6a714bff2c085d330144ad98dc6530fea1ab29e` die Workflows CI, Desktop compile, Visual review, Documentation localization und Starlight lock template. Das dokumentiert den vorherigen Stand, nicht bereits bestandene Prüfungen der neuen Hilfe.
