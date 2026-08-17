# V1 contract governance

Contracts are the exact interface between Scriptor's renderer, native modules, CLI, MCP tools, plugins, and tests.

## V1 rules

- Every command has one stable identifier, owner, permission level, typed input/output, typed error codes, audit behavior, and mutation/rollback statement.
- Rust implementations and TypeScript contracts change together in one packet. Native code cannot invent behavior absent from the contract.
- A v1 contract accepts only its declared schema. Unknown, renamed, and obsolete fields are rejected at the boundary; no compatibility adapters are shipped.
- Any intentional contract break is a new product version and requires a replacement contract, behavioral tests, source-contract coverage, docs, changelog baseline update, and release verification.

## Required review

| Contract area | Required owners |
|---|---|
| Vault, note, path, save | Core Contracts, Vault Kernel, Native Platform |
| Search, cache, graph | Core Contracts, Indexing and Search, Knowledge Graph |
| Export, preview | Core Contracts, Publication, Native Platform |
| Canvas | Core Contracts, Canvas Experience, Native Platform |
| MCP, plugin | Core Contracts, Automation and AI, affected capability owner |
