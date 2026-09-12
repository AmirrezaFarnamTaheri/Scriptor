# Contract 索引

[English](CONTRACT_INDEX.md) · **简体中文** · [Русский](CONTRACT_INDEX.ru.md) · [Deutsch](CONTRACT_INDEX.de.md) · [Español](CONTRACT_INDEX.es.md) · [فارسی](CONTRACT_INDEX.fa.md)

## Contract 规则

- Contract 在实现前描述行为。
- Contract 必须稳定到足以被 UI、CLI、MCP 和 tests 共同使用。
- 每个 command 声明 owner、permission、input、output、errors 和 rollback。
- Native Rust 实现不得创造 TypeScript contract 之外的行为。
- Contract 可以是 experimental，但必须明确标记。

## 初始 Contracts

| Contract | 文件 | Owner | 状态 |
|---|---|---|---|
| Command envelope | `packages/core/src/contracts/command.ts` | Core Contracts | Shipped |
| Canvas | `packages/core/src/contracts/canvas.ts` | Canvas Experience, Core Contracts | Shipped |
| Vault | `packages/core/src/contracts/vault.ts` | Vault Kernel | Shipped |
| Notes | `packages/core/src/contracts/note.ts` | Vault Kernel, Editor Experience | Shipped |
| Graph | `packages/core/src/contracts/graph.ts` | Knowledge Graph | Shipped |
| Export | `packages/core/src/contracts/export.ts` | Publication | Shipped |
| Jobs | `packages/core/src/contracts/job.ts` | Native Platform | Shipped |
| MCP | `packages/core/src/contracts/mcp.ts` | Automation And AI | Shipped |
| Plugin | `packages/core/src/contracts/plugin.ts` | Core Contracts, Automation And AI | Shipped |

## Permission 模型

| Permission | 含义 |
|---|---|
| `read` | 读取派生或 canonical data，不执行 mutation。 |
| `write-approved` | 只有显式用户批准或 trusted UI command 后才能修改 vault files。 |
| `system` | 修改派生 cache、jobs 或本地 app state。 |
| `dangerous` | destructive 或 external command，需要 confirmation 和 audit。 |

## Error 模型

每个 command error 必须包含：

- 稳定的 `code`；
- 人类可读的 `message`；
- `recoverable` boolean；
- 可选 `details`；
- 可选 `rollbackHint`。
