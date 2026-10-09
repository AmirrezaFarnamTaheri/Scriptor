# Scriptor 功能一览

[English](CAPABILITIES.md) · [فارسی](CAPABILITIES.fa.md) · **简体中文** · [Русский](CAPABILITIES.ru.md) · [Deutsch](CAPABILITIES.de.md) · [Español](CAPABILITIES.es.md)

Scriptor 以本地 Markdown 文件为基础，提供编辑、研究、发布和明确授权的自动化。本页介绍当前功能入口及职责边界。[能力成熟度记录](CAPABILITY-MATURITY.md)区分已发布、实验性和仅设计阶段的功能；出现一个按钮并不意味着该功能已具备生产支持。

[视觉评审画廊](VISUAL-REVIEW.zh-CN.md)和[截图目录](assets/screenshots/README.zh-CN.md)展示界面状态。实际权限和笔记库状态仍由原生层确认，不能从截图推断。

## 核心功能

| 领域 | 参考 |
|---|---|
| 桌面外壳（Tauri 2） | `apps/desktop/` |
| 笔记库内核与索引器 | `crates/vault`, `crates/indexer` |
| 无界面后台进程 IPC | [IPC](architecture/IPC_DAEMON.md) |
| 终端界面 | [TUI](architecture/TUI_PARITY.md) |
| 插件、安全模式与自有目录 | [Plugin system](architecture/PLUGIN_SYSTEM.md) |
| 插件作者指南与 Hello World | [Author guide](plugins/AUTHOR_GUIDE.md) |
| 22 个支持审核草稿的 MCP 工具 | `packages/mcp/` |
| Pandoc 导出 | `crates/export-runner`, `@scriptor/export` |
| 使用 resvg worker 的 Canvas 引擎 | `crates/canvas-engine`, `@scriptor/canvas` |
| 虚拟化笔记库树 | `src/components/app/VirtualNoteList.tsx` |
| 设计令牌 | `src/styles/tokens/components.css` |
| 视觉回归 | `playwright.visual.config.ts` |
| CI 的 axe-core 检查 | `check:a11y-axe`, `check:release` |
| 文档截图 | `docs/assets/screenshots/` |
| 发布打包与未签名信任证据 | `scripts/release/`, `.github/workflows/release.yml` |

MCP 写入的持久审计位于 `crates/vault/src/mcp_audit.rs` 和 `crates/daemon/src/automation_stdio.rs`。

## 实验性工作流

| 工作流 | 行为与参考 |
|---|---|
| 独立源文件 | 编辑 LaTeX、代码和相关文本格式，保存受保护；执行和编译需明确触发。见[成熟度记录](CAPABILITY-MATURITY.md)。 |
| Google 集成 | 独立账户连接、审核后的 Drive/Docs 修订、Calendar/Tasks 规划以及可选 Gmail。见[Google 指南](guides/GOOGLE_INTEGRATIONS.zh-CN.md)。 |
| Overleaf 交换 | 通过固定主机 Git 传输审核后的源文件。见[架构](ARCHITECTURE.zh-CN.md)。 |
| 运行会话与语义检查 | 明确授权的代码执行和依赖服务商的嵌入检查。原生层、服务商和打包客户端的证据是[独立验证要求](VERIFICATION.zh-CN.md)。 |
| 工作区组合 | 主侧工作区、可移动面板和自定义快捷入口；隐藏入口仍可从命令面板恢复。见[入门指南](guides/GETTING_STARTED.zh-CN.md)。 |

## 无界面引擎

启用 **Settings → Headless engine** 后，索引、搜索、反向链接、图谱、Git 状态、健康诊断、笔记保存/重命名和导出任务经由本地 daemon 执行。打开笔记库、扫描和 Canvas 仍在进程内运行以保持响应速度。见 [IPC 契约](architecture/IPC_DAEMON.md)。

## 验证

验证流程见 [CONTRIBUTING.zh-CN.md](../CONTRIBUTING.zh-CN.md)，当前结果和待完成门槛见 [VERIFICATION.zh-CN.md](VERIFICATION.zh-CN.md)。本次评审的所有可执行验证均由 GitHub workers 完成。浏览器夹具证明受控条件下的行为和布局，不能证明真实服务访问、已安装客户端行为或发布就绪。工作流证据须保留源码提交及诊断产物。

```powershell
pnpm check:release
pnpm check:daemon
pnpm check:tui
pnpm check:a11y
pnpm check:a11y-axe
pnpm check:plugins
pnpm check:mcp
pnpm check:contracts
pnpm check:canvas
pnpm check:editor
pnpm check:renderer
pnpm check:export
pnpm check:knowledge
pnpm check:citations
pnpm check:headless
pnpm check:perf
pnpm test:rust
pnpm test:visual
pnpm test:e2e
```

[CI](../.github/workflows/ci.yml)

## 相关文档

[Pandoc 前提条件](release/PANDOC_STRATEGY.md) · [安装包信任](release/SIGNING.md) · [产品原则](../PRODUCT.md) · [更新日志](../CHANGELOG.md)
