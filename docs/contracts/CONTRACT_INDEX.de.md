# Contract-Index

[English](CONTRACT_INDEX.md) · [简体中文](CONTRACT_INDEX.zh-CN.md) · [Русский](CONTRACT_INDEX.ru.md) · **Deutsch** · [Español](CONTRACT_INDEX.es.md) · [فارسی](CONTRACT_INDEX.fa.md)

## Contract-Regeln

- Contracts beschreiben Verhalten vor der Implementierung.
- Contracts sind stabil genug, dass UI, CLI, MCP und Tests sie gemeinsam verwenden.
- Jeder Command deklariert Owner, Permission, Input, Output, Errors und Rollback.
- Native Rust Implementations dürfen kein Verhalten erfinden, das im TypeScript Contract fehlt.
- Contracts können experimental sein, der Status muss explizit sein.

## Initiale Contracts

| Contract | Datei | Owner | Status |
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

## Berechtigungsmodell

| Permission | Bedeutung |
|---|---|
| `read` | Liest derived oder canonical data ohne Mutation. |
| `write-approved` | Mutiert Vault Files nur nach expliziter Nutzerfreigabe oder Trusted UI Command. |
| `system` | Mutiert Derived Cache, Jobs oder Local App State. |
| `dangerous` | Destructive oder External Command; Confirmation und Audit erforderlich. |

## Fehlermodell

Jeder Command Error enthält:

- stabilen `code`;
- menschenlesbare `message`;
- Boolean `recoverable`;
- optional `details`;
- optional `rollbackHint`.
