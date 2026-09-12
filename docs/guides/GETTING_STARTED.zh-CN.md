# Scriptor 入门

[English](GETTING_STARTED.md) · [فارسی](GETTING_STARTED.fa.md) · **简体中文** · [Русский](GETTING_STARTED.ru.md) · [Deutsch](GETTING_STARTED.de.md) · [Español](GETTING_STARTED.es.md)

Scriptor 是一个 local-first 的 Markdown 知识工作区。本指南介绍安装、打开第一个 vault，以及日常最常用的核心工作流。

如需**从源码构建**，请参阅 [`README.zh-CN.md`](../../README.zh-CN.md) 中的 **Build from source** 部分。

## 安装

从 [GitHub Releases](https://github.com/AmirrezaFarnamTaheri/Scriptor/releases) 下载适用于您平台的最新版本：

| 平台 | 格式 |
|---|---|
| Windows | MSI 或 NSIS 安装程序 |
| macOS | DMG |
| Linux | DEB 或 AppImage |

Production 安装程序有意保持未签名状态。完整验证流程请参阅 [`docs/RELEASE-SECURITY.zh-CN.md`](../RELEASE-SECURITY.zh-CN.md)。

## 打开 vault

1. 启动 **Scriptor**。
2. 选择 **Open Vault**，然后选择任意包含 Markdown 笔记的文件夹。
3. Scriptor 会在后台为 vault 建立索引，不需要专有数据库。

文件在磁盘上仍然是普通 Markdown。Scriptor 会直接读写这些文件。

### Vault 配置

Vault 设置位于 `.scriptor/config.json`。Snippet、导出 profile 和 plugin manifest 同样位于 `.scriptor/` 下。

## 工作区

| 区域 | 用途 |
|---|---|
| **Vault 侧边栏** | 浏览、搜索和筛选笔记；创建每日笔记和模板 |
| **编辑器** | 使用 Monaco 或 CodeMirror，以 Source、Split 或 Preview 模式写作 |
| **Inspector rail** | 大纲、链接、backlink、引用、笔记健康状态和导出 profile |
| **Status dock** | 输出日志、搜索结果、诊断信息和后台 job |

使用顶部栏的 workspace 模式 — **Writing**、**Knowledge**、**Publish**、**Review**、**Automation** — 让 toolbar 和 command palette 聚焦当前任务。

## 核心工作流

| 任务 | Desktop | Terminal (`scriptor tui`) |
|---|---|---|
| 浏览笔记 | Vault 侧边栏 | `j` / `k` |
| 搜索 | 侧边栏搜索或 `Ctrl+K` | `/` 后输入查询 |
| Command palette | `Ctrl+K` 或顶部搜索 | — |
| Preview | 编辑器 **Split** 或 **Preview** 模式 | `p` |
| Backlinks | Inspector rail | `b` |
| Graph | **Graph** toolbar 按钮（键盘：方向键、Enter、Escape） | `g` |
| Vault 健康 | Inspector **Note Health** 或 Settings | `h` |
| 导出 | Inspector 导出 profile 或 **Publish** | `scriptor export` |
| Git 状态 | 顶部栏 Git 指示器 | — |
| 冲突解决 | 带 base 列的三方冲突 UI | — |
| 快捷键 | Settings → Keyboard Shortcuts | — |
| 定时备份 | Settings → Vault Snapshots | — |

## 配置导出

Scriptor 通过 [Pandoc](https://pandoc.org/) 导出。要实际导出 HTML、PDF、DOCX、LaTeX、ePub 和 Reveal.js，请在系统上安装 Pandoc：

```powershell
# Windows
winget install --id JohnMacFarlane.Pandoc

# macOS
brew install pandoc
```

Dry-run 导出预览无需 Pandoc。发现方式、override 与故障排除参阅 [`docs/release/PANDOC_STRATEGY.zh-CN.md`](../release/PANDOC_STRATEGY.zh-CN.md)。

## 可选：Headless engine

启用 **Settings → Headless engine** 后，索引、搜索、backlink、graph、Git 状态与导出 job 会通过本地 daemon 执行。打开 vault 与 canvas 保持 in-process，以保证响应速度。参阅 [`docs/architecture/IPC_DAEMON.zh-CN.md`](../architecture/IPC_DAEMON.zh-CN.md)。

## 延伸阅读

- [`docs/CAPABILITIES.zh-CN.md`](../CAPABILITIES.zh-CN.md) — 完整功能地图
- [`docs/contracts/COMMAND_CATALOG.zh-CN.md`](../contracts/COMMAND_CATALOG.zh-CN.md) — Tauri、daemon 与 CLI 命令
- [`docs/architecture/PLUGIN_SYSTEM.zh-CN.md`](../architecture/PLUGIN_SYSTEM.zh-CN.md) — plugin 与 marketplace
- [`docs/plugins/AUTHOR_GUIDE.zh-CN.md`](../plugins/AUTHOR_GUIDE.zh-CN.md) — plugin 作者指南与 hello-world 教程
- [`DESIGN.zh-CN.md`](../../DESIGN.zh-CN.md) — 编辑器界面、设计系统与可访问性合同
- [`docs/design/DESIGN_SYSTEM.zh-CN.md`](../design/DESIGN_SYSTEM.zh-CN.md) — 视觉系统 token
- [`docs/brand/BRAND.md`](../brand/BRAND.md) — logo 与 wordmark
- [`docs/assets/screenshots/README.zh-CN.md`](../assets/screenshots/README.zh-CN.md) — 重新生成 UI screenshot
