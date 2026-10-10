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

### 经审阅的源文件、同步与渲染流程

研究工作区复用 vault/indexer 边界。表格修改先保存编辑器，再保留表格最初显示的修订；源变化须重载并审阅。Capture 与 Zotero 导入先预览，再向原始库的不存在目标写入。凭据仅在内存中；密钥变化重置分页。

PDF/EPUB 限制为 128 MiB，栅格图像/音频另限 32 MiB，排除活动 SVG/HTML。检查 MIME，源变化或卸载时回收对象 URL。Reader 协议提供内置查看器代码，不暴露任意文件路径。

构建收据绑定源/输出指纹。部署复制到私有、有界临时快照，验证收据后仅将快照交给进程代理，结束后删除。适配器在获得打包和真实提供商证据前仍属实验性。

重命名先保存编辑器，再执行原生修改。保存失败中止并保留草稿；链接改写遵循修订/导航保护，原生过期源检查仍权威。恢复备份文件名唯一，保护旧补丁。活动历史只读末尾最多 256 KiB、返回最多 200 条有效记录；超过 16 KiB 的追加被拒，超过 1 MiB 的历史在库锁内压缩。重命名恢复单独保留，不自动清除。

引用在最终净化前从文本节点按当前书目解析。分组保留前缀、定位及作者抑制；缺失键保留源文本并标注可访问状态。代码、链接及已有引用除外。作者/年份预览不修改 Markdown、不替代 CSL 导出。

`useWorkspaceShortcutPreferences`验证有界版本化本地 UI 数据；`WorkspaceShortcutBar`只解析当前命令目录。标签和尺寸不能保存可执行命令。存储错误保留草稿；隐藏行仍可经命令面板恢复。

`useWorkspaceComposition`将验证后的每库叶引用绑定至两个 dock 组。恢复引用不激活所有者；导航经所有者批准。隐藏或移动保留已挂载所有者；嵌套对话框阻止隐藏。生命周期按叶管理，修改的编辑器依次展示。主写作编辑器唯一，侧 Markdown 叶是只读快照。模块管理器按规范 manifest 和当前插件策略授权，再存偏好。

独立源文件使用 `commands/source_files.rs`，显式文本格式允许列表、有界 UTF-8、内容 hash 保存、严格创建和不可变恢复。不会进入 Markdown 正文元数据或历史。未保存导航须在切库前决策；过期决策不能无限阻塞。

`calendar_sync`保留公开文件夹/传输绑定和桌面 OAuth client ID，无需迁移。Drive/Docs、Calendar/Tasks、Gmail 使用三份独立系统密钥链记录和服务授权。发现验证有界页，拒绝部分结果及分页循环，保留日历写入角色。切换账户使消费者与准备的审阅失效；原生 OAuth 代数阻止迟到登录恢复断开的凭据。删除本地凭据不会撤销整个 Google 应用授权，须在 Google 账户明确操作。

异步后续保留原始库和账户。账户改变使发现、消息、审阅和导入失效。Planner 块保留本地；映射及基线归确认账户和所选日历/任务列表。卸载后迟到响应不能覆盖活动 planner。Gmail 在保存、索引、导航前重检上下文；提交的写入可能完成，但过期后续效果被抑制。

Drive JSON 与 opaque Docs 共享修订/冲突模型和一次原生许可。Docs 验证规范编码信封和 checksum，保留 Markdown 字节。富文本转换是独立审阅流程，记录不携带媒体。[Google 指南](guides/GOOGLE_INTEGRATIONS.zh-CN.md)。

Overleaf 经代理使用固定主机 Git。新隔离仓库保留完整远端索引，仅物化所选 blob；对象检查绕过 Git 文本过滤。审阅 HEAD/内容后普通非强制 push；本地应用采用内容 CAS。

持久 Python kernel 是库所有的代理进程，生命周期有限、按单元源授权、输出有界且绘图产物有归属。原生转换保护防止迟到注册；切库/恢复停止旧 kernel。其他语言的新执行独立处理。

Graphviz 使用内置 WebAssembly、可取消且限时的 worker。DOT 围栏与 Diagram studio 共享客户端；SVG 在被动图像上下文显示。离线 PDF 排版仍属原生，具有受限资源快照、内置声明及唯一产物发布。渲染测试数据不证明平台打包或真实提供商。

Adapter layer 仍保留 composition root，但 quick capture、rename transaction、deletion、telemetry、shortcut、sidebar action、auxiliary workspace data、settings vault configuration、MCP tool contract、daemon command catalog/support、daemon transport test、CLI command-line schema 与 CLI benchmark 已有明确 owner。进一步拆分会通过有表征测试的 vertical workflow 和 typed application service 渐进进行，而不是 big-bang rewrite。详见 capability ledger。
