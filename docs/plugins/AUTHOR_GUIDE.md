# Plugin Author Guide

Complete reference for building Scriptor plugins.

## Quick Start

See [`packages/plugins/hello-world/`](../../packages/plugins/hello-world/) for a minimal working plugin.

---

## 1. Plugin Manifest

Every plugin exports a `PluginManifest` object. The manifest declares identity, lifecycle, capabilities, permissions, and contributions.

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

### Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | Yes | Unique plugin identifier. See [naming rules](#7-plugin-id-naming-rules). |
| `name` | `string` | Yes | Human-readable display name. |
| `version` | `string` | Yes | Semver version string. |
| `apiVersion` | `string` | No | Plugin API version. Defaults to host version. See [API compatibility](#8-api-version-compatibility). |
| `publisher` | `string` | Yes | Author or organization name. |
| `description` | `string` | Yes | Short description of what the plugin does. |
| `activation` | `PluginActivation[]` | Yes | When the plugin loads. |
| `capabilities` | `PluginCapability[]` | Yes | Which capability types the plugin uses. |
| `permissions` | `PluginPermission[]` | Yes | Data/resource access the plugin requires. |
| `contributes` | `PluginContributions` | No | Slot contributions (commands, widgets, etc.). |

### Activation Policies

| Value | Behavior |
|---|---|
| `'manual'` | User must explicitly enable or invoke the plugin. |
| `'on-startup'` | Plugin loads when Scriptor starts. |
| `'on-vault-open'` | Plugin loads when a vault is opened. |

A plugin may declare multiple activation policies. The earliest matching policy triggers load.

---

## 2. Capability Types

Declare capabilities in the `capabilities` array. Each capability unlocks specific contribution slots.

### 2.1 `command`

Register commands in the command palette.

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

| Field | Type | Description |
|---|---|---|
| `commandId` | `string` | Unique command identifier (dotted). |
| `label` | `string` | Display label in the command palette. |
| `category` | `string` | Grouping category (e.g. `Vault`, `Export`, `Tools`). |
| `permission` | `CommandPermission` | Minimum permission to run: `read`, `write-approved`, `system`, or `dangerous`. |

### 2.2 `renderer-extension`

Extend the markdown preview renderer with custom transforms.

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

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Unique extension identifier. |
| `label` | `string` | Display name. |
| `handles` | `'block' \| 'inline' \| 'document'` | Scope of the transform. |
| `priority` | `number` | Lower numbers run first. |

### 2.3 `export-profile`

Add new export formats or templates.

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

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Unique profile identifier. |
| `label` | `string` | Display name in export dialog. |
| `format` | `ExportFormat` | Target format (e.g. `html`, `pdf`, `wechat-html`). |

### 2.4 `mcp-tool`

Expose tools to the MCP (Model Context Protocol) layer for AI integrations.

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

| Field | Type | Description |
|---|---|---|
| `name` | `string` | Tool name exposed via MCP. |
| `label` | `string` | Human-readable label. |
| `modeRequired` | `McpMode` | Required MCP mode (e.g. `read`). |
| `commandId` | `string` | Command that implements the tool. |

### 2.5 `inspector-widget`

Add panels to the inspector sidebar.

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

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Unique widget identifier. |
| `label` | `string` | Display name. |
| `placement` | `'note' \| 'vault' \| 'export' \| 'graph' \| 'canvas'` | Where the widget appears. |

### 2.6 `vault-health-check`

Define diagnostic rules for vault health reports.

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

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Unique check identifier. |
| `label` | `string` | Display name in health report. |
| `severity` | `'info' \| 'warning' \| 'error'` | Issue severity level. |

### 2.7 `canvas-tool`

Add tools to the canvas toolbar.

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

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Unique tool identifier. |
| `label` | `string` | Toolbar label. |
| `commandId` | `string` | Command that implements the tool. |
| `toolKind` | `'select' \| 'draw' \| 'shape' \| 'connector' \| 'template' \| 'present' \| 'place'` | Tool behavior category. |

### 2.8 `canvas-block`

Register custom block renderers for canvas mode.

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

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Unique block identifier. |
| `label` | `string` | Display name. |
| `blockKind` | `CanvasBlockKind` | Block type (e.g. `markdown`, `image`). |
| `rendererId` | `string` | ID of the renderer that draws this block. |

### 2.9 `template-pack`

Bundle starter templates for documents or canvases.

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

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Unique template identifier. |
| `label` | `string` | Display name. |
| `categories` | `string[]` | Category tags for filtering. |
| `canvasCompatible` | `boolean` | Available in canvas mode. |
| `documentCompatible` | `boolean` | Available in document mode. |

---

## 3. Permission Model

Every plugin must declare the permissions it needs, each with a human-readable reason.

```ts
permissions: [
  { permission: 'read', reason: 'Read vault note metadata for search.' },
],
```

### Available Permissions

| Permission | Scope |
|---|---|
| `read` | Query approved command contracts and vault metadata. |
| `write-approved` | Propose writes that require user confirmation. |
| `system` | Access derived caches and background jobs (no canonical file changes). |
| `dangerous` | Explicit install-time warning + runtime confirmation. **Must be `optional: true`** until sandbox policy exists. |
| `network` | HTTP access. Blocked by default; host manages an allowlist. |

### Blocked Permissions (v1)

These permissions are rejected at validation time:

| Permission | Reason |
|---|---|
| `external-process` | Not available until plugin sandbox policy is implemented. |
| `secrets` | Not available until named keychain handles are implemented. |

Using a blocked permission causes manifest validation to fail.

### Permission Reasons

Every permission entry **must** include a non-empty `reason` string. This is shown to users during plugin installation so they can make informed decisions.

```ts
// Good
{ permission: 'read', reason: 'Read note titles for the search command.' }

// Bad — will fail validation
{ permission: 'read', reason: '' }
```

### The `optional` Flag

The `dangerous` permission must set `optional: true`. This signals that the plugin can function without the permission and will request it at runtime only when needed.

```ts
{ permission: 'dangerous', reason: 'Bulk rename files.', optional: true }
```

---

## 4. Safe Mode

When Scriptor starts in safe mode:

- **All plugins are disabled** at the registry level.
- Individual plugins **cannot be re-enabled** while safe mode is active.
- Plugin failures from the previous session are cleared.
- Safe mode is a recovery mechanism — use it when a plugin causes instability.

```ts
const registry = new PluginRegistry(/* safeMode */ true)
registry.listEnabled() // => [] — nothing runs
registry.setEnabled('acme.my-plugin', true) // => false — blocked
registry.setSafeMode(false)
registry.setEnabled('acme.my-plugin', true) // => true — now allowed
```

Users can toggle safe mode from the plugin settings panel.

---

## 5. Hello-World Plugin (Step by Step)

### Step 1: Create the directory

```
packages/plugins/hello-world/
  package.json
  src/
    manifest.ts
    index.ts
```

### Step 2: Write `package.json`

```json
{
  "name": "@scriptor/plugin-hello-world",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "dependencies": {
    "@scriptor/core": "workspace:*"
  }
}
```

### Step 3: Write the manifest

```ts
// src/manifest.ts
import type { PluginManifest } from '@scriptor/core/contracts/plugin'

export const helloWorldManifest: PluginManifest = {
  id: 'hello-world',
  name: 'Hello World',
  version: '0.1.0',
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

### Step 4: Write the entry point

```ts
// src/index.ts
export { helloWorldManifest } from './manifest'
```

### Step 5: Validate

```sh
pnpm check:plugins
```

This runs manifest validation, sandbox tests, and registry tests across all plugins. If your manifest is malformed, it will report errors.

---

## 6. How Contributions Work

Each capability maps to one or more contribution slots in the `contributes` object:

| Capability | Contribution Slot(s) |
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

**Rule:** If you add entries to a contribution slot, you must declare the corresponding capability. For example, adding `mcpTools` without `mcp-tool` in `capabilities` fails validation.

Contributions from all enabled plugins are merged at startup by `collectContributions()`, which returns flat arrays for each slot. The host then feeds these into the command bus, renderer, export pipeline, etc.

---

## 7. Plugin ID Naming Rules

Plugin IDs must match the pattern `^[a-z0-9][a-z0-9.-]*$`:

- **Lowercase** letters, digits, dots, and hyphens only.
- Must **start** with a lowercase letter or digit.
- No underscores, no uppercase, no spaces.
- Dots are used as namespace separators.

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

Convention: prefix with your org name (e.g. `scriptor.*`, `acme.*`) to avoid collisions.

---

## 8. API Version Compatibility

The current plugin API version is **0.1.0**.

- If `apiVersion` is omitted, it defaults to the host version.
- Compatibility is checked by **major version**: `0.x.x` is compatible with `0.y.y`.
- A plugin with `apiVersion: '1.0.0'` would be incompatible with the current `0.1.0` host.

```ts
// Compatible — same major version (0)
apiVersion: '0.1.0'
apiVersion: '0.2.0'

// Incompatible — different major version
apiVersion: '1.0.0'  // ❌ fails validation
```

When the API reaches `1.0.0`, plugins built for `0.x` will need updates.

---

## 9. Testing Your Plugin

### Run plugin validation

```sh
pnpm check:plugins
```

This executes:

1. **Manifest validation** — schema, ID pattern, required fields, capability/permission checks.
2. **Registry tests** — safe mode, enable/disable, snapshot correctness.
3. **Sandbox tests** — blocked capabilities, disabled-plugin behavior.
4. **Host sandbox tests** — raw filesystem access is denied.
5. **WASM host tests** — WASM plugin manifest validation.
6. **Marketplace catalog** — bundled catalog is non-empty.

If any test fails, the command exits with code 1 and prints the failure reasons.

### Manual testing checklist

- [ ] Manifest passes `validatePluginManifest()` with no errors.
- [ ] Plugin loads and appears in the plugin registry.
- [ ] Commands show in the command palette under the correct category.
- [ ] Permissions are displayed correctly during installation.
- [ ] Plugin disables cleanly without crashing the host.
- [ ] Safe mode prevents the plugin from loading.

---

## 10. Example Manifests

### Command plugin

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
  "contributes": {
    "commands": [
      { "commandId": "acme.word-count.run", "label": "Count Words", "category": "Tools", "permission": "read" }
    ]
  }
}
```

### Renderer extension

```json
{
  "id": "acme.markmap",
  "name": "Markmap Renderer",
  "version": "0.1.0",
  "publisher": "Acme",
  "description": "Render markdown headings as a mind map in preview.",
  "activation": ["on-vault-open"],
  "capabilities": ["renderer-extension"],
  "permissions": [{ "permission": "read", "reason": "Read note headings for mind map generation." }],
  "contributes": {
    "rendererExtensions": [
      { "id": "markmap-view", "label": "Markmap mind map", "handles": "document", "priority": 20 }
    ]
  }
}
```

### Export profile

```json
{
  "id": "acme-latex-export",
  "name": "LaTeX Export",
  "version": "0.1.0",
  "publisher": "Acme",
  "description": "Export notes as LaTeX documents.",
  "activation": ["manual"],
  "capabilities": ["export-profile"],
  "permissions": [{ "permission": "read", "reason": "Read note content for LaTeX conversion." }],
  "contributes": {
    "exportProfiles": [
      { "id": "latex-export", "label": "LaTeX (.tex)", "format": "html" }
    ]
  }
}
```

### MCP tool

```json
{
  "id": "acme.mcp-search",
  "name": "MCP Search",
  "version": "0.1.0",
  "publisher": "Acme",
  "description": "Expose vault search as an MCP tool.",
  "activation": ["on-startup"],
  "capabilities": ["mcp-tool", "command"],
  "permissions": [{ "permission": "read", "reason": "Search vault notes via MCP interface." }],
  "contributes": {
    "mcpTools": [
      { "name": "vault_search", "label": "Search vault", "modeRequired": "read", "commandId": "acme.mcp-search.run" }
    ],
    "commands": [
      { "commandId": "acme.mcp-search.run", "label": "Search Vault (MCP)", "category": "Tools", "permission": "read" }
    ]
  }
}
```

### Inspector widget

```json
{
  "id": "acme.outliner",
  "name": "Note Outliner",
  "version": "0.1.0",
  "publisher": "Acme",
  "description": "Show a heading outline in the inspector.",
  "activation": ["on-vault-open"],
  "capabilities": ["inspector-widget"],
  "permissions": [{ "permission": "read", "reason": "Read note headings for the outline widget." }],
  "contributes": {
    "inspectorWidgets": [
      { "id": "heading-outline", "label": "Heading Outline", "placement": "note" }
    ]
  }
}
```

### Vault health check

```json
{
  "id": "acme.frontmatter-lint",
  "name": "Frontmatter Lint",
  "version": "0.1.0",
  "publisher": "Acme",
  "description": "Check for missing or invalid YAML frontmatter.",
  "activation": ["on-vault-open"],
  "capabilities": ["vault-health-check"],
  "permissions": [{ "permission": "read", "reason": "Read frontmatter fields for validation." }],
  "contributes": {
    "vaultHealthChecks": [
      { "id": "missing-frontmatter", "label": "Missing frontmatter", "severity": "warning" },
      { "id": "invalid-yaml", "label": "Invalid YAML syntax", "severity": "error" }
    ]
  }
}
```

### Canvas tool

```json
{
  "id": "acme.canvas-shapes",
  "name": "Canvas Shapes",
  "version": "0.1.0",
  "publisher": "Acme",
  "description": "Extra shape tools for the canvas.",
  "activation": ["on-startup"],
  "capabilities": ["canvas-tool"],
  "permissions": [{ "permission": "read", "reason": "Read canvas state for shape placement." }],
  "contributes": {
    "canvasTools": [
      { "id": "circle", "label": "Circle", "commandId": "canvas.circle", "toolKind": "shape" },
      { "id": "arrow", "label": "Arrow", "commandId": "canvas.arrow", "toolKind": "connector" }
    ]
  }
}
```

### Canvas block

```json
{
  "id": "acme.kanban",
  "name": "Kanban Block",
  "version": "0.1.0",
  "publisher": "Acme",
  "description": "Kanban board block for canvas mode.",
  "activation": ["on-vault-open"],
  "capabilities": ["canvas-block"],
  "permissions": [{ "permission": "read", "reason": "Read card data for kanban rendering." }],
  "contributes": {
    "canvasBlocks": [
      { "id": "kanban-board", "label": "Kanban Board", "blockKind": "markdown", "rendererId": "acme-kanban" }
    ]
  }
}
```

### Template pack

```json
{
  "id": "acme.templates",
  "name": "Starter Templates",
  "version": "0.1.0",
  "publisher": "Acme",
  "description": "Document and canvas starter templates.",
  "activation": ["on-startup"],
  "capabilities": ["template-pack"],
  "permissions": [{ "permission": "read", "reason": "Read template content for instantiation." }],
  "contributes": {
    "templatePacks": [
      { "id": "weekly-journal", "label": "Weekly Journal", "categories": ["journal"], "canvasCompatible": false, "documentCompatible": true },
      { "id": "mood-board", "label": "Mood Board", "categories": ["creative"], "canvasCompatible": true, "documentCompatible": false }
    ]
  }
}
```

---

## Reference Plugins

| Plugin | Path | Capabilities |
|---|---|---|
| Hello World | [`packages/plugins/hello-world/`](../../packages/plugins/hello-world/) | `command` |
| Canvas Kit | [`packages/plugins/canvas-kit/`](../../packages/plugins/canvas-kit/) | `canvas-tool`, `template-pack` |
| Publish Pack | [`packages/plugins/publish-pack/`](../../packages/plugins/publish-pack/) | `renderer-extension`, `export-profile` |
| Vault Lint | [`packages/plugins/vault-lint/`](../../packages/plugins/vault-lint/) | `inspector-widget`, `vault-health-check`, `command` |
| PDF Translate | [`packages/plugins/pdf-translate/`](../../packages/plugins/pdf-translate/) | `command`, `export-profile` |

---

## Source References

- Manifest schema: `packages/core/src/contracts/plugin.ts`
- Validation logic: `packages/plugin-api/src/manifest.ts`
- Sandbox policy: `packages/plugin-api/src/sandbox.ts`
- Plugin host: `packages/plugin-api/src/host.ts`
- Plugin registry: `packages/plugin-api/src/registry.ts`
- Contribution merging: `packages/plugin-api/src/contributions.ts`
