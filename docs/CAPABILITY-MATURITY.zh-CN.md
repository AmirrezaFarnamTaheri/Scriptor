# 功能成熟度台账

[English](CAPABILITY-MATURITY.md) · **简体中文** · [Русский](CAPABILITY-MATURITY.ru.md) · [Deutsch](CAPABILITY-MATURITY.de.md) · [Español](CAPABILITY-MATURITY.es.md) · [فارسی](CAPABILITY-MATURITY.fa.md)

本台账是所有支持声明的权威依据。**Implemented** 表示已有源码；**Supported** 还要求集成测试、release inclusion、文档和明确 owner。**Experimental** 表示需要 opt-in，且可能发生变化。**Design-only** 绝不能被描述成已经可用。

| 功能 | 状态 | 源码 / 证据 | 发布姿态 |
|---|---|---|---|
| Markdown vault 读/写/config | Supported | `crates/vault/`、Tauri/daemon adapters | Included |
| SQLite/FTS 索引与搜索 | Supported | `crates/indexer/` | Included |
| Backlinks/knowledge/graph | Supported, bounded | `crates/indexer/src/knowledge.rs`, `graph.rs` | Included |
| Desktop workspace | Supported | `src/`, `apps/desktop/` | Included |
| 带注释的 vault PDF/EPUB reader | Experimental | `src/components/reader/`, `apps/desktop/src-tauri/src/commands/reader.rs`, `.scriptor/reader/annotations.json` | 仅本地桌面；在宣称支持前需要完整 browser/accessibility 与 release-gate 证据 |
| 基于 Markdown 的 task 编辑 | Experimental | `crates/indexer/src/tasks.rs`, `src/components/TaskPanel.tsx` | 通过 vault write path 更新源 Markdown；宣称支持前需要干净环境端到端证据 |
| Markdown Kanban | Experimental | `crates/indexer/src/kanban.rs`, `src/components/KanbanPanel.tsx` | 移动卡片会把完整 source text 移到指定 `##` 标题下；宣称支持前需要 browser-flow 证据 |
| CodeMirror Markdown editor | 默认 Supported editor | `packages/editor/src/codemirror.tsx` | Included |
| Monaco editor | Advanced/lazy editor | `src/components/shell/EditorWorkspace.tsx` | Included, non-default |
| Git operations/conflict UI | Supported | `crates/native-git/`, `src/components/GitPanel.tsx` | Included |
| Export/Pandoc profiles | Supported with external-tool policy | `crates/export-runner/`, `packages/export/` | Included；Pandoc 独立 |
| Citation parsing/bibliography UI | Supported, bounded | `crates/indexer/src/citations.rs`、renderer citeproc path | Included；仅本地 bibliography data，不宣称 Zotero sync |
| Local Starlight publishing | Experimental | `crates/publish-runner/`、desktop plan/review/apply、CLI adapter | 仅本地输出；source/security contract 已通过，但仍需完整 Cargo/browser release 证据 |
| Canvas | Supported | `crates/canvas-engine/`, `packages/canvas/` | Included |
| Daemon IPC / CLI / TUI | Supported | `crates/daemon/`, `crates/ipc/`, `crates/cli/` | Daemon sidecar included |
| Canonical MCP server | Supported（保留 legacy compatibility codecs；是否采用 current spec 明确处理） | `packages/mcp/` | Included |
| Trusted automation stdio | Supported with audit/authorization；`mcp-stdio` 保留为 CLI alias | `crates/daemon/src/automation_stdio.rs` | Included |
| Manifest-first plugins | Experimental | `packages/plugin-api/` | 仅 first-party catalog |
| External code chunks | Experimental/high-risk | process broker + user confirmation | Opt-in |
| AI provider requests | Experimental opt-in | native keychain/network boundary | Opt-in |
| Local recovery snapshots | Supported | `commands/backup.rs` | Included |
| External DR backups | Supported foundation；每次 release 需要 drill | `commands/backup.rs` | Included |
| Encrypted vaults | 仅 Experimental primitives | `crates/vault/src/encryption.rs` | 不是受支持的 vault mode |
| Rust citation-engine（BibLaTeX parsing） | Supported | `crates/citation-engine/`, `crates/indexer/src/bibliography.rs` | Indexer 通过该 engine（hayagriva grammar）解析 `.bib`；fatal parse error 降级为 warning，每条 entry 转换失败会跳过；crate 的 citeproc rendering surface 仍在 incubating |
| Zotero Web API connector | Experimental / library-only | `packages/zotero-connector/` | Read-only library；未组合进产品，也没有已发布 sync UI |
| Google Calendar and Tasks | Experimental desktop integration | `apps/desktop/src-tauri/src/commands/google_calendar.rs`, `src/hooks/useGoogleCalendarSync.ts` | OAuth PKCE + OS-keychain token；需要配置 Google client ID，并在宣称支持前提供更广的 browser-flow 证据 |
| Gmail native bridge（manager UI 已组合，capability-gated） | Experimental desktop integration | `apps/desktop/src-tauri/src/commands/google_calendar.rs`, `src/bridge/commands/google_gmail.ts` | 位于 `scriptor.gmail-manager` plugin capability 后；仅显式启用插件时列出，每个 native command（包括 read/auth）都会在边界重新检查 capability；message listing 有界且并发 fetch |
| Desktop Git mutation queue（GitQueue） | Integrated | `crates/native-git/src/queue.rs` | 所有 desktop Git mutation 都进入每 repo 一个的有界 worker；source-contracts 覆盖 serialization + 64-slot backpressure；daemon-side Git command 仍由 daemon state mutex 串行化 |
| Semantic（embedding）search | Experimental opt-in | `crates/embeddings/`, `crates/daemon/src/handler.rs` | 通过 vault config 的 `semantic` section opt-in（本地 ollama server 或 OpenAI + 用户 keychain key）；vault sync 只 embed 已变化 note，并先 redact sealed span；未配置时退回 keyword-only search；cosine query 使用 reusable scratch buffer 实现 zero-copy |
| Tantivy index | Evaluation | `crates/tantivy-indexer/` | 不进入默认 workspace build 与 release binary；2026-09-01 release build、2k-note vault benchmark：warm search 0.0ms，FTS5 为 7.8ms（都远低于 100ms budget）。使用 batch commit API（`stage_note` + `commit_batch`）时 build index 452ms，而同 vault 的 FTS5 rebuild 约 8s；但 FTS5 已满足所有 budget 且与 note cache transactionally tied，因此产品保留 FTS5。若未来需要 sub-millisecond semantic-scale search，Tantivy 是待用替代方案。比较命令：`cargo run --release -p scriptor-cli --features tantivy -- bench-tantivy <vault> <query>` |
| WASM plugin host | Incubating | `crates/wasm-runtime/` | 不进入默认 workspace build |
| Mobile app | Design-only | `docs/architecture/MOBILE_ARCHITECTURE.md` | Not shipped |
| Signed public plugin marketplace | Design-only | plugin graduation requirements | Not shipped |
| Built-in self updater | Disabled | updater plugin/permission removed | Not shipped |

## 升级到 Supported 的门槛

只有以下条件全部满足，功能才能升级为 Supported：

1. 有明确 owner 与 support window；
2. 有稳定 public contract 与 current-schema policy；
3. 具备 positive、negative、restart、cancellation、recovery tests；
4. 具备 authorization/privacy model；
5. 有有界 performance evidence；
6. 有用户与 operator 文档；
7. 已包含在 release 中并验证 artifact；
8. 有 changelog entry。
