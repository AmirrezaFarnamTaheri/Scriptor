# Индекс контрактов

[English](CONTRACT_INDEX.md) · [简体中文](CONTRACT_INDEX.zh-CN.md) · **Русский** · [Deutsch](CONTRACT_INDEX.de.md) · [Español](CONTRACT_INDEX.es.md) · [فارسی](CONTRACT_INDEX.fa.md)

## Правила контрактов

- Контракты описывают поведение до реализации.
- Контракты достаточно стабильны для совместного использования UI, CLI, MCP и тестами.
- Каждая команда объявляет owner, permission, input, output, errors и rollback.
- Native Rust implementation не может придумывать поведение, отсутствующее в TypeScript contract.
- Contract может быть experimental, но статус должен быть явным.

## Начальные контракты

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

## Модель разрешений

| Permission | Значение |
|---|---|
| `read` | Читает производные или canonical data без mutation. |
| `write-approved` | Изменяет vault files только после явного approval пользователя или trusted UI command. |
| `system` | Изменяет derived cache, jobs или local app state. |
| `dangerous` | Destructive/external command; требует confirmation и audit. |

## Модель ошибок

Каждая command error содержит:

- стабильный `code`;
- читаемый `message`;
- boolean `recoverable`;
- optional `details`;
- optional `rollbackHint`.
