# V1 Contract 治理

[English](CONTRACT_GOVERNANCE.md) · **简体中文** · [Русский](CONTRACT_GOVERNANCE.ru.md) · [Deutsch](CONTRACT_GOVERNANCE.de.md) · [Español](CONTRACT_GOVERNANCE.es.md) · [فارسی](CONTRACT_GOVERNANCE.fa.md)

Contract 是 Scriptor renderer、native modules、CLI、MCP tools、plugins 与 tests 之间的精确接口。

## V1 规则

- 每个 command 都有一个稳定 identifier、owner、permission level、typed input/output、typed error codes、audit behavior 与 mutation/rollback 声明。
- Rust implementation 与 TypeScript contract 必须在同一个 change packet 中一起变化。Native code 不得创造 contract 未定义的行为。
- v1 contract 只接受声明的 schema；unknown、renamed、obsolete field 在 boundary 被拒绝，不提供 compatibility adapter。
- 任何有意的 contract break 都意味着新的产品版本，并需要 replacement contract、behavioral tests、source-contract coverage、docs、changelog baseline update 与 release verification。

## Required review

| Contract area | Required owners |
|---|---|
| Vault, note, path, save | Core Contracts, Vault Kernel, Native Platform |
| Search, cache, graph | Core Contracts, Indexing and Search, Knowledge Graph |
| Export, preview | Core Contracts, Publication, Native Platform |
| Canvas | Core Contracts, Canvas Experience, Native Platform |
| MCP, plugin | Core Contracts, Automation and AI, affected capability owner |
