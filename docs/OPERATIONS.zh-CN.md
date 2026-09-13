<div dir="ltr" align="center">
[English](OPERATIONS.md) · [فارسی](OPERATIONS.fa.md) · **简体中文** · [Русский](OPERATIONS.ru.md) · [Deutsch](OPERATIONS.de.md) · [Español](OPERATIONS.es.md)
</div>

# 运维与诊断

## 结构化 tracing

Desktop、daemon 和 CLI 通过 `crates/system-bridge/src/observability.rs` 初始化结构化 JSON tracing。名称涉及 secret/token/password/key 的字段会被脱敏。日志文件按大小轮转，并只保留有限数量的 segment。

## 关联

长时间运行或跨边界的操作应当携带同一个 operation/request ID，并贯穿 renderer command、Tauri/daemon adapter、外部进程 receipt 和 audit event。故障报告应当能够仅凭该 ID 进行诊断，而不需要阅读源代码。

## 健康信号

- watcher generation 与 rescan-required 状态；
- index generation/新鲜度；
- daemon subscriber 丢弃；
- process timeout/cancel/truncation 结果；
- 待处理的 MCP intent；
- backup 验证与 restore journal；
- log rotation/repair 状态。

## 事件信息收集

只能使用已经脱敏的诊断数据。绝不要附带真实 vault、keychain 值、完整 request body 或未经审查的 audit log。应保留 source commit、应用版本、OS/arch、复现步骤、operation ID，以及最小且相关的有界日志片段。

## 支持包

Settings → Diagnostics → **Export redacted support bundle** 会在 `.scriptor/diagnostics/` 下写入一个有界 JSON 支持文件。它包含应用/系统身份、聚合的 vault 健康计数，以及最多 100 条已经脱敏的 client diagnostic event。vault 根目录、笔记路径、笔记内容、request body 和凭据会被刻意排除。client diagnostic journal 在 2 MiB 时轮转，并会在持久化前限制 message/detail 大小。
