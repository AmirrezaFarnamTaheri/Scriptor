# IPC Daemon Architecture

> **Source of truth:** [`docs/ARCHITECTURE.md`](../ARCHITECTURE.md) — daemon transport is covered there at the topology and ownership level. This document holds the **RPC surface quick-reference** and the **invariants and validation** that are too detailed for the overview.

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

## Validation

- Frame roundtrip (`scriptor-ipc`)
- Handler + socket RPC ping (`scriptor-daemon`)
- Differential oracle: `rewrite_tags_differential_oracle` in `vault::tag_rename`
- CI: `cargo test -p scriptor-daemon -p scriptor-ipc` + `pnpm check:daemon`

## Run commands

```bash
cargo run -p scriptor-daemon -- serve
cargo run -p scriptor-cli -- daemon ping
cargo run -p scriptor-cli -- tui ./vault --via-daemon
pnpm check:daemon
```

For the topology diagram, desktop integration routing, sidecar staging, and headless engine hook paths, see the **Daemon transport** row in [`docs/ARCHITECTURE.md`](../ARCHITECTURE.md) and the bridge routing paths documented there.
