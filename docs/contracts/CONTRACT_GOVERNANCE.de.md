# V1-Contract-Governance

[English](CONTRACT_GOVERNANCE.md) · [简体中文](CONTRACT_GOVERNANCE.zh-CN.md) · [Русский](CONTRACT_GOVERNANCE.ru.md) · **Deutsch** · [Español](CONTRACT_GOVERNANCE.es.md) · [فارسی](CONTRACT_GOVERNANCE.fa.md)

Contracts sind die exakte Schnittstelle zwischen Scriptor Renderer, Native Modules, CLI, MCP Tools, Plugins und Tests.

## V1-Regeln

- Jeder Command hat einen stabilen Identifier, Owner, Permission Level, Typed Input/Output, Typed Error Codes, Audit Behavior und Mutation/Rollback Statement.
- Rust Implementations und TypeScript Contracts ändern sich gemeinsam in einem Change Packet. Native Code darf kein Verhalten erfinden, das im Contract fehlt.
- Ein v1 Contract akzeptiert nur sein deklariertes Schema. Unknown, Renamed und Obsolete Fields werden an der Boundary abgelehnt; Compatibility Adapter werden nicht ausgeliefert.
- Jeder absichtliche Contract Break ist eine neue Produktversion und benötigt Replacement Contract, Behavioral Tests, Source-Contract Coverage, Docs, Changelog Baseline Update und Release Verification.

## Erforderliches Review

| Contract-Bereich | Required owners |
|---|---|
| Vault, note, path, save | Core Contracts, Vault Kernel, Native Platform |
| Search, cache, graph | Core Contracts, Indexing and Search, Knowledge Graph |
| Export, preview | Core Contracts, Publication, Native Platform |
| Canvas | Core Contracts, Canvas Experience, Native Platform |
| MCP, plugin | Core Contracts, Automation and AI, affected capability owner |
