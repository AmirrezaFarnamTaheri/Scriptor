# Onboarding: Scriptor contributors

> **Audience:** first-time contributors, maintainers, and code auditors. New users
> should start at [`README.md`](../README.md) and
> [`docs/guides/GETTING_STARTED.md`](guides/GETTING_STARTED.md).
>
> For agent rules read first, see [`AGENTS.md`](../AGENTS.md). For the contributor
> workflow, PRs, and required checks, see [`CONTRIBUTING.md`](../CONTRIBUTING.md).

## Tech stack

| Layer | Technology | Source of truth |
|---|---|---|
| **Desktop shell** | Tauri 2 (Rust) | `apps/desktop/src-tauri/` |
| **Core engines** | Rust workspace crates (1.96.0, 2024 Edition) | `crates/`, `rust-toolchain.toml` |
| **Frontend** | React 19, Vite 8, TypeScript 6, Lucide React | `package.json` |
| **Package manager** | pnpm 10.33.0 | `package.json` (`packageManager`) |
| **Styling** | Semantic OKLCH + CSS custom properties; no Tailwind, no remote fonts | `src/index.css`, `src/styles/` |
| **IPC protocol** | Rust `ts-rs` → TypeScript contracts | `crates/ipc/src/lib.rs` → `tsconfig.contracts.json` |
| **Testing** | Cargo test, Playwright E2E + visual, axe-core a11y | `playwright.e2e.config.ts`, `playwright.visual.config.ts` |

For install commands, see the **Build from source** section in [`README.md`](../README.md).
For the full required-checks list, see [`CONTRIBUTING.md`](../CONTRIBUTING.md).
> Local quick gates: `pnpm test:source` (contract + governance suite), `pnpm check:changelog` (release-notes guard), `pnpm test:rust` (CI-aligned Rust gate; excludes scriptor-desktop and the incubating engines), `pnpm check:i18n` (locale parity).

## Architecture at a glance

The runtime topology, trust boundaries, and crate ownership are documented in
[`docs/ARCHITECTURE.md`](ARCHITECTURE.md). The current overview:

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

The renderer is not an authority boundary. Native operations validate scope,
authorization, runtime payloads, paths, process policy, and cancellation
independently of UI state.

## Key entry points

| Component | Entry point |
|---|---|
| Desktop shell | `apps/desktop/src-tauri/src/lib.rs` |
| React SPA | `src/App.tsx`, `src/main.tsx` |
| Vault kernel | `crates/vault/src/lib.rs` |
| Indexer / search / graph | `crates/indexer/src/lib.rs` |
| IPC protocol definitions | `crates/ipc/src/lib.rs` |
| Daemon IPC | `crates/daemon/src/lib.rs` |
| Process launch sandbox | `crates/system-bridge/src/process.rs` |
| Design tokens & theme | `src/index.css`, `src/styles/` |
| Design contract | [`DESIGN.md`](../DESIGN.md) |

## Directory map

```
apps/desktop/         → Tauri 2 desktop shell application
crates/               → Rust workspace engines (vault, indexer, citation, canvas, IPC, daemon, CLI)
packages/             → TypeScript monorepo packages (@scriptor/core, editor, canvas, portal, mcp, renderer, export)
src/                  → Main React workspace SPA, UI components, custom hooks, styles
scripts/validation/   → Automated contract, governance, a11y, and source verification scripts
scripts/benchmarks/   → Latency, memory, and throughput performance benchmark scripts
docs/                 → Architectural specifications, capability maturity ledger, verification docs
e2e/                  → Playwright E2E and visual regression specifications
```

## Conventions & quality floor

The full list of contributor conventions lives in [`CONTRIBUTING.md`](../CONTRIBUTING.md)
and [`AGENTS.md`](../AGENTS.md). The non-negotiable items:

- **Local-first & Markdown native** — Markdown files on disk are the source of truth.
- **IPC contracts** — every Rust IPC command maps to a TypeScript interface; runtime JSON from `unknown` is validated before use.
- **Process sandbox** — external process execution must go through `crates/system-bridge/src/process.rs` and be validated against `process-launch-inventory.json`.
- **UI & anti-slop** — follow [`DESIGN.md`](../DESIGN.md) (no purple/indigo AI gradients, system fonts only, WCAG 2.2 AA floor, touch targets ≥ 44×44 px).
- **Rust safety** — production code avoids `.unwrap()`; `thiserror` in libraries vs. `anyhow` in binaries; every `unsafe` block has an explicit `// SAFETY:` comment.

## Where to look

| Task | Location |
|---|---|
| Modify vault file logic | `crates/vault/src/` |
| Modify indexer or graph search | `crates/indexer/src/` |
| Add or update IPC methods | `crates/ipc/src/` & `tsconfig.contracts.json` |
| Update editor component | `packages/editor/src/` |
| Update canvas workspace | `packages/canvas/src/` & `crates/canvas-engine/` |
| Update theme or styling | `src/index.css` & `src/styles/` |
| Add end-to-end / visual test | `e2e/` & `playwright.e2e.config.ts` |
| Add performance benchmark | `scripts/benchmarks/` & `perf-baselines.json` |
