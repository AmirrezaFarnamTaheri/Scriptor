# Arquitectura actual

[English](ARCHITECTURE.md) · [简体中文](ARCHITECTURE.zh-CN.md) · [Русский](ARCHITECTURE.ru.md) · [Deutsch](ARCHITECTURE.de.md) · **Español** · [فارسی](ARCHITECTURE.fa.md)

**Estado:** mapa de la implementación actual. La versión canónica del producto está en [`VERSION`](../VERSION); las propuestas solo de diseño viven en documentos separados y están marcadas en [`CAPABILITY-MATURITY.md`](CAPABILITY-MATURITY.md).

## Topología de runtime

```text
React renderer
  -> typed bridge commands
  -> Tauri command adapters
  -> authorization broker
  -> application/kernel crates
       vault | indexer | native-git | export-runner | canvas-engine
  -> filesystem / SQLite / Git / keychain / approved external tools

CLI/TUI and MCP
  -> daemon IPC (scriptor-ipc envelopes)
  -> daemon handlers and shared kernel crates
```

El renderer no es una frontera de autoridad. Las operaciones nativas validan scope, authorization, runtime payloads, paths, process policy y cancellation de forma independiente al estado de la UI.

## Planos y propiedad

| Plano | Owner | Responsabilidades |
|---|---|---|
| Product shell | `src/App.tsx`, `src/components/shell/`, `src/components/app/QuickCaptureWorkspaceLayer.tsx`, `src/components/app/WorkspaceRenameDialogs.tsx`, `src/hooks/` | composición del workspace, workflows de capture/rename y presentation state |
| Runtime validation | `src/lib/runtimeSchema.ts`, `src/types/vaultValidators.ts` | parsear payloads no confiables de bridge/storage |
| Native adapter | `apps/desktop/src-tauri/src/commands/` | solo mapping Tauri argument/result |
| Authorization | `apps/desktop/src-tauri/src/authorization.rs` | grants operation/scope de un solo uso y confirmación nativa |
| Vault | `crates/vault/` | safe paths, notes, config, scans, watcher events, audit records |
| Index | `crates/indexer/` | SQLite current schema, FTS, backlinks, graph y knowledge queries |
| Git | `crates/native-git/` | operaciones noninteractive status/diff/commit/conflict |
| External tools | `crates/system-bridge/src/process.rs` | executable policy, sanitized env, sandbox, bounds, cancellation, receipts |
| Daemon transport | `crates/daemon/`, `crates/ipc/` | authenticated local RPC, frame bounds, resynchronizing event delivery, jobs, MCP bridge; el command catalog tiene ownership separado del dispatch |
| Desktop git serialization | `crates/native-git/src/queue.rs`, `apps/desktop/src-tauri/src/state.rs` | las cinco mutaciones Git nativas pasan por bounded per-repo GitQueue worker con 64-slot backpressure; el handle se reinicia en vault swap; los comandos read-only whole-vault se despachan fuera del daemon state mutex mediante session-clone seam |
| Observability | `crates/system-bridge/src/observability.rs` | structured, redacted, bounded local tracing |
| Export | `crates/export-runner/`, `packages/export/` | profiles, preflight, diagrams, Pandoc orchestration |
| Publish | `crates/publish-runner/`, adaptadores desktop/CLI | frontmatter-gated plan/review/apply, managed local Starlight output, stale-plan y output-drift protection |
| UI packages | `packages/*` | deep modules expuestos solo por package exports; MCP tool contracts/catalog separados de runtime state y dispatch |

## Flujos principales

### Abrir e indexar un vault

1. Renderer solicita abrir un vault mediante typed bridge.
2. Native adapter valida el path y actualiza scoped state.
3. Metadata discovery se separa de bounded content parsing.
4. Indexer aplica una generation y guarda notes/links/FTS en SQLite.
5. Watcher agrupa cambios incrementales; overflow/error emite `RescanRequired`.
6. Desktop y daemon ignoran stale generations y ejecutan la misma recuperación full-rebuild.

### Mutar una note mediante MCP

1. Validar tool y vault scope.
2. Persistir y hacer `fsync` de un intent con idempotency key y hash-chain link.
3. Ejecutar la atomic vault mutation.
4. Añadir outcome. Si el proceso se detiene entre intent y outcome, startup reconciliation resuelve determinísticamente el pending record.

