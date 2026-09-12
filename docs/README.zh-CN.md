# Scriptor 文档

[English](README.md) · [فارسی](README.fa.md) · **简体中文** · [Русский](README.ru.md) · [Deutsch](README.de.md) · [Español](README.es.md)

> 英文文档是规范来源。本译文旨在提供流畅、清晰的本地化阅读体验；代码、命令、路径、API 名称和契约标识保持原样。

## 当前状态的权威文档

| 文档 | 用途 |
|---|---|
| [`../README.zh-CN.md`](../README.zh-CN.md) | 概览、安装、验证和发布状态 |
| [`ARCHITECTURE.zh-CN.md`](ARCHITECTURE.zh-CN.md) | 运行时拓扑、所有权、信任与故障边界 |
| [`CAPABILITY-MATURITY.zh-CN.md`](CAPABILITY-MATURITY.zh-CN.md) | 已发布、实验性、评估中和仅设计功能的状态 |
| [`../PRODUCT.zh-CN.md`](../PRODUCT.zh-CN.md) | 用户目标、产品承诺和明确排除项 |
| [`../DESIGN.zh-CN.md`](../DESIGN.zh-CN.md) | UI 系统、响应式设计和可访问性 |
| [`../SECURITY.zh-CN.md`](../SECURITY.zh-CN.md) | 安全边界和漏洞报告政策 |
| [`RELEASE-SECURITY.zh-CN.md`](RELEASE-SECURITY.zh-CN.md) | 签名、SBOM、provenance 和用户验证 |
| [`ENCRYPTION-THREAT-MODEL.zh-CN.md`](ENCRYPTION-THREAT-MODEL.zh-CN.md) | 实验性加密能力的决策门槛 |
| [`OPERATIONS.zh-CN.md`](OPERATIONS.zh-CN.md) | tracing、关联、健康状态与事件处理 |
| [`FINAL-REMEDIATION-REPORT.zh-CN.md`](FINAL-REMEDIATION-REPORT.zh-CN.md) | 当前 v1 产品、schema 与发布基线 |
| [`VERIFICATION.zh-CN.md`](VERIFICATION.zh-CN.md) | 已执行、静态、待执行、发布与历史证据门禁 |
| [`RELEASE-CHECKLIST.zh-CN.md`](RELEASE-CHECKLIST.zh-CN.md) | 生产发布 go/no-go 清单 |

## 用户与贡献者指南

- [`guides/GETTING_STARTED.zh-CN.md`](guides/GETTING_STARTED.zh-CN.md)
- [`CAPABILITIES.zh-CN.md`](CAPABILITIES.zh-CN.md)
- [`../CONTRIBUTING.zh-CN.md`](../CONTRIBUTING.zh-CN.md)
- [`plugins/AUTHOR_GUIDE.zh-CN.md`](plugins/AUTHOR_GUIDE.zh-CN.md)
- [`contracts/COMMAND_CATALOG.zh-CN.md`](contracts/COMMAND_CATALOG.zh-CN.md)
- [`contracts/CONTRACT_INDEX.zh-CN.md`](contracts/CONTRACT_INDEX.zh-CN.md)
- [`contracts/CONTRACT_GOVERNANCE.zh-CN.md`](contracts/CONTRACT_GOVERNANCE.zh-CN.md)

## 设计与验证

- [`design/DESIGN_SYSTEM.zh-CN.md`](design/DESIGN_SYSTEM.zh-CN.md)
- [`design/LAYOUT_BLUEPRINTS.zh-CN.md`](design/LAYOUT_BLUEPRINTS.zh-CN.md)
- [`validation/ACCESSIBILITY_AUDIT.zh-CN.md`](validation/ACCESSIBILITY_AUDIT.zh-CN.md)
- [`validation/FRONTEND_QUALITY.zh-CN.md`](validation/FRONTEND_QUALITY.zh-CN.md)
- [`assets/screenshots/README.zh-CN.md`](assets/screenshots/README.zh-CN.md)

## 架构记录

| 文件 | 范围 |
|---|---|
| [`ARCHITECTURE.zh-CN.md`](ARCHITECTURE.zh-CN.md) | 运行时拓扑、所有权、信任与故障边界 |
| [`architecture/c4-container.zh-CN.md`](architecture/c4-container.zh-CN.md) | Container 级运行时图（Mermaid） |
| [`architecture/c4-context.zh-CN.md`](architecture/c4-context.zh-CN.md) | Context 图（Mermaid） |
| [`architecture/IPC_DAEMON.zh-CN.md`](architecture/IPC_DAEMON.zh-CN.md) | Daemon RPC 接口、不变量和验证 |
| [`architecture/PLUGIN_SYSTEM.zh-CN.md`](architecture/PLUGIN_SYSTEM.zh-CN.md) | Plugin manifest、安全模式、市场和开发 |
| [`architecture/PERFORMANCE_ARCHITECTURE.zh-CN.md`](architecture/PERFORMANCE_ARCHITECTURE.zh-CN.md) | 优化层、责任归属与性能预算 |
| [`architecture/TUI_PARITY.zh-CN.md`](architecture/TUI_PARITY.zh-CN.md) | TTY TUI 与桌面界面的功能对等模型 |

这些文档中的所有能力声明都必须与 [`CAPABILITY-MATURITY.zh-CN.md`](CAPABILITY-MATURITY.zh-CN.md) 一致。设计文档本身不能证明某项能力已经发布。

## 归档资料

v1 之前的研究资料和已被取代的设计评估保存在 [`_archived/`](_archived/) 中，仅用于历史参考，不属于当前本地化和产品契约范围。

## 发布参考

- [`release/SIGNING.zh-CN.md`](release/SIGNING.zh-CN.md)
- [`release/PANDOC_STRATEGY.zh-CN.md`](release/PANDOC_STRATEGY.zh-CN.md)
