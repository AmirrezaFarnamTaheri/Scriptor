# Google-Integrationen

[English](GOOGLE_INTEGRATIONS.md) · [فارسی](GOOGLE_INTEGRATIONS.fa.md) · [简体中文](GOOGLE_INTEGRATIONS.zh-CN.md) · [Русский](GOOGLE_INTEGRATIONS.ru.md) · **Deutsch** · [Español](GOOGLE_INTEGRATIONS.es.md)

Die experimentellen Desktop-Integrationen verbinden Drive, Docs, Calendar, Tasks und Gmail mit einem lokalen Vault. Markdown-Dateien bleiben die maßgebliche Quelle. Änderungen aus Google werden vor der lokalen Übernahme geprüft; eine Kontoverbindung startet keine automatische Synchronisierung des gesamten Vaults.

## Einrichten und verbinden

Öffnen Sie **Settings → Integrations**, tragen Sie die öffentliche Google-OAuth-Client-ID für eine Desktop-Anwendung ein und speichern Sie die Konfiguration, bevor Sie einen Integrationsarbeitsbereich öffnen. Die Kalender-Synchronisierung darf deaktiviert bleiben, wenn Sie nur Drive oder Gmail verwenden.

Aktivieren Sie im Google-Projekt die APIs der gewünschten Dienste und richten Sie einen OAuth-Client für eine installierte Desktop-Anwendung ein. Die [Google-Anleitung](https://developers.google.com/identity/protocols/oauth2/native-app) erläutert Projekt, Zustimmungsbildschirm und Client. Scriptor öffnet den Systembrowser für die Zustimmung. Tragen Sie ausschließlich die Client-ID ein; Client-Secrets und Zugriffstoken gehören nicht in die Vault-Einstellungen.

Die Verbindungen sind unabhängig: Drive und Docs teilen eine Verbindung, Calendar und Tasks eine zweite; Gmail hat eine eigene. Verbinden Sie jede benötigte Gruppe und prüfen Sie die angezeigte Kontoidentität. Für Gmail muss außerdem das Gmail-Plugin aktiviert sein. Token liegen im Schlüsselbund des Betriebssystems; die öffentliche Client-ID und die Ressourcenauswahl gehören zur Vault-Konfiguration.

## Markdown über Drive oder Docs teilen

Öffnen Sie **Drive collaboration** über die Befehlspalette. Durchsuchen Sie zugängliche Ordner, geben Sie eine Ordner-ID manuell ein oder erstellen Sie nach Prüfung der Schreibberechtigung einen Ordner. Wählen Sie einen Transport und speichern Sie die Vault-Auswahl mit **Save folder and transport**.

Drive-JSON-Datensätze und opake Google-Docs-Datensätze enthalten unveränderliche Markdown-Revisionen. Das Docs-Datensatzformat erhält die Markdown-Bytes; es macht das Dokument nicht zu einem Rich-Text-Editor. Prüfen Sie die entfernte Revision und lösen Sie Konflikte, bevor Sie sie lokal anwenden. Das Teilen einer Revision ist ein ausdrücklicher Schreibvorgang beim Anbieter.

Normale Google-Dokumente können im ausgewählten Ordner durchsucht werden. Die Textkonvertierung ist ein separater Ablauf mit ausdrücklicher Warnung vor Formatverlust und Inhaltsprüfung. Ein Export erstellt ein neues Dokument, statt ein bestehendes Rich-Text-Dokument zu ersetzen. Mediendateien werden mit diesen Markdown-Datensätzen nicht repliziert. Transportformate, Konfliktbehandlung und Abfragelimits beschreibt der [Zusammenarbeitsvertrag](../validation/COLLABORATION_COMPLETION.md).

## Mit Calendar und Tasks planen

Lassen Sie in den Integrationseinstellungen Kalender und Aufgabenlisten ermitteln, wählen Sie die vorgesehenen Ressourcen und speichern Sie. Wenn die Suche eine Ressource nicht findet, können Sie deren Kennung manuell eingeben. Aktualisieren Sie nach einer Änderung der Berechtigungen die Verbindung.

Der Aufgabenarbeitsbereich zeigt lokale Aufgaben und den Wochenplaner. Lokale Zeitblöcke funktionieren auch offline. Fälligkeitsdaten in Google Tasks sind keine geplanten Uhrzeiten; Zeitblöcke mit Beginn und Ende verwenden Calendar-Ereignisse. Wählen Sie eine Vault-Aufgabe, legen Sie Beginn und Ende fest und speichern Sie den lokalen Block. Ein vorhandenes Ereignis mit Uhrzeit lässt sich ausdrücklich zuordnen.

**Review bidirectional sync** vergleicht geladene Anbieterdaten mit lokalen Aufgaben und zugeordneten Blöcken. Wählen Sie für jede Änderung die Richtung. Schreibvorgänge benötigen eine Berechtigung; bei widersprüchlichen Revisionen ist eine neue Prüfung nötig. Ein schreibgeschützter Kalender kann gelesen und importiert werden, doch das Übertragen von Ereignissen ist deaktiviert. Die Prüfung umfasst das geladene Zeitfenster und ausdrückliche Zuordnungen, nicht sämtliche Google-Ereignisse.

## Gmail verwenden

Aktivieren Sie das Gmail-Plugin und öffnen Sie **Gmail Manager**. Suchen oder aktualisieren Sie Nachrichten, laden Sie weitere Seiten und wählen Sie eine Nachricht für die Klartextansicht. Die sichtbare Liste ist begrenzt; präzisieren Sie die Suche, wenn mehr Nachrichten vorliegen, als sie aufnehmen kann.

Der Import erstellt eine neue Markdown-Notiz im ursprünglichen Vault. Nachrichtentext wird maskiert, damit er nicht als aktives Markdown oder HTML interpretiert wird. Ein vorhandenes Ziel wird nicht überschrieben. Archivieren, Verschieben in den Papierkorb und Senden sind separate, geprüfte Anbieteraktionen. Der Entwurf ist Klartext; verweigerte Berechtigungen oder fehlgeschlagenes Senden erhalten ihn zur Korrektur oder zum erneuten Versuch.

## Trennen und wiederherstellen

Das Trennen entfernt das ausgewählte lokale Zugangsdatenpaket. Vorbereitete entfernte Prüfungen und kontobezogene Zwischenspeicher werden geleert; lokale Notizen und Zeitblöcke bleiben erhalten. Ereigniszuordnungen werden nicht für andere Konten oder Kalender wiederverwendet. Bereits an Google gesendete Anfragen können nach einem Abbruch abschließen; ein Kontowechsel verhindert, dass ihr veraltetes Ergebnis den neuen Arbeitsbereich ersetzt.

Lokales Trennen widerruft nicht die anwendungsweite Google-Autorisierung. Diese verwalten Sie in Ihrem Google-Konto; ein Widerruf kann mehrere verbundene Dienste betreffen.

| Problem | Nächster Schritt |
|---|---|
| Anmeldung abgelaufen oder erforderlich | Betroffenen Dienst erneut verbinden und Daten aktualisieren. |
| Ressource fehlt oder Zugriff verweigert | Konto, Ressourcen-ID und Freigaberechte prüfen; anschließend erneut ermitteln. |
| Seitennavigation oder Ressourcensuche fehlgeschlagen | Aktualisieren und neu beginnen; unvollständige Ermittlung wird verworfen. |
| Ungespeicherte Einstellungen | Vor dem Öffnen über einen Arbeitsbereichslink die Konfiguration speichern. |
| Entfernte Revision geändert | Neu abrufen und vor dem Schreiben eine neue Prüfung vorbereiten. |

Diese Integrationen bleiben experimentell. Browser-Testdaten prüfen das Anwendungsverhalten ohne Google-Kontozugriff. Live-OAuth, Shared-Drive-Zugriff und das Verhalten der paketierten Desktop-Anwendung benötigen eigene Anbieter- und Geräteprüfungen. Der [Reifegrad-Ledger](../CAPABILITY-MATURITY.md) dokumentiert den Supportstatus, der [Prüfnachweis](../validation/GOOGLE-INTEGRATIONS-2026-10-09.md) die Evidenz.
