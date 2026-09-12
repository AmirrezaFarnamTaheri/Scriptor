# TUI 功能对等矩阵

[English](TUI_PARITY.md) · **简体中文** · [Русский](TUI_PARITY.ru.md) · [Deutsch](TUI_PARITY.de.md) · [Español](TUI_PARITY.es.md) · [فارسی](TUI_PARITY.fa.md)

## 不变量

终端界面必须暴露与桌面外壳相同的 local-first vault 模型：打开 vault、检查已索引笔记、搜索、预览、查看导出指引、Git 状态与健康诊断，同时不能引入平行 backend。

## 当前界面

- `cargo run -p scriptor-cli -- tui <vault>`
  - keyboard-first 笔记浏览器，使用经过 grapheme-width 清理的渲染
  - 使用 `/` 进入增量搜索
  - 右侧 pane 模式：preview（`p`）、backlinks（`b`）、graph（`g`）、health（`h`）；用 `Tab` 循环
  - 通过 pulldown-cmark terminal renderer 提供丰富 Markdown preview
  - 使用 `PgUp` / `PgDn` 滚动 pane；`?` 打开帮助 overlay
  - footer 显示 Git branch/cleanliness 与 health issue 数量
  - in-process backend 使用 `scriptor-vault` + `scriptor-indexer` + `scriptor-native-git`

- `cargo run -p scriptor-cli -- tui <vault> --via-daemon`
  - 相同 UX 经 `scriptor-daemon` RPC 路由（OpenVault、ListNotes、SearchNotes、ReadNote、GitStatus、HealthDiagnostics、Backlinks、GraphSummary）

- `cargo run -p scriptor-cli -- tui <vault> --smoke-test`
  - 非交互验证：打开 vault、建立 index、发现笔记、全部 pane 模式、preview 加载

## Desktop / Terminal 映射

| 能力 | Desktop | TUI | Backend 复用 |
|---|---|---|---|
| 打开 vault | `vault_open` | `tui` | `scriptor-vault::open_vault` |
| 重建 index | 自动 / command | startup | `scriptor-indexer::rebuild_index` |
| 浏览笔记 | sidebar | 左侧 list pane | `list_note_summaries` |
| 搜索笔记 | sidebar + dock | `/` query mode | `search_notes` |
| 读取笔记 | editor/preview | preview pane (`p`) | `read_note` |
| 导出笔记 | export profiles | health pane CLI hint | `scriptor export` command |
| Git 状态 | Git panel | footer + `r` refresh | `scriptor-native-git::git_status` |
| 诊断 | dock / panels | health pane (`h`) | `health_diagnostics_json` |
| Backlinks | inspector | backlinks pane (`b`) | `backlinks_for_path` |
| Graph summary | graph panel | graph pane (`g`) | `query_focused_graph` |

## 验证

- Unit：`safe_fit` grapheme 测试、`footer_includes_git_and_health_slots` snapshot-style assertion
- Smoke：`pnpm check:tui`、`pnpm check:daemon`（TUI via daemon）
- CI：`validate-frontend` 中的 TUI smoke + daemon IPC unit tests
