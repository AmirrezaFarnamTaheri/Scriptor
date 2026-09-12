# Gobierno de contratos V1

[English](CONTRACT_GOVERNANCE.md) · [简体中文](CONTRACT_GOVERNANCE.zh-CN.md) · [Русский](CONTRACT_GOVERNANCE.ru.md) · [Deutsch](CONTRACT_GOVERNANCE.de.md) · **Español** · [فارسی](CONTRACT_GOVERNANCE.fa.md)

Los contracts son la interfaz exacta entre el renderer de Scriptor, native modules, CLI, MCP tools, plugins y tests.

## Reglas V1

- Cada command tiene un identifier estable, owner, permission level, typed input/output, typed error codes, audit behavior y mutation/rollback statement.
- Rust implementations y TypeScript contracts cambian juntos en un mismo change packet. Native code no puede inventar comportamiento ausente del contract.
- Un v1 contract solo acepta el schema declarado. Unknown, renamed y obsolete fields se rechazan en el boundary; no se distribuyen compatibility adapters.
- Cualquier contract break intencionado es una nueva versión de producto y requiere replacement contract, behavioral tests, source-contract coverage, docs, changelog baseline update y release verification.

## Review obligatorio

| Contract area | Required owners |
|---|---|
| Vault, note, path, save | Core Contracts, Vault Kernel, Native Platform |
| Search, cache, graph | Core Contracts, Indexing and Search, Knowledge Graph |
| Export, preview | Core Contracts, Publication, Native Platform |
| Canvas | Core Contracts, Canvas Experience, Native Platform |
| MCP, plugin | Core Contracts, Automation and AI, affected capability owner |
