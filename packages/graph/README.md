# `@scriptor/graph`

TypeScript contracts for graph queries and backlinks live in `@scriptor/core`.

**Implementation:** `crates/indexer` (link parsing, FTS, backlinks, graph traversal, rename integrity).

Use `indexer_*` Tauri commands or headless `daemon_*` RPC when the headless engine is enabled.
