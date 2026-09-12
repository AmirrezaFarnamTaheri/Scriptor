# 当前架构

[English](ARCHITECTURE.md) · **简体中文** · [Русский](ARCHITECTURE.ru.md) · [Deutsch](ARCHITECTURE.de.md) · [Español](ARCHITECTURE.es.md) · [فارسی](ARCHITECTURE.fa.md)

**状态：** 当前实现地图。产品版本的权威来源是 [`VERSION`](../VERSION)；仅设计阶段的提案放在独立文档中，并在 [`CAPABILITY-MATURITY.md`](CAPABILITY-MATURITY.md) 中标记。

## Runtime 拓扑

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

Renderer 不是权限边界。Native 操作会独立于 UI 状态验证 scope、authorization、runtime payload、path、process policy 与 cancellation。

## 层面与所有权

| Plane | Owner | 职责 |
|---|---|---|
| Product shell | `src/App.tsx`, `src/components/shell/`, `src/components/app/QuickCaptureWorkspaceLayer.tsx`, `src/components/app/WorkspaceRenameDialogs.tsx`, `src/hooks/` | workspace composition、capture/rename workflow 与 presentation state |
| Runtime validation | `src/lib/runtimeSchema.ts`, `src/types/vaultValidators.ts` | 解析不可信 bridge/storage payload |
| Native adapter | `apps/desktop/src-tauri/src/commands/` | 只负责 Tauri argument/result mapping |
| Authorization | `apps/desktop/src-tauri/src/authorization.rs` | 一次性 operation/scope grant 与 native confirmation |
| Vault | `crates/vault/` | safe path、note、config、scan、watcher event、audit record |
| Index | `crates/indexer/` | SQLite current schema、FTS、backlink、graph 与 knowledge query |
| Git | `crates/native-git/` | noninteractive status/diff/commit/conflict operations |
| External tools | `crates/system-bridge/src/process.rs` | executable policy、sanitized env、sandbox、bounds、cancellation、receipt |
| Daemon transport | `crates/daemon/`, `crates/ipc/` | 经过认证的 local RPC、frame bounds、可重新同步的 event delivery、jobs、MCP bridge；command catalog 与 dispatch 分开拥有 |
| Desktop git serialization | `crates/native-git/src/queue.rs`, `apps/desktop/src-tauri/src/state.rs` | 五种 native Git mutation 都提交到每 repo 一个、64-slot backpressure 的有界 GitQueue worker；vault swap 时 handle 重置；只读全 vault command（rename preview、vault health）通过 session-clone seam 在 daemon state mutex 之外 dispatch |
| Observability | `crates/system-bridge/src/observability.rs` | structured、redacted、bounded local tracing |
| Export | `crates/export-runner/`, `packages/export/` | profile、preflight、diagram、Pandoc orchestration |
| Publish | `crates/publish-runner/`, desktop/CLI adapters | frontmatter-gated plan/review/apply、managed local Starlight output、stale-plan 与 output-drift protection |
| UI packages | `packages/*` | deep module 仅通过 package export 暴露；MCP tool contract/catalog 与 runtime state/dispatch 分离 |

## 主要工作流

### 打开并索引 vault

1. Renderer 通过 typed bridge 请求打开 vault。
2. Native adapter 验证 path 并更新 scoped state。
3. Metadata discovery 与有界 content parsing 分离。
4. Indexer 应用 generation，并把 notes/links/FTS 存入 SQLite。
5. Watcher 对增量变更 batching；overflow/error 会发出 `RescanRequired`。
6. Desktop 与 daemon 忽略 stale generation，并使用相同 full-rebuild recovery。

### 通过 MCP 修改 note

1. 验证 tool 与 vault scope。
2. 持久化并 `fsync` 一个包含 idempotency key 与 hash-chain link 的 intent。
3. 执行 atomic vault mutation。
4. 追加 outcome。若进程在 intent 与 outcome 之间终止，startup reconciliation 会确定性解决 pending record。

### Commit 选定文件

