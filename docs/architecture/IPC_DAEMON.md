# IPC Daemon Architecture

Scriptor separates the vault engine from interface surfaces through a privilege-isolated, local-first IPC layer.

## Topology

```
┌─────────────────────┐     length-prefixed postcard      ┌──────────────────────┐
│  Clients            │  ───────────────────────────────► │  scriptor-daemon      │
│  - scriptor CLI      │     (named pipe / UDS file path)  │  (headless engine)   │
│  - scriptor TUI      │  ◄─────────────────────────────── │                      │
│  - desktop (Tauri)  │                                   │  VaultSession state  │
└─────────────────────┘                                   │  Indexer dispatch    │
                                                          └──────────────────────┘
```

## Invariants

1. **Local-only transport** — Windows uses namespaced pipes (`scriptor-core`); Unix uses a UDS file under the app data directory.
2. **Framed messages** — every frame is `MAGIC (u32) | LEN (u32) | postcard body`, capped at 16 MiB.
3. **Fail-fast RPC** — malformed frames or unknown vault state return explicit `RpcResult::Err` strings.
4. **Session ownership** — `OpenVault` establishes the active vault; subsequent calls require an open session.
5. **Hot reload hook** — `ReloadConfig` bumps an internal generation counter without tearing down active sessions.

## RPC Surface

| Method | Payload |
| --- | --- |
| `Ping` | version |
| `OpenVault` | vault descriptor |
| `ListNotes` / `SearchNotes` | note summaries / hits |
| `ReadNote` | markdown document |
| `RebuildIndex` | rebuild summary |
| `HealthReport` / `HealthDiagnostics` | JSON reports |
| `GitStatus` | JSON git status |
| `Backlinks` | JSON backlink hits |
| `GraphSummary` | JSON focused graph |
| `ReloadConfig` | unit |
| `SaveNote` | save output JSON (includes metadata + content hash) |
| `UpdateNoteIndex` | unit |
| `RenameNoteApply` | rename apply output JSON |
| `ExportRunNote` | export job output JSON |
| `ExportRunMarkdown` | export job output JSON (preprocessed markdown source) |

## Commands

```bash
cargo run -p scriptor-daemon -- serve
cargo run -p scriptor-cli -- daemon ping
cargo run -p scriptor-cli -- tui ./vault --via-daemon
pnpm check:daemon
```

## Validation

- Frame roundtrip (`scriptor-ipc`)
- Handler + socket RPC ping (`scriptor-daemon`)
- Differential oracle: `rewrite_tags_differential_oracle` in `vault::tag_rename`
- CI: `cargo test -p scriptor-daemon -p scriptor-ipc` + `pnpm check:daemon`

## Desktop Integration

When **Settings → Headless engine** is enabled, the desktop shell:

1. Starts or connects to `scriptor-daemon` via Tauri (`daemon_start`, `daemon_ping`).
2. Opens the active vault on the daemon (`daemon_open_vault`).
3. Routes indexer reads through daemon RPC proxies:
   - `indexer_rebuild`, `indexer_search`, `indexer_backlinks`, `indexer_graph`
   - `indexer_list_note_summaries`, `vault_health`, `vault_health_diagnostics`, `git_status`
4. Routes write-side operations through daemon RPC proxies:
   - `vault_save_note`, `indexer_update_note`, `vault_rename_apply`
   - `export_run_note`, `export_run_markdown`, headless `export_start_note` (daemon run + Tauri event bridge)

Vault open, scan tree, canvas, and in-process note reads remain in the desktop process for lowest latency.

The daemon binary is bundled as a Tauri `externalBin` sidecar (`scripts/release/stage-daemon-sidecar.ps1`).

Bridge routing: `src/bridge/headlessMode.ts`, `src/bridge/commands/indexer.ts`, `src/bridge/commands/vault.ts`, `src/bridge/commands/export.ts`.
