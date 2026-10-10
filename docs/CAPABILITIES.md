# Scriptor Capabilities

**English** · [فارسی](CAPABILITIES.fa.md) · [简体中文](CAPABILITIES.zh-CN.md) · [Русский](CAPABILITIES.ru.md) · [Deutsch](CAPABILITIES.de.md) · [Español](CAPABILITIES.es.md)

Visual references for capability-gated surfaces are maintained in the [visual review gallery](./VISUAL-REVIEW.md) and the [canonical screenshot inventory](assets/screenshots/README.md), including [Graph](assets/screenshots/graph.png), [Canvas](assets/screenshots/canvas.png), [MCP](assets/screenshots/mcp-panel.png), and [Plugins](assets/screenshots/plugins.png). Screenshots illustrate UI state only; native authorization and vault state remain authoritative.

Scriptor combines local Markdown files with editing, research, publishing and
permissioned automation. This map points to the relevant guides and ownership
boundaries. The [capability ledger](CAPABILITY-MATURITY.md) records whether each
surface is shipped, experimental or design-only; a visible control alone does
not establish production support.

## Core surfaces

| Area | Reference |
|------|-----------|
| Desktop shell (Tauri 2) | `apps/desktop/` |
| Vault kernel + indexer | `crates/vault`, `crates/indexer` |
| Headless daemon IPC | [`architecture/IPC_DAEMON.md`](./architecture/IPC_DAEMON.md) |
| Terminal UI | [`architecture/TUI_PARITY.md`](./architecture/TUI_PARITY.md) |
| Plugin system, safe mode and first-party catalog | [`architecture/PLUGIN_SYSTEM.md`](./architecture/PLUGIN_SYSTEM.md) |
| Plugin author guide + hello-world | [`plugins/AUTHOR_GUIDE.md`](./plugins/AUTHOR_GUIDE.md) |
| MCP 22 tools with reviewed drafts | `packages/mcp/`; durable mutation audit: `crates/vault/src/mcp_audit.rs`, `crates/daemon/src/automation_stdio.rs` |
| Export (Pandoc) | `crates/export-runner`, `@scriptor/export` |
| Canvas engine (resvg worker offload) | `crates/canvas-engine`, `@scriptor/canvas` |
| Virtualized vault tree | `src/components/app/VirtualNoteList.tsx` |
| Design tokens | `src/styles/tokens/components.css` |
| Visual regression tests | `playwright.visual.config.ts` |
| axe-core CI gate | `check:a11y-axe` in `check:release` |
| Documentation screenshots | `docs/assets/screenshots/` |
| Release packaging + unsigned trust evidence | `scripts/release/`, `.github/workflows/release.yml` |

## Experimental workflows

| Workflow | Behavior and reference |
|---|---|
| Standalone source files | Text-format editing and guarded saves for LaTeX, code and related source files; execution and compilation are explicit. See the [capability ledger](CAPABILITY-MATURITY.md). |
| Google integrations | Independent account connections, reviewed Drive/Docs Markdown revisions, Calendar/Tasks planning and opt-in Gmail. See the [setup and workflow guide](guides/GOOGLE_INTEGRATIONS.md). |
| Overleaf exchange | Reviewed source-file exchange through its fixed-host Git transport. See [architecture](ARCHITECTURE.md). |
| Runtime sessions and semantic inspection | Permissioned code execution and provider-dependent embedding inspection. Native, provider and packaged-client evidence remain separate gates in the [verification record](VERIFICATION.md). |
| Workspace composition | Main and side leaves, movable panels and customizable shortcuts; hidden shortcuts remain recoverable from the command palette. See [getting started](guides/GETTING_STARTED.md). |

## Headless engine

When **Settings → Headless engine** is enabled, indexing, search, backlinks, graph, Git status, health diagnostics, note save/rename, and export jobs route through the local daemon. Vault open, scan, and canvas stay in-process for responsiveness. See [`architecture/IPC_DAEMON.md`](./architecture/IPC_DAEMON.md).

## Verification

Validation procedures belong in [CONTRIBUTING.md](../CONTRIBUTING.md); current
results and open gates belong in [VERIFICATION.md](VERIFICATION.md). Browser
fixtures establish application behavior and layout under controlled data.
They do not establish live provider access, installed-client behavior or release
readiness. Hosted workflows preserve their source commit and diagnostic artifacts.

```powershell
pnpm check:release   # Full local release gate (includes axe-core CI gate)
pnpm check:daemon    # IPC smoke
pnpm check:tui       # Terminal UI smoke
pnpm check:a11y      # Static accessibility checks
pnpm check:a11y-axe  # axe-core WCAG 2a/2aa/2.1aa automated audit
pnpm check:plugins   # Plugin manifest + marketplace catalog
pnpm check:mcp       # MCP tool manifest validation
pnpm check:contracts # TypeScript contract packages
pnpm check:canvas    # Canvas engine contracts
pnpm check:editor    # Editor engine contracts
pnpm check:renderer  # Renderer contracts
pnpm check:export    # Export pipeline contracts
pnpm check:knowledge # Knowledge graph contracts
pnpm check:citations # Citation engine contracts
pnpm check:headless  # Headless runner contracts
pnpm check:perf      # Performance baseline check
pnpm test:rust       # Rust unit and integration tests
pnpm test:visual     # Visual regression Playwright tests
pnpm test:e2e        # Playwright end-to-end tests
```

CI mirrors these in [`.github/workflows/ci.yml`](../.github/workflows/ci.yml).

## Related documents

| Document | Purpose |
|----------|---------|
| [`guides/GETTING_STARTED.md`](./guides/GETTING_STARTED.md) | First-run guide |
| [`release/PANDOC_STRATEGY.md`](./release/PANDOC_STRATEGY.md) | Export prerequisites |
| [`release/SIGNING.md`](./release/SIGNING.md) | Installer trust and signing policy |
| [`../PRODUCT.md`](../PRODUCT.md) | Product principles |
| [`../CHANGELOG.md`](../CHANGELOG.md) | Release history |
