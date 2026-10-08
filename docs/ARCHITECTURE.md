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

Research workspaces compose the existing vault/indexer/native boundaries. Database edits flush the source editor through its mutation coordinator, then retain the revision originally displayed by the table; a changed source requires reload and review. Capture and Zotero imports preview content before a missing-destination, expected-vault write. Credentials used for reviewed imports stay in memory and pagination is reset when the key changes.

Asset previews read through the originating-vault reader boundary. PDF/EPUB documents remain bounded at 128 MiB; raster/audio previews use a separate 32 MiB bound and exclude active SVG/HTML documents. Local image/audio object URLs have explicit MIME checks and are revoked on source changes or unmount. The bundled reader custom protocol serves viewer code, rather than exposing arbitrary filesystem paths.

Publishing build receipts bind output to source/output fingerprints. Deployment copies the bounded output into a private temporary snapshot, verifies that snapshot against the receipt, and passes only the snapshot to the brokered deployment process. Temporary snapshots are removed when the operation ends. These adapters remain experimental pending packaged and live-provider evidence.

Rename composition flushes pending editor saves before applying native mutations. Link rewrites refresh the active note through the editor's revision/navigation guard; failed saves abort the rename and retain the draft. Native stale-source checks remain authoritative. Recovery backup filenames include a unique version identifier so later renames cannot overwrite the content referenced by older patch records.

Activity history reads inspect at most the final 256 KiB and return at most 200 valid records, skipping malformed and oversized records. Appends reject records over 16 KiB and compact histories exceeding 1 MiB while holding the vault update lock. This policy applies to diagnostic activity; rename recovery records are retained separately and are not automatically pruned.

Rendered output resolves bracket citations against the current bibliography in a text-node postprocessor before final sanitization. Grouped citations retain prefixes, locators, and author suppression; missing keys preserve the original source with an accessible unresolved marker. Code, links, and existing citation markup are excluded. This author/year preview does not replace CSL export formatting or alter authored Markdown. The sanitizer admits only the citation status and accessibility attributes needed by that presentation.

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
| Desktop git serialization | `crates/native-git/src/queue.rs`, `apps/desktop/src-tauri/src/state.rs` | all five native Git mutations submit through the bounded per-repo GitQueue worker (64-slot backpressure); the handle resets on vault swap; read-only whole-vault commands (rename previews, vault health) dispatch outside the daemon state mutex via the session-clone seam |
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

### Reviewed source, sync and rendering workflows

Workspace shortcut preferences are separate from vault leaves and drafts.
`useWorkspaceShortcutPreferences` validates versioned, bounded local UI data;
`WorkspaceShortcutBar` resolves only the current command catalog. Labels and
dimensions cannot store executable commands. Storage denial retains the draft
and reports an error; hidden rows remain recoverable through the palette.

The shell's `useWorkspaceComposition` binds runtime-validated per-vault leaf
references to two dock groups. It restores references without activating owners,
commits navigation only after owner approval and preserves mounted source/feature
owners while their tabs are hidden or moved. Nested dialogs block hiding their
owner. A per-leaf lifecycle registry scopes close decisions, while deferred vault
guards reveal dirty editors sequentially. The writing editor stays singular;
side Markdown leaves are read-only snapshots with explicit guarded navigation.
The module manager registers the canonical runtime manifest, rechecks current
plugin policy on launch, and applies authority changes before storing preferences.

Standalone source files use `commands/source_files.rs` and the source editor,
with an explicit text-format allowlist, bounded UTF-8 reads, content-hash saves,
strict creation and immutable recovery. They do not enter Markdown prose
metadata or history pipelines. Unsaved navigation decisions settle before a
vault switch; superseded decisions cannot leave a switch waiting indefinitely.

Google collaboration uses a persisted public folder/transport binding in
`calendar_sync`. That existing
section also retains the shared public OAuth desktop client ID; old vaults need
no configuration migration. Drive/Docs, Calendar/Tasks and Gmail credentials
remain three independent OS-keychain records with service-specific grants.
Resource discovery validates bounded provider pages, rejects partial results
and pagination cycles, and preserves calendar write roles. Account-change
notifications invalidate other mounted consumers and their prepared reviews;
native OAuth generations prevent a late login from restoring a disconnected
credential. Removing one local credential does not revoke Google's entire app
grant. Grant-wide revocation remains an explicit Google-account action.

Google collaboration binds remote operations to the originating vault as well
as the one-time native grant. Drive JSON and opaque Google Docs records share
the revision/conflict model. The Docs transport verifies a canonical encoded
envelope and checksum, preserving Markdown bytes; optional rich text conversion
is a separate reviewed workflow. Media files are not carried by these records.

Overleaf uses the supported fixed-host Git transport through the process
broker. A fresh isolated repository preserves the full remote index while only
the selected source blob is materialized. Blob/object checks avoid Git text
filter transformations. Reviewed head and content checks precede ordinary
non-force pushes; a local application uses source-file content CAS.

Persistent Python kernels are vault-owned broker processes with finite
lifetimes, per-cell source-bound permission, bounded output and owned plot
artifacts. A shared native transition guard prevents late registration during
vault changes. Opening a vault and restoring a backup stop old kernels before
replacing the session. Fresh execution of other languages remains separate.

Graphviz is a bundled WebAssembly renderer in a cancellable, deadline-bounded
worker. Markdown DOT fences and Diagram studio use the same client. SVG output
is displayed in passive image context. Offline PDF typesetting remains native,
with confined asset snapshots, bundled notices and unique artifact publication.
Platform packaging and live provider evidence are tracked in the capability
ledger rather than inferred from renderer fixtures.

The adapter layer retains a composition root, but quick capture, rename transactions, deletion, telemetry, shortcuts, sidebar actions, auxiliary workspace data, settings vault configuration, MCP tool contracts, daemon command catalog/support, daemon transport tests, CLI command-line schema, and CLI benchmarks have focused owners. Further decomposition proceeds through characterized vertical workflows over typed application services, not a big-bang rewrite. See the capability ledger.
