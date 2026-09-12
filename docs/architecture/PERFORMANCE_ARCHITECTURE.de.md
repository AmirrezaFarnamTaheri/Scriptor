# Performance-Architektur

[English](PERFORMANCE_ARCHITECTURE.md) · [简体中文](PERFORMANCE_ARCHITECTURE.zh-CN.md) · [Русский](PERFORMANCE_ARCHITECTURE.ru.md) · **Deutsch** · [Español](PERFORMANCE_ARCHITECTURE.es.md) · [فارسی](PERFORMANCE_ARCHITECTURE.fa.md)

## Performance-These

Scriptor soll sich schneller anfühlen als Markdown-Workspaces der Electron-Ära, weil teure Arbeit aus dem UI-Thread ausgelagert wird, nativer Code IO- und Prozessgrenzen besitzt und abgeleiteter Zustand mit expliziter Rebuild-Semantik gecacht wird.

## Optimierungs-Stack

| Ebene | Optimierung | Owner | Validierung |
|---|---|---|---|
| Desktop shell | Tauri 2 statt Electron. | Native Platform | Startup- und Idle-Memory-Benchmark. |
| File IO | Rust Vault Kernel mit atomaren Writes und gebündelten Watcher Events. | Vault Kernel | Save-Latency und Watcher-Burst-Tests. |
| Cache | Abgeleiteter SQLite/FTS-Cache. | Indexing And Search | Rebuild-, Warm-Search- und Migration-Tests. |
| Editor | CodeMirror Adapter, Lazy Extensions, standardmäßig kein Rich Editor. | Editor Experience | Keystroke Frame Budget. |
| Preview | Worker-basiertes Markdown Rendering und Sanitizer Boundary. | Publication | Preview-Render-Benchmark. |
| Graph | Vorberechnete Edges, fokussierte Graph Queries, Worker Layout. | Knowledge Graph | Graph-Query- und Layout-Benchmark. |
| Canvas | Native Scene Model, Spatial Index, Lazy Block Renderers, Snapshot Jobs. | Canvas Experience | Hit-Test-, Pan/Zoom- und Snapshot-Benchmarks. |
| Export | Rust Job Runner, isolierte Temp Dirs, abbrechbarer Pandoc-Prozess. | Publication | Exportdauer- und Cancellation-Tests. |
| UI lists | Virtualisierte File Trees, Search Results, Backlinks, Jobs. | Design Systems | Large-List-Interaction-Test. |
| Automation | Zunächst MCP read-only, später Write Approval. | Automation And AI | Permission-Tests und Audit Logs. |

## Performance-Budgets

| Budget | Ziel | Erster Mess-Hook |
|---|---:|---|
| Cold Shell nutzbar | 2.0s | `scripts/benchmarks/startup` |
| Warmer 5k-Notizen-Vault nutzbar | 1.5s | `scripts/benchmarks/vault-scan` |
| Normales Note-Save bis Cache-Update | 150ms | Rust Integration Test Timing |
| Warm Search Query | 100ms | `scripts/benchmarks/search` |
| Durchschnittliche Editor-Frame-Kosten | 16ms | Editor Latency Probe |
| Preview einer normalen Note | 250ms | Renderer Worker Benchmark |
| Rename Dry Run bei 5k Notes | 500ms | Graph Rename Fixture |
| Canvas Pan/Zoom Frame Cost | 16ms | Canvas Interaction Probe |
| Canvas Snapshot Start Latency | 250ms | Canvas Snapshot Job Benchmark |
| Reaktion auf Export-Cancellation | 250ms | Export-Runner Integration Test |

## UI-Performance-Regeln

- Abgeleitete Zusammenfassungen rendern, nicht rohe Full-Vault-Strukturen.
- Editor State lokal im Editor Adapter halten.
- App-Shell-State flach und serialisierbar halten.
- Stabile Zeilenhöhen für File Trees, Backlinks, Jobs und Command Results verwenden.
- Graph-, Canvas-, Export-, Plugin- und AI-Panels erst beim Öffnen laden.
- Plugin-Widgets in begrenzten Slots mit expliziten Data Contracts halten.
- CSS Containment verwenden, wo Panels unabhängig scrollen.
- Reduced Motion respektieren und Choreografie beim Seitenladen vermeiden.

## Native-Performance-Regeln

- Niemals denselben Vault-Pfad zweimal parallel scannen.
- File-Watcher-Events vor Cache-Updates bündeln.
- Content Hashes verwenden, um unveränderte Notes zu überspringen.
- Index Updates in SQLite Transactions ausführen.
- Explizite Process Args gegenüber Shell Strings bevorzugen.
- Cache Rebuild als normalen Recovery Path behandeln.
- Für lange Jobs Progress- und Cancellation-Punkte bereitstellen.

## Upgrade-Pfade

| Einschränkung | Erster Ansatz | Nur bei belegtem Bedarf upgraden |
|---|---|---|
| Search latency | SQLite FTS5 | Tantivy Index Crate. |
| Graph layout | Web Worker Layout | Rust Layout Precompute oder WebGL Renderer. |
| Canvas hit-testing | Rust Spatial Index | GPU Renderer erst nach gemessenem Interaktionsdruck. |
| Large vault scans | Rust Sequential Scan mit Batching | Rayon Parallel Scan mit IO Backpressure. |
| Git process overhead | Safe Git CLI Adapter | `git2` Wrapper. |
| Export throughput | Einzelne Pandoc Job Queue | Parallele Queue mit Ressourcenlimits je Profil. |
