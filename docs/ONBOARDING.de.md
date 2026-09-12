[English](ONBOARDING.md) · [فارسی](ONBOARDING.fa.md) · [简体中文](ONBOARDING.zh-CN.md) · [Русский](ONBOARDING.ru.md) · **Deutsch** · [Español](ONBOARDING.es.md)

# Onboarding für Scriptor-Mitwirkende

> **Zielgruppe:** neue Mitwirkende, Maintainer und Code-Auditoren. Neue Benutzer sollten bei [`README.md`](../README.md) und [`docs/guides/GETTING_STARTED.de.md`](guides/GETTING_STARTED.de.md) beginnen.
>
> Agent-Regeln stehen zuerst in [`AGENTS.md`](../AGENTS.md). Workflow, Pull Requests und Pflichtprüfungen für Beiträge beschreibt [`CONTRIBUTING.de.md`](../CONTRIBUTING.de.md).

## Technologie-Stack

| Ebene | Technologie | Maßgebliche Quelle |
|---|---|---|
| **Desktop-Shell** | Tauri 2 (Rust) | `apps/desktop/src-tauri/` |
| **Kern-Engines** | Rust-Workspace-Crates (1.96.0, Edition 2024) | `crates/`, `rust-toolchain.toml` |
| **Frontend** | React 19, Vite 8, TypeScript 6, Lucide React | `package.json` |
| **Paketmanager** | pnpm 10.33.0 | `package.json` (`packageManager`) |
| **Styling** | Semantisches OKLCH + CSS Custom Properties; kein Tailwind, keine Remote-Fonts | `src/index.css`, `src/styles/` |
| **IPC-Protokoll** | Rust `ts-rs` → TypeScript-Verträge | `crates/ipc/src/lib.rs` → `tsconfig.contracts.json` |
| **Tests** | Cargo test, Playwright E2E + visuell, axe-core a11y | `playwright.e2e.config.ts`, `playwright.visual.config.ts` |

Installationsbefehle stehen im Abschnitt **Build from source** in [`README.de.md`](../README.de.md). Die vollständige Liste der Pflichtprüfungen steht in [`CONTRIBUTING.de.md`](../CONTRIBUTING.de.md).

> Schnelle lokale Gates: `pnpm test:source` (Contract- und Governance-Suite), `pnpm check:changelog` (Release-Notes-Guard), `pnpm test:rust` (CI-ausgerichtetes Rust-Gate; ohne scriptor-desktop und die inkubierenden Engines), `pnpm check:i18n` (Locale-Parität).

## Architektur auf einen Blick

Runtime-Topologie, Vertrauensgrenzen und Crate-Eigentum sind in [`docs/ARCHITECTURE.de.md`](ARCHITECTURE.de.md) dokumentiert. Überblick:

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

Der Renderer ist keine Autoritätsgrenze. Native Operationen validieren Scope, Autorisierung, Runtime-Payloads, Pfade, Prozessrichtlinien und Abbruch unabhängig vom UI-Zustand.

## Wichtige Einstiegspunkte

| Komponente | Einstiegspunkt |
|---|---|
| Desktop-Shell | `apps/desktop/src-tauri/src/lib.rs` |
| React SPA | `src/App.tsx`, `src/main.tsx` |
| Vault-Kernel | `crates/vault/src/lib.rs` |
| Indexer / Suche / Graph | `crates/indexer/src/lib.rs` |
| IPC-Protokolldefinitionen | `crates/ipc/src/lib.rs` |
| Daemon-IPC | `crates/daemon/src/lib.rs` |
| Sandbox für Prozessstarts | `crates/system-bridge/src/process.rs` |
| Design-Tokens & Theme | `src/index.css`, `src/styles/` |
| Design-Vertrag | [`DESIGN.de.md`](../DESIGN.de.md) |

## Verzeichnisübersicht

```
apps/desktop/         → Tauri-2-Desktop-Shell
crates/               → Rust-Workspace-Engines (vault, indexer, citation, canvas, IPC, daemon, CLI)
packages/             → TypeScript-Monorepo-Pakete (@scriptor/core, editor, canvas, portal, mcp, renderer, export)
src/                  → Haupt-React-SPA, UI-Komponenten, Hooks, Styles
scripts/validation/   → Automatisierte Contract-, Governance-, A11y- und Source-Prüfungen
scripts/benchmarks/   → Performance-Benchmarks für Latenz, Speicher und Durchsatz
docs/                 → Architekturspezifikationen, Capability-Maturity-Ledger, Verifikationsdokumente
e2e/                  → Playwright-E2E- und visuelle Regressionstests
```

## Konventionen und Qualitätsuntergrenze

Die vollständigen Konventionen stehen in [`CONTRIBUTING.de.md`](../CONTRIBUTING.de.md) und [`AGENTS.md`](../AGENTS.md). Unverhandelbar sind:

- **Local-first & Markdown-nativ** — Markdown-Dateien auf dem Datenträger sind maßgeblich.
- **IPC-Verträge** — jeder Rust-IPC-Befehl besitzt eine TypeScript-Schnittstelle; Runtime-JSON aus `unknown` wird vor Nutzung validiert.
- **Prozess-Sandbox** — externe Prozesse müssen über `crates/system-bridge/src/process.rs` laufen und gegen `process-launch-inventory.json` validiert werden.
- **UI & Anti-Slop** — [`DESIGN.de.md`](../DESIGN.de.md) befolgen: keine violett/indigo AI-Gradienten, nur Systemfonts, mindestens WCAG 2.2 AA, Touch-Ziele ≥ 44×44 px.
- **Rust-Sicherheit** — Produktionscode vermeidet `.unwrap()`; `thiserror` in Libraries, `anyhow` in Binaries; jeder `unsafe`-Block hat einen ausdrücklichen `// SAFETY:`-Kommentar.

## Wo Änderungen hingehören

| Aufgabe | Ort |
|---|---|
| Vault-Dateilogik | `crates/vault/src/` |
| Indexer oder Graph-Suche | `crates/indexer/src/` |
| IPC-Methoden | `crates/ipc/src/` & `tsconfig.contracts.json` |
| Editor-Komponente | `packages/editor/src/` |
| Canvas-Workspace | `packages/canvas/src/` & `crates/canvas-engine/` |
| Theme oder Styling | `src/index.css` & `src/styles/` |
| E2E-/Visual-Test | `e2e/` & `playwright.e2e.config.ts` |
| Performance-Benchmark | `scripts/benchmarks/` & `perf-baselines.json` |