### Commit de archivos seleccionados

`crates/native-git/src/status.rs` crea un índice temporal aislado inicializado desde `HEAD`, stagea los paths literales solicitados, crea el commit tree, actualiza la branch y deja sin cambios el índice original del usuario.

### Leer documentos del vault

Reader solo acepta paths PDF/EPUB relativos al vault en el native boundary. Native code resuelve y confina cada path antes de devolver bytes; renderer usa assets PDF/EPUB viewer incluidos y guarda annotations atómicamente en el vault sidecar. Reader se activa primero desde command palette, sin afirmar un shortcut predeterminado.

### Actualizar tasks y tarjetas Kanban

Las tasks se indexan desde Markdown y los cambios se escriben en la note de origen mediante canonical vault save path antes de ejecutar la native mutation. Kanban es una vista Markdown alternativa: mover una card reescribe el archivo fuente trasladando la línea completa bajo el heading `##` solicitado y luego actualiza el index. Ambos caminos rechazan source state stale o inválido en lugar de aplicar silenciosamente un cambio optimista solo en UI.

### Publicar un sitio Starlight local

1. Desktop o CLI solicita a `crates/publish-runner` un plan read-only derivado de un bounded symlink-aware vault scan.
2. Solo notes con `publish: true` son candidatas; sealed content se rechaza después del opt-in gate.
3. Desktop muestra items new/changed/orphaned para review. Apply es una native-authorized mutation separada.
4. Apply recalcula eligibility y content hashes, rechaza selections stale o inventadas por renderer y elimina solo fresh paths previamente propiedad de publish state.
5. Managed output usa atomic writes y rechaza traversal, symlink indirection, source/output containment y unmanaged overwrites. Las páginas generadas ausentes o modificadas manualmente conservan managed ownership, pero aparecen changed en el siguiente plan para que un apply revisado pueda repararlas.

### Proceso externo

Todos los launches soportados pasan por process broker. La policy incluye canonical executable resolution, optional binary hash, trusted workspace, environment allowlist, network policy, límites de time/output, process group/job cancellation y structured outcome. Ningún command se construye concatenando una shell string.

### Backup y restore

- `.scriptor/snapshots` locales son snapshots rápidos de recovery.
- External targets producen backups de disaster recovery en un directorio ligado al vault.
- Cada backup tiene un versioned SHA-256 manifest.
- Restore verifica path, size, hash y vault binding antes de promotion y registra un crash-visible restore journal.

## Modelo de datos y controles de escala

SQLite usa WAL, foreign keys, busy timeouts, current-schema validation, FTS y secondary indexes sobre vault/path y link adjacency. Las Graph APIs son bounded y conservan BFS depth/parent/path. Knowledge summaries y link resolution usan batch/aggregate queries. Los scans limitan file count y note size.

## Fronteras de confianza y fallo

| Boundary | Failure policy |
|---|---|
| Renderer -> native | validate, authorize, reject unknown/expired scope |
| Runtime JSON | parse desde `unknown`; quarantine corrupt persisted state |
| Filesystem | vault confinement, sin symlink/traversal escape |
| SQLite | current-schema validation; explicit busy/error surfaces |
| Watcher | generation IDs y full-rescan recovery |
| Event subscribers | bounded nonblocking queues; slow consumers se desconectan; authenticated resubscription emite `ResyncRequired` antes de reanudar delivery normal |
| Subprocess | timeout/cancel/process-tree kill; bounded stdout/stderr |
| Logs/audit | redaction, size rotation, bounded tail; mutation log hash chain |
| Release | immutable action pins, version contract, explicit unsigned trust records, checksums/SBOM/receipt, provenance attestations |

## Trabajo de arquitectura conocido

Adapter layer conserva una composition root, pero quick capture, rename transactions, deletion, telemetry, shortcuts, sidebar actions, auxiliary workspace data, settings vault configuration, MCP tool contracts, daemon command catalog/support, daemon transport tests, CLI command-line schema y CLI benchmarks ya tienen owners definidos. La descomposición adicional avanza mediante vertical workflows caracterizados sobre typed application services, no mediante un big-bang rewrite. Véase el capability ledger.
