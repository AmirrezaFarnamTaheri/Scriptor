# Índice de contratos

[English](CONTRACT_INDEX.md) · [简体中文](CONTRACT_INDEX.zh-CN.md) · [Русский](CONTRACT_INDEX.ru.md) · [Deutsch](CONTRACT_INDEX.de.md) · **Español** · [فارسی](CONTRACT_INDEX.fa.md)

## Reglas de contratos

- Los contratos describen comportamiento antes de la implementación.
- Son suficientemente estables para compartir entre UI, CLI, MCP y tests.
- Cada command declara owner, permission, input, output, errors y rollback.
- Las implementaciones Native Rust no pueden inventar comportamiento ausente del TypeScript contract.
- Los contracts pueden ser experimental, pero debe indicarse explícitamente.

## Contratos iniciales

| Contract | Archivo | Owner | Estado |
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

## Modelo de permisos

| Permission | Significado |
|---|---|
| `read` | Lee datos derivados o canónicos sin mutación. |
| `write-approved` | Modifica vault files solo tras aprobación explícita del usuario o trusted UI command. |
| `system` | Modifica derived cache, jobs o local app state. |
| `dangerous` | Command destructivo o externo; exige confirmation y audit. |

## Modelo de errores

Cada command error debe incluir:

- `code` estable;
- `message` legible;
- boolean `recoverable`;
- `details` opcional;
- `rollbackHint` opcional.
