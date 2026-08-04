# Scriptor Screenshots

Screenshots for documentation and marketing. Generated with Playwright in E2E mode.

## Available Screenshots

| Screenshot | Description | Size | Used in |
|---|---|---|---|
| workspace-light.png | Historical light workspace baseline | 194 KB | Baseline comparison only |
| workspace-dark.png | Historical dark workspace baseline | 192 KB | Baseline comparison only |
| editor-preview.png | Historical split editor/preview baseline | 194 KB | Baseline comparison only |
| command-palette.png | Historical command palette baseline | 213 KB | Baseline comparison only |
| graph.png | Historical graph baseline | 193 KB | Baseline comparison only |
| canvas.png | Spatial canvas board for visual note arrangement | 37 KB | — |
| git-panel.png | Version control status, commit, pull/push | 192 KB | — |
| mcp-panel.png | Historical MCP panel baseline | 269 KB | Baseline comparison only |
| settings.png | Runtime config, vault config, appearance, diagnostics | 37 KB | — |
| publish-center.png | Historical publish-center baseline | 216 KB | Baseline comparison only |
| vault-health.png | Vault health dashboard with lint and health scores | 228 KB | — |
| knowledge-workbench.png | 5-tab knowledge hub (inbox, tags, orphans, backlinks, recent) | 217 KB | — |
| conflict-resolver.png | 3-way merge UI with hunk-level ours/theirs selection | 192 KB | — |
| note-history.png | Revision timeline with restore capability | 204 KB | — |
| keyboard-shortcuts.png | Keyboard shortcut editor (settings section) | 37 KB | — |
| workspace-mobile.png | Workspace at 820px responsive breakpoint with bottom dock | 123 KB | — |
| onboarding-tour.png | First-run product tour experience | 205 KB | — |
| plugins.png | Plugin marketplace discovery and management | 204 KB | — |

### Freshness and acceptance

Checked-in PNGs are documentation assets and historical visual baselines. They are not proof
that the current source renders correctly. Lazy-panel loading, topbar overflow, compact layouts,
modal focus, and console/network cleanliness are asserted by the Playwright source suite and must
be rerun from the frozen release candidate. Any stale snapshot is replaced only after a reviewer
inspects the diff; visual failures are never hidden by raising the global tolerance.

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

After UI changes that affect layout or copy, regenerate and commit the updated PNGs. Record the
browser/channel, OS, source commit, viewport, and result in the release PR. See
[`../../validation/FRONTEND_QUALITY.md`](../../validation/FRONTEND_QUALITY.md).
