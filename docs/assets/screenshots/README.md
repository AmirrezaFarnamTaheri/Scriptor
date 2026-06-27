# Scriptor Screenshots

Screenshots for documentation and marketing. Regenerate with:

```bash
pnpm screenshots:capture
```

## Available Screenshots

| Screenshot | Description | Used in |
|---|---|---|
| workspace-light.png | Main workspace in light mode (editor + vault sidebar + inspector) | README.md |
| workspace-dark.png | Main workspace in dark mode | README.md |
| editor-preview.png | Split editor + Markdown preview side by side | README.md |
| command-palette.png | Ctrl+K command palette with search | README.md |
| graph.png | Force-directed knowledge graph with wikilink edges | README.md |
| canvas.png | Spatial canvas board for visual note arrangement | — |
| git-panel.png | Version control status, commit, pull/push | — |
| mcp-panel.png | MCP tools and automation recipes | README.md |
| settings.png | Runtime config, vault config, appearance, diagnostics | — |
| publish-center.png | Export profiles, dry-run preflight, Pandoc integration | README.md |
| vault-health.png | Vault health dashboard with lint and health scores | — |
| knowledge-workbench.png | 5-tab knowledge hub (inbox, tags, orphans, backlinks, recent) | — |
| conflict-resolver.png | 3-way merge UI with hunk-level ours/theirs selection | — |
| note-history.png | Revision timeline with restore capability | — |
| keyboard-shortcuts.png | Keyboard shortcut editor (settings section) | — |
| workspace-mobile.png | Workspace at 820px responsive breakpoint with bottom dock | — |
| onboarding-tour.png | First-run product tour experience | — |
| plugins.png | Plugin marketplace discovery and management | — |

## Regeneration

Screenshots are captured via Playwright in E2E mode. The mock IPC bridge
provides fixture data so no real vault or Tauri binary is needed.

### Full capture (build + test + copy)

```bash
pnpm screenshots:capture
```

### Capture from running dev server (skip build)

```bash
pnpm screenshots:capture:web
```

### Override browser channel

```bash
$env:PLAYWRIGHT_CHANNEL = 'chrome'
pnpm screenshots:capture:web
```

### Generate placeholder PNGs (no Playwright required)

```bash
node scripts/screenshots/generate-placeholders.mjs
```

## Architecture

The screenshot pipeline uses the same E2E mock IPC bridge as the functional tests:

- **`playwright.config.ts`** — Playwright config for screenshot capture (builds + serves)
- **`playwright.e2e.config.ts`** — Playwright config for E2E tests against running dev server
- **`e2e/screenshots.spec.ts`** — Test spec that navigates each surface and captures screenshots
- **`src/e2e/bootstrap.ts`** — Mock IPC bridge providing fake vault, git, indexer, and export data
- **`src/e2e/state.ts`** — In-memory note state for the mock vault
- **`scripts/screenshots/generate-placeholders.mjs`** — Generates placeholder PNGs without Playwright

After UI changes that affect layout or copy, regenerate and commit the updated PNGs.
