# Performance Architecture

## Performance Thesis

Scriptor should feel faster than Electron-era Markdown workspaces because expensive work is moved out of the UI thread, native code owns IO and process boundaries, and derived state is cached with explicit rebuild semantics.

## Optimization Stack

| Layer | Optimization | Owner | Validation |
|---|---|---|---|
| Desktop shell | Tauri 2 instead of Electron. | Native Platform | Startup and idle memory benchmark. |
| File IO | Rust vault kernel with atomic writes and batched watcher events. | Vault Kernel | Save latency and watcher burst tests. |
| Cache | SQLite/FTS derived cache. | Indexing And Search | Rebuild, warm search, and migration tests. |
| Editor | CodeMirror adapter, lazy extensions, no rich editor by default. | Editor Experience | Keystroke frame budget. |
| Preview | Worker-based Markdown rendering and sanitizer boundary. | Publication | Preview render benchmark. |
| Graph | Precomputed edges, focused graph queries, worker layout. | Knowledge Graph | Graph query and layout benchmark. |
| Canvas | Native scene model, spatial index, lazy block renderers, snapshot jobs. | Canvas Experience | Hit-test, pan/zoom, and snapshot benchmarks. |
| Export | Rust job runner, isolated temp dirs, cancellable Pandoc process. | Publication | Export duration and cancellation tests. |
| UI lists | Virtualized file tree, search results, backlinks, jobs. | Design Systems | Large list interaction test. |
| Automation | MCP read-only first, write approval later. | Automation And AI | Permission tests and audit logs. |

## Performance Budgets

| Budget | Target | First Measurement Hook |
|---|---:|---|
| Cold shell usable | 2.0s | `scripts/benchmarks/startup` |
| Warm 5k-note vault usable | 1.5s | `scripts/benchmarks/vault-scan` |
| Normal note save to cache update | 150ms | Rust integration test timing |
| Warm search query | 100ms | `scripts/benchmarks/search` |
| Editor average frame cost | 16ms | editor latency probe |
| Preview normal note render | 250ms | renderer worker benchmark |
| Rename dry run on 5k notes | 500ms | graph rename fixture |
| Canvas pan/zoom frame cost | 16ms | canvas interaction probe |
| Canvas snapshot start latency | 250ms | canvas snapshot job benchmark |
| Export cancellation response | 250ms | export-runner integration test |

## UI Performance Rules

- Render derived summaries, not raw full-vault structures.
- Keep editor state local to the editor adapter.
- Keep app shell state shallow and serializable.
- Use stable row heights for file trees, backlinks, jobs, and command results.
- Defer graph, canvas, export, plugin, and AI panels until opened.
- Keep plugin widgets in bounded slots with explicit data contracts.
- Use CSS containment where panels are independently scrollable.
- Respect reduced motion and avoid page-load choreography.

## Native Performance Rules

- Never scan the same vault path twice in parallel.
- Batch file watcher events before cache updates.
- Use content hashes to skip unchanged notes.
- Run index updates in SQLite transactions.
- Prefer explicit process args over shell strings.
- Treat cache rebuild as a normal recovery path.
- Emit progress and cancellation points for long jobs.

## Upgrade Paths

| Constraint | First Approach | Upgrade Only If Evidence Shows |
|---|---|---|
| Search latency | SQLite FTS5 | Tantivy index crate. |
| Graph layout | Web worker layout | Rust layout precompute or WebGL renderer. |
| Canvas hit-testing | Rust spatial index | GPU renderer only after measured interaction pressure. |
| Large vault scans | Rust sequential scan with batching | Rayon parallel scan with IO backpressure. |
| Git process overhead | Safe Git CLI adapter | `git2` wrapper. |
| Export throughput | Single Pandoc job queue | Parallel queue with per-profile resource caps. |

