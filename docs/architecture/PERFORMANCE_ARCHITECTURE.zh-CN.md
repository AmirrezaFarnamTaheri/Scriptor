# 性能架构

[English](PERFORMANCE_ARCHITECTURE.md) · **简体中文** · [Русский](PERFORMANCE_ARCHITECTURE.ru.md) · [Deutsch](PERFORMANCE_ARCHITECTURE.de.md) · [Español](PERFORMANCE_ARCHITECTURE.es.md) · [فارسی](PERFORMANCE_ARCHITECTURE.fa.md)

## 性能原则

Scriptor 应当比 Electron 时代的 Markdown workspace 更快：昂贵工作移出 UI thread，原生代码拥有 IO 与 process boundary，派生状态通过明确的 rebuild 语义进行 cache。

## 优化栈

| 层 | 优化 | Owner | 验证 |
|---|---|---|---|
| Desktop shell | 使用 Tauri 2 代替 Electron。 | Native Platform | 启动与 idle memory benchmark。 |
| File IO | Rust vault kernel，atomic write 与批处理 watcher event。 | Vault Kernel | 保存 latency 与 watcher burst tests。 |
| Cache | SQLite/FTS 派生 cache。 | Indexing And Search | Rebuild、warm search 与 migration tests。 |
| Editor | CodeMirror adapter、lazy extension，默认不使用 rich editor。 | Editor Experience | Keystroke frame budget。 |
| Preview | 基于 worker 的 Markdown rendering 与 sanitizer boundary。 | Publication | Preview render benchmark。 |
| Graph | 预计算 edge、聚焦 graph query、worker layout。 | Knowledge Graph | Graph query 与 layout benchmark。 |
| Canvas | Native scene model、spatial index、lazy block renderer、snapshot job。 | Canvas Experience | Hit-test、pan/zoom 与 snapshot benchmarks。 |
| Export | Rust job runner、隔离 temp dir、可取消 Pandoc process。 | Publication | Export duration 与 cancellation tests。 |
| UI lists | 虚拟化 file tree、search result、backlink、job。 | Design Systems | Large list interaction test。 |
| Automation | 先 MCP read-only，之后再引入 write approval。 | Automation And AI | Permission tests 与 audit logs。 |

## 性能预算

| 预算 | 目标 | 首个测量 hook |
|---|---:|---|
| 冷启动 shell 可用 | 2.0s | `scripts/benchmarks/startup` |
| warm 5k-note vault 可用 | 1.5s | `scripts/benchmarks/vault-scan` |
| 普通 note 保存到 cache 更新 | 150ms | Rust integration test timing |
| Warm search query | 100ms | `scripts/benchmarks/search` |
| Editor 平均 frame cost | 16ms | editor latency probe |
| 普通 note preview render | 250ms | renderer worker benchmark |
| 5k note rename dry run | 500ms | graph rename fixture |
| Canvas pan/zoom frame cost | 16ms | canvas interaction probe |
| Canvas snapshot 启动 latency | 250ms | canvas snapshot job benchmark |
| Export cancellation response | 250ms | export-runner integration test |

## UI 性能规则

- Render 派生摘要，而不是整个 vault 的原始结构。
- Editor state 留在 editor adapter 本地。
- App shell state 保持浅层且可序列化。
- File tree、backlink、job 与 command result 使用稳定 row height。
- Graph、canvas、export、plugin 与 AI panel 只有打开时才加载。
- Plugin widget 必须放在有界 slot 中，并使用显式 data contract。
- 可独立滚动的 panel 使用 CSS containment。
- 尊重 reduced motion，避免页面加载编排动画。

## Native 性能规则

- 绝不并行扫描同一 vault path 两次。
- Cache update 前批处理 file watcher event。
- 使用 content hash 跳过未变化 note。
- 在 SQLite transaction 中执行 index update。
- 优先使用显式 process arg，而不是 shell string。
- 把 cache rebuild 当作正常 recovery path。
- 长时间 job 必须提供 progress 与 cancellation point。

## 升级路径

| 限制 | 首选方式 | 只有证据表明需要时才升级 |
|---|---|---|
| Search latency | SQLite FTS5 | Tantivy index crate。 |
| Graph layout | Web worker layout | Rust layout 预计算或 WebGL renderer。 |
| Canvas hit-testing | Rust spatial index | 只有测得交互压力后才使用 GPU renderer。 |
| Large vault scan | Rust 顺序扫描 + batching | Rayon parallel scan + IO backpressure。 |
| Git process overhead | Safe Git CLI adapter | `git2` wrapper。 |
| Export throughput | 单一 Pandoc job queue | 按 profile 设资源上限的 parallel queue。 |
