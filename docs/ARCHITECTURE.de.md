# Aktuelle Architektur

[English](ARCHITECTURE.md) · [简体中文](ARCHITECTURE.zh-CN.md) · [Русский](ARCHITECTURE.ru.md) · **Deutsch** · [Español](ARCHITECTURE.es.md) · [فارسی](ARCHITECTURE.fa.md)

**Status:** aktuelle Implementierungskarte. Die maßgebliche Produktversion steht in [`VERSION`](../VERSION); reine Designvorschläge liegen in separaten Dokumenten und werden in [`CAPABILITY-MATURITY.md`](CAPABILITY-MATURITY.md) gekennzeichnet.

## Runtime-Topologie

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

Der Renderer ist keine Autoritätsgrenze. Native Operationen validieren Scope, Authorization, Runtime Payloads, Paths, Process Policy und Cancellation unabhängig vom UI-State.

## Ebenen und Zuständigkeiten

| Ebene | Owner | Verantwortlichkeiten |
|---|---|---|
| Product shell | `src/App.tsx`, `src/components/shell/`, `src/components/app/QuickCaptureWorkspaceLayer.tsx`, `src/components/app/WorkspaceRenameDialogs.tsx`, `src/hooks/` | Workspace Composition, Capture/Rename Workflows und Presentation State |
| Runtime validation | `src/lib/runtimeSchema.ts`, `src/types/vaultValidators.ts` | nicht vertrauenswürdige Bridge-/Storage-Payloads parsen |
| Native adapter | `apps/desktop/src-tauri/src/commands/` | nur Tauri Argument-/Result-Mapping |
| Authorization | `apps/desktop/src-tauri/src/authorization.rs` | einmalige Operation-/Scope-Grants und Native Confirmation |
| Vault | `crates/vault/` | sichere Paths, Notes, Config, Scans, Watcher Events, Audit Records |
| Index | `crates/indexer/` | SQLite Current Schema, FTS, Backlinks, Graph und Knowledge Queries |
| Git | `crates/native-git/` | noninteractive Status/Diff/Commit/Conflict Operations |
| External tools | `crates/system-bridge/src/process.rs` | Executable Policy, sanitized env, Sandbox, Bounds, Cancellation, Receipts |
| Daemon transport | `crates/daemon/`, `crates/ipc/` | authentifiziertes Local RPC, Frame Bounds, resynchronisierende Event Delivery, Jobs, MCP Bridge; Command Catalog ist getrennt von Dispatch zuständig |
| Desktop git serialization | `crates/native-git/src/queue.rs`, `apps/desktop/src-tauri/src/state.rs` | alle fünf Native-Git-Mutationen laufen über bounded per-repo GitQueue Worker mit 64-slot Backpressure; Handle wird bei Vault Swap zurückgesetzt; read-only Whole-Vault-Commands laufen über Session-Clone-Seam außerhalb des Daemon State Mutex |
| Observability | `crates/system-bridge/src/observability.rs` | structured, redacted, bounded local tracing |
| Export | `crates/export-runner/`, `packages/export/` | Profiles, Preflight, Diagramme, Pandoc Orchestration |
| Publish | `crates/publish-runner/`, Desktop/CLI Adapter | frontmatter-gated Plan/Review/Apply, Managed Local Starlight Output, Stale-Plan- und Output-Drift-Schutz |
| UI packages | `packages/*` | Deep Modules nur über Package Exports; MCP Tool Contracts/Catalog getrennt von Runtime State und Dispatch |

## Primäre Workflows

### Vault öffnen und indexieren

1. Renderer fordert Vault Open über Typed Bridge an.
2. Native Adapter validiert Path und aktualisiert Scoped State.
3. Metadata Discovery ist von Bounded Content Parsing getrennt.
4. Indexer wendet eine Generation an und speichert Notes/Links/FTS in SQLite.
5. Watcher bündelt inkrementelle Änderungen; Overflow/Error emittiert `RescanRequired`.
6. Desktop und Daemon ignorieren stale Generations und nutzen dieselbe Full-Rebuild-Recovery.

### Note über MCP mutieren

1. Tool und Vault Scope validieren.
2. Intent mit Idempotency Key und Hash-Chain-Link persistieren und `fsync` ausführen.
3. Atomic Vault Mutation durchführen.
4. Outcome anhängen. Stoppt der Prozess zwischen Intent und Outcome, löst Startup Reconciliation den Pending Record deterministisch auf.

### Ausgewählte Dateien committen

`crates/native-git/src/status.rs` erzeugt einen isolierten temporären Index aus `HEAD`, staged die angeforderten literal Paths, erzeugt den Commit Tree, aktualisiert den Branch und lässt den ursprünglichen Nutzerindex unverändert.

### Vault-Dokumente lesen

