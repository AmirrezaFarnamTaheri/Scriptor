[English](ONBOARDING.md) · [فارسی](ONBOARDING.fa.md) · **简体中文** · [Русский](ONBOARDING.ru.md) · [Deutsch](ONBOARDING.de.md) · [Español](ONBOARDING.es.md)

# Scriptor 贡献者入门

> **适用对象：**首次贡献者、维护者和代码审计人员。新用户应从 [`README.md`](../README.md) 和 [`docs/guides/GETTING_STARTED.zh-CN.md`](guides/GETTING_STARTED.zh-CN.md) 开始。
>
> Agent 规则请先阅读 [`AGENTS.md`](../AGENTS.md)。贡献流程、PR 与必需检查见 [`CONTRIBUTING.zh-CN.md`](../CONTRIBUTING.zh-CN.md)。

## 技术栈

| 层 | 技术 | 权威来源 |
|---|---|---|
| **桌面壳** | Tauri 2 (Rust) | `apps/desktop/src-tauri/` |
| **核心引擎** | Rust workspace crates（1.96.0，2024 Edition） | `crates/`, `rust-toolchain.toml` |
| **前端** | React 19, Vite 8, TypeScript 6, Lucide React | `package.json` |
| **包管理器** | pnpm 10.33.0 | `package.json` (`packageManager`) |
| **样式** | 语义 OKLCH + CSS custom properties；无 Tailwind、无远程字体 | `src/index.css`, `src/styles/` |
| **IPC 协议** | Rust `ts-rs` → TypeScript contracts | `crates/ipc/src/lib.rs` → `tsconfig.contracts.json` |
| **测试** | Cargo test、Playwright E2E + visual、axe-core a11y | `playwright.e2e.config.ts`, `playwright.visual.config.ts` |

安装命令见 [`README.zh-CN.md`](../README.zh-CN.md) 的 **Build from source**。完整必需检查列表见 [`CONTRIBUTING.zh-CN.md`](../CONTRIBUTING.zh-CN.md)。

> 本地快速 gate：`pnpm test:source`（contract + governance）、`pnpm check:changelog`（发布说明保护）、`pnpm test:rust`（与 CI 对齐的 Rust gate；排除 scriptor-desktop 和孵化中的引擎）、`pnpm check:i18n`（locale parity）。

## 架构概览

运行时拓扑、信任边界和 crate 所有权记录在 [`docs/ARCHITECTURE.zh-CN.md`](ARCHITECTURE.zh-CN.md)：

```
React renderer
  → typed bridge commands
  → Tauri command adapters
  → authorization broker
  → application/kernel crates (vault, indexer, native-git, export-runner, canvas-engine)
  → filesystem / SQLite / Git / keychain / approved external tools

CLI/TUI and MCP
  → daemon IPC (scriptor-ipc envelopes)
  → daemon handlers and shared kernel crates
```

Renderer 不是权限边界。原生操作会独立于 UI 状态验证 scope、授权、运行时 payload、路径、进程策略和取消行为。

## 关键入口

| 组件 | 入口 |
|---|---|
| Desktop shell | `apps/desktop/src-tauri/src/lib.rs` |
| React SPA | `src/App.tsx`, `src/main.tsx` |
| Vault kernel | `crates/vault/src/lib.rs` |
| Indexer / search / graph | `crates/indexer/src/lib.rs` |
| IPC protocol definitions | `crates/ipc/src/lib.rs` |
| Daemon IPC | `crates/daemon/src/lib.rs` |
| Process launch sandbox | `crates/system-bridge/src/process.rs` |
| Design tokens & theme | `src/index.css`, `src/styles/` |
| Design contract | [`DESIGN.zh-CN.md`](../DESIGN.zh-CN.md) |

## 目录图

```
apps/desktop/         → Tauri 2 桌面壳应用
crates/               → Rust workspace 引擎（vault, indexer, citation, canvas, IPC, daemon, CLI）
packages/             → TypeScript monorepo 包（@scriptor/core, editor, canvas, portal, mcp, renderer, export）
src/                  → 主 React workspace SPA、UI 组件、自定义 hooks、样式
scripts/validation/   → 自动 contract、governance、a11y 与源码验证
scripts/benchmarks/   → 延迟、内存和吞吐性能 benchmark
docs/                 → 架构规范、能力成熟度台账、验证文档
e2e/                  → Playwright E2E 与视觉回归规范
```

## 约定与质量底线

完整约定见 [`CONTRIBUTING.zh-CN.md`](../CONTRIBUTING.zh-CN.md) 和 [`AGENTS.md`](../AGENTS.md)。不可妥协的规则：

- **Local-first & Markdown 原生** — 磁盘上的 Markdown 文件是权威来源。
- **IPC contracts** — 每条 Rust IPC 命令映射到 TypeScript 接口；来自 `unknown` 的 runtime JSON 使用前必须验证。
- **进程 sandbox** — 外部进程必须通过 `crates/system-bridge/src/process.rs`，并根据 `process-launch-inventory.json` 验证。
- **UI & anti-slop** — 遵循 [`DESIGN.zh-CN.md`](../DESIGN.zh-CN.md)：不使用紫色/靛蓝 AI 渐变，仅使用系统字体，最低 WCAG 2.2 AA，触控目标 ≥ 44×44 px。
- **Rust 安全** — production 代码避免 `.unwrap()`；library 使用 `thiserror`，binary 使用 `anyhow`；每个 `unsafe` 块都有明确的 `// SAFETY:` 注释。

## 去哪里修改

| 任务 | 位置 |
|---|---|
| Vault 文件逻辑 | `crates/vault/src/` |
| Indexer / graph search | `crates/indexer/src/` |
| IPC 方法 | `crates/ipc/src/` & `tsconfig.contracts.json` |
| Editor 组件 | `packages/editor/src/` |
| Canvas workspace | `packages/canvas/src/` & `crates/canvas-engine/` |
| Theme / styling | `src/index.css` & `src/styles/` |
| E2E / visual test | `e2e/` & `playwright.e2e.config.ts` |
| Performance benchmark | `scripts/benchmarks/` & `perf-baselines.json` |
