# Scriptor Capabilities

Shipped product surfaces and release validation for **v0.1.0**.

## What you can do

| Category | Features |
|----------|----------|
| **Write** | Monaco and CodeMirror editors; source, split, and preview modes; format toolbar; snippets; distraction-free mode |
| **Organize** | Vault tree with virtualized list; inbox; daily notes; note types; templates; saved views |
| **Connect** | Wikilinks, backlinks, knowledge graph, knowledge workbench, unresolved link repair |
| **Cite** | Bibliography files, CSL styles, inline `[@key]` citations, reference preview |
| **Publish** | Pandoc export profiles (HTML, PDF, DOCX, LaTeX, ePub, Reveal.js); publish center |
| **Automate** | Git integration; MCP read-only tools; plugin marketplace and safe mode; headless daemon |
| **Visualize** | Canvas boards (lazy-loaded); portal quick capture |
| **Operate** | Command palette; workspace modes; vault health dashboard; terminal UI |

## Included in v0.1

| Area | Reference |
|------|-----------|
| Desktop shell (Tauri 2) | `apps/desktop/` |
| Vault kernel + indexer | `crates/vault`, `crates/indexer` |
| Headless daemon IPC | [`architecture/IPC_DAEMON.md`](./architecture/IPC_DAEMON.md) |
| Terminal UI | [`architecture/TUI_PARITY.md`](./architecture/TUI_PARITY.md) |
| Plugin system (safe mode + marketplace) | [`architecture/PLUGIN_SYSTEM.md`](./architecture/PLUGIN_SYSTEM.md) |
| MCP read-only tools | `packages/mcp/` |
| Export (Pandoc) | `crates/export-runner`, `@scriptor/export` |
| Canvas engine | `crates/canvas-engine`, `@scriptor/canvas` |
| Virtualized vault tree | `src/components/app/VirtualNoteList.tsx` |
| Documentation screenshots | `docs/assets/screenshots/` |
| Release packaging + optional Authenticode | `scripts/release/`, `.github/workflows/release.yml` |

## Headless engine

When **Settings → Headless engine** is enabled, indexing, search, backlinks, graph, Git status, health diagnostics, note save/rename, and export jobs route through the local daemon. Vault open, scan, and canvas stay in-process for responsiveness. See [`architecture/IPC_DAEMON.md`](./architecture/IPC_DAEMON.md).

## Release validation

```powershell
pnpm check:release   # Full local release gate
pnpm check:daemon    # IPC smoke
pnpm check:tui       # Terminal UI smoke
pnpm check:a11y      # Static accessibility checks
pnpm check:plugins   # Plugin manifest + marketplace catalog
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