Reader akzeptiert an der Native Boundary nur vault-relative PDF-/EPUB-Pfade. Native Code löst jeden Pfad auf und beschränkt ihn vor Rückgabe der Document Bytes; der Renderer verwendet gebündelte PDF-/EPUB-Viewer-Assets und speichert Annotationen atomar im Vault Sidecar. Reader-Aktivierung ist Command-Palette-first, ohne Default-Shortcut-Claim.

### Tasks und Kanban Cards aktualisieren

Tasks werden aus Markdown indexiert; Änderungen werden vor der Native Mutation über den kanonischen Vault Save Path in die Ursprungsnote zurückgeschrieben. Kanban ist eine alternative Markdown-Ansicht: Ein Card Move schreibt die Source-Datei neu, indem die vollständige Card Line unter die angeforderte `##`-Überschrift verschoben wird, dann wird der Index aktualisiert. Beide Pfade lehnen stale oder invalid Source State ab, statt still eine optimistische UI-only Änderung anzuwenden.

### Lokale Starlight-Site veröffentlichen

1. Desktop oder CLI fragt `crates/publish-runner` nach einem read-only Plan aus einem bounded, symlink-aware Vault Scan.
2. Nur Notes mit `publish: true` sind Kandidaten; sealed content wird nach dem Opt-in Gate abgelehnt.
3. Desktop zeigt new/changed/orphaned Items zur Review. Apply ist eine separate native-authorized Mutation.
4. Apply berechnet Eligibility und Content Hashes neu, verwirft stale oder renderer-erfundene Selections und löscht nur fresh Paths, die zuvor Publish State gehörten.
5. Managed Output verwendet Atomic Writes und verweigert Traversal, Symlink Indirection, Source/Output Containment und Unmanaged Overwrites. Fehlende oder manuell geänderte Generated Pages behalten Managed Ownership, erscheinen aber im nächsten Plan als changed, damit Reviewed Apply sie reparieren kann.

### Externer Prozess

Alle unterstützten Starts laufen über den Process Broker. Die Policy enthält Canonical Executable Resolution, optionalen Binary Hash, Trusted Workspace, Environment Allowlist, Network Policy, Time/Output Limits, Process Group/Job Cancellation und Structured Outcome. Kein Command wird aus einem Shell String zusammengesetzt.

### Backup und Restore

- Lokale `.scriptor/snapshots` sind schnelle Recovery Snapshots.
- External Targets erzeugen Disaster-Recovery-Backups in einem Vault-gebundenen Verzeichnis.
- Jedes Backup hat ein versioniertes SHA-256 Manifest.
- Restore prüft vor Promotion Path, Size, Hash und Vault Binding und schreibt ein crash-sichtbares Restore Journal.

## Datenmodell und Skalierungskontrollen

SQLite verwendet WAL, Foreign Keys, Busy Timeouts, Current-Schema Validation, FTS und Secondary Indexes auf Vault/Path und Link Adjacency. Graph APIs sind bounded und erhalten BFS Depth/Parent/Path. Knowledge Summaries und Link Resolution verwenden Batch/Aggregate Queries. Scans begrenzen File Count und Note Size.

## Vertrauens- und Fehlergrenzen

| Boundary | Failure Policy |
|---|---|
| Renderer -> native | validate, authorize, reject unknown/expired scope |
| Runtime JSON | parse from `unknown`; corrupt persisted state quarantänisieren |
| Filesystem | Vault Confinement, kein Symlink/Traversal Escape |
| SQLite | Current-Schema Validation; explizite Busy/Error Surfaces |
| Watcher | Generation IDs und Full-Rescan Recovery |
| Event subscribers | bounded nonblocking queues; Slow Consumers werden getrennt; authenticated resubscription emittiert `ResyncRequired` bevor normale Delivery fortgesetzt wird |
| Subprocess | timeout/cancel/process-tree kill; bounded stdout/stderr |
| Logs/audit | Redaction, Size Rotation, bounded tail; Mutation Log Hash Chain |
| Release | immutable Action Pins, Version Contract, explizite unsigned Trust Records, Checksums/SBOM/Receipt, Provenance Attestations |

## Bekannte Architekturarbeit

Die Adapter Layer behält eine Composition Root, aber Quick Capture, Rename Transactions, Deletion, Telemetry, Shortcuts, Sidebar Actions, Auxiliary Workspace Data, Settings Vault Configuration, MCP Tool Contracts, Daemon Command Catalog/Support, Daemon Transport Tests, CLI Command-Line Schema und CLI Benchmarks haben fokussierte Owners. Weitere Dekomposition erfolgt über charakterisierte Vertical Workflows auf typisierten Application Services, nicht per Big-Bang-Rewrite. Siehe Capability Ledger.
