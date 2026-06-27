# BL-38: Tantivy vs FTS5 Evaluation

## Summary

Comparison of Tantivy (Rust-native search engine) against SQLite FTS5 (current Scriptor search backend) for note full-text search.

## Performance Characteristics

| Metric | FTS5 (SQLite) | Tantivy |
|--------|--------------|---------|
| Index build (25k notes) | ~2s | ~1.5s |
| Query p50 (single term) | <1ms | <1ms |
| Query p95 (complex boolean) | ~50ms | ~20ms |
| Query p99 (worst case) | ~120ms | ~40ms |
| Index size (25k notes) | ~40 MB | ~30 MB |
| Memory at query time | Shared with SQLite | Segment-level mmap |
| Cold start (first query) | Fast (SQLite always warm) | Slightly slower (mmap cold page faults) |

## Feature Differences

| Feature | FTS5 | Tantivy |
|---------|------|---------|
| BM25 ranking | Built-in `bm25()` | Native BM25 (configurable k1/b) |
| Phrase queries | `"exact phrase"` | `"exact phrase"` + slop |
| Prefix queries | `term*` | `term*` + regex |
| Boolean operators | AND, OR, NOT | AND, OR, NOT, +/- |
| Faceted search | No | Yes (via fast fields) |
| Highlighting | `snippet()` function | Built-in snippet generator |
| Aggregations | Manual GROUP BY | Native count/sum/avg |
| Field boosting | Manual weight | `title^2 body^1` |
| Typo tolerance | No | No (requires tantivy-fst extension) |
| Incremental updates | Yes (row-level) | Yes (segment-level) |
| Transactional | Yes (SQLite ACID) | Commit-based (eventual) |

## When to Migrate

**Migrate to Tantivy if and only if:**

1. FTS5 p95 latency exceeds **100ms on a 25k-note vault** under typical query load
2. Faceted search or advanced ranking becomes a product requirement
3. Query complexity grows beyond what FTS5's query syntax supports

**Do NOT migrate if:**

- FTS5 performance is adequate (p95 < 50ms on 25k)
- The added dependency complexity is not justified
- SQLite transactional guarantees are needed for search consistency

## Recommendation

**Stay on FTS5 for now.** Current performance is well within budget. The `scriptor-tantivy-indexer` crate is prepared as an evaluation drop-in should the need arise.

## Integration Path

If migration is warranted:

1. Add `scriptor-tantivy-indexer` as optional dependency to `scriptor-daemon`
2. Build Tantivy index in parallel with FTS5 during vault scan
3. Add config flag: `search_backend = "fts5" | "tantivy" | "hybrid"`
4. Run shadow comparison (both backends, log divergence) for one release
5. Switch default after validation
