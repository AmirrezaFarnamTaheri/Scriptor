# Scriptor 功能概览

[English](CAPABILITIES.md) · **简体中文** · [Русский](CAPABILITIES.ru.md) · [Deutsch](CAPABILITIES.de.md) · [Español](CAPABILITIES.es.md) · [فارسی](CAPABILITIES.fa.md)

受功能开关控制的界面，其视觉参考保存在[视觉评审图库](./VISUAL-REVIEW.md)和[标准截图清单](assets/screenshots/README.md)中，包括 [Graph](assets/screenshots/graph.png)、[Canvas](assets/screenshots/canvas.png)、[MCP](assets/screenshots/mcp-panel.png) 和 [Plugins](assets/screenshots/plugins.png)。截图仅用于说明界面状态；原生授权状态和 vault 的真实状态仍是最终依据。

本文记录 **v1.0.0** 已交付的产品界面以及发布验证方式。

面向用户的功能导览位于主 [`README.md`](../README.md) 的 Features 部分；功能成熟度的权威说明位于 [`CAPABILITY-MATURITY.md`](./CAPABILITY-MATURITY.md)。本页用于跟踪 v1.0.0 的交付清单和发布验证命令。

## v1.0.0 已包含内容

| 领域 | 参考位置 |
|---|---|
| 桌面外壳（Tauri 2） | `apps/desktop/` |
| Vault 核心与索引器 | `crates/vault`, `crates/indexer` |
| 无界面 daemon IPC | [`architecture/IPC_DAEMON.md`](./architecture/IPC_DAEMON.md) |
| 终端界面 | [`architecture/TUI_PARITY.md`](./architecture/TUI_PARITY.md) |
| 插件系统（安全模式 + marketplace） | [`architecture/PLUGIN_SYSTEM.md`](./architecture/PLUGIN_SYSTEM.md) |
| 插件作者指南 + hello-world | [`plugins/AUTHOR_GUIDE.md`](./plugins/AUTHOR_GUIDE.md) |
| 22 个 MCP 工具与经过评审的草稿流程 | `packages/mcp/`；持久变更审计：`crates/vault/src/mcp_audit.rs`, `crates/daemon/src/automation_stdio.rs` |
| 导出（Pandoc） | `crates/export-runner`, `@scriptor/export` |
| Canvas 引擎（resvg worker 卸载） | `crates/canvas-engine`, `@scriptor/canvas` |
| 虚拟化 vault 树 | `src/components/app/VirtualNoteList.tsx` |
| 设计 token（已提取 414 行） | `src/styles/tokens/components.css` |
| 视觉回归测试 | `playwright.visual.config.ts` |
| axe-core CI 门禁 | `check:release` 中的 `check:a11y-axe` |
| 文档截图 | `docs/assets/screenshots/` |
| 发布打包与未签名信任证据 | `scripts/release/`, `.github/workflows/release.yml` |

## Headless 引擎

启用 **Settings → Headless engine** 后，索引、搜索、backlink、graph、Git 状态、健康诊断、笔记保存/重命名以及导出任务都会经由本地 daemon 处理。为保证响应速度，vault 打开、扫描和 Canvas 仍在进程内执行。详见 [`architecture/IPC_DAEMON.md`](./architecture/IPC_DAEMON.md)。

## 发布验证

```powershell
pnpm check:release   # Full local release gate (includes axe-core CI gate)
pnpm check:daemon    # IPC smoke
pnpm check:tui       # Terminal UI smoke
pnpm check:a11y      # Static accessibility checks
pnpm check:a11y-axe  # axe-core WCAG 2a/2aa/2.1aa automated audit
pnpm check:plugins   # Plugin manifest + marketplace catalog
pnpm check:mcp       # MCP tool manifest validation
pnpm check:contracts # TypeScript contract packages
pnpm check:canvas    # Canvas engine contracts
pnpm check:editor    # Editor engine contracts
pnpm check:renderer  # Renderer contracts
pnpm check:export    # Export pipeline contracts
pnpm check:knowledge # Knowledge graph contracts
pnpm check:citations # Citation engine contracts
pnpm check:headless  # Headless runner contracts
pnpm check:perf      # Performance baseline check
pnpm test:rust       # Rust unit and integration tests
pnpm test:visual     # Visual regression Playwright tests
pnpm test:e2e        # Playwright end-to-end tests
```

CI 会在 [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) 中执行对应检查。

## 相关文档

| 文档 | 用途 |
|---|---|
| [`guides/GETTING_STARTED.md`](./guides/GETTING_STARTED.md) | 首次运行指南 |
| [`release/PANDOC_STRATEGY.md`](./release/PANDOC_STRATEGY.md) | 导出前置要求 |
| [`release/SIGNING.md`](./release/SIGNING.md) | 安装包信任与签名策略 |
| [`../PRODUCT.md`](../PRODUCT.md) | 产品原则 |
| [`../CHANGELOG.md`](../CHANGELOG.md) | 发布历史 |
