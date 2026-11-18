# Scriptor 实时协同编辑实施计划

[English](2026-11-14-live-collaboration.md) · [فارسی](2026-11-14-live-collaboration.fa.md) · **简体中文** · [Русский](2026-11-14-live-collaboration.ru.md) · [Deutsch](2026-11-14-live-collaboration.de.md) · [Español](2026-11-14-live-collaboration.es.md)

> 面向工程实现者：按独立任务推进，并为每个增量保留测试失败与通过的证据。

**目标：** 支持多个 Scriptor 客户端同时编辑、离线恢复和可靠持久化；不得将 Google Docs 轮询或 Overleaf Git 同步误称为原生实时协同。

**架构：** 版本化协议把每次更新绑定至 vault、房间、文档、纪元和参与者。使用经过验证的 Yjs 兼容文本 CRDT 实现并发收敛。本机层管理持久日志和文件写入边界；已认证的 WSS 中继只在数据持久提交后发出 ACK。CodeMirror 和 Monaco 提交增量编辑事务，外部提供商通过独立适配器处理审查后的投影。

**技术：** TypeScript/Node 22、React、CodeMirror 6、Monaco、Rust/Tauri、SQLite WAL、Yjs、认证 WebSocket。

## 全局安全约束

- 精确验证 vault、room、document、epoch 和 peer；用户对每个文档单独授权。
- 大小限制：单次更新 256 KiB、在线状态 2 KiB、实体化文档 2 MiB、本地未确认队列 64 MiB。
- 已撤销成员不得读写；只读成员不得写入。过期会话的异步结果不得修改当前文档。
- ACK 必须表示中继已完成持久事务，不能以发送网络帧代替确认；本地已确认的更改必须经得起重启。
- 保持原有 Drive/Docs 不可变修订、有限轮询、Overleaf Git 交换、CAS 与恢复机制的独立完整性。
- 禁用未经公开支持的 Overleaf 私有编辑端点；未经真实验证不得宣称提供商原生实时编辑。
- 使用独立分支，以 main 为基线，不混入 PR #336；完成精确版本验证前始终保持草稿 PR。

## 任务 1：消息协议和可靠重试队列

**文件：** src/lib/liveCollaborationProtocol.ts 及测试、src/lib/liveCollaborationQueue.ts 及测试。

**接口：** parseLiveCollaborationScope、parseLiveCollaborationEnvelope、PendingCollaborationQueue；网络消息始终视为不可信输入。

- [ ] 先编写失败测试，覆盖错误的 vault/房间/文档/纪元、畸形 base64、超大载荷、重复 ID、序号复用、错误 ACK、队列恢复与容量拒绝。
- [ ] 运行 node --experimental-strip-types --test src/lib/liveCollaborationProtocol.test.ts src/lib/liveCollaborationQueue.test.ts，并记录缺失功能导致的失败。
- [ ] 实现严格解析、幂等重试、精确确认；超配额时保留原有待发送内容。
- [ ] 再次运行同一测试并通过；运行 pnpm check:contracts && pnpm test:source。
- [ ] 只提交已经验证的独立增量。

## 任务 2：本机持久日志和文件投影协调器

**文件：** 新建 apps/desktop/src-tauri/src/commands/collaboration_live.rs；调整 commands/mod.rs、lib.rs；增加 Rust 测试。

**接口：** 开始、追加、查询待确认、ACK、重放、停止，返回持久日志与 CAS 投影收据。

- [ ] 测试错误 vault、符号链接、旧纪元、fsync 失败、重启恢复、重复 ACK、外部文件变更和双写竞争。
- [ ] 先观察 cargo test -p scriptor-desktop collaboration_live 的预期失败。
- [ ] 实现具备唯一更新 ID、事务状态转换和容量限制的 SQLite WAL 日志；文件更新复用本机授权、CAS 与恢复边界。
- [ ] 发生错误时暂停协同会话并保护可恢复草稿。
- [ ] 通过 Rust 定向测试、cargo check --locked 及源码合约检查后单独提交。

## 任务 3：自托管认证中继

**文件：** services/collaboration-relay/，包含独立测试和部署说明。

**接口：** 公钥签名挑战、当前成员权限、房间/文档/纪元状态及 SYNC、UPDATE、ACK、RESYNC、撤权事件。

- [ ] 测试三个认证客户端、只读写入拒绝、离线编辑者撤权、不确定结果重试、提交前后崩溃、乱序消息、过期凭据和压缩恢复。
- [ ] 在实现前通过 npm test 记录预期失败。
- [ ] 生产环境仅允许 WSS；每条消息重新核对权限；事务提交后发送 ACK；安全处理快照和游标压缩，在线状态设置 TTL。
- [ ] 通过功能、安全、TLS、负载和崩溃恢复测试；不得默认启用外部联网。

## 任务 4：会话与编辑器适配

**文件：** 新建 src/hooks/useLiveCollaboration.ts；修改 packages/editor/src/codemirror.tsx、src/components/editor/MonacoMarkdownEditor.tsx、src/components/SourceMonacoEditor.tsx、src/hooks/useWorkspaceEditor.ts。

- [ ] 先测试跨编辑器事务、作者独立撤销、远程光标、输入法、Unicode、文档切换、迟到响应和自动保存冲突。
- [ ] 记录失败后接入增量 CRDT 事务；收到远端更新时不得用全量 setValue 破坏撤销历史。
- [ ] 实现逐文档显式启用、无障碍状态提示、错误恢复及唯一文件投影负责人。
- [ ] 通过定向测试及 pnpm check:editor && pnpm check:contracts && pnpm test:e2e 后提交。

## 任务 5：恢复、安全与发布证据

**文件：** e2e/live-collaboration-workflows.spec.ts 和 docs/validation/LIVE-COLLABORATION-ACCEPTANCE.md。

- [ ] 使用 100 个确定性随机种子、每个种子 1000 次编辑、三个客户端进行测试；覆盖网络分区、重启、丢失 ACK、撤权、损坏快照及同文件竞争。
- [ ] 保留原始失败证据，只修复实际的数据丢失、授权、安全、性能和无障碍问题，不削弱断言。
- [ ] 证明所有副本字节一致、所有已确认本地修改可恢复、未授权写入被拒绝。
- [ ] 记录精确提交 ID、打包验证、TLS 安全审核及限制；真实设备验证前保持实验状态。

## 独立后续里程碑

**M2 Overleaf：** 通过官方 Git 安全同步完整项目树，显式审查资源文件、二进制内容、删除和冲突；禁止强制推送。

**M3 Google Docs：** 为标签页、样式、列表、链接、表格构建结构化文档模型；使用带修订控制的选择性 batchUpdate；不允许静默丢失不支持的内容。

**M4 提供商协调：** 提供商检查点与 CRDT ACK 分离，对外部差异执行重新审查。

**M5 Overleaf 原生实时编辑器：** 仅在获得经过安全评估的官方支持协议后推进。

**已批准的初始部署方式：** 自托管、非端到端加密，必须清楚告知中继运营者可能接触内容。托管服务、自动向提供商写入、非官方协议都需要单独批准。
