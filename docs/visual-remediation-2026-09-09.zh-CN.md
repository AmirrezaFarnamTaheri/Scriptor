[English](visual-remediation-2026-09-09.md) · [فارسی](visual-remediation-2026-09-09.fa.md) · **简体中文** · [Русский](visual-remediation-2026-09-09.ru.md) · [Deutsch](visual-remediation-2026-09-09.de.md) · [Español](visual-remediation-2026-09-09.es.md)

# 视觉整改 — 2026-09-09

本 checklist 跟踪对 Windows workspace 及相关界面的第二轮原生视觉审查。它有意保留在实现分支中，以便每项整改能够增量落地并验证。

## P1 — Shell 与编辑器信息架构

- [x] 将持续占三行的 editor toolbar 收敛为一条主工具栏，次要工具通过 progressive disclosure 展开。
- [x] 消除 Source/Preview/Split 与 editor option icon 之间的语义重复。
- [x] 让 active-mode、toggle 与瞬时 command 状态在视觉和语义上明确区分。
- [x] 降低 global top-bar command 密度并合并重复入口。
- [x] 明确全局搜索、笔记搜索和 command palette 的 scope：全局 trigger 明确为 `Commands and notes`，sidebar 只搜索笔记，palette 解释何时进入 note search。
- [x] 删除重复的 `Vault`/recent-note 导航并明确 sidebar utility action。
- [x] 减少 split mode chrome，同时保持可用的 editor/preview 宽度。
- [x] 简化两层底部 status/output chrome；删除重复 Jobs affordance 与已完成 progress 噪声。
- [x] 将真实问题的优先级提高到被动 subsystem status 之上。

## P1 — 信任、状态与命名

- [x] 对齐 Inspector citation 指标，明确 note-level 与 vault-level 区别。
- [x] 用 vault-scoped health 与 note-scoped Publish readiness 替换重叠的 Note Health / Note quality。
- [x] 消除 editor surface mode 与 inspector tab 之间的 Preview 命名冲突（改为 `Rendered output`）。
- [x] 将 Inspector profile 明确为单选控件，并无需 tooltip 即可显示所选 profile 描述。
- [x] 修正 Publish Center 术语、profile label/path 分离和 export action 层级。
- [x] 让 onboarding 感知状态，不再指导用户操作被阻塞的后台控制。
- [x] 替换模糊 merge 术语，并要求 apply 前明确解决每个 hunk。

## P2 — 单独界面

- [x] 将 Settings 重做为可导航 section，明确持久化模型并减少实现术语。
- [x] 将已安装 plugin/permission 管理与 marketplace 浏览分离，同时保持四个 top-level Store tab 在一行。
- [x] 将 MCP authorization level 表现为安全状态而非普通 tab，并明确 vault scope。
- [x] 将 Vault Health 健康状态改为正向摘要，降低 maintenance action 权重。
- [x] Note History 以 comparison-first、restore-second 组织，统一 timestamp，preview read fail-closed。
- [x] Knowledge Workbench 使用正向且不重复的 empty state。
- [x] 改进 Graph 方向、双向 edge 可见性、焦点标签、控制、键盘导航和 canvas 利用率。
- [x] 简化 Git rail action、状态措辞、pull strategy、确认与 commit workflow 层级。
- [x] Conflict resolver 视觉上 diff-first、始终可关闭并默认安全。
- [x] 明确 command palette category、shortcut 对齐和重要操作。
- [x] 给空 Canvas 明确第一步；无内容时降低 export controls，并删除 developer CLI 泄漏。
- [x] 实现真正的 keyboard-shortcuts 管理界面，不复用 Settings。

## P2 — Accessibility、响应式、主题、本地化

- [x] 在最终 CSS cascade 中保持 44px coarse-pointer target。
- [x] 验证 Canvas、graph、toolbar menu、virtualized Git row 和 security-state control 的键盘语义。
- [x] 验证每个审查 dialog/panel 的 dark mode，而非仅主 workspace。自动覆盖 Settings、MCP、Graph、Knowledge Workbench、Note History、Canvas、Plugins、Git/conflicts、Export & publish、Vault Health 与首次 onboarding，并带明确 dark-surface assertion。
- [x] 完成 Windows scaling、长名称、大数据、loading/error、破坏性确认的视觉矩阵。覆盖 Windows visual regression、125% device scale/app zoom、compact/mobile/tablet、带长文件名的大型 virtualized vault、慢加载 skeleton、editor/preview failure、破坏性确认、Persian RTL 与 German expansion。
- [x] 删除仍需 semantic token 的 hard-coded implementation/theme color。最终 repository sweep 将 application chrome、status color、editor warning、reader surface、error overlay 和 primary-action foreground 统一到 semantic/theme token。保留字面颜色均为有意 palette definition、user/content color、export/print color、data visualization/category palette 或 semantic variable 后的 fallback。

## Detour 中发现的正确性与信任问题

- [x] 删除 heuristic merge-ancestor reconstruction，对 unresolved/incomplete conflict block fail-closed。
- [x] 修复在 `setVault` 后立即读取 stale React state 的 initial-vault refresh。
- [x] Plugin consent 采用 least-privilege：默认只 required permission，per-vault additive grant 与 vault-scoped revoke。
- [x] 序列化 vault configuration mutation path，并在 Settings save 中保留 runtime-owned MCP state。
- [x] 将 LanguageTool 路由到受支持 desktop network path，并显示 service failure，而不是静默报告无问题。
- [x] 按 task parser 一致渲染 extended task state。
- [x] 当 selected revision 或 current-note comparison 无法读取时禁用 Note History restore。
- [x] 暴露 native layer 支持的 Git pull strategy，不再 hard-code fast-forward。

## 验证

每个已勾选项至少拥有一种证据：聚焦 unit/component test、E2E interaction assertion、accessibility assertion 或覆盖相关状态的 visual contract。Screenshot test 正在强化，使缺失 feature 直接失败，而不是静默捕获 fallback 界面。

最新 recovery pass 还删除了第二套 `splitPreview` UI authority：现在由 `chrome.editorSurfaceMode` 统一驱动 Source/Split/Rendered，layout preset 与 palette toggle 都经由该 authority，Inspector 也接收相同 effective state。E2E workspace-chrome fixture 现在使用 production versioned-storage envelope，因此原本要测试 custom layout 时不再静默回退 default chrome。同时修复了 stale accessible-name 与过宽 locator。

用于原子应用大型 cross-file recovery 的临时 branch-only write workflow 已在成功 commit 后自删除；它不属于拟议 product/CI surface。

PR 在 current-head CI、desktop compile、visual review 全绿之前保持 draft；任何未完成项必须实现，或带 evidence 明确拆分为 follow-up scope。
