# Erste Schritte mit Scriptor

[English](GETTING_STARTED.md) · [فارسی](GETTING_STARTED.fa.md) · [简体中文](GETTING_STARTED.zh-CN.md) · [Русский](GETTING_STARTED.ru.md) · **Deutsch** · [Español](GETTING_STARTED.es.md)

Scriptor ist ein local-first Markdown-Wissensarbeitsbereich. Dieser Leitfaden behandelt die Installation, das Öffnen des ersten Vaults und die wichtigsten Arbeitsabläufe für den Alltag.

Zum **Bauen aus dem Quellcode** siehe den Abschnitt **Build from source** in [`README.de.md`](../../README.de.md).

## Installation

Laden Sie die aktuelle Version für Ihre Plattform von [GitHub Releases](https://github.com/AmirrezaFarnamTaheri/Scriptor/releases) herunter:

| Plattform | Formate |
|---|---|
| Windows | MSI- oder NSIS-Installer |
| macOS | DMG |
| Linux | DEB oder AppImage |

Produktions-Installer sind absichtlich unsigniert. Der vollständige Prüfablauf ist in [`docs/RELEASE-SECURITY.de.md`](../RELEASE-SECURITY.de.md) beschrieben.

## Einen Vault öffnen

1. Starten Sie **Scriptor**.
2. Wählen Sie **Open Vault** und einen beliebigen Ordner mit Markdown-Notizen.
3. Scriptor indiziert den Vault im Hintergrund — eine proprietäre Datenbank ist nicht erforderlich.

Ihre Dateien bleiben als normales Markdown auf der Festplatte. Scriptor liest und schreibt sie direkt.

### Vault-Konfiguration

Vault-Einstellungen liegen in `.scriptor/config.json`. Snippets, Exportprofile und Plugin-Manifeste befinden sich ebenfalls unter `.scriptor/`.

## Der Arbeitsbereich

| Bereich | Zweck |
|---|---|
| **Vault-Seitenleiste** | Notizen durchsuchen, suchen und filtern; tägliche Notizen und Vorlagen erstellen |
| **Editor** | Im Source-, Split- oder Preview-Modus mit Monaco oder CodeMirror schreiben |
| **Inspector-Leiste** | Gliederung, Links, Backlinks, Zitate, Notizgesundheit und Exportprofile |
| **Status-Dock** | Ausgabeprotokoll, Suchergebnisse, Diagnosen und Hintergrundjobs |

Nutzen Sie die Workspace-Modi in der oberen Leiste — **Writing**, **Knowledge**, **Publish**, **Review**, **Automation** — um Toolbar und Command Palette auf die aktuelle Aufgabe auszurichten.

## Zentrale Arbeitsabläufe

| Aufgabe | Desktop | Terminal (`scriptor tui`) |
|---|---|---|
| Notizen durchsuchen | Vault-Seitenleiste | `j` / `k` |
| Suchen | Seitenleistensuche oder `Ctrl+K` | `/`, dann Suchbegriff |
| Command Palette | `Ctrl+K` oder Suche in der oberen Leiste | — |
| Vorschau | Editor-Modus **Split** oder **Preview** | `p` |
| Backlinks | Inspector-Leiste | `b` |
| Graph | Toolbar-Schaltfläche **Graph** (Tastatur: Pfeiltasten, Enter, Escape) | `g` |
| Vault-Gesundheit | Inspector **Note Health** oder Settings | `h` |
| Export | Inspector-Exportprofile oder **Publish** | `scriptor export` |
| Git-Status | Git-Anzeige in der oberen Leiste | — |
| Konflikte lösen | Drei-Wege-Konfliktoberfläche mit Basisspalte | — |
| Tastenkürzel | Settings → Keyboard Shortcuts | — |
| Geplante Backups | Settings → Vault Snapshots | — |

## Export einrichten

Scriptor exportiert über [Pandoc](https://pandoc.org/). Installieren Sie Pandoc für echte Exporte nach HTML, PDF, DOCX, LaTeX, ePub und Reveal.js:

```powershell
# Windows
winget install --id JohnMacFarlane.Pandoc

# macOS
brew install pandoc
```

Dry-run-Exportvorschauen funktionieren ohne Pandoc. Details zu Erkennung, Overrides und Fehlerbehebung finden Sie in [`docs/release/PANDOC_STRATEGY.de.md`](../release/PANDOC_STRATEGY.de.md).

## Optional: Headless Engine

Aktivieren Sie **Settings → Headless engine**, um Indizierung, Suche, Backlinks, Graph, Git-Status und Exportjobs über den lokalen Daemon auszuführen. Vault-Öffnen und Canvas bleiben für geringe Latenz im Prozess. Siehe [`docs/architecture/IPC_DAEMON.de.md`](../architecture/IPC_DAEMON.de.md).

## Weiterführende Dokumentation

- [`docs/CAPABILITIES.de.md`](../CAPABILITIES.de.md) — vollständige Funktionsübersicht
- [`docs/contracts/COMMAND_CATALOG.de.md`](../contracts/COMMAND_CATALOG.de.md) — Tauri-, Daemon- und CLI-Befehle
- [`docs/architecture/PLUGIN_SYSTEM.de.md`](../architecture/PLUGIN_SYSTEM.de.md) — Plugins und Marketplace
- [`docs/plugins/AUTHOR_GUIDE.de.md`](../plugins/AUTHOR_GUIDE.de.md) — Plugin-Autorenleitfaden und Hello-World
- [`DESIGN.de.md`](../../DESIGN.de.md) — Editor-Oberfläche, Designsystem und Accessibility-Vertrag
- [`docs/design/DESIGN_SYSTEM.de.md`](../design/DESIGN_SYSTEM.de.md) — visuelle System-Tokens
- [`docs/brand/BRAND.md`](../brand/BRAND.md) — Logo und Wordmark
- [`docs/assets/screenshots/README.de.md`](../assets/screenshots/README.de.md) — UI-Screenshots neu erzeugen
