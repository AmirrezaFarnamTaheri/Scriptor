[English](AUTHOR_GUIDE.md) · [فارسی](AUTHOR_GUIDE.fa.md) · [简体中文](AUTHOR_GUIDE.zh-CN.md) · [Русский](AUTHOR_GUIDE.ru.md) · **Deutsch** · [Español](AUTHOR_GUIDE.es.md)

# Leitfaden für Plugin-Autoren

Vollständige Referenz zum Erstellen von Scriptor-Plugins.

## Schnellstart

Ein minimales funktionierendes Plugin finden Sie unter [`packages/plugins/hello-world/`](../../packages/plugins/hello-world/).

---

## 1. Plugin-Manifest

Jedes Plugin exportiert ein `PluginManifest`-Objekt. Das Manifest deklariert Identität, Lifecycle, Fähigkeiten, Berechtigungen und Contributions.

```ts
import type { PluginManifest } from '@scriptor/core/contracts/plugin'

export const myManifest: PluginManifest = {
  id: 'acme.my-plugin',
  name: 'My Plugin',
  version: '1.0.0',
  publisher: 'Acme',
  description: 'What this plugin does.',
  activation: ['manual'],
  capabilities: ['command'],
  permissions: [{ permission: 'read', reason: 'Read vault metadata.' }],
  contributes: { /* ... */ },
}
```

### Felder

