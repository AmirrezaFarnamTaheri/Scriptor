# Arquitectura del daemon IPC

[English](IPC_DAEMON.md) · [简体中文](IPC_DAEMON.zh-CN.md) · [Русский](IPC_DAEMON.ru.md) · [Deutsch](IPC_DAEMON.de.md) · **Español** · [فارسی](IPC_DAEMON.fa.md)

> **Fuente de verdad:** [`docs/ARCHITECTURE.md`](../ARCHITECTURE.md) — el transporte del daemon se documenta allí a nivel de topology y ownership. Este documento conserva la **referencia rápida de la superficie RPC** y los **invariantes y validaciones** demasiado detallados para el resumen general.

## Invariantes

1. **Transporte solo local** — Windows usa namespaced pipes (`scriptor-core`); Unix usa un archivo UDS bajo el directorio de datos de la aplicación.
2. **Mensajes con framing** — cada frame usa `MAGIC (u32) | LEN (u32) | postcard body`, con un máximo de 16 MiB.
3. **RPC fail-fast** — los frames malformados o un estado de vault desconocido devuelven strings explícitos `RpcResult::Err`.
4. **Propiedad de la sesión** — `OpenVault` establece el vault activo; las llamadas posteriores requieren una sesión abierta.
5. **Hook de hot reload** — `ReloadConfig` incrementa un generation counter interno sin desmontar las sesiones activas.

## Superficie RPC

| Método | Payload |
|---|---|
| `Ping` | versión |
| `OpenVault` | descriptor del vault |
| `ListNotes` / `SearchNotes` | resúmenes de notas / resultados |
| `ReadNote` | documento Markdown |
| `RebuildIndex` | resumen de reconstrucción |
| `HealthReport` / `HealthDiagnostics` | informes JSON |
| `GitStatus` | estado Git JSON |
| `Backlinks` | resultados de backlinks JSON |
| `GraphSummary` | grafo enfocado JSON |
| `ReloadConfig` | unit |
| `SaveNote` | JSON de salida de guardado (incluye metadata + content hash) |
| `UpdateNoteIndex` | unit |
| `RenameNoteApply` | JSON del resultado de aplicar el rename |
| `ExportRunNote` | JSON de salida del job de exportación |
| `ExportRunMarkdown` | JSON de salida del job de exportación (fuente Markdown preprocesada) |

## Validación

- Roundtrip de frame (`scriptor-ipc`)
- Handler + ping RPC por socket (`scriptor-daemon`)
- Differential oracle: `rewrite_tags_differential_oracle` en `vault::tag_rename`
- CI: `cargo test -p scriptor-daemon -p scriptor-ipc` + `pnpm check:daemon`

## Comandos de ejecución

```bash
cargo run -p scriptor-daemon -- serve
cargo run -p scriptor-cli -- daemon ping
cargo run -p scriptor-cli -- tui ./vault --via-daemon
pnpm check:daemon
```

Para el diagrama de topology, el routing de la integración de escritorio, el staging de sidecars y las rutas de hooks de headless engine, consulte la fila **Daemon transport** de [`docs/ARCHITECTURE.md`](../ARCHITECTURE.md) y las rutas de bridge documentadas allí.
