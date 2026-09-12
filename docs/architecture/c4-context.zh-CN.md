# C4 模型规范：Scriptor 一级系统上下文

[English](c4-context.md) · **简体中文** · [Русский](c4-context.ru.md) · [Deutsch](c4-context.de.md) · [Español](c4-context.es.md) · [فارسی](c4-context.fa.md)

**状态：** 当前实现上下文覆盖 Scriptor `1.0.0`，以及本源码树中尚未发布的加固工作。实验性和仅设计阶段的界面以 [`../CAPABILITY-MATURITY.md`](../CAPABILITY-MATURITY.md) 为准。

## 系统概览

Scriptor 是一个 local-first 的桌面 Markdown 知识与写作工作区。用户文件系统中的 Markdown 是权威数据；SQLite 索引以及生成的发布/导出产物都属于派生状态。

## 用户角色

| 角色 | 主要目标 | 已实现工作流 |
|---|---|---|
| 研究者 | 编写、整理文献笔记和草稿 | Markdown 编辑、本地参考文献/引文检查、PDF/EPUB 阅读与注释、graph/search |
| 技术写作者 | 产出结构化文档 | Editor/preview、导出 profile、Git 工作流、经审核的本地 Starlight 发布 |
| 知识工作者 | 维护可迁移的个人知识库 | Vault 索引、全文搜索、backlinks/graph、任务/Kanban、capture |

## 系统上下文

```mermaid
C4Context
    title Scriptor 系统上下文

    Person(user, "用户 / 作者", "拥有本地 vault，并显式授权高权限操作。")
    System(scriptor, "Scriptor", "Local-first Tauri 桌面工作区，同时提供 CLI/TUI、daemon 与 MCP 扩展界面。")

    System_Ext(git_remote, "Git Remote", "可选的用户配置 Git 托管服务，由原生 Git 子系统访问。")
    System_Ext(ai_provider, "AI Provider", "可选的、经用户批准的 HTTPS 文本生成端点；凭据保留在原生层。")
    System_Ext(google, "Google Calendar / Tasks APIs", "可选 OAuth2 PKCE 集成，token 存储在操作系统 keychain。")
    System_Ext(export_tools, "本地导出工具链", "由用户安装的 Pandoc/Typst/相关本地二进制文件，只在显式导出流程中使用。")

    Rel(user, scriptor, "写作、搜索、审阅并授权操作", "原生桌面 UI / CLI")
    Rel(scriptor, git_remote, "仅在显式调用时 push / pull", "system git，通过用户配置的 HTTPS/SSH")
    Rel(scriptor, ai_provider, "发送经批准的草稿请求", "原生 HTTPS")
    Rel(scriptor, google, "OAuth/connect、读取日历、修改任务", "OAuth2 PKCE + HTTPS")
    Rel(scriptor, export_tools, "执行经批准的本地导出操作", "有界 subprocess / 已记录的 broker 例外")
```

仓库包含一个只读的 Zotero Web API connector package，但它**没有组合进已发布的 desktop/CLI/daemon runtime**，因此不作为活跃外部系统关系出现在该图中。

## 信任边界

1. **本地 vault：** Markdown 与用户资产在磁盘上保持权威；派生索引与发布输出均可重建。
2. **Renderer/native 边界：** renderer 不被授予 filesystem、keychain、Git、network、process、backup 或 publish 权限。原生代码会重新验证 path、payload 和敏感 grant。
3. **Daemon 边界：** CLI/TUI 与 daemon MCP 使用带类型的 `scriptor-ipc` 本地协议，其中包含经过认证的 endpoint metadata、nonce 检查和有界 framing；它与 Tauri renderer IPC 相互独立。
4. **外部进程：** 受支持的启动操作通过 process broker 执行，除非某个范围极窄且有文档记录的 broker 例外承担了等价的限制和策略。
5. **外部网络：** Git、AI 和 Google 集成都必须显式启用，并各自采用专用认证。不存在环境式的网络 fallback。
