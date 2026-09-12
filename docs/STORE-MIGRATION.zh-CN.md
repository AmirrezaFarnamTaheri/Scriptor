[English](STORE-MIGRATION.md) · [فارسی](STORE-MIGRATION.fa.md) · **简体中文** · [Русский](STORE-MIGRATION.ru.md) · [Deutsch](STORE-MIGRATION.de.md) · [Español](STORE-MIGRATION.es.md)

# Renderer store 所有权

Store 负责临时 renderer 状态、read-model 缓存、请求标识、乐观 UI 和重试状态。它们绝不能成为 vault 文件、秘密、授权、daemon nonce 或原生 job 执行的权威来源。

## 当前所有权

| 界面 | 当前所有者 | 下一步提取 | 边界 |
| --- | --- | --- | --- |
| Panel routing 和 payload | App shell 与 overlay hook | `usePanelRouterStore` | 原生命令保持在 store 外部 |
| Reader 生命周期与 annotation retry | Reader panel 与 save queue | `useReaderSessionStore` | Vault sidecar 是持久权威来源 |
| Plugin 决策 | 通过 bridge 投影的 backend plugin state | `useCapabilityStore` | Vault-backed state 与 native gate 权威有效 |
| MCP discovery/drafts/audit | MCP panels 与 runtime hooks | `useMcpRuntimeStore` | Tool 执行与权限检查留在 native 层 |
| Git status 和 jobs | Git panels/hooks | `useGitWorkspaceStore` | Git process、credentials、conflict writes 留在 native 层 |
| 冲突选择与 merge preview | Git UI | `useConflictResolutionStore` | 权威 Markdown 写入留在 vault/native boundary |
| Task/Kanban requests | Domain panels | `useTaskBoardStore` | Request ID 拒绝过期响应；Markdown 是真相来源 |
| Export/publish plans | Export/Publish panels | `useExportJobStore`, `usePublishPlanStore` | 进程启动与发布留在 native/CI |
| Navigation/history/tabs | Editor/navigation controllers | reducer-backed navigation store | Editor 持久化仍由 vault 支撑 |

## 提取规则

每次提取都必须从失败的 race/retry 测试开始，暴露有类型的状态机（`idle`, `loading`, `success`, `error`, `cancelled`），携带 request/job 标识，并保持现有 native 授权边界。只有旧 owner 被移除、所有 consumer 使用新 contract、重复状态不再可能分歧时，store 迁移才算完成。

当前变更包已经包含 navigation、editor orchestration 和 panel surfaces 的 controller 分解。剩余 store 是有意分阶段进行的 follow-up，不是在没有迁移 ownership 的情况下引入重复 provider。

## 视觉参考

Store 边界对应[视觉图库](./VISUAL-REVIEW.zh-CN.md)中审查过的界面：

- panel routing 与命令可用性：[command palette](assets/screenshots/command-palette.png)
- graph/canvas workspace state：[Graph](assets/screenshots/graph.png) 与 [Canvas](assets/screenshots/canvas.png)
- Git/conflict state：[Git panel](assets/screenshots/git-panel.png) 与 [conflict resolver](assets/screenshots/conflict-resolver.png)
- MCP runtime state：[MCP panel](assets/screenshots/mcp-panel.png)
- export/publish jobs：[Publish center](assets/screenshots/publish-center.png)
- preferences/plugin state：[Settings](assets/screenshots/settings.png) 与 [Plugins](assets/screenshots/plugins.png)
