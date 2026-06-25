# Contract Index

## Contract Rules

- Contracts describe behavior before implementation.
- Contracts are stable enough for UI, CLI, MCP, and tests to share.
- Every command declares owner, permission, input, output, errors, and rollback.
- Native Rust implementations must not invent behavior outside the TypeScript contract.
- Contracts can be experimental, but experimental status must be explicit.

## Initial Contracts

| Contract | File | Owner | Status |
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

## Permission Model

| Permission | Meaning |
|---|---|
| `read` | Reads derived or canonical data without mutation. |
| `write-approved` | Mutates vault files only after explicit user approval or trusted UI command. |
| `system` | Mutates derived cache, jobs, or local app state. |
| `dangerous` | Destructive or external command. Requires confirmation and audit. |

## Error Model

Every command error must include:

- Stable `code`.
- Human-readable `message`.
- `recoverable` boolean.
- Optional `details`.
- Optional `rollbackHint`.
