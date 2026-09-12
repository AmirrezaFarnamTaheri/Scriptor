# 产品

**Scriptor** · *面向严肃写作的工具* · 版本来源：[`VERSION`](VERSION)

## 产品定位

Scriptor 是一个面向严肃写作和研究的 local-first Markdown 工作空间。它把写作、证据管理、引用、图谱导航、感知 Git 的修订、可复现发布和权限受控的自动化结合在一起，同时始终以磁盘上的 Markdown 文件作为权威来源。

## 运行环境

- Tauri 桌面应用是主要产品界面。
- Web shell 用于开发和视觉测试。
- daemon、CLI/TUI、MCP server 和受限的 plugin catalog 都是同一 vault 模型的运维扩展。
- Mobile、加密 vault、embeddings、Tantivy 和 WASM host 仍按 [`docs/CAPABILITY-MATURITY.zh-CN.md`](docs/CAPABILITY-MATURITY.zh-CN.md) 标记为实验性或仅设计阶段。

## 现有证据

产品声明基于仓库中的实际 artifact，而不是 roadmap 措辞：

- [`README.zh-CN.md`](README.zh-CN.md) 定义当前 release 状态和受支持入口。
- [`docs/CAPABILITY-MATURITY.zh-CN.md`](docs/CAPABILITY-MATURITY.zh-CN.md) 区分已实现、实验性和仅设计能力。
- [`docs/ARCHITECTURE.zh-CN.md`](docs/ARCHITECTURE.zh-CN.md) 记录组件所有权和信任边界。
- [`docs/VERIFICATION.zh-CN.md`](docs/VERIFICATION.zh-CN.md) 定义当前检查能够证明什么，以及哪些结论需要 clean environment 证据。
- [`DESIGN.zh-CN.md`](DESIGN.zh-CN.md) 定义交互、可访问性和视觉系统要求。

## 产品原则

1. **文件始终权威。** Markdown 保持可移植、可检查、可恢复。
2. **授权必须明确。** Native、network、process、plugin、MCP、backup、publishing 和 destructive action 都跨越具名的权限边界。
3. **工作必须有界。** 扫描、图遍历、process output、日志、队列和保留记录都有明确限制。
4. **变更必须可恢复。** 高影响变更会暴露范围、有序副作用、失败状态和恢复证据。
5. **成熟度必须如实表达。** 已实现行为、实验性工作和设计选项绝不会被描述成等价保证。
6. **工作空间服务于写作。** 导航、诊断和自动化用于支持文档，而不是取代文档。

## 用户与核心任务

Scriptor 面向长期维护 Markdown vault 的作者、研究人员、学生、技术作者和知识工作者。他们使用 Scriptor 收集材料、连接证据、撰写和修订长文、管理引用、检查知识质量、可复现地发布，并在不放弃文件所有权的前提下自动化有界任务。

## 产品承诺

1. Markdown 文件保持可移植且权威。
2. 在高风险操作发生前，用户能够理解哪些内容会被读取、写入、发送、执行或删除。
3. Index、graph、Git、export 和 backup 状态可观察且可恢复。
4. 即使在高密度研究场景下，写作工作区也保持平静、清晰、可读。
5. 实验性能力会明确标记，绝不会被表述为已经发布的保证。

## 受支持界面

| 界面 | 成熟度 |
|---|---|
| Web development shell | 支持开发和视觉测试 |
| Tauri desktop (Windows, macOS, Linux) | 主要产品界面 |
| Headless daemon 与 CLI/TUI | 受支持的运维界面 |
| MCP stdio integration | 通过 scoped tools 和持久 audit record 提供支持 |
| Plugin catalog | manifest-first、受限、实验性平台 |
| Google Calendar 与 Tasks | 实验性、opt-in 桌面集成 |
| Mobile、encrypted vaults、embeddings、Tantivy、WASM host | 实验性或仅设计阶段 |

权威矩阵见 [`docs/CAPABILITY-MATURITY.zh-CN.md`](docs/CAPABILITY-MATURITY.zh-CN.md)。

## 成功指标

- 不发生静默数据丢失或跨 vault mutation；
- 随 vault 规模增长，内存和延迟仍保持有界；
- release 可复现、可追溯到 source，并明确提供 trust status、checksum、CycloneDX SBOM、receipt 和 provenance attestation；
- 工作流程支持完整键盘操作并达到 WCAG 2.2 AA；
- 新贡献者无需“考古”即可定位 ownership、contract、test 和 operational evidence；
- 除明确 opt-in 的服务外，核心用户工作流无需外部网络即可运行。

## 明确排除项

- proprietary storage 作为 source of truth；
- 环境式 AI 或 plugin 权限；
- 隐藏的 network fallback；
- 以 chat-first 导航取代写作；
- 减少工作区域的装饰性 dashboard chrome；
- 对原型加密或未隔离第三方代码作安全保证；
- 隐藏或歪曲官方 upstream installer 有意保持 unsigned 状态的生产渠道。

## 运行模型

Scriptor 是 local-first 产品。相对于 native authority，renderer 被视为不可信。Tauri command、daemon RPC、MCP、external process、Git、keychain 访问和 backup/restore 都是明确边界。本地 log 与 audit record 有界并经过脱敏；高完整性的 mutation record 使用 hash chain。

## Roadmap 政策

Roadmap 描述的是选项，而不是当前行为。一项 capability 只有在具备以下条件后才能升级：

- 明确的 owner 和 source entry point；
- 明确的 trust 与 failure semantics；
- positive、negative、restart、cancellation 和 recovery 测试；
- authorization/privacy 模型；
- 有界性能证据；
- 用户与运维文档；
- capability ledger 中的 release inclusion 与 support 状态。
