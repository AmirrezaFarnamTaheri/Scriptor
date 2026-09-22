# Kontextbezogene Hilfe, Fragen und Touren

[English](HELP-AND-TOURS.md) · [فارسی](HELP-AND-TOURS.fa.md) · [简体中文](HELP-AND-TOURS.zh-CN.md) · [Русский](HELP-AND-TOURS.ru.md) · **Deutsch** · [Español](HELP-AND-TOURS.es.md)

## Produktvertrag

Die Hilfe funktioniert offline und schreibgeschützt. Sie erklärt die aktuelle Anwendung; sie ist weder ein KI-Supportchat noch ein Bedienungsautomat oder eine Berechtigungsinstanz. Kein Schritt führt Befehle aus, sendet E-Mails, aktiviert Plugins, startet Code, veröffentlicht, stellt Dateien wieder her oder löscht Daten. „Abgeschlossen“ bedeutet nur, dass die Anleitung gelesen wurde, nicht dass eine Operation erfolgreich war.

Die maßgebliche Sammlung liegt in `src/lib/help/catalog.ts`. Jeder Eintrag beschreibt Zugang, Voraussetzungen, Auswirkungen, Reifegrad, Quellcode-Eigentümer, Kontextselektoren, Schritte, Antworten, verwandte Anleitungen und Anzeigepolitik. Auch Widgets und Docks haben eigene Themen. Nicht verfügbare Funktionen bleiben mit klaren Voraussetzungen auffindbar, werden aber nie automatisch aktiviert.

## Wann Hinweise erscheinen

- **Beim ersten App-Start:** Nur die kurze Einführung in den Arbeitsbereich erscheint. Sie kann übersprungen und später über den bestehenden Einführungsweg oder die Hilfe wiederholt werden.
- **Globale Hilfe:** Genau ein sichtbarer Einstieg **Hilfe & Anleitungen** befindet sich in der Kopfzeile; derselbe Einstieg ist über die Befehlspalette verfügbar. Panels, Karten, Docks, Editor-Werkzeugleisten und Modalfenster erhalten keine zusätzlichen Fragezeichen.
- **Kontextbezogene Hilfe:** **F1** verwendet zuerst die fokussierte Funktion, dann den zuletzt verwendeten Bereich und schließlich die Arbeitsplatzübersicht. **Umschalt+F1** startet bzw. setzt die kontextbezogene Tour direkt fort.
- **Orientierung beim ersten Öffnen:** Komplexe, optionale, experimentelle oder folgenreichere Bereiche zeigen nach dem Onboarding einmalig eine nichtmodale Einladung. Sie bietet **Anleitung öffnen**, **Tour starten** oder **Nicht jetzt** und startet niemals automatisch eine Tour.
- **Nur manuell:** Einfache Bedienelemente sowie dringende Wiederherstellungs-/Sicherheitsabläufe bleiben ausschließlich über F1, Suche oder Befehlspalette abrufbar.
- **Ausführliche Touren:** Jede Tour wird weiterhin ausdrücklich vom Benutzer gestartet; eine Einladung erteilt keine Berechtigung und führt nichts aus.

Das Schließen einer Tour bewahrt den aktuellen Schritt. Nur ein ausdrücklicher Abschluss markiert sie als gelesen. Neustart betrifft nur diese Tour. Das Zurücksetzen des Hilfefortschritts erfordert eine Bestätigung und verändert weder Tresor noch Editor-Einstellungen, Konten oder Zugangsdaten.

## Bedienung und Barrierefreiheit

F1 bestimmt zuerst die fokussierte Oberfläche, danach den zuletzt verwendeten Bereich und schließlich die Arbeitsplatzübersicht. Der einzelne Hilfe-Schalter in der Kopfzeile öffnet die Arbeitsplatzanleitung und die durchsuchbare Hilfe. In funktionsspezifische Überschriften oder Bedienelemente werden keine zusätzlichen Hilfe-Controls eingefügt.

„Dieses Steuerelement zeigen“ schließt die Hilfe und zeigt oder fokussiert ausschließlich ein bereits vorhandenes Element. Es wird nicht angeklickt und keine verborgene Funktion geöffnet. Fehlt das Ziel, erklärt die Hilfe Zugang und Voraussetzungen, ohne den Fortschritt unbemerkt weiterzuschalten. Inhalte sind Text, kein ausführbares HTML. Suchbegriffe, Notizen, Nachrichten, Pfade und Zugangsdaten werden nicht gesammelt oder versendet.

Der Hilfedialog besitzt einen zugänglichen Titel, eine Schließen-Aktion, eine eigene Tab-Reihenfolge und die oberste Escape-Registrierung. Die darunterliegende Funktion bleibt erhalten; beim Schließen kehrt der Fokus nach Möglichkeit zum Auslöser zurück.

Die Bedienelemente unterstützen Englisch, Deutsch und Persisch. Der ausführliche, redaktionell erstellte Korpus ist derzeit Englisch und ausdrücklich mit `lang=en` und `dir=ltr` markiert. Ein übersetzter Hinweis macht diese Sprachgrenze sichtbar.

## Speicherung und Prüfung

Der Fortschritt verwendet den begrenzten, versionierten lokalen Schlüssel `scriptor:help-guides:v1`. Unbekannte IDs und ungültige Schritte werden verworfen oder normalisiert. Gesperrter, voller oder beschädigter Speicher führt zu einer funktionsfähigen Sitzung im Arbeitsspeicher mit Warnhinweis. Dieser Zustand ist von Einführungserledigung und Operationsberechtigung unabhängig.

`src/lib/help/help.test.ts` prüft Katalog, Nur-auf-Anfrage-Politik, Suche, Fortschritt, Speicherfehler, Wiederaufnahme und Anfragevalidierung. `e2e/help-scope-regressions.spec.ts` stellt sicher, dass Produktoberflächen keine injizierten Hilfe-Controls erhalten, der eine globale Hilfe-Einstieg sichtbar bleibt, F1 die richtige Funktion findet und die Arbeitsplatz-Tour ihr Ziel anzeigen kann.

Neue Oberflächen benötigen weiterhin einen registrierten oder ausdrücklich zugeordneten Guide mit überprüfbaren Quell-Selektoren; dafür darf kein weiterer permanenter Hilfe-Schalter entstehen.

## Vorheriger Prüfstand

Vor dieser Ergänzung bestanden bei PR #135 und Commit `c6a714bff2c085d330144ad98dc6530fea1ab29e` die Workflows CI, Desktop compile, Visual review, Documentation localization und Starlight lock template. Das dokumentiert den vorherigen Stand, nicht bereits bestandene Prüfungen der neuen Hilfe.
