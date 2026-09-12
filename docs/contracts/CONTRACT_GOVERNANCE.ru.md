# Управление контрактами V1

[English](CONTRACT_GOVERNANCE.md) · [简体中文](CONTRACT_GOVERNANCE.zh-CN.md) · **Русский** · [Deutsch](CONTRACT_GOVERNANCE.de.md) · [Español](CONTRACT_GOVERNANCE.es.md) · [فارسی](CONTRACT_GOVERNANCE.fa.md)

Контракты — точный интерфейс между renderer Scriptor, native modules, CLI, MCP tools, plugins и tests.

## Правила V1

- Каждая команда имеет один стабильный identifier, owner, permission level, typed input/output, typed error codes, audit behavior и mutation/rollback statement.
- Rust implementations и TypeScript contracts меняются вместе одним change packet. Native code не может придумывать поведение вне contract.
- Contract v1 принимает только объявленную schema. Unknown, renamed и obsolete fields отклоняются на boundary; compatibility adapters не поставляются.
- Любой намеренный contract break — новая версия продукта и требует replacement contract, behavioral tests, source-contract coverage, docs, changelog baseline update и release verification.

## Обязательный review

| Contract area | Required owners |
|---|---|
| Vault, note, path, save | Core Contracts, Vault Kernel, Native Platform |
| Search, cache, graph | Core Contracts, Indexing and Search, Knowledge Graph |
| Export, preview | Core Contracts, Publication, Native Platform |
| Canvas | Core Contracts, Canvas Experience, Native Platform |
| MCP, plugin | Core Contracts, Automation and AI, affected capability owner |
