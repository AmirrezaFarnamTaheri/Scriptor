# Arquitectura de rendimiento

[English](PERFORMANCE_ARCHITECTURE.md) · [简体中文](PERFORMANCE_ARCHITECTURE.zh-CN.md) · [Русский](PERFORMANCE_ARCHITECTURE.ru.md) · [Deutsch](PERFORMANCE_ARCHITECTURE.de.md) · **Español** · [فارسی](PERFORMANCE_ARCHITECTURE.fa.md)

## Tesis de rendimiento

Scriptor debe sentirse más rápido que los espacios Markdown de la era Electron porque el trabajo costoso sale del hilo de UI, el código nativo controla las fronteras de IO y procesos, y el estado derivado se cachea con semántica explícita de rebuild.

## Pila de optimización

| Capa | Optimización | Owner | Validación |
|---|---|---|---|
| Desktop shell | Tauri 2 en lugar de Electron. | Native Platform | Benchmark de startup y memoria idle. |
| File IO | Rust vault kernel con escrituras atómicas y eventos watcher agrupados. | Vault Kernel | Tests de latencia de guardado y ráfagas del watcher. |
| Cache | Cache derivada SQLite/FTS. | Indexing And Search | Tests de rebuild, warm search y migration. |
| Editor | Adaptador CodeMirror, extensiones lazy, sin rich editor por defecto. | Editor Experience | Presupuesto de frame por pulsación. |
| Preview | Renderizado Markdown basado en worker y frontera de sanitizer. | Publication | Benchmark de preview render. |
| Graph | Edges precalculados, focused graph queries, worker layout. | Knowledge Graph | Benchmark de graph query y layout. |
| Canvas | Native scene model, spatial index, lazy block renderers, snapshot jobs. | Canvas Experience | Benchmarks de hit-test, pan/zoom y snapshot. |
| Export | Rust job runner, temp dirs aislados, proceso Pandoc cancelable. | Publication | Tests de duración y cancelación del export. |
| UI lists | File tree, search results, backlinks y jobs virtualizados. | Design Systems | Test de interacción con listas grandes. |
| Automation | MCP read-only primero, write approval después. | Automation And AI | Permission tests y audit logs. |

## Presupuestos de rendimiento

| Presupuesto | Objetivo | Primer hook de medición |
|---|---:|---|
| Cold shell utilizable | 2.0s | `scripts/benchmarks/startup` |
| Vault warm de 5k notas utilizable | 1.5s | `scripts/benchmarks/vault-scan` |
| Guardado normal hasta update de cache | 150ms | Timing de Rust integration test |
| Warm search query | 100ms | `scripts/benchmarks/search` |
| Coste medio de frame del editor | 16ms | editor latency probe |
| Render de preview de una nota normal | 250ms | renderer worker benchmark |
| Rename dry run en 5k notas | 500ms | graph rename fixture |
| Coste de frame de Canvas pan/zoom | 16ms | canvas interaction probe |
| Latencia de inicio de Canvas snapshot | 250ms | canvas snapshot job benchmark |
| Respuesta de cancelación de export | 250ms | export-runner integration test |

## Reglas de rendimiento de UI

- Renderizar resúmenes derivados, no estructuras crudas del vault completo.
- Mantener el editor state local al editor adapter.
- Mantener el estado de la app shell poco profundo y serializable.
- Usar alturas de fila estables para file trees, backlinks, jobs y command results.
- Posponer graph, canvas, export, plugin y paneles AI hasta que se abran.
- Mantener plugin widgets en slots acotados con data contracts explícitos.
- Usar CSS containment donde los paneles tengan scroll independiente.
- Respetar reduced motion y evitar coreografías al cargar páginas.

## Reglas de rendimiento nativo

- No escanear nunca el mismo vault path dos veces en paralelo.
- Agrupar file watcher events antes de cache updates.
- Usar content hashes para omitir notas sin cambios.
- Ejecutar index updates dentro de transacciones SQLite.
- Preferir process args explícitos a strings de shell.
- Tratar cache rebuild como una ruta normal de recovery.
- Emitir progreso y puntos de cancelación en jobs largos.

## Rutas de ampliación

| Restricción | Primer enfoque | Ampliar solo si la evidencia lo demuestra |
|---|---|---|
| Search latency | SQLite FTS5 | Tantivy index crate. |
| Graph layout | Web worker layout | Rust layout precompute o WebGL renderer. |
| Canvas hit-testing | Rust spatial index | GPU renderer solo tras medir presión de interacción. |
| Large vault scans | Rust sequential scan con batching | Rayon parallel scan con IO backpressure. |
| Git process overhead | Safe Git CLI adapter | Wrapper `git2`. |
| Export throughput | Una cola de jobs Pandoc | Cola paralela con resource caps por perfil. |
