# Current architecture

**Status:** current implementation map. The authoritative product version is [`VERSION`](../VERSION); design-only proposals live in separate documents and are labeled in [`CAPABILITY-MATURITY.md`](CAPABILITY-MATURITY.md).

## Runtime topology

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

The renderer is not an authority boundary. Native operations validate scope, authorization, runtime payloads, paths, process policy, and cancellation independently of UI state.

## Planes and ownership

| Plane | Owner | Responsibilities |
|---|---|---|
| Product shell | `src/App.tsx`, `src/components/shell/`, `src/components/app/QuickCaptureWorkspaceLayer.tsx`, `src/components/app/WorkspaceRenameDialogs.tsx`, `src/hooks/` | workspace composition, capture/rename workflows, and presentation state |
| Runtime validation | `src/lib/runtimeSchema.ts`, `src/types/vaultValidators.ts` | parse untrusted bridge/storage payloads |
| Native adapter | `apps/desktop/src-tauri/src/commands/` | Tauri argument/result mapping only |
| Authorization | `apps/desktop/src-tauri/src/authorization.rs` | one-time operation/scope grants and native confirmation |
| Vault | `crates/vault/` | safe paths, notes, config, scans, watcher events, audit records |
| Index | `crates/indexer/` | SQLite current schema, FTS, backlinks, graph and knowledge queries |
| Git | `crates/native-git/` | noninteractive status/diff/commit/conflict operations |
| External tools | `crates/system-bridge/src/process.rs` | executable policy, sanitized env, sandbox, bounds, cancellation, receipts |
| Daemon transport | `crates/daemon/`, `crates/ipc/` | authenticated local RPC, frame bounds, resynchronizing event delivery, jobs, MCP bridge; the command catalog is owned separately from dispatch |
| Observability | `crates/system-bridge/src/observability.rs` | structured, redacted, bounded local tracing |
| Export | `crates/export-runner/`, `packages/export/` | profiles, preflight, diagrams, Pandoc orchestration |
| Publish | `crates/publish-runner/`, desktop/CLI adapters | frontmatter-gated plan/review/apply, managed local Starlight output, stale-plan and output-drift protection |
| UI packages | `packages/*` | deep modules exposed only through package exports; MCP tool contracts/catalog are separated from runtime state and dispatch |

## Primary workflows

### Open and index a vault

1. Renderer requests a vault open through the typed bridge.
2. Native adapter validates the path and updates scoped state.
3. Metadata discovery is separated from bounded content parsing.
4. Indexer applies a generation and stores notes/links/FTS in SQLite.
5. Watcher batches incremental changes; overflow/error emits `RescanRequired`.
6. Desktop and daemon ignore stale generations and run the same full-rebuild recovery.

### Mutate a note through MCP

1. Validate tool and vault scope.
2. Persist and `fsync` an intent containing idempotency key and hash-chain link.
3. Perform the atomic vault mutation.
4. Append outcome. If the process stops between intent and outcome, startup reconciliation resolves the pending record deterministically.

### Commit selected files

`crates/native-git/src/status.rs` creates an isolated temporary index seeded from `HEAD`, stages literal requested paths, creates the commit tree, updates the branch, and leaves the user’s original index unchanged.

### Read vault documents

The Reader accepts only vault-relative PDF and EPUB paths at the native boundary. Native code resolves and confines each path before returning document bytes; the renderer uses bundled PDF/EPUB viewer assets and stores annotations atomically in the vault sidecar. Reader activation is command-palette-first, with no default shortcut claim.

### Update tasks and Kanban cards

Tasks are indexed from Markdown and changes write back to the originating note through the canonical vault save path before the native mutation runs. Kanban is an alternate Markdown view: moving a card rewrites the source file by relocating the complete card line under the requested `##` heading, then refreshes the index. Both paths reject stale or invalid source state instead of silently applying an optimistic UI-only change.

### Publish a local Starlight site

1. Desktop or CLI asks `crates/publish-runner` for a read-only plan derived from a bounded, symlink-aware vault scan.
2. Only notes with `publish: true` are candidates; sealed content is rejected after the opt-in gate.
3. Desktop presents new/changed/orphaned items for review. Apply is a separate native-authorized mutation.
4. Apply recomputes eligibility and content hashes, rejects stale or renderer-invented selections, and deletes only fresh paths previously owned by publish state.
5. Managed output uses atomic writes and refuses traversal, symlink indirection, source/output containment, and unmanaged overwrites. Missing or manually modified generated pages preserve managed ownership but are surfaced as changed on the next plan so a reviewed apply can repair them.

### External process

All supported launches pass through the process broker. Policy includes canonical executable resolution, optional binary hash, trusted workspace, environment allowlist, network policy, time/output limits, process group/job cancellation, and structured outcome. No command is assembled through a shell string.

### Backup and restore

- Local `.scriptor/snapshots` are fast recovery snapshots.
- External targets produce disaster-recovery backups in a vault-bound directory.
- Every backup has a versioned SHA-256 manifest.
- Restore verifies path, size, hash, and vault binding before promotion and records a crash-visible restore journal.

## Data model and scale controls

SQLite uses WAL, foreign keys, busy timeouts, current-schema validation, FTS, and secondary indexes on vault/path and link adjacency. Graph APIs are bounded and preserve BFS depth/parent/path. Knowledge summaries and link resolution use batch/aggregate queries. Scans cap file count and note size.

## Trust and failure boundaries

| Boundary | Failure policy |
|---|---|
| Renderer -> native | validate, authorize, reject unknown/expired scope |
| Runtime JSON | parse from `unknown`; quarantine corrupt persisted state |
| Filesystem | vault confinement, no symlink/traversal escape |
| SQLite | current-schema validation; explicit busy/error surfaces |
| Watcher | generation IDs and full-rescan recovery |
| Event subscribers | bounded nonblocking queues; slow consumers disconnected; authenticated resubscription emits `ResyncRequired` before normal delivery resumes |
| Subprocess | timeout/cancel/process-tree kill; bounded stdout/stderr |
| Logs/audit | redaction, size rotation, bounded tail; mutation log hash chain |
| Release | immutable action pins, version contract, explicit unsigned trust records, checksums/SBOM/receipt, provenance attestations |

## Known architecture work

The adapter layer retains a composition root, but quick capture, rename transactions, deletion, telemetry, shortcuts, sidebar actions, auxiliary workspace data, settings vault configuration, MCP tool contracts, daemon command catalog/support, daemon transport tests, CLI command-line schema, and CLI benchmarks have focused owners. Further decomposition proceeds through characterized vertical workflows over typed application services, not a big-bang rewrite. See the capability ledger.
