# Архитектура IPC-демона

[English](IPC_DAEMON.md) · [简体中文](IPC_DAEMON.zh-CN.md) · **Русский** · [Deutsch](IPC_DAEMON.de.md) · [Español](IPC_DAEMON.es.md) · [فارسی](IPC_DAEMON.fa.md)

> **Источник истины:** [`docs/ARCHITECTURE.md`](../ARCHITECTURE.md) — транспорт daemon описан там на уровне topology и ownership. Здесь оставлены **краткий справочник RPC surface**, а также **инварианты и проверки**, слишком детальные для общего обзора.

## Инварианты

1. **Только локальный transport** — Windows использует namespaced pipes (`scriptor-core`); Unix — UDS-файл в каталоге данных приложения.
2. **Framed messages** — каждый frame имеет формат `MAGIC (u32) | LEN (u32) | postcard body` и ограничен 16 MiB.
3. **Fail-fast RPC** — повреждённые frames или неизвестное состояние vault возвращают явные строки `RpcResult::Err`.
4. **Session ownership** — `OpenVault` устанавливает активный vault; последующие вызовы требуют открытой session.
5. **Hot reload hook** — `ReloadConfig` увеличивает внутренний generation counter без разрыва активных sessions.

## RPC Surface

| Method | Payload |
|---|---|
| `Ping` | version |
| `OpenVault` | vault descriptor |
| `ListNotes` / `SearchNotes` | summaries заметок / hits |
| `ReadNote` | markdown document |
| `RebuildIndex` | rebuild summary |
| `HealthReport` / `HealthDiagnostics` | JSON reports |
| `GitStatus` | JSON git status |
| `Backlinks` | JSON backlink hits |
| `GraphSummary` | JSON focused graph |
| `ReloadConfig` | unit |
| `SaveNote` | JSON результата сохранения (metadata + content hash) |
| `UpdateNoteIndex` | unit |
| `RenameNoteApply` | JSON результата применения rename |
| `ExportRunNote` | JSON результата export job |
| `ExportRunMarkdown` | JSON результата export job (предобработанный markdown source) |

## Проверка

- Roundtrip frame (`scriptor-ipc`)
- Handler + socket RPC ping (`scriptor-daemon`)
- Differential oracle: `rewrite_tags_differential_oracle` в `vault::tag_rename`
- CI: `cargo test -p scriptor-daemon -p scriptor-ipc` + `pnpm check:daemon`

## Команды запуска

```bash
cargo run -p scriptor-daemon -- serve
cargo run -p scriptor-cli -- daemon ping
cargo run -p scriptor-cli -- tui ./vault --via-daemon
pnpm check:daemon
```

Topology-диаграмма, маршрутизация desktop integration, staging sidecar и пути hook headless engine находятся в строке **Daemon transport** файла [`docs/ARCHITECTURE.md`](../ARCHITECTURE.md) и в описанных там bridge-routing путях.
