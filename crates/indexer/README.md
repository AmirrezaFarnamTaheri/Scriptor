# `scriptor-indexer`

SQLite/FTS derived cache, link parsing, search, health reports, graph queries, and incremental rebuild.

## Shipped

- Schema migrations, content-hash incremental updates, watcher batch apply.
- FTS search, backlinks, graph summary/traversal, DQL, tag queries.
- Health diagnostics (broken links, orphans, citations, cache status).

Tauri commands: `indexer_*`. Headless parity: daemon RPC (`SearchNotes`, `Backlinks`, `GraphSummary`, …).

## Canvas relations

Explicit connector endpoints are derived from board JSON into `canvas_relations`, separate from authored Markdown `links`. Graph queries include both through `knowledge_links`; edge kinds use `canvas:<label>` and edge identities include the board and relation. DQL `canvas:Research/question.md` lists target notes with board/connector/label provenance. Target paths resolve against the current note cache, so removed notes become unresolved graph endpoints and re-created notes resolve without changing board content.

`sync_canvas_relations` replaces a vault's derived Canvas rows atomically and returns accepted board/relation and skipped-file counts. Full rebuild includes it in the existing rebuild transaction. Scans accept at most 1,000 boards, 4 MiB per board, 32 MiB total, and 20,000 relations (5,000 per board). Capacity errors retain the previous cache; malformed/foreign-vault boards are skipped and reported. Deleted boards contribute no rows on the next sync or rebuild. Symlinks are excluded and the board directory must remain confined to the vault.
