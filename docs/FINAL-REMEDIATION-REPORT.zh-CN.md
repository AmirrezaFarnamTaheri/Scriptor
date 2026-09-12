# V1 产品基线

**产品版本：** 由 [`VERSION`](../VERSION) 跟踪  
**契约：** 当前只存在一套源代码、API 和持久化状态 schema。

## 产品边界

Scriptor v1 为每一类持久化职责定义唯一的权威所有者：

- vault 负责内容、capability 决策、audit record 和恢复数据；
- native adapter 会对每个 filesystem、process、IPC 以及 capability-sensitive 操作执行验证和授权；
- renderer 只负责 presentation state、request 生命周期以及缓存的 read model；
- package contract 精确定义 renderer、desktop、daemon、CLI、MCP 和 plugin 接口。

持久化的 browser 数据必须使用当前、经过验证的 envelope。无效或过时值会被 quarantine，绝不会被解释为实时状态。Plugin state 存储在 vault 中。Canvas 存储使用 canonical identifier，并拒绝 noncanonical 文件。

## V1 发布要求

只有当精确的 source head 通过 [`VERIFICATION.zh-CN.md`](VERIFICATION.zh-CN.md) 中适用的 locked dependency、Rust、browser、accessibility、desktop、artifact 和 recovery 检查后，release 才具备发布资格。Release artifact 必须由不可变的 `v1.0.0` tag 构建，并按照 [`RELEASE-SECURITY.zh-CN.md`](RELEASE-SECURITY.zh-CN.md) 绑定 checksum、SBOM、receipt 和 GitHub attestation。

实验性能力在满足 [`CAPABILITY-MATURITY.zh-CN.md`](CAPABILITY-MATURITY.zh-CN.md) 的 graduation 要求之前，不得包含在“受支持产品能力”的声明中。

## 仓库卫生

发布树只保留当前产品与运维文档。已被取代的计划、review packet、forensic snapshot 和历史 changelog 条目被有意排除在 v1 契约之外。
