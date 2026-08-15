# Onboarding Guide: Scriptor

## Overview
**Scriptor** is a local-first Markdown knowledge workspace for serious writing and research. It combines a Tauri 2 desktop shell, a Rust vault/indexing kernel (`crates/vault`, `crates/indexer`), a React 19 workspace, Git-aware editing, citation management, canvas tools, graph navigation, and permissioned automation while keeping Markdown files portable on disk.

## Tech Stack

| Layer | Technology | Version / Spec |
|---|---|---|
| **Desktop Shell** | Tauri 2 (Rust) | `apps/desktop/src-tauri` |
| **Core Engines** | Rust Workspace Crates | 1.96.0 (2024 Edition) |
| **Frontend Framework** | React 19, Vite 8, TypeScript 6 | pnpm `10.33.0` |
| **Styling System** | Semantic OKLCH & CSS custom properties | `src/index.css` & `src/styles/` |
| **Icons & UI** | Lucide React, `UnifiedPanelShell` | No remote fonts / Tailwind |
| **IPC Protocol** | Rust `ts-rs` generated TS contracts | `crates/ipc` $\rightarrow$ `tsconfig.contracts.json` |
| **Testing** | Cargo Test, Playwright E2E & Visual, axe-core a11y | `playwright.e2e.config.ts`, `playwright.visual.config.ts` |

## Architecture & Data Flow

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Tauri 2 Desktop Shell                           │
│  (apps/desktop/src-tauri/src/lib.rs) <---> React Workspace (src/App.tsx)│
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ IPC (crates/ipc)
┌───────────────────────────────────▼────────────────────────────────────┐
│                         Rust Kernel Workspace                          │
│ ┌────────────────┐ ┌────────────────┐ ┌──────────────────────────────┐ │
│ │  crates/vault  │ │ crates/indexer │ │   crates/citation-engine     │ │
│ └────────────────┘ └────────────────┘ └──────────────────────────────┘ │
│ ┌────────────────┐ ┌────────────────┐ ┌──────────────────────────────┐ │
│ │ crates/daemon  │ │crates/system-b.│ │    crates/export-runner      │ │
│ └────────────────┘ └────────────────┘ └──────────────────────────────┘ │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Local Filesystem & Git
                                    ▼
                         Local Vault (.md files)
```

1. **User Action / Workspace Editing**: Triggered in `src/App.tsx` or modular frontend packages (`packages/editor`, `packages/canvas`, `packages/portal`).
2. **IPC Invocation**: Calls IPC endpoints validated against TS types generated from `crates/ipc/src/lib.rs`.
3. **Rust Engine Execution**: `crates/vault` manages local Markdown file IO, `crates/indexer` maintains SQLite/in-memory graph indices, `crates/native-git` performs atomic commits.
4. **Process & Security Sandbox**: Subprocesses are launched strictly through `crates/system-bridge/src/process.rs` and validated against `process-launch-inventory.json`.

## Key Entry Points

- **Desktop Shell Entry**: `apps/desktop/src-tauri/src/lib.rs`
- **React SPA Entry**: `src/App.tsx` & `src/main.tsx`
- **Vault Kernel Entry**: `crates/vault/src/lib.rs`
- **Index & Search Kernel Entry**: `crates/indexer/src/lib.rs`
- **IPC Protocol Definitions**: `crates/ipc/src/lib.rs`
- **Daemon IPC Entry**: `crates/daemon/src/lib.rs`
- **Process Launch Sandbox**: `crates/system-bridge/src/process.rs`
- **Design Tokens & Theme**: `src/index.css` & `src/styles/`
- **Canonical Design Contract**: `DESIGN.md`

## Directory Map

```
apps/desktop/         → Tauri 2 desktop shell application
crates/               → Rust workspace engines (vault, indexer, citation, canvas, IPC, daemon, CLI)
packages/             → TypeScript monorepo packages (@scriptor/core, editor, canvas, portal, mcp, renderer, export)
src/                  → Main React workspace SPA, UI components, custom hooks, styles
scripts/validation/   → Automated contract, governance, a11y, and source verification scripts
scripts/benchmarks/   → Latency, memory, and throughput performance benchmark scripts
docs/                 → Architectural specifications, capability maturity ledger, security threat models, verification docs
e2e/                  → Playwright E2E and visual regression specifications
```

## Conventions & Quality Floor

- **Local-First & Markdown Native**: Markdown files on disk remain the single source of truth.
- **IPC Contracts**: Every Rust IPC command maps to a TypeScript interface; runtime JSON is validated before use.
- **Process Sandbox**: External process execution must use `crates/system-bridge/src/process.rs`.
- **UI & Anti-Slop**: Follow [`DESIGN.md`](DESIGN.md) (no purple/indigo AI gradients, system fonts only, WCAG 2.2 AA floor, touch targets $\ge 44\times 44\text{px}$).
- **Rust Safety**: Production code must avoid `unwrap()`, use `thiserror` in libraries vs `anyhow` in binaries, and include explicit `// SAFETY:` comments for any `unsafe` block.

## Essential Verification Commands

```powershell
# Fast contract and governance checks
pnpm version:check
pnpm check:governance
pnpm check:contracts
pnpm check:source
pnpm check:frontend-quality

# Rust compiler, lints & tests
cargo fmt --all --check
cargo clippy --workspace --all-targets -- -D warnings
pnpm check:deny
pnpm test:rust

# Frontend linting, build & E2E/visual/a11y tests
pnpm lint
pnpm build
pnpm check:a11y
pnpm check:a11y-axe
pnpm test:e2e
pnpm test:visual

# Performance & Benchmarks
pnpm check:perf
pnpm bench:startup
pnpm bench:idle-memory
```

## Where to Look

| Task | Location |
|---|---|
| Modify Vault file logic | `crates/vault/src/` |
| Modify Indexer or Graph search | `crates/indexer/src/` |
| Add or update IPC methods | `crates/ipc/src/` & `tsconfig.contracts.json` |
| Update Editor component | `packages/editor/src/` |
| Update Canvas workspace | `packages/canvas/src/` & `crates/canvas-engine/` |
| Update Theme or Styling | `src/index.css` & `src/styles/` |
| Add end-to-end / visual test | `e2e/` & `playwright.e2e.config.ts` |
| Add performance benchmark | `scripts/benchmarks/` & `perf-baselines.json` |
