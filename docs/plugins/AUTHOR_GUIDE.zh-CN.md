[English](AUTHOR_GUIDE.md) · [فارسی](AUTHOR_GUIDE.fa.md) · **简体中文** · [Русский](AUTHOR_GUIDE.ru.md) · [Deutsch](AUTHOR_GUIDE.de.md) · [Español](AUTHOR_GUIDE.es.md)

# 插件作者指南

创建 Scriptor 插件的完整参考。

## 快速开始

最小可运行示例位于 [`packages/plugins/hello-world/`](../../packages/plugins/hello-world/)。

---

## 1. 插件 Manifest

每个插件都导出一个 `PluginManifest` 对象。Manifest 声明插件身份、生命周期、能力、权限和贡献项。

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

### 字段

| 字段 | 类型 | 必需 | 说明 |
|---|---|---|---|
| `id` | `string` | 是 | 唯一插件标识。参见[命名规则](#7-plugin-id-命名规则)。 |
| `name` | `string` | 是 | 面向用户的可读名称。 |
| `version` | `string` | 是 | Semver 版本。 |
| `apiVersion` | `string` | 否 | 插件 API 版本。默认使用当前 host 版本。参见 [V1 API 契约](#8-v1-api-契约)。 |
| `publisher` | `string` | 是 | 作者或组织名称。 |
| `description` | `string` | 是 | 插件简短说明。 |
| `activation` | `PluginActivation[]` | 是 | 插件何时加载。 |
| `capabilities` | `PluginCapability[]` | 是 | 插件使用的能力类型。 |
| `permissions` | `PluginPermission[]` | 是 | 所需的数据/资源访问权限。 |
| `contributes` | `PluginContributions` | 否 | Commands、widgets 等 contribution slot。 |

### 激活策略

| 值 | 行为 |
|---|---|
| `'manual'` | 用户必须显式启用或调用插件。 |
| `'on-startup'` | Scriptor 启动时加载插件。 |
| `'on-vault-open'` | 打开 vault 时加载插件。 |

插件可以声明多个激活策略；第一个匹配项会触发加载。

---

## 2. Capability 类型

在 `capabilities` 数组中声明能力。每种 capability 都会启用特定 contribution slot。

### 2.1 `command`

在 command palette 中注册命令。

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

| 字段 | 类型 | 说明 |
|---|---|---|
| `commandId` | `string` | 唯一 dotted command ID。 |
| `label` | `string` | 在 command palette 中显示的名称。 |
| `category` | `string` | 分组，例如 `Vault`、`Export`、`Tools`。 |
| `permission` | `CommandPermission` | 最低权限：`read`、`write-approved`、`system` 或 `dangerous`。 |

### 2.2 `renderer-extension`

使用自定义转换扩展 Markdown preview renderer。

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

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `string` | 唯一 extension ID。 |
| `label` | `string` | 显示名称。 |
| `handles` | `'block' \| 'inline' \| 'document'` | 转换作用范围。 |
| `priority` | `number` | 数字越小越先运行。 |

### 2.3 `export-profile`

添加新的导出格式或模板。

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

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `string` | 唯一 profile ID。 |
| `label` | `string` | 导出对话框中的显示名称。 |
| `format` | `ExportFormat` | 目标格式，例如 `html`、`pdf`、`wechat-html`。 |

### 2.4 `mcp-tool`

向 MCP（Model Context Protocol）层暴露工具，用于 AI 集成。

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

| 字段 | 类型 | 说明 |
|---|---|---|
| `name` | `string` | 通过 MCP 暴露的 tool 名称。 |
| `label` | `string` | 可读标签。 |
| `modeRequired` | `McpMode` | 所需 MCP mode，例如 `read`。 |
| `commandId` | `string` | 实现该 tool 的 command。 |

### 2.5 `inspector-widget`

向 Inspector 侧栏添加 panel。

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

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `string` | 唯一 widget ID。 |
| `label` | `string` | 显示名称。 |
| `placement` | `'note' \| 'vault' \| 'export' \| 'graph' \| 'canvas'` | Widget 出现的位置。 |

### 2.6 `vault-health-check`

为 vault health report 定义诊断规则。

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

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `string` | 唯一 check ID。 |
| `label` | `string` | Health report 中的名称。 |
| `severity` | `'info' \| 'warning' \| 'error'` | 严重级别。 |

### 2.7 `canvas-tool`

向 Canvas toolbar 添加工具。

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

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `string` | 唯一 tool ID。 |
| `label` | `string` | Toolbar 标签。 |
| `commandId` | `string` | 实现该工具的 command。 |
| `toolKind` | `'select' \| 'draw' \| 'shape' \| 'connector' \| 'template' \| 'present' \| 'place'` | 行为类别。 |

### 2.8 `canvas-block`

为 Canvas 注册自定义 block renderer。

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

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `string` | 唯一 block ID。 |
| `label` | `string` | 显示名称。 |
| `blockKind` | `CanvasBlockKind` | Block 类型，例如 `markdown`、`image`。 |
| `rendererId` | `string` | Renderer ID。 |

### 2.9 `template-pack`

打包文档或 Canvas 的 starter template。

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

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `string` | 唯一 template ID。 |
| `label` | `string` | 显示名称。 |
| `categories` | `string[]` | 用于过滤的 category tag。 |
| `canvasCompatible` | `boolean` | 是否可用于 Canvas。 |
| `documentCompatible` | `boolean` | 是否可用于 document mode。 |

---

## 3. 权限模型

每个插件必须声明所需权限，并为每项权限提供用户可读的原因。

```ts
permissions: [
  { permission: 'read', reason: 'Read vault note metadata for search.' },
],
```

### 可用权限

| 权限 | 范围 |
|---|---|
| `read` | 查询获准的 command contract 与 vault metadata。 |
| `write-approved` | 提议需要用户确认的写操作。 |
| `system` | 使用 derived cache 与后台 job，但不修改权威文件。 |
| `dangerous` | 安装时明确警告 + runtime 确认。Sandbox policy 完成之前**必须设置 `optional: true`**。 |
| `network` | HTTP 访问。默认阻止；由 host 管理 allowlist。 |

### 被阻止的权限（v1）

| 权限 | 原因 |
|---|---|
| `external-process` | Plugin sandbox policy 实现前不可用。 |
| `secrets` | Named keychain handle 实现前不可用。 |

声明被阻止权限会使 manifest validation 失败。

### 权限原因

每个 permission 条目**必须**包含非空 `reason`。安装时会向用户显示，以支持知情决策。

```ts
// Good
{ permission: 'read', reason: 'Read note titles for the search command.' }

// Bad — will fail validation
{ permission: 'read', reason: '' }
```

### `optional` 标志

`dangerous` 权限必须设置 `optional: true`，表示插件没有该权限也能运行，只在真正需要时于 runtime 请求。

```ts
{ permission: 'dangerous', reason: 'Bulk rename files.', optional: true }
```

---

## 4. Safe Mode

Scriptor 以 safe mode 启动时：

- Registry 层**禁用所有插件**。
- Safe mode 激活期间，单个插件**不能重新启用**。
- 清除上一 session 的 plugin failure。
- Safe mode 是插件导致不稳定时的恢复机制。

```ts
const registry = new PluginRegistry(/* safeMode */ true)
registry.listEnabled() // => [] — nothing runs
registry.setEnabled('acme.my-plugin', true) // => false — blocked
registry.setSafeMode(false)
registry.setEnabled('acme.my-plugin', true) // => true — now allowed
```

用户可在插件设置 panel 中切换 safe mode。

---

## 5. Hello World 插件：逐步创建

### 第 1 步：创建目录

```
packages/plugins/hello-world/
  package.json
  src/
    manifest.ts
    index.ts
```

### 第 2 步：编写 `package.json`

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

### 第 3 步：编写 manifest

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

### 第 4 步：编写 entry point

```ts
// src/index.ts
export { helloWorldManifest } from './manifest'
```

### 第 5 步：验证

```sh
pnpm check:plugins
```

此命令会对全部插件执行 manifest validation、sandbox tests 与 registry tests；manifest 格式错误时会报告具体原因。

---

## 6. Contribution 如何工作

| Capability | Contribution slot |
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

**规则：**只要向某个 contribution slot 添加条目，就必须声明对应 capability。例如，在 `capabilities` 中没有 `mcp-tool` 却添加 `mcpTools` 会导致 validation 失败。

所有已启用插件的 contributions 会在启动时由 `collectContributions()` 合并为每个 slot 的平铺数组，然后由 host 送入 command bus、renderer、export pipeline 等。

---

## 7. Plugin ID 命名规则

Plugin ID 必须匹配 `^[a-z0-9][a-z0-9.-]*$`：

- 只能使用**小写**字母、数字、点和连字符。
- 必须以小写字母或数字开头。
- 不允许下划线、大写字母或空格。
- 点用于分隔 namespace。

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

约定：使用组织名作为前缀（例如 `scriptor.*`、`acme.*`），避免命名冲突。

---

## 8. V1 API 契约

当前插件 API 版本为 **1.0.0**。

- 省略 `apiVersion` 时默认使用 host 版本。
- API 版本必须精确等于 `1.0.0`。
- 其他版本会被拒绝；host 不加载兼容适配器。

```ts
// Valid — exact current contract
apiVersion: '1.0.0'

// Invalid — not the current contract
apiVersion: '1.0.1'  // ❌ fails validation
```

新的产品版本会发布各自的精确插件契约。

---

## 9. 测试插件

### 运行插件验证

```sh
pnpm check:plugins
```

它会执行：

1. **Manifest validation** — schema、ID pattern、必需字段、capability/permission 检查。
2. **Registry tests** — safe mode、enable/disable、snapshot 正确性。
3. **Sandbox tests** — 被阻止 capability、disabled-plugin 行为。
4. **Host sandbox tests** — 原始 filesystem 访问被拒绝。
5. **WASM host tests** — WASM plugin manifest validation。
6. **Marketplace catalog** — bundled catalog 非空。

任何测试失败都会以 code 1 退出并打印原因。

### 手动测试 checklist

- [ ] Manifest 通过 `validatePluginManifest()`，无错误。
- [ ] Plugin 加载并出现在 registry 中。
- [ ] Commands 在 command palette 中显示于正确 category。
- [ ] 安装过程中正确显示 permissions。
- [ ] Plugin 可干净禁用，不使 host crash。
- [ ] Safe mode 阻止插件加载。

---

## 10. Manifest 示例

以下 JSON 示例故意保持与权威 API 一致，不翻译可执行值，以便直接复制并与 canonical contract 对比。

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

## 参考插件

| 插件 | 路径 | Capabilities |
|---|---|---|
| Hello World | [`packages/plugins/hello-world/`](../../packages/plugins/hello-world/) | `command` |
| Canvas Kit | [`packages/plugins/canvas-kit/`](../../packages/plugins/canvas-kit/) | `canvas-tool`, `template-pack` |
| Publish Pack | [`packages/plugins/publish-pack/`](../../packages/plugins/publish-pack/) | `renderer-extension`, `export-profile` |
| Vault Lint | [`packages/plugins/vault-lint/`](../../packages/plugins/vault-lint/) | `inspector-widget`, `vault-health-check`, `command` |
| PDF Translate | [`packages/plugins/pdf-translate/`](../../packages/plugins/pdf-translate/) | `command`, `export-profile` |

---

## 源码参考

- Manifest schema：`packages/core/src/contracts/plugin.ts`
- Validation logic：`packages/plugin-api/src/manifest.ts`
- Sandbox policy：`packages/plugin-api/src/sandbox.ts`
- Plugin host：`packages/plugin-api/src/host.ts`
- Plugin registry：`packages/plugin-api/src/registry.ts`
- Contribution merging：`packages/plugin-api/src/contributions.ts`
