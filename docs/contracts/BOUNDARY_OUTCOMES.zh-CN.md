[English](BOUNDARY_OUTCOMES.md) · [فارسی](BOUNDARY_OUTCOMES.fa.md) · **简体中文** · [Русский](BOUNDARY_OUTCOMES.ru.md) · [Deutsch](BOUNDARY_OUTCOMES.de.md) · [Español](BOUNDARY_OUTCOMES.es.md)

# 边界结果契约

Scriptor 的边界适配器统一使用六状态结果代数，避免把“可选值缺失、持久化状态损坏、部分结果、执行失败、成功恢复”全部折叠成相同的空值/default 返回。

| 状态 | 契约 | 允许 default？ |
| --- | --- | --- |
| `value` | 权威操作结果。 | 不适用。 |
| `absent-optional` | 可选状态确实不存在。调用方可以映射为明确记录的 default 或空值。 | **可以，仅此状态。** |
| `invalid` | 输入、配置、序列化状态或持久化数据格式错误。返回有类型的 code 与 message。 | 不允许。 |
| `degraded` | 有可用的部分状态，但 warnings 标识缺失/不可用部分。 | 不允许静默 default；warning 与值一起返回。 |
| `failed` | 操作失败。返回 code、message 以及 retry/recovery 是否合理。 | 不允许。 |
| `recovered` | 操作经明确 recovery 路径成功。保留 recovery receipt。 | 不允许静默抹除 recovery 事件。 |

`contracts/operations.json` 为每个收录的 Tauri command、daemon RPC、MCP tool 和 CLI command 指定允许状态。生成的 TypeScript/Rust metadata 与 parity checks 会使新增边界在声明语义之前保持 fail-closed。

## 适配器规则

1. 在权威边界禁止使用 `unwrap_or_default`、`.ok()`、`filter_map(Result::ok)` 或同类写法，除非源 contract 明确表示 `absent-optional`。
2. 无效的 vault 配置是 `invalid`，不是 absence。
3. 数据库 row decode 错误是带 warnings 的 `failed` 或 `degraded`，绝不能静默忽略。
4. Process/IPC failures 使用结构化 code 和 recoverability，而非无类型字符串。
5. atomic-write/journal repair 后的 recovery 是 `recovered`；当边界公开 receipt 时应输出或保留它。