`crates/native-git/src/status.rs` 创建一个从 `HEAD` 初始化的隔离临时 index，stage 字面请求 path，创建 commit tree，更新 branch，并保持用户原有 index 不变。

### 读取 vault 文档

Reader 在 native boundary 只接受 vault-relative PDF/EPUB path。Native code 在返回文档 bytes 前解析并约束每个 path；renderer 使用随附的 PDF/EPUB viewer asset，并把 annotation 原子写入 vault sidecar。Reader 以 command-palette-first 方式激活，不声称存在默认快捷键。

### 更新 task 与 Kanban card

Task 从 Markdown 建立索引，native mutation 运行前通过 canonical vault save path 把变更写回原 note。Kanban 是另一种 Markdown view：移动 card 会把完整 card line 移到请求的 `##` heading 下并刷新 index。两条路径都会拒绝 stale 或 invalid source state，而不是静默应用仅存在于 UI 的 optimistic change。

### 发布本地 Starlight site

1. Desktop 或 CLI 向 `crates/publish-runner` 请求一个由 bounded、symlink-aware vault scan 派生的只读 plan。
2. 只有 `publish: true` 的 note 是 candidate；sealed content 在 opt-in gate 后被拒绝。
3. Desktop 展示 new/changed/orphaned item 供 review；Apply 是独立的 native-authorized mutation。
4. Apply 重新计算 eligibility 与 content hash，拒绝 stale 或 renderer 虚构的 selection，只删除此前由 publish state 拥有且仍属 fresh 的 path。
5. Managed output 使用 atomic write，并拒绝 traversal、symlink indirection、source/output containment 和 unmanaged overwrite。缺失或手工修改的 generated page 保留 managed ownership，但下一次 plan 会标为 changed，让 review 后的 apply 能修复。

### 外部进程

所有受支持的 launch 都经过 process broker。Policy 包括 canonical executable resolution、可选 binary hash、trusted workspace、environment allowlist、network policy、time/output limit、process group/job cancellation 与 structured outcome。任何 command 都不会通过 shell string 拼接。

### Backup 与 restore

- 本地 `.scriptor/snapshots` 是快速 recovery snapshot。
- External target 在与 vault 绑定的目录中生成 disaster-recovery backup。
- 每个 backup 都有 versioned SHA-256 manifest。
- Restore 在 promotion 前验证 path、size、hash、vault binding，并记录 crash-visible restore journal。

## 数据模型与规模控制

SQLite 使用 WAL、foreign key、busy timeout、current-schema validation、FTS，以及 vault/path 和 link adjacency 上的 secondary index。Graph API 有界，并保留 BFS depth/parent/path。Knowledge summary 与 link resolution 使用 batch/aggregate query。Scan 限制 file count 与 note size。

## 信任与失败边界

| Boundary | Failure policy |
|---|---|
| Renderer -> native | validate、authorize，拒绝未知/过期 scope |
| Runtime JSON | 从 `unknown` parse；quarantine 损坏的 persisted state |
| Filesystem | vault confinement，不允许 symlink/traversal escape |
| SQLite | current-schema validation；显式 busy/error surface |
| Watcher | generation ID 与 full-rescan recovery |
| Event subscribers | bounded nonblocking queue；断开 slow consumer；authenticated resubscription 在恢复正常 delivery 前发出 `ResyncRequired` |
| Subprocess | timeout/cancel/process-tree kill；bounded stdout/stderr |
| Logs/audit | redaction、size rotation、bounded tail；mutation log hash chain |
| Release | immutable action pin、version contract、显式 unsigned trust record、checksum/SBOM/receipt、provenance attestation |

## 已知架构工作

Adapter layer 仍保留 composition root，但 quick capture、rename transaction、deletion、telemetry、shortcut、sidebar action、auxiliary workspace data、settings vault configuration、MCP tool contract、daemon command catalog/support、daemon transport test、CLI command-line schema 与 CLI benchmark 已有明确 owner。进一步拆分会通过有表征测试的 vertical workflow 和 typed application service 渐进进行，而不是 big-bang rewrite。详见 capability ledger。
