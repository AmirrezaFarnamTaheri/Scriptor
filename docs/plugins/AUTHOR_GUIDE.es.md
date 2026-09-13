[English](AUTHOR_GUIDE.md) · [فارسی](AUTHOR_GUIDE.fa.md) · [简体中文](AUTHOR_GUIDE.zh-CN.md) · [Русский](AUTHOR_GUIDE.ru.md) · [Deutsch](AUTHOR_GUIDE.de.md) · **Español**

# Guía para autores de plugins

Referencia completa para crear plugins de Scriptor.

## Inicio rápido

Consulte [`packages/plugins/hello-world/`](../../packages/plugins/hello-world/) para ver un plugin mínimo funcional.

---

## 1. Manifest del plugin

Cada plugin exporta un objeto `PluginManifest`. El manifest declara identidad, ciclo de vida, capacidades, permisos y contribuciones.

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

### Campos

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `id` | `string` | Sí | Identificador único. Consulte las [reglas de nombres](#7-reglas-de-nombres-para-plugin-id). |
| `name` | `string` | Sí | Nombre legible mostrado al usuario. |
| `version` | `string` | Sí | Versión semver. |
| `apiVersion` | `string` | No | Versión de la API de plugins. Por defecto usa la versión actual del host. Consulte el [contrato V1](#8-contrato-de-api-v1). |
| `publisher` | `string` | Sí | Autor u organización. |
| `description` | `string` | Sí | Descripción breve del plugin. |
| `activation` | `PluginActivation[]` | Sí | Cuándo se carga. |
| `capabilities` | `PluginCapability[]` | Sí | Tipos de capacidad usados. |
| `permissions` | `PluginPermission[]` | Sí | Acceso a datos/recursos requerido. |
| `contributes` | `PluginContributions` | No | Slots de contribución: commands, widgets, etc. |

### Políticas de activación

| Valor | Comportamiento |
|---|---|
| `'manual'` | El usuario debe activar o invocar el plugin explícitamente. |
| `'on-startup'` | Se carga cuando arranca Scriptor. |
| `'on-vault-open'` | Se carga al abrir un vault. |

Un plugin puede declarar varias políticas. La primera que coincida dispara la carga.

---

## 2. Tipos de capacidad

Declare capacidades en `capabilities`. Cada una habilita slots concretos de contribución.

### 2.1 `command`

Registra comandos en la command palette.

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

| Campo | Tipo | Descripción |
|---|---|---|
| `commandId` | `string` | Identificador único con puntos. |
| `label` | `string` | Texto mostrado en la palette. |
| `category` | `string` | Categoría, por ejemplo `Vault`, `Export`, `Tools`. |
| `permission` | `CommandPermission` | Permiso mínimo: `read`, `write-approved`, `system` o `dangerous`. |

### 2.2 `renderer-extension`

Extiende el renderer de preview Markdown con transformaciones personalizadas.

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

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | `string` | Identificador único de la extensión. |
| `label` | `string` | Nombre mostrado. |
| `handles` | `'block' \| 'inline' \| 'document'` | Alcance de la transformación. |
| `priority` | `number` | Los números menores se ejecutan primero. |

### 2.3 `export-profile`

Añade formatos o templates de exportación.

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

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | `string` | Identificador único del perfil. |
| `label` | `string` | Nombre mostrado en el diálogo de export. |
| `format` | `ExportFormat` | Formato objetivo como `html`, `pdf`, `wechat-html`. |

### 2.4 `mcp-tool`

Expone herramientas a la capa MCP (Model Context Protocol) para integraciones de IA.

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

| Campo | Tipo | Descripción |
|---|---|---|
| `name` | `string` | Nombre de tool expuesto por MCP. |
| `label` | `string` | Etiqueta legible. |
| `modeRequired` | `McpMode` | Modo MCP requerido, por ejemplo `read`. |
| `commandId` | `string` | Comando que implementa la tool. |

### 2.5 `inspector-widget`

Añade paneles a la sidebar del Inspector.

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

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | `string` | Identificador único. |
| `label` | `string` | Nombre mostrado. |
| `placement` | `'note' \| 'vault' \| 'export' \| 'graph' \| 'canvas'` | Dónde aparece el widget. |

### 2.6 `vault-health-check`

Define reglas de diagnóstico para informes de salud del vault.

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

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | `string` | Identificador único del check. |
| `label` | `string` | Nombre mostrado en el informe. |
| `severity` | `'info' \| 'warning' \| 'error'` | Nivel de severidad. |

### 2.7 `canvas-tool`

Añade herramientas a la toolbar del Canvas.

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

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | `string` | Identificador único. |
| `label` | `string` | Etiqueta en la toolbar. |
| `commandId` | `string` | Comando que implementa la herramienta. |
| `toolKind` | `'select' \| 'draw' \| 'shape' \| 'connector' \| 'template' \| 'present' \| 'place'` | Categoría de comportamiento. |

### 2.8 `canvas-block`

Registra renderers de bloques personalizados para Canvas.

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

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | `string` | Identificador único de bloque. |
| `label` | `string` | Nombre mostrado. |
| `blockKind` | `CanvasBlockKind` | Tipo de bloque, por ejemplo `markdown`, `image`. |
| `rendererId` | `string` | ID del renderer. |

### 2.9 `template-pack`

Agrupa templates iniciales para documentos o canvas.

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

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | `string` | Identificador único. |
| `label` | `string` | Nombre mostrado. |
| `categories` | `string[]` | Tags de categoría para filtrado. |
| `canvasCompatible` | `boolean` | Disponible en Canvas. |
| `documentCompatible` | `boolean` | Disponible en documentos. |

---

## 3. Modelo de permisos

Todo plugin declara los permisos necesarios y un motivo legible para cada uno.

```ts
permissions: [
  { permission: 'read', reason: 'Read vault note metadata for search.' },
],
```

### Permisos disponibles

| Permiso | Alcance |
|---|---|
| `read` | Consultar contratos de comandos aprobados y metadata del vault. |
| `write-approved` | Proponer escrituras que requieren confirmación del usuario. |
| `system` | Acceder a caches derivadas y jobs de fondo sin cambiar archivos canónicos. |
| `dangerous` | Warning explícito al instalar + confirmación en runtime. **Debe usar `optional: true`** hasta que exista la política sandbox. |
| `network` | Acceso HTTP. Bloqueado por defecto; el host gestiona una allowlist. |

### Permisos bloqueados (v1)

| Permiso | Motivo |
|---|---|
| `external-process` | No disponible hasta implementar la política sandbox de plugins. |
| `secrets` | No disponible hasta implementar handles de keychain con nombre. |

Usar un permiso bloqueado hace fallar la validación del manifest.

### Motivos de permisos

Cada entrada **debe** incluir un `reason` no vacío. Se muestra al usuario durante la instalación.

```ts
// Good
{ permission: 'read', reason: 'Read note titles for the search command.' }

// Bad — will fail validation
{ permission: 'read', reason: '' }
```

### Flag `optional`

El permiso `dangerous` debe usar `optional: true`, indicando que el plugin funciona sin él y lo solicita en runtime solo cuando es necesario.

```ts
{ permission: 'dangerous', reason: 'Bulk rename files.', optional: true }
```

---

## 4. Safe Mode

Cuando Scriptor arranca en safe mode:

- **Todos los plugins están deshabilitados** a nivel de registry.
- Los plugins individuales **no pueden reactivarse** mientras siga activo.
- Se limpian fallos de plugins de la sesión anterior.
- Es un mecanismo de recuperación cuando un plugin causa inestabilidad.

```ts
const registry = new PluginRegistry(/* safeMode */ true)
registry.listEnabled() // => [] — nothing runs
registry.setEnabled('acme.my-plugin', true) // => false — blocked
registry.setSafeMode(false)
registry.setEnabled('acme.my-plugin', true) // => true — now allowed
```

El usuario puede cambiarlo desde el panel de settings de plugins.

---

## 5. Plugin Hello World paso a paso

### Paso 1: crear el directorio

```
packages/plugins/hello-world/
  package.json
  src/
    manifest.ts
    index.ts
```

### Paso 2: escribir `package.json`

```json
{
  "name": "@scriptor/plugin-hello-world",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "dependencies": { "@scriptor/core": "workspace:*" }
}
```

### Paso 3: escribir el manifest

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
  contributes: { commands: [{ commandId: 'hello.greet', label: 'Hello World: Greet', category: 'Tools', permission: 'read' }] },
}
```

### Paso 4: escribir el entry point

```ts
// src/index.ts
export { helloWorldManifest } from './manifest'
```

### Paso 5: validar

```sh
pnpm check:plugins
```

Ejecuta validación de manifests, pruebas sandbox y pruebas del registry para todos los plugins; un manifest incorrecto informa sus errores.

---

## 6. Cómo funcionan las contribuciones

| Capacidad | Slot(s) |
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

**Regla:** si añade entradas a un slot, debe declarar la capacidad correspondiente. Por ejemplo, `mcpTools` sin `mcp-tool` hace fallar la validación.

`collectContributions()` combina al arrancar las contribuciones de todos los plugins habilitados y devuelve arrays planos para cada slot. El host los entrega al command bus, renderer, export pipeline, etc.

---

## 7. Reglas de nombres para Plugin ID

Los ID deben cumplir `^[a-z0-9][a-z0-9.-]*$`:

- Solo letras **minúsculas**, dígitos, puntos y guiones.
- Deben empezar por minúscula o dígito.
- Sin underscores, mayúsculas ni espacios.
- Los puntos separan namespaces.

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

Convención: prefije con su organización (`scriptor.*`, `acme.*`) para evitar colisiones.

---

## 8. Contrato de API V1

La versión actual es **1.0.0**.

- Si omite `apiVersion`, se usa la versión del host.
- Debe ser exactamente `1.0.0`.
- Otros valores se rechazan; el host no carga adaptadores de compatibilidad.

```ts
// Valid — exact current contract
apiVersion: '1.0.0'

// Invalid — not the current contract
apiVersion: '1.0.1'  // ❌ fails validation
```

Cada nueva versión del producto publica su contrato exacto de plugins.

---

## 9. Probar el plugin

```sh
pnpm check:plugins
```

Ejecuta:

1. **Validación del manifest** — schema, patrón ID, campos obligatorios, capacidades y permisos.
2. **Pruebas de registry** — safe mode, enable/disable, snapshots.
3. **Pruebas sandbox** — capacidades bloqueadas y plugins deshabilitados.
4. **Pruebas sandbox del host** — deniega acceso directo al filesystem.
5. **Pruebas WASM host** — validación de manifests WASM.
6. **Catálogo marketplace** — el catálogo bundled no está vacío.

Un fallo termina con código 1 y muestra las causas.

### Checklist manual

- [ ] El manifest pasa `validatePluginManifest()` sin errores.
- [ ] El plugin carga y aparece en el registry.
- [ ] Los comandos aparecen en la categoría correcta.
- [ ] Los permisos se muestran correctamente durante instalación.
- [ ] El plugin se deshabilita limpiamente sin tumbar el host.
- [ ] Safe mode evita que cargue.

---

## 10. Manifests de ejemplo

Los ejemplos JSON se mantienen sin traducir para conservar el contrato copiable y comparable con la API canónica.

### Plugin de comandos

```json
{"id":"acme.word-count","name":"Word Count","version":"1.0.0","publisher":"Acme","description":"Count words in the current note.","activation":["manual"],"capabilities":["command"],"permissions":[{"permission":"read","reason":"Read current note content."}],"contributes":{"commands":[{"commandId":"acme.word-count.run","label":"Count Words","category":"Tools","permission":"read"}]}}
```

### Renderer extension

```json
{"id":"acme.markmap","name":"Markmap Renderer","version":"1.0.0","publisher":"Acme","description":"Render markdown headings as a mind map in preview.","activation":["on-vault-open"],"capabilities":["renderer-extension"],"permissions":[{"permission":"read","reason":"Read note headings for mind map generation."}],"contributes":{"rendererExtensions":[{"id":"markmap-view","label":"Markmap mind map","handles":"document","priority":20}]}}
```

### Export profile

```json
{"id":"acme-latex-export","name":"LaTeX Export","version":"1.0.0","publisher":"Acme","description":"Export notes as LaTeX documents.","activation":["manual"],"capabilities":["export-profile"],"permissions":[{"permission":"read","reason":"Read note content for LaTeX conversion."}],"contributes":{"exportProfiles":[{"id":"latex-export","label":"LaTeX (.tex)","format":"html"}]}}
```

### MCP tool

```json
{"id":"acme.mcp-search","name":"MCP Search","version":"1.0.0","publisher":"Acme","description":"Expose vault search as an MCP tool.","activation":["on-startup"],"capabilities":["mcp-tool","command"],"permissions":[{"permission":"read","reason":"Search vault notes via MCP interface."}],"contributes":{"mcpTools":[{"name":"vault_search","label":"Search vault","modeRequired":"read","commandId":"acme.mcp-search.run"}],"commands":[{"commandId":"acme.mcp-search.run","label":"Search Vault (MCP)","category":"Tools","permission":"read"}]}}
```

### Inspector widget

```json
{"id":"acme.outliner","name":"Note Outliner","version":"1.0.0","publisher":"Acme","description":"Show a heading outline in the inspector.","activation":["on-vault-open"],"capabilities":["inspector-widget"],"permissions":[{"permission":"read","reason":"Read note headings for the outline widget."}],"contributes":{"inspectorWidgets":[{"id":"heading-outline","label":"Heading Outline","placement":"note"}]}}
```

### Vault health check

```json
{"id":"acme.frontmatter-lint","name":"Frontmatter Lint","version":"1.0.0","publisher":"Acme","description":"Check for missing or invalid YAML frontmatter.","activation":["on-vault-open"],"capabilities":["vault-health-check"],"permissions":[{"permission":"read","reason":"Read frontmatter fields for validation."}],"contributes":{"vaultHealthChecks":[{"id":"missing-frontmatter","label":"Missing frontmatter","severity":"warning"},{"id":"invalid-yaml","label":"Invalid YAML syntax","severity":"error"}]}}
```

### Canvas tool

```json
{"id":"acme.canvas-shapes","name":"Canvas Shapes","version":"1.0.0","publisher":"Acme","description":"Extra shape tools for the canvas.","activation":["on-startup"],"capabilities":["canvas-tool"],"permissions":[{"permission":"read","reason":"Read canvas state for shape placement."}],"contributes":{"canvasTools":[{"id":"circle","label":"Circle","commandId":"canvas.circle","toolKind":"shape"},{"id":"arrow","label":"Arrow","commandId":"canvas.arrow","toolKind":"connector"}]}}
```

### Canvas block

```json
{"id":"acme.kanban","name":"Kanban Block","version":"1.0.0","publisher":"Acme","description":"Kanban board block for canvas mode.","activation":["on-vault-open"],"capabilities":["canvas-block"],"permissions":[{"permission":"read","reason":"Read card data for kanban rendering."}],"contributes":{"canvasBlocks":[{"id":"kanban-board","label":"Kanban Board","blockKind":"markdown","rendererId":"acme-kanban"}]}}
```

### Template pack

```json
{"id":"acme.templates","name":"Starter Templates","version":"1.0.0","publisher":"Acme","description":"Document and canvas starter templates.","activation":["on-startup"],"capabilities":["template-pack"],"permissions":[{"permission":"read","reason":"Read template content for instantiation."}],"contributes":{"templatePacks":[{"id":"weekly-journal","label":"Weekly Journal","categories":["journal"],"canvasCompatible":false,"documentCompatible":true},{"id":"mood-board","label":"Mood Board","categories":["creative"],"canvasCompatible":true,"documentCompatible":false}]}}
```

---

## Plugins de referencia

| Plugin | Ruta | Capacidades |
|---|---|---|
| Hello World | [`packages/plugins/hello-world/`](../../packages/plugins/hello-world/) | `command` |
| Canvas Kit | [`packages/plugins/canvas-kit/`](../../packages/plugins/canvas-kit/) | `canvas-tool`, `template-pack` |
| Publish Pack | [`packages/plugins/publish-pack/`](../../packages/plugins/publish-pack/) | `renderer-extension`, `export-profile` |
| Vault Lint | [`packages/plugins/vault-lint/`](../../packages/plugins/vault-lint/) | `inspector-widget`, `vault-health-check`, `command` |
| PDF Translate | [`packages/plugins/pdf-translate/`](../../packages/plugins/pdf-translate/) | `command`, `export-profile` |

---

## Referencias de código fuente

- Schema: `packages/core/src/contracts/plugin.ts`
- Validación: `packages/plugin-api/src/manifest.ts`
- Sandbox: `packages/plugin-api/src/sandbox.ts`
- Host: `packages/plugin-api/src/host.ts`
- Registry: `packages/plugin-api/src/registry.ts`
- Merging de contribuciones: `packages/plugin-api/src/contributions.ts`
