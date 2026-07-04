# Scriptor Screenshots

Screenshots for documentation and marketing. Generated with Playwright in E2E mode.

## Available Screenshots

| Screenshot | Description | Size | Used in |
|---|---|---|---|
| workspace-light.png | Main workspace in light mode (editor + vault sidebar + inspector) | 194 KB | README.md |
| workspace-dark.png | Main workspace in dark mode | 192 KB | README.md |
| editor-preview.png | Split editor + Markdown preview side by side | 194 KB | README.md |
| command-palette.png | Ctrl+K command palette with search | 213 KB | README.md |
| graph.png | Force-directed knowledge graph with wikilink edges | 193 KB | README.md |
| canvas.png | Spatial canvas board for visual note arrangement | 37 KB | — |
| git-panel.png | Version control status, commit, pull/push | 192 KB | — |
| mcp-panel.png | MCP tools and automation recipes | 269 KB | README.md |
| settings.png | Runtime config, vault config, appearance, diagnostics | 37 KB | — |
| publish-center.png | Export profiles, dry-run preflight, Pandoc integration | 216 KB | README.md |
| vault-health.png | Vault health dashboard with lint and health scores | 228 KB | — |
| knowledge-workbench.png | 5-tab knowledge hub (inbox, tags, orphans, backlinks, recent) | 217 KB | — |
| conflict-resolver.png | 3-way merge UI with hunk-level ours/theirs selection | 192 KB | — |
| note-history.png | Revision timeline with restore capability | 204 KB | — |
| keyboard-shortcuts.png | Keyboard shortcut editor (settings section) | 37 KB | — |
| workspace-mobile.png | Workspace at 820px responsive breakpoint with bottom dock | 123 KB | — |
| onboarding-tour.png | First-run product tour experience | 205 KB | — |
| plugins.png | Plugin marketplace discovery and management | 204 KB | — |

### Known Issues

The following screenshots show the workspace without their intended dialog overlay due to
lazy-loaded panel components crashing during E2E render (`Cannot read properties of null`):

- **canvas.png** — Canvas panel fails to render in E2E mode
- **settings.png** — Settings panel crashes during lazy load in E2E mode
- **keyboard-shortcuts.png** — Same root cause as settings (settings panel contains shortcuts tab)

The topbar overflows at 1440px viewport width, pushing Canvas, Settings, and other buttons
off-screen (x > 1440px). These buttons are unreachable without scrolling the topbar.

## Regeneration

Screenshots are captured via Playwright in E2E mode. The mock IPC bridge
provides fixture data so no real vault or Tauri binary is needed.

### Build in E2E mode

```powershell
$env:VITE_E2E_MODE = 'true'
pnpm build --mode e2e
```

### Start preview server

```powershell
pnpm vite preview --host 127.0.0.1 --port 4184 --strictPort
```

### Run Playwright screenshot tests

```powershell
npx playwright test --config playwright.e2e.config.ts e2e/screenshots.spec.ts --update-snapshots
```

### Copy snapshots to docs

```powershell
Copy-Item "e2e/screenshots.spec.ts-snapshots/*.png" "docs/assets/screenshots/" -Force
```

### Override browser channel

```powershell
$env:PLAYWRIGHT_CHANNEL = 'chrome'
```

## Architecture

The screenshot pipeline uses the same E2E mock IPC bridge as the functional tests:

- **`playwright.e2e.config.ts`** — Playwright config for E2E tests and screenshot capture
- **`e2e/screenshots.spec.ts`** — Test spec that navigates each surface and captures screenshots
- **`src/e2e/bootstrap.ts`** — Mock IPC bridge providing fake vault, git, indexer, and export data
- **`src/e2e/state.ts`** — In-memory note state for the mock vault
- **`src/screenshot/fixture.ts`** — Fixture data (vault, scan, graph, health diagnostics)

After UI changes that affect layout or copy, regenerate and commit the updated PNGs.
