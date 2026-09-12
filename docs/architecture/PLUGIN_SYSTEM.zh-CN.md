# 插件系统设计

[English](PLUGIN_SYSTEM.md) · **简体中文** · [Русский](PLUGIN_SYSTEM.ru.md) · [Deutsch](PLUGIN_SYSTEM.de.md) · [Español](PLUGIN_SYSTEM.es.md) · [فارسی](PLUGIN_SYSTEM.fa.md)

![插件 marketplace 与已安装插件](../assets/screenshots/plugins.png)

## 目标

- 让 Scriptor 可以扩展，同时不让核心应用变成缺乏边界的开放面。
- 通过 command contract 保护文件和 vault 写入。
- 允许第一方与随附的 marketplace 扩展添加 command、renderer 行为、export profile、MCP 工具、inspector widget、vault health check、canvas 工具、block 与 template pack。
- 让每一项权限都可见且可撤销。

## 非目标

- 第一版不允许插件直接访问原始文件系统。
- 不允许由插件管理后台 daemon。
- 不允许未经 review 的 MCP 写入工具。

## 插件 Runtime 模型

```text
Plugin manifest
  -> permission review
  -> activation policy
  -> contribution registry
  -> command bus / renderer / export / MCP slots
  -> audit events
```

插件通过 slot 提供行为：

| Slot | 能力 | 最低权限 |
|---|---|---|
| Command | Command palette 与自动化 action。 | `read` |
| Renderer extension | Markdown preview transform。 | `read` |
| Export profile | 新的 export target 或 template。 | `system` |
| MCP tool | AI/tooling interface。 | `read` |
| Inspector widget | 右侧 note/vault widget。 | `read` |
| Vault health check | Diagnostics rule。 | `read` |
| Canvas tool | Edgeless canvas toolbar action。 | `read` |
| Canvas block | Canvas mode 注册的 block renderer。 | `read` |
| Template pack | Document 或 canvas 起始布局。 | `read` |

## 权限模型

| 权限 | 含义 |
|---|---|
| `read` | 可以查询获准的 command contract。 |
| `write-approved` | 可以提出需要用户确认的写入。 |
| `system` | 可以使用派生 cache/job，但不能修改 canonical file。 |
| `dangerous` | 安装时必须明确警告，运行时必须再次确认。 |
| `network` | 默认阻止，仅允许 allowlist 中的 host。 |
| `secrets` | 只能通过具名 keychain handle 访问。 |
| `external-process` | 在插件 sandbox policy 完成前保持禁用。 |

## 第一方插件候选

| 插件 | 价值 | Slots |
|---|---|---|
| `scriptor-citation-tools` | CSL、bibliography、缺失 citation 健康检查。 | inspector widget, health check, export profile |
| `scriptor-graph-lens` | 高级 graph filter 与 note centrality 报告。 | inspector widget, command |
| `scriptor.publish-pack` | 发布 template 与 export profile。 | export profile, renderer extension |
| `scriptor-vault-lint` | 检查 broken link、无效 frontmatter、stale note。 | health check, command |
| `scriptor-mcp-research` | 只读研究助手工具。 | MCP tool, command |
| `scriptor.canvas-kit` | Sticky note、shape、connector 与 research board template。 | canvas tool, canvas block, template pack |

## 安全门禁

- 插件 manifest 在加载前必须通过 schema validation。
- 权限变化需要用户确认。
- 插件 command 与 UI 和 CLI 使用同一个 command bus。
- 插件 widget 只收到限定范围的数据，绝不会获得原始 vault handle。
- 插件 renderer extension 只收到经过 sanitization 的输入。
- 插件失败时只禁用该插件，不得让应用 shell 崩溃。
- Safe mode 启动时禁用全部插件。

## 已交付能力

| 能力 | 位置 |
|---|---|
| Manifest schema | `@scriptor/core/contracts/plugin` |
| Contribution registry + safe mode | `packages/plugin-api` |
| 随附 marketplace catalog | `packages/plugin-api/catalog.json`, `src/marketplace.ts` |
| Remote catalog merge | `loadMarketplaceCatalog` (`VITE_SCRIPTOR_PLUGIN_MARKETPLACE_URL`) |
| 第一方插件 | `scriptor-vault-lint`, `scriptor.canvas-kit`, `scriptor.publish-pack` |
| Plugin panel UI | `src/components/PluginPanel.tsx` |
| MCP 只读 plugin slot | `packages/mcp` |
