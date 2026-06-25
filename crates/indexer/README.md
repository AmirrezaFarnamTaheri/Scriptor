# `scriptor-indexer`

SQLite/FTS derived cache, link parsing, search, health reports, graph queries, and incremental rebuild.

## Shipped

- Schema migrations, content-hash incremental updates, watcher batch apply.
- FTS search, backlinks, graph summary/traversal, DQL, tag queries.
- Health diagnostics (broken links, orphans, citations, cache status).

Tauri commands: `indexer_*`. Headless parity: daemon RPC (`SearchNotes`, `Backlinks`, `GraphSummary`, …).
