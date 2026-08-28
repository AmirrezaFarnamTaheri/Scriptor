# Scriptor Screenshots

Screenshots for documentation and marketing. Generated with Playwright in E2E mode.

## Available Screenshots

| Screenshot | Description | Size | Used in |
|---|---|---|---|
| workspace-light.png | Reviewed light workspace baseline | 130 KB | Docs + baseline mirror |
| workspace-dark.png | Reviewed dark workspace baseline | 59 KB | Docs + baseline mirror |
| workspace-tablet.png | 1024px workspace breakpoint capture | 139 KB | VISUAL-REVIEW |
| editor-preview.png | Reviewed split editor/preview baseline | 201 KB | Docs + baseline mirror |
| command-palette.png | Reviewed command palette baseline | 182 KB | Docs + baseline mirror |
| graph.png | Reviewed graph baseline | 96 KB | Docs + baseline mirror |
| canvas.png | Spatial canvas board for visual note arrangement | 100 KB | VISUAL-REVIEW, STORE-MIGRATION, CAPABILITIES |
| git-panel.png | Version control status, commit, pull/push | 103 KB | VISUAL-REVIEW, STORE-MIGRATION |
| mcp-panel.png | Reviewed MCP panel baseline | 246 KB | Docs + baseline mirror |
| settings.png | Runtime config, vault config, appearance, diagnostics | 130 KB | VISUAL-REVIEW, STORE-MIGRATION |
| publish-center.png | Reviewed publish-center baseline | 147 KB | Docs + baseline mirror |
| vault-health.png | Vault health dashboard with lint and health scores | 100 KB | VISUAL-REVIEW, RELEASE-CHECKLIST |
| knowledge-workbench.png | 5-tab knowledge hub (inbox, tags, orphans, backlinks, recent) | 140 KB | VISUAL-REVIEW |
| conflict-resolver.png | 3-way merge UI with hunk-level ours/theirs selection | 88 KB | VISUAL-REVIEW, STORE-MIGRATION |
| note-history.png | Revision timeline with restore capability | 134 KB | VISUAL-REVIEW |
| keyboard-shortcuts.png | Keyboard shortcut editor (settings section) | 119 KB | VISUAL-REVIEW |
| onboarding-tour.png | First-run product tour experience | 132 KB | VISUAL-REVIEW |
| plugins.png | Plugin marketplace discovery and management | 81 KB | VISUAL-REVIEW, STORE-MIGRATION, CAPABILITIES |
| inspector-preview.png | Inspector preview mode with editor/preview controls | 123 KB | VISUAL-REVIEW |
| editor-recovery.png | Editor recovery fallback state | 8 KB | VISUAL-REVIEW, RELEASE-CHECKLIST |
| mcp-sharing-inventory.png | MCP sharing and resource inventory view | 68 KB | VISUAL-REVIEW |
| toolbar-typography.png | Typography toolbar popover | 12 KB | VISUAL-REVIEW |
| toolbar-insert.png | Insert toolbar popover | 11 KB | VISUAL-REVIEW |
| mobile-inspector.png | 390px mobile inspector pane | 53 KB | VISUAL-REVIEW |
| mobile-vault.png | 390px mobile vault pane | 75 KB | VISUAL-REVIEW |

### Freshness and acceptance

Checked-in PNGs mirror reviewed Windows baselines used by the stable screenshot suite. They are
still not proof by themselves that the current source renders correctly. Lazy-panel loading, topbar overflow, compact layouts,
modal focus, and console/network cleanliness are asserted by the Playwright source suite and must
be rerun from the frozen release candidate. Any stale snapshot is replaced only after a reviewer
inspects the diff; visual failures are never hidden by raising the global tolerance.

## Regeneration

Screenshots are captured via Playwright in E2E mode. The mock IPC bridge
provides fixture data so no real vault or Tauri binary is needed.

### Build in E2E mode

```powershell
pnpm exec vite build --mode e2e
```

Vite loads `.env.e2e` for this mode; do not export `VITE_E2E_MODE` into the
parent shell. E2E builds use the shared `dist/` directory, so run `pnpm build`
before packaging the desktop application. Production bundle validation rejects
test-only fault-injection markers if an E2E environment leaks into release assets.

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
Get-ChildItem "e2e/screenshots.spec.ts-snapshots" -Filter *.png | ForEach-Object {
  $docName = $_.Name -replace '-(win32|linux|darwin)(?=\.png$)', ''
  Copy-Item $_.FullName (Join-Path "docs/assets/screenshots" $docName) -Force
}
```

`capture.ps1` performs this normalization automatically. The 820px responsive workspace is
captured as runtime visual evidence (`workspace-mobile.png`) rather than kept as a stale baseline.
State-review screenshots from `visual-review.spec.ts` are likewise uploaded with the Visual review
job and intentionally are not checked-in pixel baselines.

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
