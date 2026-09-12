[English](AUTHOR_GUIDE.md) · [فارسی](AUTHOR_GUIDE.fa.md) · [简体中文](AUTHOR_GUIDE.zh-CN.md) · **Русский** · [Deutsch](AUTHOR_GUIDE.de.md) · [Español](AUTHOR_GUIDE.es.md)

# Руководство для авторов плагинов

Полный справочник по созданию плагинов Scriptor.

## Быстрый старт

Минимальный рабочий пример находится в [`packages/plugins/hello-world/`](../../packages/plugins/hello-world/).

---

## 1. Manifest плагина

Каждый plugin экспортирует объект `PluginManifest`. Manifest объявляет identity, lifecycle, capabilities, permissions и contributions.

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

### Поля

| Поле | Тип | Обязательно | Описание |
|---|---|---|---|
| `id` | `string` | Да | Уникальный идентификатор. См. [правила именования](#7-правила-именования-plugin-id). |
| `name` | `string` | Да | Человекочитаемое отображаемое имя. |
| `version` | `string` | Да | Версия semver. |
| `apiVersion` | `string` | Нет | Версия plugin API. По умолчанию — текущая версия host. См. [контракт V1](#8-контракт-api-v1). |
| `publisher` | `string` | Да | Автор или организация. |
| `description` | `string` | Да | Краткое описание. |
| `activation` | `PluginActivation[]` | Да | Когда plugin загружается. |
| `capabilities` | `PluginCapability[]` | Да | Используемые типы возможностей. |
| `permissions` | `PluginPermission[]` | Да | Требуемый доступ к данным/ресурсам. |
| `contributes` | `PluginContributions` | Нет | Contribution slots: commands, widgets и т. д. |

### Политики активации

| Значение | Поведение |
|---|---|
| `'manual'` | Пользователь должен явно включить или вызвать plugin. |
| `'on-startup'` | Plugin загружается при запуске Scriptor. |
| `'on-vault-open'` | Plugin загружается при открытии vault. |

Можно объявить несколько политик; первая совпавшая запускает загрузку.

---

## 2. Типы capabilities

Capabilities объявляются в массиве `capabilities`. Каждая capability открывает определённые contribution slots.

### 2.1 `command`

Регистрирует commands в command palette.

```ts
capabilities: ['command'],
contributes: {
  commands: [{ commandId: 'acme.greet', label: 'Say Hello', category: 'Tools', permission: 'read' }],
},
```

| Поле | Тип | Описание |
|---|---|---|
| `commandId` | `string` | Уникальный dotted identifier. |
| `label` | `string` | Текст в command palette. |
| `category` | `string` | Категория, например `Vault`, `Export`, `Tools`. |
| `permission` | `CommandPermission` | Минимальное permission: `read`, `write-approved`, `system` или `dangerous`. |

### 2.2 `renderer-extension`

Расширяет Markdown preview renderer пользовательскими преобразованиями.

```ts
capabilities: ['renderer-extension'],
contributes: {
  rendererExtensions: [{ id: 'acme-callout', label: 'Custom callout', handles: 'block', priority: 10 }],
},
```

| Поле | Тип | Описание |
|---|---|---|
| `id` | `string` | Уникальный identifier расширения. |
| `label` | `string` | Отображаемое имя. |
| `handles` | `'block' \| 'inline' \| 'document'` | Scope преобразования. |
| `priority` | `number` | Меньшие числа выполняются раньше. |

### 2.3 `export-profile`

Добавляет новые export formats или templates.

```ts
capabilities: ['export-profile'],
contributes: {
  exportProfiles: [{ id: 'acme-html', label: 'Acme HTML', format: 'html' }],
},
```

| Поле | Тип | Описание |
|---|---|---|
| `id` | `string` | Уникальный profile identifier. |
| `label` | `string` | Имя в export dialog. |
| `format` | `ExportFormat` | Target format, например `html`, `pdf`, `wechat-html`. |

### 2.4 `mcp-tool`

Экспонирует tools в MCP (Model Context Protocol) для AI-интеграций.

```ts
capabilities: ['mcp-tool'],
contributes: {
  mcpTools: [{ name: 'vault_search', label: 'Search vault notes', modeRequired: 'read', commandId: 'acme.search' }],
},
```

| Поле | Тип | Описание |
|---|---|---|
| `name` | `string` | Имя tool, экспонируемое через MCP. |
| `label` | `string` | Человекочитаемое имя. |
| `modeRequired` | `McpMode` | Требуемый MCP mode, например `read`. |
| `commandId` | `string` | Command, реализующий tool. |

### 2.5 `inspector-widget`

Добавляет панели в sidebar Inspector.

```ts
capabilities: ['inspector-widget'],
contributes: {
  inspectorWidgets: [{ id: 'acme-stats', label: 'Note Statistics', placement: 'note' }],
},
```

| Поле | Тип | Описание |
|---|---|---|
| `id` | `string` | Уникальный widget identifier. |
| `label` | `string` | Отображаемое имя. |
| `placement` | `'note' \| 'vault' \| 'export' \| 'graph' \| 'canvas'` | Где появляется widget. |

### 2.6 `vault-health-check`

Определяет диагностические правила для отчёта здоровья vault.

```ts
capabilities: ['vault-health-check'],
contributes: {
  vaultHealthChecks: [{ id: 'acme-broken-refs', label: 'Broken references', severity: 'warning' }],
},
```

| Поле | Тип | Описание |
|---|---|---|
| `id` | `string` | Уникальный check identifier. |
| `label` | `string` | Имя в health report. |
| `severity` | `'info' \| 'warning' \| 'error'` | Уровень серьёзности. |

### 2.7 `canvas-tool`

Добавляет tools в Canvas toolbar.

```ts
capabilities: ['canvas-tool'],
contributes: {
  canvasTools: [{ id: 'acme-sticky', label: 'Sticky Note', commandId: 'canvas.place-sticky', toolKind: 'place' }],
},
```

| Поле | Тип | Описание |
|---|---|---|
| `id` | `string` | Уникальный tool identifier. |
| `label` | `string` | Label в toolbar. |
| `commandId` | `string` | Реализующий command. |
| `toolKind` | `'select' \| 'draw' \| 'shape' \| 'connector' \| 'template' \| 'present' \| 'place'` | Категория поведения. |

### 2.8 `canvas-block`

Регистрирует пользовательские block renderers для Canvas.

```ts
capabilities: ['canvas-block'],
contributes: {
  canvasBlocks: [{ id: 'acme-chart-block', label: 'Chart Block', blockKind: 'markdown', rendererId: 'acme-chart-renderer' }],
},
```

| Поле | Тип | Описание |
|---|---|---|
| `id` | `string` | Уникальный block identifier. |
| `label` | `string` | Отображаемое имя. |
| `blockKind` | `CanvasBlockKind` | Тип блока, например `markdown`, `image`. |
| `rendererId` | `string` | ID renderer. |

### 2.9 `template-pack`

Группирует starter templates для документов или Canvas.

```ts
capabilities: ['template-pack'],
contributes: {
  templatePacks: [{ id: 'acme-research-board', label: 'Research Board', categories: ['research'], canvasCompatible: true, documentCompatible: false }],
},
```

| Поле | Тип | Описание |
|---|---|---|
| `id` | `string` | Уникальный template identifier. |
| `label` | `string` | Отображаемое имя. |
| `categories` | `string[]` | Category tags для фильтрации. |
| `canvasCompatible` | `boolean` | Доступен в Canvas. |
| `documentCompatible` | `boolean` | Доступен в document mode. |

---

## 3. Модель permissions

Каждый plugin обязан объявлять необходимые permissions и человекочитаемую причину для каждого.

```ts
permissions: [
  { permission: 'read', reason: 'Read vault note metadata for search.' },
],
```

### Доступные permissions

| Permission | Scope |
|---|---|
| `read` | Запрашивать разрешённые command contracts и metadata vault. |
| `write-approved` | Предлагать writes, требующие подтверждения пользователя. |
| `system` | Использовать derived caches и background jobs без изменения канонических файлов. |
| `dangerous` | Явное предупреждение при установке + runtime confirmation. **Обязательно `optional: true`**, пока нет sandbox policy. |
| `network` | HTTP access. По умолчанию заблокирован; host ведёт allowlist. |

### Заблокированные permissions (v1)

| Permission | Причина |
|---|---|
| `external-process` | Недоступно до реализации plugin sandbox policy. |
| `secrets` | Недоступно до реализации named keychain handles. |

Использование заблокированного permission приводит к ошибке validation.

### Причины permissions

Каждая запись **обязана** содержать непустой `reason`. Он показывается пользователю при установке.

```ts
// Good
{ permission: 'read', reason: 'Read note titles for the search command.' }

// Bad — will fail validation
{ permission: 'read', reason: '' }
```

### Флаг `optional`

`dangerous` должен задавать `optional: true`: plugin может работать без него и запрашивает permission только при необходимости.

```ts
{ permission: 'dangerous', reason: 'Bulk rename files.', optional: true }
```

---

## 4. Safe Mode

При запуске Scriptor в safe mode:

- **Все plugins отключены** на уровне registry.
- Отдельный plugin **нельзя снова включить**, пока safe mode активен.
- Ошибки plugins предыдущей session очищаются.
- Safe mode служит recovery-механизмом при нестабильности от plugin.

```ts
const registry = new PluginRegistry(/* safeMode */ true)
registry.listEnabled() // => [] — nothing runs
registry.setEnabled('acme.my-plugin', true) // => false — blocked
registry.setSafeMode(false)
registry.setEnabled('acme.my-plugin', true) // => true — now allowed
```

Пользователь может переключать safe mode в настройках plugins.

---

## 5. Hello World plugin пошагово

### Шаг 1: каталог

```
packages/plugins/hello-world/
  package.json
  src/
    manifest.ts
    index.ts
```

### Шаг 2: `package.json`

```json
{"name":"@scriptor/plugin-hello-world","private":true,"version":"1.0.0","type":"module","exports":{".":"./src/index.ts"},"dependencies":{"@scriptor/core":"workspace:*"}}
```

### Шаг 3: manifest

```ts
// src/manifest.ts
import type { PluginManifest } from '@scriptor/core/contracts/plugin'

export const helloWorldManifest: PluginManifest = {
  id: 'hello-world', name: 'Hello World', version: '1.0.0', publisher: 'Example',
  description: 'Minimal example plugin that registers a greeting command.',
  activation: ['manual'], capabilities: ['command'],
  permissions: [{ permission: 'read', reason: 'Read note metadata for the greeting.' }],
  contributes: { commands: [{ commandId: 'hello.greet', label: 'Hello World: Greet', category: 'Tools', permission: 'read' }] },
}
```

### Шаг 4: entry point

```ts
// src/index.ts
export { helloWorldManifest } from './manifest'
```

### Шаг 5: validation

```sh
pnpm check:plugins
```

Команда запускает manifest validation, sandbox tests и registry tests для всех plugins и сообщает ошибки некорректного manifest.

---

## 6. Как работают contributions

| Capability | Contribution slot(s) |
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

**Правило:** если contribution slot содержит элементы, должна быть объявлена соответствующая capability. Например, `mcpTools` без `mcp-tool` приводит к ошибке validation.

`collectContributions()` объединяет contributions всех enabled plugins при старте в плоские массивы для каждого slot. Host передаёт их в command bus, renderer, export pipeline и т. д.

---

## 7. Правила именования Plugin ID

ID должен соответствовать `^[a-z0-9][a-z0-9.-]*$`:

- Только **строчные** буквы, цифры, точки и дефисы.
- Начинается со строчной буквы или цифры.
- Без underscores, uppercase и пробелов.
- Точки — разделители namespace.

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

Рекомендуется prefix организации (`scriptor.*`, `acme.*`) для предотвращения collisions.

---

## 8. Контракт API V1

Текущая версия plugin API — **1.0.0**.

- При отсутствии `apiVersion` используется версия host.
- Версия должна быть точно `1.0.0`.
- Другие значения отклоняются; compatibility adapters не загружаются.

```ts
// Valid — exact current contract
apiVersion: '1.0.0'

// Invalid — not the current contract
apiVersion: '1.0.1'  // ❌ fails validation
```

Каждая новая версия продукта публикует свой точный plugin contract.

---

## 9. Тестирование plugin

```sh
pnpm check:plugins
```

Выполняются:

1. **Manifest validation** — schema, ID pattern, required fields, capabilities/permissions.
2. **Registry tests** — safe mode, enable/disable, snapshot correctness.
3. **Sandbox tests** — blocked capabilities и disabled-plugin behavior.
4. **Host sandbox tests** — raw filesystem access запрещён.
5. **WASM host tests** — validation WASM plugin manifests.
6. **Marketplace catalog** — bundled catalog не пуст.

При ошибке process завершится с code 1 и выведет причины.

### Ручной checklist

- [ ] Manifest проходит `validatePluginManifest()` без ошибок.
- [ ] Plugin загружается и виден в registry.
- [ ] Commands появляются в правильной категории.
- [ ] Permissions корректно показываются при установке.
- [ ] Plugin чисто отключается без crash host.
- [ ] Safe mode блокирует загрузку.

---

## 10. Примеры manifest

JSON-примеры оставлены без перевода, чтобы оставаться копируемыми и точно соответствовать каноническому API.

### Command plugin

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

## Эталонные plugins

| Plugin | Путь | Capabilities |
|---|---|---|
| Hello World | [`packages/plugins/hello-world/`](../../packages/plugins/hello-world/) | `command` |
| Canvas Kit | [`packages/plugins/canvas-kit/`](../../packages/plugins/canvas-kit/) | `canvas-tool`, `template-pack` |
| Publish Pack | [`packages/plugins/publish-pack/`](../../packages/plugins/publish-pack/) | `renderer-extension`, `export-profile` |
| Vault Lint | [`packages/plugins/vault-lint/`](../../packages/plugins/vault-lint/) | `inspector-widget`, `vault-health-check`, `command` |
| PDF Translate | [`packages/plugins/pdf-translate/`](../../packages/plugins/pdf-translate/) | `command`, `export-profile` |

---

## Ссылки на исходники

- Manifest schema: `packages/core/src/contracts/plugin.ts`
- Validation logic: `packages/plugin-api/src/manifest.ts`
- Sandbox policy: `packages/plugin-api/src/sandbox.ts`
- Plugin host: `packages/plugin-api/src/host.ts`
- Plugin registry: `packages/plugin-api/src/registry.ts`
- Contribution merging: `packages/plugin-api/src/contributions.ts`
