[English](SHARING_AND_SYNC.md) · [فارسی](SHARING_AND_SYNC.fa.md) · **简体中文** · [Русский](SHARING_AND_SYNC.ru.md) · [Deutsch](SHARING_AND_SYNC.de.md) · [Español](SHARING_AND_SYNC.es.md)

# 共享与同步

Scriptor 会清点本地 agent 资源，并从桌面应用在受支持的应用、IDE 与 CLI 之间同步经过验证的 skills。

## 信任模型

发现与修改是两种独立操作。仅存在配置目录绝不能证明某个应用已安装。确认至少需要一种有界身份信号：

- 一个能解析到具体路径的 executable，通过有界版本探测，并记录 SHA-256 hash；
- 已知安装应用的 binary，且有记录 hash；或
- 已安装的编辑器扩展，其精确 publisher 与 extension identifier 和包 metadata 一致。

每个发现资源都会保留 physical target、scope、canonical path、manifest path、ownership marker、validation issues 与规范化 content fingerprint。无效资源仍可见，但不能选作同步源。

## 支持级别

- **Native：**AgentStack、Claude Code、Codex，以及 vendor-neutral 的 Agent Skills 目录。
- **Compatible：**具有公开文档化 skill 目录的目标，目前包括 Visual Studio Code 与 Copilot、Windsurf、Zed、Gemini CLI、OpenCode。
- **Inventory only：**能够检测到、但缺乏足够稳定且公开写入契约的产品。Scriptor 展示证据，但不会修改其文件。

支持级别与安装状态彼此独立。受支持的目标只有在应用身份确认后才能写入，明确 vendor-neutral 的 `~/.agents/skills` 库除外。

## 计划与执行

同步与去重总是从不可变计划开始。一个计划：

- 绑定完整 inventory fingerprint；
- 包含预期 source/destination fingerprint；
- 在 `PLAN_TTL_MS` 定义的有界生命周期后过期；
- 只消费一次；
- 将多个共享同一 physical destination 的已选产品折叠为一次操作；
- 在修改前拒绝重叠 destination；并且
- 要求一份 scope 到计划 identifier 的原生一次性授权。

独立 destination 可以使用有限 worker 数并行运行。任一时刻仅有一个计划修改资源。Frontend 只接收结构化进度与 receipts，不接收原始 process stdout/stderr。

## 去重

Scriptor 区分：

- **Exact mirror：**相同内容有意安装到不同 target/scope。
- **Redundant：**相同内容在同一 target/scope 中重复。
- **Diverged：**相同逻辑身份具有不同内容。

只有 redundant exact copies 才能生成自动去重计划。副本会移入 Scriptor recovery quarantine 并通过 hash 验证，而不是永久删除。Mirror 会保留；diverged resource 需要人工 merge 决策。

## 恢复

更新会在 promotion 前先 stage 并 hash 替换内容。现有内容首先移入 recovery quarantine。如果 promotion 或写后验证失败，Scriptor 会尝试恢复旧内容并报告结构化 failure receipt。
