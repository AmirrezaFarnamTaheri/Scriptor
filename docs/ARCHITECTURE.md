# Current architecture

**Status:** current implementation map for version `0.1.0`. Design-only proposals live in separate documents and are labeled in [`CAPABILITY-MATURITY.md`](CAPABILITY-MATURITY.md).

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
| Index | `crates/indexer/` | SQLite schema/migrations, FTS, backlinks, graph and knowledge queries |
| Git | `crates/native-git/` | noninteractive status/diff/commit/conflict operations |
| External tools | `crates/system-bridge/src/process.rs` | executable policy, sanitized env, sandbox, bounds, cancellation, receipts |
| Daemon transport | `crates/daemon/`, `crates/ipc/` | authenticated local RPC, frame bounds, resynchronizing event delivery, jobs, MCP bridge; the command catalog is owned separately from dispatch |
| Observability | `crates/system-bridge/src/observability.rs` | structured, redacted, bounded local tracing |
| Export | `crates/export-runner/`, `packages/export/` | profiles, preflight, diagrams, Pandoc orchestration |
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

### External process

All supported launches pass through the process broker. Policy includes canonical executable resolution, optional binary hash, trusted workspace, environment allowlist, network policy, time/output limits, process group/job cancellation, and structured outcome. No command is assembled through a shell string.

### Backup and restore

- Local `.scriptor/snapshots` are fast recovery snapshots.
- External targets produce disaster-recovery backups in a vault-bound directory.
- Every backup has a versioned SHA-256 manifest.
- Restore verifies path, size, hash, and vault binding before promotion and records a crash-visible restore journal.

## Data model and scale controls

SQLite uses WAL, foreign keys, busy timeouts, transactional migrations, FTS, and secondary indexes on vault/path and link adjacency. Graph APIs are bounded and preserve BFS depth/parent/path. Knowledge summaries and link resolution use batch/aggregate queries. Scans cap file count and note size.

## Trust and failure boundaries

| Boundary | Failure policy |
|---|---|
| Renderer -> native | validate, authorize, reject unknown/expired scope |
| Runtime JSON | parse from `unknown`; quarantine corrupt persisted state |
| Filesystem | vault confinement, no symlink/traversal escape |
| SQLite | migrations in transaction; explicit busy/error surfaces |
| Watcher | generation IDs and full-rescan recovery |
| Event subscribers | bounded nonblocking queues; slow consumers disconnected; authenticated resubscription emits `ResyncRequired` before normal delivery resumes |
| Subprocess | timeout/cancel/process-tree kill; bounded stdout/stderr |
| Logs/audit | redaction, size rotation, bounded tail; mutation log hash chain |
| Release | immutable action pins, version contract, mandatory production signatures, attestations |

## Known architecture work

The adapter layer retains a composition root, but quick capture, rename transactions, deletion, telemetry, shortcuts, sidebar actions, auxiliary workspace data, settings vault configuration, MCP tool contracts, daemon command catalog/support, daemon transport tests, CLI command-line schema, and CLI benchmarks now have focused owners. The source ratchet was tightened after these extractions: `App.tsx` 1,950 lines, MCP runtime 575, daemon command gateway 875, and CLI main 650. Further decomposition must proceed by characterized vertical workflows over typed application services, not a big-bang rewrite. See the capability ledger and `docs/REMEDIATION-2026-08-03.md`.
