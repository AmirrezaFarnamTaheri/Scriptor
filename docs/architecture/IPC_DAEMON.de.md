# IPC-Daemon-Architektur

[English](IPC_DAEMON.md) · [简体中文](IPC_DAEMON.zh-CN.md) · [Русский](IPC_DAEMON.ru.md) · **Deutsch** · [Español](IPC_DAEMON.es.md) · [فارسی](IPC_DAEMON.fa.md)

> **Quelle der Wahrheit:** [`docs/ARCHITECTURE.md`](../ARCHITECTURE.md) — der Daemon-Transport wird dort auf Topologie- und Ownership-Ebene beschrieben. Dieses Dokument enthält die **RPC-Surface-Kurzreferenz** sowie **Invarianten und Validierung**, die für die Übersicht zu detailliert sind.

## Invarianten

1. **Nur lokaler Transport** — Windows verwendet Namespaced Pipes (`scriptor-core`); Unix eine UDS-Datei im App-Datenverzeichnis.
2. **Gerahmte Nachrichten** — jeder Frame hat das Format `MAGIC (u32) | LEN (u32) | postcard body` und ist auf 16 MiB begrenzt.
3. **Fail-fast RPC** — ungültige Frames oder unbekannter Vault-Zustand liefern explizite `RpcResult::Err`-Strings.
4. **Session-Eigentum** — `OpenVault` legt den aktiven Vault fest; nachfolgende Aufrufe benötigen eine offene Session.
5. **Hot-Reload-Hook** — `ReloadConfig` erhöht einen internen Generation Counter, ohne aktive Sessions zu beenden.

## RPC-Surface

| Methode | Payload |
|---|---|
| `Ping` | Version |
| `OpenVault` | Vault Descriptor |
| `ListNotes` / `SearchNotes` | Note Summaries / Treffer |
| `ReadNote` | Markdown-Dokument |
| `RebuildIndex` | Rebuild Summary |
| `HealthReport` / `HealthDiagnostics` | JSON-Reports |
| `GitStatus` | JSON-Git-Status |
| `Backlinks` | JSON-Backlink-Treffer |
| `GraphSummary` | fokussierter Graph als JSON |
| `ReloadConfig` | unit |
| `SaveNote` | Save-Output-JSON (inkl. Metadata + Content Hash) |
| `UpdateNoteIndex` | unit |
| `RenameNoteApply` | Rename-Apply-Output-JSON |
| `ExportRunNote` | Export-Job-Output-JSON |
| `ExportRunMarkdown` | Export-Job-Output-JSON (vorverarbeitete Markdown-Quelle) |

## Validierung

- Frame-Roundtrip (`scriptor-ipc`)
- Handler + Socket-RPC-Ping (`scriptor-daemon`)
- Differential Oracle: `rewrite_tags_differential_oracle` in `vault::tag_rename`
- CI: `cargo test -p scriptor-daemon -p scriptor-ipc` + `pnpm check:daemon`

## Startbefehle

```bash
cargo run -p scriptor-daemon -- serve
cargo run -p scriptor-cli -- daemon ping
cargo run -p scriptor-cli -- tui ./vault --via-daemon
pnpm check:daemon
```

Topologiediagramm, Desktop-Integration-Routing, Sidecar-Staging und Hook-Pfade der Headless Engine stehen in der Zeile **Daemon transport** in [`docs/ARCHITECTURE.md`](../ARCHITECTURE.md) sowie in den dort dokumentierten Bridge-Routing-Pfaden.
