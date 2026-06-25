# Contract Governance

Contracts are the durable interface between Scriptor's renderer, native modules, CLI, MCP tools, plugins, and tests.

## Contract lifecycle

| Status | Meaning |
|---|---|
| Shipped | Implemented in Rust + TypeScript; used by desktop, CLI, and validation runners. |
| Experimental | Usable behind a feature flag or first-party plugin. |
| Deprecated | Replacement exists; remove at next major version. |

Core contracts in `packages/core/src/contracts/` are **Shipped** as of v0.1.

## Required fields for commands

- Stable command id.
- Owner and permission level.
- Typed input and typed output.
- Error codes with recoverability.
- Audit behavior for MCP, AI, or plugin callers.
- Rollback strategy or explicit no-mutation note.
- Fixture examples.

## Compatibility rules

- Additive optional fields are allowed on minor releases.
- Removing or renaming fields requires a migration note in `COMMAND_CATALOG.md`.
- Native Rust implementations cannot invent behavior absent from the TypeScript contract.

## Review Gates

| Contract Area | Required Owners |
|---|---|
| Vault, note, path, save | Core Contracts, Vault Kernel, Native Platform. |
| Search/cache/graph | Core Contracts, Indexing And Search, Knowledge Graph. |
| Export/preview | Core Contracts, Publication, Native Platform. |
| Canvas | Core Contracts, Canvas Experience, Native Platform. |
| MCP/plugin | Core Contracts, Automation And AI, affected capability owner. |