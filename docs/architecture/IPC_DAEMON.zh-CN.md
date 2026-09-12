# IPC Daemon 架构

[English](IPC_DAEMON.md) · **简体中文** · [Русский](IPC_DAEMON.ru.md) · [Deutsch](IPC_DAEMON.de.md) · [Español](IPC_DAEMON.es.md) · [فارسی](IPC_DAEMON.fa.md)

> **权威来源：** [`docs/ARCHITECTURE.md`](../ARCHITECTURE.md) — daemon transport 的 topology 和 ownership 在该文档中说明。本页保留更适合快速查阅的 **RPC surface**，以及不适合塞进总览的**不变量与验证要求**。

## 不变量

1. **仅本地 transport** — Windows 使用 namespaced pipe（`scriptor-core`）；Unix 使用应用数据目录下的 UDS 文件。
2. **Framed message** — 每个 frame 的格式为 `MAGIC (u32) | LEN (u32) | postcard body`，上限 16 MiB。
3. **Fail-fast RPC** — 格式错误的 frame 或未知 vault 状态会返回明确的 `RpcResult::Err` 字符串。
4. **Session ownership** — `OpenVault` 建立 active vault；后续调用必须已有打开的 session。
5. **Hot reload hook** — `ReloadConfig` 递增内部 generation counter，而不会拆掉 active session。

## RPC Surface

| Method | Payload |
|---|---|
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
| `SaveNote` | 保存结果 JSON（含 metadata + content hash） |
| `UpdateNoteIndex` | unit |
| `RenameNoteApply` | rename apply 结果 JSON |
| `ExportRunNote` | export job 结果 JSON |
| `ExportRunMarkdown` | export job 结果 JSON（预处理后的 markdown source） |

## 验证

- Frame roundtrip（`scriptor-ipc`）
- Handler + socket RPC ping（`scriptor-daemon`）
- Differential oracle：`vault::tag_rename` 中的 `rewrite_tags_differential_oracle`
- CI：`cargo test -p scriptor-daemon -p scriptor-ipc` + `pnpm check:daemon`

## 运行命令

```bash
cargo run -p scriptor-daemon -- serve
cargo run -p scriptor-cli -- daemon ping
cargo run -p scriptor-cli -- tui ./vault --via-daemon
pnpm check:daemon
```

关于 topology 图、desktop integration routing、sidecar staging 与 headless engine hook path，请查看 [`docs/ARCHITECTURE.md`](../ARCHITECTURE.md) 中的 **Daemon transport** 行以及该文档列出的 bridge routing path。
