# Design des Plugin-Systems

[English](PLUGIN_SYSTEM.md) · [简体中文](PLUGIN_SYSTEM.zh-CN.md) · [Русский](PLUGIN_SYSTEM.ru.md) · **Deutsch** · [Español](PLUGIN_SYSTEM.es.md) · [فارسی](PLUGIN_SYSTEM.fa.md)

![Plugin-Marktplatz und installierte Plugins](../assets/screenshots/plugins.png)

## Ziele

- Scriptor erweiterbar machen, ohne die Kernanwendung durchlässig zu machen.
- Dateien und Vault-Schreibzugriffe durch Command Contracts schützen.
- First-Party- und gebündelten Marketplace-Erweiterungen erlauben, Commands, Renderer-Verhalten, Exportprofile, MCP-Tools, Inspector-Widgets, Vault-Health-Checks, Canvas-Tools, Blocks und Template-Packs beizutragen.
- Jede Berechtigung sichtbar und widerrufbar machen.

## Nicht-Ziele

- In der ersten Version kein direkter Plugin-Dateisystemzugriff.
- Keine von Plugins verwalteten Hintergrund-Daemons.
- Keine ungeprüften MCP-Schreibwerkzeuge.

## Runtime-Modell für Plugins

```text
Plugin manifest
  -> permission review
  -> activation policy
  -> contribution registry
  -> command bus / renderer / export / MCP slots
  -> audit events
```

Plugins tragen Verhalten über Slots bei:

| Slot | Fähigkeit | Mindestberechtigung |
|---|---|---|
| Command | Command Palette und Automationsaktion. | `read` |
| Renderer extension | Transformation der Markdown-Vorschau. | `read` |
| Export profile | Neues Exportziel oder Template. | `system` |
| MCP tool | AI-/Tooling-Schnittstelle. | `read` |
| Inspector widget | Note-/Vault-Widget in der rechten Leiste. | `read` |
| Vault health check | Diagnoseregel. | `read` |
| Canvas tool | Toolbar-Aktion auf endloser Canvas. | `read` |
| Canvas block | Registrierter Block-Renderer im Canvas-Modus. | `read` |
| Template pack | Startlayouts für Dokument oder Canvas. | `read` |

## Berechtigungsmodell

| Berechtigung | Bedeutung |
|---|---|
| `read` | Darf freigegebene Command Contracts abfragen. |
| `write-approved` | Darf Schreibvorgänge vorschlagen, die bestätigt werden müssen. |
| `system` | Darf abgeleitete Caches/Jobs verwenden, ohne kanonische Dateien zu verändern. |
| `dangerous` | Erfordert ausdrückliche Warnung bei Installation und Bestätigung zur Laufzeit. |
| `network` | Standardmäßig blockiert, per Host-Allowlist freigegeben. |
| `secrets` | Zugriff nur über benannte Keychain Handles. |
| `external-process` | Deaktiviert, bis eine Plugin-Sandbox-Richtlinie existiert. |

## First-Party-Plugin-Kandidaten

| Plugin | Nutzen | Slots |
|---|---|---|
| `scriptor-citation-tools` | CSL, Bibliografie, Health Checks für fehlende Zitate. | inspector widget, health check, export profile |
| `scriptor-graph-lens` | Erweiterte Graph-Filter und Berichte zur Zentralität von Notizen. | inspector widget, command |
| `scriptor.publish-pack` | Publikations-Templates und Exportprofile. | export profile, renderer extension |
| `scriptor-vault-lint` | Regeln für defekte Links, ungültiges Frontmatter und veraltete Notizen. | health check, command |
| `scriptor-mcp-research` | Read-only Forschungsassistenten-Tools. | MCP tool, command |
| `scriptor.canvas-kit` | Sticky Notes, Formen, Verbinder und Research-Board-Templates. | canvas tool, canvas block, template pack |

## Sicherheits-Gates

- Plugin-Manifeste werden vor dem Laden gegen das Schema validiert.
- Berechtigungsänderungen benötigen Nutzerbestätigung.
- Plugin-Commands laufen über denselben Command Bus wie UI und CLI.
- Plugin-Widgets erhalten scoped data, niemals rohe Vault Handles.
- Renderer-Erweiterungen erhalten bereinigte Extension Inputs.
- Ein Plugin-Fehler deaktiviert das Plugin, ohne die App-Shell abstürzen zu lassen.
- Safe Mode startet mit deaktivierten Plugins.

## Ausgelieferte Fähigkeiten

| Fähigkeit | Ort |
|---|---|
| Manifest schema | `@scriptor/core/contracts/plugin` |
| Contribution registry + safe mode | `packages/plugin-api` |
| Gebündelter Marketplace Catalog | `packages/plugin-api/catalog.json`, `src/marketplace.ts` |
| Remote catalog merge | `loadMarketplaceCatalog` (`VITE_SCRIPTOR_PLUGIN_MARKETPLACE_URL`) |
| First-party plugins | `scriptor-vault-lint`, `scriptor.canvas-kit`, `scriptor.publish-pack` |
| Plugin panel UI | `src/components/PluginPanel.tsx` |
| MCP read-only plugin slot | `packages/mcp` |
