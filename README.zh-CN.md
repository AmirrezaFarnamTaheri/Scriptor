<div align="center">

# Scriptor

**面向严肃写作与研究的本地优先 Markdown 工作空间。**

[English](README.md) · [فارسی](README.fa.md) · **简体中文** · [Русский](README.ru.md) · [Deutsch](README.de.md) · [Español](README.es.md)

[![Version](https://img.shields.io/badge/version-1.0.8-0f766e.svg)](VERSION)
[![License: AGPL-3.0-or-later](https://img.shields.io/badge/license-AGPL--3.0--or--later-0f766e.svg)](LICENSE)
[![Platforms](https://img.shields.io/badge/platforms-Windows%20%7C%20macOS%20%7C%20Linux-0f766e.svg)](#download)
[![Stack](https://img.shields.io/badge/stack-Tauri%202%20%C2%B7%20React%2019%20%C2%B7%20Rust%201.96-0f766e.svg)](#tech-stack)
[![CI](https://img.shields.io/github/actions/workflow/status/AmirrezaFarnamTaheri/Scriptor/ci.yml?branch=main&label=CI)](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/workflows/ci.yml)

你的笔记始终是普通的 Markdown 文件。Scriptor 在此基础上提供编辑、反向链接、引用、版本历史、发布，以及带明确权限边界的自动化能力。

[下载](#download) · [快速开始](docs/guides/GETTING_STARTED.zh-CN.md) · [功能一览](docs/CAPABILITIES.zh-CN.md) · [插件开发](docs/plugins/AUTHOR_GUIDE.zh-CN.md) · [参与贡献](CONTRIBUTING.zh-CN.md)

</div>

![Scriptor 工作空间：编辑器、渲染预览、检查器和紧凑状态栏](docs/assets/screenshots/workspace-light.png)

## 产品简介

Scriptor 打开一个 Markdown 文件夹，并为其增加搜索、反向链接、历史记录、预览和健康检查等能力。Markdown 始终是数据的唯一事实来源，因此每篇笔记都可以继续在其他编辑器中直接读取和使用。

Scriptor 面向需要长期维护的项目，例如书籍、论文、技术文档、研究资料库和知识库。Tauri 桌面外壳负责用户界面，Rust 服务则负责知识库访问、索引、Git、导出以及本地 IPC。

| 你的工作 | Scriptor 提供的能力 |
|---|---|
| **撰写与修订** | 源码、分栏和渲染视图；大纲导航；代码片段；可配置编辑器；笔记历史 |
| **构建证据链** | Wikilink、反向链接、引用、图谱探索、健康检查、未解析链接修复 |
| **可复现发布** | 面向 HTML、PDF、DOCX、LaTeX、ePub 和 Reveal.js 的具名 Pandoc 配置 |
| **有边界的自动化** | 感知 Git 的工作流、可审计的 MCP 工具、权限受控的插件和本地 daemon |

## 实际界面

| 使用源码与预览进行写作 | 检查结构与笔记质量 |
|---|---|
| ![编辑器与预览](docs/assets/screenshots/editor-preview.png) | ![检查器预览](docs/assets/screenshots/inspector-preview.png) |

| 探索内容之间的关联 | 修复并整理知识库 |
|---|---|
| ![知识图谱](docs/assets/screenshots/graph.png) | ![知识工作台](docs/assets/screenshots/knowledge-workbench.png) |

| 扩展工作空间 | 从具名配置发布 |
|---|---|
| ![插件市场](docs/assets/screenshots/plugins.png) | ![发布中心](docs/assets/screenshots/publish-center.png) |

[截图目录](docs/assets/screenshots/README.zh-CN.md)还包括深色模式、Git、冲突解决、命令面板、MCP、设置、知识库健康状态、笔记历史、键盘快捷键、首次引导以及紧凑布局。截图脚本会等待数据和面板完全加载；如果页面始终处于加载中或降级状态，捕获流程会直接失败。

## 功能

- **写作** — 默认使用 CodeMirror 6，并可选择 Monaco；支持分栏和预览模式、格式工具栏、片段、专注模式和快捷键编辑器
- **组织** — 虚拟化知识库树、收件箱、每日笔记、笔记类型、模板和保存的视图
- **连接** — Wikilink、反向链接、支持键盘导航的知识图谱、知识工作台和未解析链接修复
- **引用** — CSL 样式、内联 `[@key]` 引用、参考文献预览和本地参考文献文件
- **发布** — Pandoc 导出配置（HTML、PDF、DOCX、LaTeX、ePub、Reveal.js）和本地 Starlight 发布
- **自动化** — 带三方冲突解决器的 Git、22 个 MCP 工具、基于哈希链的 JSONL 变更审计、带安全模式的插件目录，以及支持 tracing 的无界面 daemon
- **可视化** — Canvas 画布（按需加载，并将 `resvg` 工作卸载给 worker）以及 Portal 快速捕获
- **运维** — 命令面板、工作空间模式、知识库健康仪表盘、终端界面和定时快照
- **拼写检查** — 多语言 Hunspell，并可选用 LanguageTool

关于已发布、实验性以及仅处于设计阶段的功能，请参阅 [`docs/CAPABILITY-MATURITY.zh-CN.md`](docs/CAPABILITY-MATURITY.zh-CN.md)。

<a id="download"></a>
## 获取 Scriptor

生产安装包通过 GitHub Release 发布。当前版本为 **1.0.8**。

- **Windows x86_64** — `.msi` 和 `.exe`（NSIS）
- **macOS Apple Silicon (aarch64)** — `.dmg`
- **Linux x86_64 和 ARM64** — `.deb` 和 `.AppImage`

> **信任状态。** 官方上游安装包有意保持为**未签名**状态。每个发行版都会提供 SHA-256 校验和、CycloneDX SBOM、发行收据、源代码身份凭据和 GitHub provenance attestation。安装前请按照 [`docs/RELEASE-SECURITY.zh-CN.md`](docs/RELEASE-SECURITY.zh-CN.md) 中的完整流程进行验证。

[下载最新版本](https://github.com/AmirrezaFarnamTaheri/Scriptor/releases)，或[从源代码构建](#build-from-source)。

<a id="tech-stack"></a>
## 技术栈

- **桌面外壳** — Tauri 2
- **渲染层** — React 19、Vite 8、TypeScript 6、Lucide React
- **核心** — Rust 1.96（2024 Edition）workspace crates（`vault`, `indexer`, `native-git`, `daemon`, `ipc`, `system-bridge`, `export-runner`, `publish-runner`, `canvas-engine`, `cli`, `embeddings`, `tantivy-indexer`, `citation-engine`, `wasm-runtime`, `capture`）
- **持久化** — 知识库核心中的 SQLite WAL + FTS5
- **IPC** — 使用 postcard framing、HMAC 认证的本地 RPC（`scriptor-ipc` → `scriptor-daemon`）
- **契约** — 通过 Rust `ts-rs` 生成的 TypeScript 类型
- **样式** — 语义化 CSS custom properties；不使用 Tailwind，也不加载远程字体
- **编辑器** — 默认使用 CodeMirror 6；Monaco 作为高级、非默认选项

<a id="build-from-source"></a>
## 从源代码构建

### 要求

- Node.js `22.16.0`（engines: `>=22.12.0`）
- pnpm `10.33.0`（由 Corepack 管理）
- Rust `1.96.0`（通过 `rustup` 安装；components: `rustfmt`, `clippy`）
- PowerShell 7（`pwsh`），用于发行、容器和基准测试脚本
- 与你的操作系统对应的 Tauri 2 平台依赖

### 首次设置

```powershell
corepack enable
corepack prepare pnpm@10.33.0 --activate
pnpm install --frozen-lockfile
rustup toolchain install 1.96.0 --profile minimal --component rustfmt --component clippy
rustup default 1.96.0
```

### 运行

```powershell
pnpm web:dev          # 仅 Web 外壳（开发和视觉测试）
pnpm desktop:dev      # Tauri 桌面外壳
```

### 验证

快速、仓库原生的检查：

```powershell
pnpm version:check
pnpm lint:actions
pnpm lint:boundaries
pnpm check:i18n
pnpm check:docs
pnpm check:source
pnpm check:frontend-quality
```

完整发行门禁：

```powershell
pnpm install --frozen-lockfile
pnpm lint
pnpm build
pnpm check:release
cargo fmt --all --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
```

`pnpm check:release` 会运行契约执行器、Rust 测试、Playwright E2E 与视觉测试、可访问性审计、daemon 与 TUI 冒烟测试以及性能门禁。打包和发行证据验证流程记录在 [`scripts/release/README.md`](scripts/release/README.md) 中。

## 架构

当前运行时拓扑、信任边界和 crate 所有权记录在 [`docs/ARCHITECTURE.zh-CN.md`](docs/ARCHITECTURE.zh-CN.md) 中。Container 与 Context 图位于 [`docs/architecture/c4-container.zh-CN.md`](docs/architecture/c4-container.zh-CN.md) 和 [`docs/architecture/c4-context.zh-CN.md`](docs/architecture/c4-context.zh-CN.md)。

| 平面 | 入口 |
|---|---|
| Desktop | `apps/desktop/src-tauri/src/lib.rs`, `src/App.tsx` |
| Vault | `crates/vault/src/lib.rs` |
| Index / search / graph | `crates/indexer/src/lib.rs` |
| Daemon IPC | `crates/daemon/src/lib.rs`, `crates/ipc/src/lib.rs` |
| Git | `crates/native-git/src/lib.rs` |
| External tools | `crates/system-bridge/src/process.rs` |
| Frontend packages | `packages/*/src/index.ts` |

## 原则

- **本地优先。** Markdown 始终是事实来源，并保持可移植性。
- **明确授权。** 破坏性操作、机密信息、网络、进程、备份和发布操作都需要限定范围的明确授权。
- **有界工作。** 扫描、图遍历、事件队列、子进程输出、日志和审计尾部都有明确限制。
- **可恢复变更。** Git commit 隔离索引；MCP 写入使用 intent/outcome 记录；恢复操作在正式替换前会验证 manifest。
- **每个边界只有一份契约。** Rust IPC 定义生成 TypeScript 契约；运行时 JSON 在使用前必须验证。
- **如实标注成熟度。** 已实现、实验性和仅设计阶段的能力分别记录在 [`docs/CAPABILITY-MATURITY.zh-CN.md`](docs/CAPABILITY-MATURITY.zh-CN.md) 中。

## 文档

| 读者 | 从这里开始 |
|---|---|
| 新用户 | [`docs/guides/GETTING_STARTED.zh-CN.md`](docs/guides/GETTING_STARTED.zh-CN.md) |
| 想了解功能 | [`docs/CAPABILITIES.zh-CN.md`](docs/CAPABILITIES.zh-CN.md) 和 [`docs/CAPABILITY-MATURITY.zh-CN.md`](docs/CAPABILITY-MATURITY.zh-CN.md) |
| 插件作者 | [`docs/plugins/AUTHOR_GUIDE.zh-CN.md`](docs/plugins/AUTHOR_GUIDE.zh-CN.md) |
| 贡献者 | [`CONTRIBUTING.zh-CN.md`](CONTRIBUTING.zh-CN.md) 和 [`AGENTS.md`](AGENTS.md) |
| 安全研究人员 | [`SECURITY.zh-CN.md`](SECURITY.zh-CN.md) 和 [`docs/ENCRYPTION-THREAT-MODEL.zh-CN.md`](docs/ENCRYPTION-THREAT-MODEL.zh-CN.md) |
| 发布负责人 | [`docs/RELEASE-CHECKLIST.zh-CN.md`](docs/RELEASE-CHECKLIST.zh-CN.md) 和 [`docs/RELEASE-SECURITY.zh-CN.md`](docs/RELEASE-SECURITY.zh-CN.md) |
| 架构师 | [`docs/ARCHITECTURE.zh-CN.md`](docs/ARCHITECTURE.zh-CN.md) 和 [`docs/architecture/`](docs/architecture/) |
| 审计人员 | [`docs/_archived/AUDIT-2026-08-23.md`](docs/_archived/AUDIT-2026-08-23.md) 和 [`docs/FINAL-REMEDIATION-REPORT.zh-CN.md`](docs/FINAL-REMEDIATION-REPORT.zh-CN.md) |

完整索引：[`docs/README.zh-CN.md`](docs/README.zh-CN.md)。

## 支持

- **Issues** — <https://github.com/AmirrezaFarnamTaheri/Scriptor/issues>
- **电子邮件** — Amirreza "Farnam" Taheri，[taherifarnam@gmail.com](mailto:taherifarnam@gmail.com)
- **安全问题** — 请遵循 [`SECURITY.zh-CN.md`](SECURITY.zh-CN.md)；不要通过公开 issue 报告漏洞

## 参与贡献

Scriptor 欢迎社区贡献。完整工作流、贡献者要求和必须通过的验证门禁见 [`CONTRIBUTING.zh-CN.md`](CONTRIBUTING.zh-CN.md)。提交 pull request 前：

1. 阅读 [`PRODUCT.zh-CN.md`](PRODUCT.zh-CN.md)、[`DESIGN.zh-CN.md`](DESIGN.zh-CN.md)、[`docs/ARCHITECTURE.zh-CN.md`](docs/ARCHITECTURE.zh-CN.md) 和 [`docs/CAPABILITY-MATURITY.zh-CN.md`](docs/CAPABILITY-MATURITY.zh-CN.md)。
2. 在可行的情况下，先添加一个在修复前会失败的行为测试。
3. 运行上方完整验证列表；每个门禁都必须在同一个精确 commit 上通过。
4. 同步更新 [`CHANGELOG.md`](CHANGELOG.md) 以及受影响的文档。

## 项目状态

**积极开发中。** `v1.0.8` 是当前生产候选版本。Desktop、vault、indexer、knowledge、Git、export、daemon 和 Web 界面均已实现并发布。[`docs/CAPABILITY-MATURITY.zh-CN.md`](docs/CAPABILITY-MATURITY.zh-CN.md) 中的能力账本是判断哪些功能受支持、处于实验阶段或仅停留在设计阶段的权威依据。移动端、加密 vault、本地 embeddings、Tantivy 和 WASM host 仍属于实验性或仅设计阶段能力。

## 许可证

Scriptor 采用 **GNU AGPL-3.0-or-later** 许可证。只要遵守该许可证义务，即可用于商业用途。不希望遵循 AGPL 要求的组织可以申请单独的商业许可证；参见 [`COMMERCIAL-LICENSING.zh-CN.md`](COMMERCIAL-LICENSING.zh-CN.md)。

## 维护者

Amirreza "Farnam" Taheri · [taherifarnam@gmail.com](mailto:taherifarnam@gmail.com) · [GitHub](https://github.com/AmirrezaFarnamTaheri/Scriptor)
