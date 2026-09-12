# C4-Modellspezifikation: Systemkontext Ebene 1 für Scriptor

[English](c4-context.md) · [简体中文](c4-context.zh-CN.md) · [Русский](c4-context.ru.md) · **Deutsch** · [Español](c4-context.es.md) · [فارسی](c4-context.fa.md)

**Status:** aktueller Implementierungskontext für Scriptor `1.0.0` einschließlich der noch unveröffentlichten Härtung in diesem Quellbaum. Experimentelle und ausschließlich entworfene Oberflächen werden durch [`../CAPABILITY-MATURITY.md`](../CAPABILITY-MATURITY.md) geregelt.

## Systemübersicht

Scriptor ist ein local-first Desktop-Arbeitsbereich für Wissen und Schreiben mit Markdown. Markdown im Dateisystem des Nutzers ist maßgeblich; SQLite-Indizes sowie erzeugte Publish-/Export-Artefakte sind abgeleiteter Zustand.

## Personas

| Persona | Hauptziel | Implementierte Abläufe |
|---|---|---|
| Forschende | Literaturhinweise und Entwürfe schreiben und organisieren | Markdown-Bearbeitung, lokale Bibliografie-/Zitationsprüfung, PDF-/EPUB-Lesen und Annotationen, Graph/Suche |
| Technische Redaktion | Strukturierte Dokumentation erstellen | Editor/Vorschau, Exportprofile, Git-Abläufe, geprüfte lokale Starlight-Veröffentlichung |
| Wissensarbeiter | Portable persönliche Wissensbasis pflegen | Vault-Indexierung, Volltextsuche, Backlinks/Graph, Aufgaben/Kanban, Capture |

## Systemkontext

```mermaid
C4Context
    title Scriptor-Systemkontext

    Person(user, "Nutzer / Autor", "Besitzt den lokalen Vault und autorisiert privilegierte Aktionen ausdrücklich.")
    System(scriptor, "Scriptor", "Local-first Tauri-Desktop-Arbeitsbereich mit CLI/TUI, Daemon und MCP-Erweiterungsoberflächen.")

    System_Ext(git_remote, "Git Remote", "Optionales, vom Nutzer konfiguriertes Git-Hosting, erreichbar über das native Git-Subsystem.")
    System_Ext(ai_provider, "AI Provider", "Optionaler, vom Nutzer freigegebener HTTPS-Endpunkt zur Textgenerierung; Zugangsdaten bleiben nativ.")
    System_Ext(google, "Google Calendar / Tasks APIs", "Optionale OAuth2-PKCE-Integration; Tokens liegen im OS-Keychain.")
    System_Ext(export_tools, "Lokale Export-Toolchain", "Vom Nutzer installierte Pandoc-/Typst-/verwandte Binärdateien für explizite Exportabläufe.")

    Rel(user, scriptor, "Schreibt, sucht, prüft und autorisiert Aktionen", "Native Desktop-UI / CLI")
    Rel(scriptor, git_remote, "Push / pull nur nach explizitem Aufruf", "system git über nutzerkonfiguriertes HTTPS/SSH")
    Rel(scriptor, ai_provider, "Sendet freigegebenen Entwurfs-Request", "native HTTPS")
    Rel(scriptor, google, "OAuth/connect, Kalender lesen, Aufgaben ändern", "OAuth2 PKCE + HTTPS")
    Rel(scriptor, export_tools, "Führt freigegebene lokale Exporte aus", "bounded subprocess / dokumentierte Broker-Ausnahme")
```

Das Repository enthält ein read-only Zotero-Web-API-Connector-Paket, dieses ist jedoch **nicht in den ausgelieferten Desktop-/CLI-/Daemon-Runtime eingebunden** und erscheint daher nicht als aktive externe Systembeziehung.

## Vertrauensgrenzen

1. **Lokaler Vault:** Markdown und Nutzerressourcen bleiben auf dem Datenträger maßgeblich. Abgeleitete Indizes und Publish-Ausgaben sind wiederherstellbar.
2. **Renderer/Native-Grenze:** Der Renderer erhält keine Datei-, Keychain-, Git-, Netzwerk-, Prozess-, Backup- oder Publish-Autorität. Native Code validiert Pfade, Payloads und sensible Grants erneut.
3. **Daemon-Grenze:** CLI/TUI und Daemon-MCP verwenden das typisierte lokale `scriptor-ipc`-Protokoll mit authentifizierten Endpoint-Metadaten, Nonce-Prüfungen und begrenztem Framing. Diese Grenze ist von Tauri Renderer IPC getrennt.
4. **Externe Prozesse:** Unterstützte Starts laufen über den Process Broker, sofern nicht eine eng begrenzte, dokumentierte Ausnahme gleichwertige Limits und Richtlinien übernimmt.
5. **Externes Netzwerk:** Git-, AI- und Google-Integrationen sind opt-in und verwenden integrationsspezifische Authentifizierung. Es gibt keinen impliziten Netzwerk-Fallback.