| Feld | Typ | Pflicht | Beschreibung |
|---|---|---|---|
| `id` | `string` | Ja | Eindeutige Plugin-ID. Siehe [Namensregeln](#7-plugin-id-namensregeln). |
| `name` | `string` | Ja | Menschenlesbarer Anzeigename. |
| `version` | `string` | Ja | Semver-Version. |
| `apiVersion` | `string` | Nein | Version der Plugin-API. Standard ist die aktuelle Host-Version. Siehe [V1-API-Vertrag](#8-v1-api-vertrag). |
| `publisher` | `string` | Ja | Name des Autors oder der Organisation. |
| `description` | `string` | Ja | Kurze Beschreibung des Plugins. |
| `activation` | `PluginActivation[]` | Ja | Wann das Plugin geladen wird. |
| `capabilities` | `PluginCapability[]` | Ja | Welche Fähigkeitstypen das Plugin nutzt. |
| `permissions` | `PluginPermission[]` | Ja | Welche Daten-/Ressourcenzugriffe benötigt werden. |
| `contributes` | `PluginContributions` | Nein | Contribution-Slots wie Commands, Widgets usw. |

### Aktivierungsrichtlinien

| Wert | Verhalten |
|---|---|
| `'manual'` | Benutzer muss das Plugin ausdrücklich aktivieren oder aufrufen. |
| `'on-startup'` | Plugin wird beim Start von Scriptor geladen. |
| `'on-vault-open'` | Plugin wird beim Öffnen eines Vaults geladen. |

Ein Plugin kann mehrere Aktivierungsrichtlinien deklarieren. Die erste passende Richtlinie löst das Laden aus.

---

## 2. Fähigkeitstypen

Fähigkeiten werden im Array `capabilities` deklariert. Jede Fähigkeit schaltet bestimmte Contribution-Slots frei.

### 2.1 `command`

Befehle in der Command Palette registrieren.

```ts
capabilities: ['command'],
contributes: {
  commands: [
    {
      commandId: 'acme.greet',
      label: 'Say Hello',
      category: 'Tools',
      permission: 'read',
    },
  ],
},
```

| Feld | Typ | Beschreibung |
|---|---|---|
| `commandId` | `string` | Eindeutige gepunktete Command-ID. |
| `label` | `string` | Anzeigename in der Command Palette. |
| `category` | `string` | Gruppierung, z. B. `Vault`, `Export`, `Tools`. |
| `permission` | `CommandPermission` | Mindestberechtigung: `read`, `write-approved`, `system` oder `dangerous`. |

### 2.2 `renderer-extension`

Markdown-Preview-Renderer mit eigenen Transformationen erweitern.

```ts
capabilities: ['renderer-extension'],
contributes: {
  rendererExtensions: [
    {
      id: 'acme-callout',
      label: 'Custom callout',
      handles: 'block',
      priority: 10,
    },
  ],
},
```

| Feld | Typ | Beschreibung |
|---|---|---|
| `id` | `string` | Eindeutige Extension-ID. |
| `label` | `string` | Anzeigename. |
| `handles` | `'block' \| 'inline' \| 'document'` | Geltungsbereich der Transformation. |
| `priority` | `number` | Kleinere Zahlen laufen zuerst. |

### 2.3 `export-profile`

Neue Exportformate oder Templates hinzufügen.

```ts
capabilities: ['export-profile'],
contributes: {
  exportProfiles: [
    {
      id: 'acme-html',
      label: 'Acme HTML',
      format: 'html',
    },
  ],
},
```

| Feld | Typ | Beschreibung |
|---|---|---|
| `id` | `string` | Eindeutige Profil-ID. |
| `label` | `string` | Anzeigename im Exportdialog. |
| `format` | `ExportFormat` | Zielformat, z. B. `html`, `pdf`, `wechat-html`. |

### 2.4 `mcp-tool`

Tools für die MCP-Schicht (Model Context Protocol) und AI-Integrationen bereitstellen.

```ts
capabilities: ['mcp-tool'],
contributes: {
  mcpTools: [
    {
      name: 'vault_search',
      label: 'Search vault notes',
      modeRequired: 'read',
      commandId: 'acme.search',
    },
  ],
},
```

| Feld | Typ | Beschreibung |
|---|---|---|
| `name` | `string` | Über MCP exponierter Tool-Name. |
| `label` | `string` | Menschenlesbares Label. |
| `modeRequired` | `McpMode` | Erforderlicher MCP-Modus, z. B. `read`. |
| `commandId` | `string` | Command, der das Tool implementiert. |

### 2.5 `inspector-widget`

Panels zur Inspector-Sidebar hinzufügen.

```ts
capabilities: ['inspector-widget'],
contributes: {
  inspectorWidgets: [
    {
      id: 'acme-stats',
      label: 'Note Statistics',
      placement: 'note',
    },
  ],
},
```

| Feld | Typ | Beschreibung |
|---|---|---|
| `id` | `string` | Eindeutige Widget-ID. |
| `label` | `string` | Anzeigename. |
| `placement` | `'note' \| 'vault' \| 'export' \| 'graph' \| 'canvas'` | Ort, an dem das Widget erscheint. |

### 2.6 `vault-health-check`

Diagnoseregeln für Vault-Health-Berichte definieren.

```ts
capabilities: ['vault-health-check'],
contributes: {
  vaultHealthChecks: [
    {
      id: 'acme-broken-refs',
      label: 'Broken references',
      severity: 'warning',
    },
  ],
},
```

| Feld | Typ | Beschreibung |
|---|---|---|
| `id` | `string` | Eindeutige Check-ID. |
| `label` | `string` | Anzeigename im Health-Bericht. |
| `severity` | `'info' \| 'warning' \| 'error'` | Schweregrad. |

### 2.7 `canvas-tool`

Tools zur Canvas-Toolbar hinzufügen.

```ts
capabilities: ['canvas-tool'],
contributes: {
  canvasTools: [
    {
      id: 'acme-sticky',
      label: 'Sticky Note',
      commandId: 'canvas.place-sticky',
      toolKind: 'place',
    },
  ],
},
```

| Feld | Typ | Beschreibung |
|---|---|---|
| `id` | `string` | Eindeutige Tool-ID. |
| `label` | `string` | Toolbar-Label. |
| `commandId` | `string` | Implementierender Command. |
| `toolKind` | `'select' \| 'draw' \| 'shape' \| 'connector' \| 'template' \| 'present' \| 'place'` | Verhaltenskategorie. |

### 2.8 `canvas-block`

Eigene Block-Renderer für Canvas registrieren.

```ts
capabilities: ['canvas-block'],
contributes: {
  canvasBlocks: [
    {
      id: 'acme-chart-block',
      label: 'Chart Block',
      blockKind: 'markdown',
      rendererId: 'acme-chart-renderer',
    },
  ],
},
```

| Feld | Typ | Beschreibung |
|---|---|---|
| `id` | `string` | Eindeutige Block-ID. |
| `label` | `string` | Anzeigename. |
| `blockKind` | `CanvasBlockKind` | Blocktyp, z. B. `markdown`, `image`. |
| `rendererId` | `string` | ID des rendernden Renderers. |

### 2.9 `template-pack`

Starter-Templates für Dokumente oder Canvas bündeln.

```ts
capabilities: ['template-pack'],
contributes: {
  templatePacks: [
    {
      id: 'acme-research-board',
      label: 'Research Board',
      categories: ['research'],
      canvasCompatible: true,
      documentCompatible: false,
    },
  ],
},
```

| Feld | Typ | Beschreibung |
|---|---|---|
| `id` | `string` | Eindeutige Template-ID. |
| `label` | `string` | Anzeigename. |
| `categories` | `string[]` | Kategorie-Tags zum Filtern. |
| `canvasCompatible` | `boolean` | Im Canvas-Modus verfügbar. |
| `documentCompatible` | `boolean` | Im Dokumentmodus verfügbar. |

---

## 3. Berechtigungsmodell

Jedes Plugin muss die benötigten Berechtigungen mit einem menschenlesbaren Grund deklarieren.

```ts
permissions: [
  { permission: 'read', reason: 'Read vault note metadata for search.' },
],
```

### Verfügbare Berechtigungen

| Berechtigung | Scope |
|---|---|
| `read` | Freigegebene Command-Verträge und Vault-Metadaten abfragen. |
| `write-approved` | Schreibvorgänge vorschlagen, die Benutzerbestätigung benötigen. |
| `system` | Abgeleitete Caches und Background-Jobs nutzen, ohne kanonische Dateien zu ändern. |
| `dangerous` | Ausdrückliche Warnung bei Installation + Runtime-Bestätigung. **Muss `optional: true` sein**, bis eine Sandbox-Policy existiert. |
| `network` | HTTP-Zugriff. Standardmäßig blockiert; der Host verwaltet eine Allowlist. |

### Blockierte Berechtigungen (v1)

| Berechtigung | Grund |
|---|---|
| `external-process` | Nicht verfügbar, bis die Plugin-Sandbox-Policy implementiert ist. |
| `secrets` | Nicht verfügbar, bis benannte Keychain-Handles implementiert sind. |

Eine blockierte Berechtigung lässt die Manifestvalidierung fehlschlagen.

### Gründe für Berechtigungen

Jeder Permission-Eintrag **muss** einen nichtleeren `reason` enthalten. Dieser Text wird bei der Installation angezeigt, damit Benutzer informiert entscheiden können.

```ts
// Good
{ permission: 'read', reason: 'Read note titles for the search command.' }

// Bad — will fail validation
{ permission: 'read', reason: '' }
```

### Flag `optional`

`dangerous` muss `optional: true` setzen. Das signalisiert, dass das Plugin ohne diese Berechtigung funktioniert und sie erst bei Bedarf zur Laufzeit anfordert.

```ts
{ permission: 'dangerous', reason: 'Bulk rename files.', optional: true }
```

---

## 4. Safe Mode

Wenn Scriptor im Safe Mode startet:

- **Alle Plugins sind auf Registry-Ebene deaktiviert.**
- Einzelne Plugins können während aktivem Safe Mode **nicht wieder aktiviert** werden.
- Pluginfehler der vorherigen Session werden gelöscht.
- Safe Mode ist ein Recovery-Mechanismus für Instabilität durch Plugins.

```ts
const registry = new PluginRegistry(/* safeMode */ true)
registry.listEnabled() // => [] — nothing runs
registry.setEnabled('acme.my-plugin', true) // => false — blocked
registry.setSafeMode(false)
registry.setEnabled('acme.my-plugin', true) // => true — now allowed
```

Benutzer können Safe Mode im Plugin-Einstellungsbereich umschalten.

---

## 5. Hello-World-Plugin Schritt für Schritt

### Schritt 1: Verzeichnis erstellen

```
packages/plugins/hello-world/
  package.json
  src/
    manifest.ts
    index.ts
```

### Schritt 2: `package.json` schreiben

```json
{
  "name": "@scriptor/plugin-hello-world",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "dependencies": {
    "@scriptor/core": "workspace:*"
  }
}
```

### Schritt 3: Manifest schreiben

```ts
// src/manifest.ts
import type { PluginManifest } from '@scriptor/core/contracts/plugin'

export const helloWorldManifest: PluginManifest = {
  id: 'hello-world',
  name: 'Hello World',
  version: '1.0.0',
  publisher: 'Example',
  description: 'Minimal example plugin that registers a greeting command.',
  activation: ['manual'],
  capabilities: ['command'],
  permissions: [{ permission: 'read', reason: 'Read note metadata for the greeting.' }],
  contributes: {
    commands: [
      {
        commandId: 'hello.greet',
        label: 'Hello World: Greet',
        category: 'Tools',
        permission: 'read',
      },
    ],
  },
}
```

### Schritt 4: Entry Point schreiben

```ts
// src/index.ts
export { helloWorldManifest } from './manifest'
```

### Schritt 5: Validieren

```sh
pnpm check:plugins
```

Der Befehl führt Manifestvalidierung, Sandbox- und Registry-Tests für alle Plugins aus und meldet fehlerhafte Manifeste.

---

## 6. Funktionsweise von Contributions

| Fähigkeit | Contribution-Slot(s) |
|---|---|
| `command` | `commands` |
| `renderer-extension` | `rendererExtensions` |
| `export-profile` | `exportProfiles` |
| `mcp-tool` | `mcpTools` |
| `inspector-widget` | `inspectorWidgets` |
| `vault-health-check` | `vaultHealthChecks` |
| `canvas-tool` | `canvasTools` |
| `canvas-block` | `canvasBlocks` |
| `template-pack` | `templatePacks` |

**Regel:** Ein belegter Contribution-Slot erfordert die entsprechende Fähigkeit. Beispielsweise schlägt `mcpTools` ohne `mcp-tool` in `capabilities` bei der Validierung fehl.

Contributions aller aktivierten Plugins werden beim Start von `collectContributions()` zu flachen Arrays pro Slot zusammengeführt. Der Host speist sie anschließend in Command Bus, Renderer, Export-Pipeline usw. ein.

---

## 7. Plugin-ID-Namensregeln

Plugin-IDs müssen `^[a-z0-9][a-z0-9.-]*$` erfüllen:

- Nur **kleine** Buchstaben, Ziffern, Punkte und Bindestriche.
- Beginn mit Kleinbuchstabe oder Ziffer.
- Keine Unterstriche, Großbuchstaben oder Leerzeichen.
- Punkte dienen als Namespace-Trenner.

```
✅ hello-world
✅ scriptor.canvas-kit
✅ acme.my-plugin
✅ my.plugin.v2
❌ My-Plugin        (uppercase)
❌ _hidden           (starts with underscore)
❌ my_plugin         (underscore)
❌ -leading-dash     (starts with hyphen)
```

Konvention: Präfix mit Organisationsnamen wie `scriptor.*` oder `acme.*`, um Kollisionen zu vermeiden.

---

## 8. V1-API-Vertrag

Die aktuelle Plugin-API-Version ist **1.0.0**.

- Ohne `apiVersion` wird die Host-Version verwendet.
- Die API-Version muss exakt `1.0.0` sein.
- Andere Werte werden abgelehnt; der Host lädt keine Compatibility-Adapter.

```ts
// Valid — exact current contract
apiVersion: '1.0.0'

// Invalid — not the current contract
apiVersion: '1.0.1'  // ❌ fails validation
```

Neue Produktversionen veröffentlichen jeweils ihren eigenen exakten Plugin-Vertrag.

---

## 9. Plugin testen

### Pluginvalidierung ausführen

```sh
pnpm check:plugins
```

Ausgeführt werden:

1. **Manifestvalidierung** — Schema, ID-Muster, Pflichtfelder, Fähigkeiten/Berechtigungen.
2. **Registry-Tests** — Safe Mode, Enable/Disable, Snapshot-Korrektheit.
3. **Sandbox-Tests** — blockierte Fähigkeiten und Verhalten deaktivierter Plugins.
4. **Host-Sandbox-Tests** — roher Dateisystemzugriff wird verweigert.
5. **WASM-Host-Tests** — Validierung von WASM-Plugin-Manifesten.
6. **Marketplace-Katalog** — der gebündelte Katalog ist nicht leer.

Bei einem Fehler endet der Befehl mit Code 1 und gibt die Gründe aus.

### Manuelle Testcheckliste

- [ ] Manifest passiert `validatePluginManifest()` ohne Fehler.
- [ ] Plugin lädt und erscheint in der Registry.
- [ ] Commands erscheinen unter der richtigen Kategorie in der Palette.
- [ ] Berechtigungen werden bei Installation korrekt angezeigt.
- [ ] Plugin lässt sich sauber deaktivieren, ohne den Host zu crashen.
- [ ] Safe Mode verhindert das Laden.

---

## 10. Beispielmanifeste

Die folgenden JSON-Beispiele bleiben absichtlich unverändert, damit sie direkt mit dem kanonischen API-Vertrag verglichen oder kopiert werden können.

### Command-Plugin

```json
{
  "id": "acme.word-count",
  "name": "Word Count",
  "version": "1.0.0",
  "publisher": "Acme",
  "description": "Count words in the current note.",
  "activation": ["manual"],
  "capabilities": ["command"],
  "permissions": [{ "permission": "read", "reason": "Read current note content." }],
  "contributes": { "commands": [{ "commandId": "acme.word-count.run", "label": "Count Words", "category": "Tools", "permission": "read" }] }
}
```

### Renderer-Extension

```json
{
  "id": "acme.markmap",
  "name": "Markmap Renderer",
  "version": "1.0.0",
  "publisher": "Acme",
  "description": "Render markdown headings as a mind map in preview.",
  "activation": ["on-vault-open"],
  "capabilities": ["renderer-extension"],
  "permissions": [{ "permission": "read", "reason": "Read note headings for mind map generation." }],
  "contributes": { "rendererExtensions": [{ "id": "markmap-view", "label": "Markmap mind map", "handles": "document", "priority": 20 }] }
}
```

### Export-Profil

```json
{
  "id": "acme-latex-export",
  "name": "LaTeX Export",
  "version": "1.0.0",
  "publisher": "Acme",
  "description": "Export notes as LaTeX documents.",
  "activation": ["manual"],
  "capabilities": ["export-profile"],
  "permissions": [{ "permission": "read", "reason": "Read note content for LaTeX conversion." }],
  "contributes": { "exportProfiles": [{ "id": "latex-export", "label": "LaTeX (.tex)", "format": "html" }] }
}
```

### MCP-Tool

```json
{
  "id": "acme.mcp-search",
  "name": "MCP Search",
  "version": "1.0.0",
  "publisher": "Acme",
  "description": "Expose vault search as an MCP tool.",
  "activation": ["on-startup"],
  "capabilities": ["mcp-tool", "command"],
  "permissions": [{ "permission": "read", "reason": "Search vault notes via MCP interface." }],
  "contributes": {
    "mcpTools": [{ "name": "vault_search", "label": "Search vault", "modeRequired": "read", "commandId": "acme.mcp-search.run" }],
    "commands": [{ "commandId": "acme.mcp-search.run", "label": "Search Vault (MCP)", "category": "Tools", "permission": "read" }]
  }
}
```

### Inspector-Widget

```json
{
  "id": "acme.outliner",
  "name": "Note Outliner",
  "version": "1.0.0",
  "publisher": "Acme",
  "description": "Show a heading outline in the inspector.",
  "activation": ["on-vault-open"],
  "capabilities": ["inspector-widget"],
  "permissions": [{ "permission": "read", "reason": "Read note headings for the outline widget." }],
  "contributes": { "inspectorWidgets": [{ "id": "heading-outline", "label": "Heading Outline", "placement": "note" }] }
}
```

### Vault-Health-Check

```json
{
  "id": "acme.frontmatter-lint",
  "name": "Frontmatter Lint",
  "version": "1.0.0",
  "publisher": "Acme",
  "description": "Check for missing or invalid YAML frontmatter.",
  "activation": ["on-vault-open"],
  "capabilities": ["vault-health-check"],
  "permissions": [{ "permission": "read", "reason": "Read frontmatter fields for validation." }],
  "contributes": { "vaultHealthChecks": [{ "id": "missing-frontmatter", "label": "Missing frontmatter", "severity": "warning" }, { "id": "invalid-yaml", "label": "Invalid YAML syntax", "severity": "error" }] }
}
```

### Canvas-Tool

```json
{
  "id": "acme.canvas-shapes",
  "name": "Canvas Shapes",
  "version": "1.0.0",
  "publisher": "Acme",
  "description": "Extra shape tools for the canvas.",
  "activation": ["on-startup"],
  "capabilities": ["canvas-tool"],
  "permissions": [{ "permission": "read", "reason": "Read canvas state for shape placement." }],
  "contributes": { "canvasTools": [{ "id": "circle", "label": "Circle", "commandId": "canvas.circle", "toolKind": "shape" }, { "id": "arrow", "label": "Arrow", "commandId": "canvas.arrow", "toolKind": "connector" }] }
}
```

### Canvas-Block

```json
{
  "id": "acme.kanban",
  "name": "Kanban Block",
  "version": "1.0.0",
  "publisher": "Acme",
  "description": "Kanban board block for canvas mode.",
  "activation": ["on-vault-open"],
  "capabilities": ["canvas-block"],
  "permissions": [{ "permission": "read", "reason": "Read card data for kanban rendering." }],
  "contributes": { "canvasBlocks": [{ "id": "kanban-board", "label": "Kanban Board", "blockKind": "markdown", "rendererId": "acme-kanban" }] }
}
```

### Template-Pack

```json
{
  "id": "acme.templates",
  "name": "Starter Templates",
  "version": "1.0.0",
  "publisher": "Acme",
  "description": "Document and canvas starter templates.",
  "activation": ["on-startup"],
  "capabilities": ["template-pack"],
  "permissions": [{ "permission": "read", "reason": "Read template content for instantiation." }],
  "contributes": { "templatePacks": [{ "id": "weekly-journal", "label": "Weekly Journal", "categories": ["journal"], "canvasCompatible": false, "documentCompatible": true }, { "id": "mood-board", "label": "Mood Board", "categories": ["creative"], "canvasCompatible": true, "documentCompatible": false }] }
}
```

---

## Referenz-Plugins

| Plugin | Pfad | Fähigkeiten |
|---|---|---|
| Hello World | [`packages/plugins/hello-world/`](../../packages/plugins/hello-world/) | `command` |
| Canvas Kit | [`packages/plugins/canvas-kit/`](../../packages/plugins/canvas-kit/) | `canvas-tool`, `template-pack` |
| Publish Pack | [`packages/plugins/publish-pack/`](../../packages/plugins/publish-pack/) | `renderer-extension`, `export-profile` |
| Vault Lint | [`packages/plugins/vault-lint/`](../../packages/plugins/vault-lint/) | `inspector-widget`, `vault-health-check`, `command` |
| PDF Translate | [`packages/plugins/pdf-translate/`](../../packages/plugins/pdf-translate/) | `command`, `export-profile` |

---

## Quellreferenzen

- Manifest-Schema: `packages/core/src/contracts/plugin.ts`
- Validierungslogik: `packages/plugin-api/src/manifest.ts`
- Sandbox-Policy: `packages/plugin-api/src/sandbox.ts`
- Plugin-Host: `packages/plugin-api/src/host.ts`
- Plugin-Registry: `packages/plugin-api/src/registry.ts`
- Contribution-Merging: `packages/plugin-api/src/contributions.ts`
