# Scriptor Capabilities

Shipped product surfaces and release validation for **v0.1.0**.

## What you can do

| Category | Features |
|----------|----------|
| **Write** | CodeMirror (default) and optional Monaco editors; source, split, and preview modes; format toolbar; snippets; distraction-free mode; keyboard shortcut editor |
| **Organize** | Vault tree with virtualized list; inbox; daily notes; note types; templates; saved views |
| **Connect** | Wikilinks, backlinks, knowledge graph with keyboard navigation, knowledge workbench, unresolved link repair |
| **Cite** | Bibliography files, CSL styles, inline `[@key]` citations, reference preview |
| **Publish** | Pandoc export profiles (HTML, PDF, DOCX, LaTeX, ePub, Reveal.js); publish center; background textbundle export |
| **Automate** | Git integration with 3-way conflict resolver; MCP 15 tools with audit JSONL; plugin marketplace and safe mode; headless daemon with tracing spans |
| **Visualize** | Canvas boards (lazy-loaded) with resvg worker offload; portal quick capture |
| **Operate** | Command palette; workspace modes; vault health dashboard; terminal UI; scheduled vault snapshots |
| **Spellcheck** | Multi-locale Hunspell (11 languages); LanguageTool self-host default for grammar/style |

## Included in v0.1

| Area | Reference |
|------|-----------|
| Desktop shell (Tauri 2) | `apps/desktop/` |
| Vault kernel + indexer | `crates/vault`, `crates/indexer` |
| Headless daemon IPC | [`architecture/IPC_DAEMON.md`](./architecture/IPC_DAEMON.md) |
| Terminal UI | [`architecture/TUI_PARITY.md`](./architecture/TUI_PARITY.md) |
| Plugin system (safe mode + marketplace) | [`architecture/PLUGIN_SYSTEM.md`](./architecture/PLUGIN_SYSTEM.md) |
| Plugin author guide + hello-world | [`plugins/AUTHOR_GUIDE.md`](./plugins/AUTHOR_GUIDE.md) |
| MCP 15 tools with audit JSONL | `packages/mcp/` |
| Export (Pandoc) | `crates/export-runner`, `@scriptor/export` |
| Canvas engine (resvg worker offload) | `crates/canvas-engine`, `@scriptor/canvas` |
| Virtualized vault tree | `src/components/app/VirtualNoteList.tsx` |
| Design tokens (414 lines extracted) | `src/styles/tokens/components.css` |
| Visual regression tests | `playwright.visual.config.ts` |
| axe-core CI gate | `check:a11y-axe` in `check:release` |
| Documentation screenshots | `docs/assets/screenshots/` |
| Release packaging + optional Authenticode | `scripts/release/`, `.github/workflows/release.yml` |

## Headless engine

When **Settings → Headless engine** is enabled, indexing, search, backlinks, graph, Git status, health diagnostics, note save/rename, and export jobs route through the local daemon. Vault open, scan, and canvas stay in-process for responsiveness. See [`architecture/IPC_DAEMON.md`](./architecture/IPC_DAEMON.md).

## Release validation

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
| [`release/SIGNING.md`](./release/SIGNING.md) | Installer signing |
| [`../PRODUCT.md`](../PRODUCT.md) | Product principles |
| [`../CHANGELOG.md`](../CHANGELOG.md) | Release history |
