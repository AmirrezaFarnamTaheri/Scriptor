# Scriptor Screenshots

Screenshots for documentation and marketing. Generated with Playwright in E2E mode.

## Available Screenshots

| Screenshot | Description | Used in |
|---|---|---|
| workspace-light.png | Reviewed light workspace capture | README / docs |
| workspace-dark.png | Reviewed dark workspace capture | Docs + stable visual coverage |
| workspace-tablet.png | 1024px workspace breakpoint capture | VISUAL-REVIEW |
| workspace-mobile.png | 820px responsive workspace capture | VISUAL-REVIEW |
| editor-preview.png | Reviewed split editor/preview capture | Docs + stable visual coverage |
| inspector-preview.png | Inspector preview mode with editor/preview controls | VISUAL-REVIEW |
| command-palette.png | Reviewed command palette capture | Docs + stable visual coverage |
| graph.png | Reviewed graph capture | Docs + stable visual coverage |
| canvas.png | Spatial canvas board for visual note arrangement | VISUAL-REVIEW, STORE-MIGRATION, CAPABILITIES |
| git-panel.png | Version control status, commit, pull/push | VISUAL-REVIEW, STORE-MIGRATION |
| mcp-panel.png | Reviewed MCP panel capture | Docs + stable visual coverage |
| settings.png | Runtime config, vault config, appearance, diagnostics | VISUAL-REVIEW, STORE-MIGRATION |
| publish-center.png | Reviewed publish-center capture | Docs + stable visual coverage |
| vault-health.png | Vault health dashboard with lint and health scores | VISUAL-REVIEW, RELEASE-CHECKLIST |
| knowledge-workbench.png | Knowledge workbench | VISUAL-REVIEW |
| conflict-resolver.png | 3-way merge UI with hunk-level ours/theirs selection | VISUAL-REVIEW, STORE-MIGRATION |
| note-history.png | Revision timeline with restore capability | VISUAL-REVIEW |
| keyboard-shortcuts.png | Keyboard shortcut editor | VISUAL-REVIEW |
| onboarding-tour.png | First-run product tour experience | VISUAL-REVIEW |
| plugins.png | Plugin marketplace discovery and management | VISUAL-REVIEW, STORE-MIGRATION, CAPABILITIES |
| editor-recovery.png | Editor recovery fallback state | VISUAL-REVIEW, RELEASE-CHECKLIST |
| mcp-sharing-inventory.png | MCP sharing and resource inventory view | VISUAL-REVIEW |
| toolbar-typography.png | Typography toolbar popover | VISUAL-REVIEW |
| toolbar-insert.png | Insert toolbar popover | VISUAL-REVIEW |
| mobile-inspector.png | 390px mobile inspector pane | VISUAL-REVIEW |
| mobile-vault.png | 390px mobile vault pane | VISUAL-REVIEW |

### Freshness and acceptance

Documentation PNGs are **fresh captures from the current source**, not copies of the stored
Playwright comparison baselines. The screenshot tests first capture the settled page directly into
`docs/assets/screenshots/`, then independently run `toHaveScreenshot` against the stable Windows
baselines in `e2e/screenshots.spec.ts-snapshots/`.

That separation is intentional. A stored baseline can still be accepted when a current render differs
within the configured visual tolerance; copying the baseline back over the fresh documentation image
would therefore make the docs stale even though the visual regression suite passes.

The stable Windows baselines remain the visual-regression acceptance surface. Intentional pixel
changes must be reviewed and refreshed explicitly with `--update-snapshots=all`; visual failures are
never hidden by raising the global tolerance.

Responsive and state-review documentation captures (`workspace-mobile`, `workspace-tablet`, mobile
vault/inspector, editor recovery, MCP sharing inventory, and toolbar popovers) are generated from live
test output and are not promoted to stable pixel baselines unless the test explicitly uses
`toHaveScreenshot`.

## Regeneration

Screenshots are captured via Playwright in E2E mode. The mock IPC bridge provides fixture data so no
real vault or Tauri binary is needed. Capture waits for fonts, visible images, lazy panels, finite
transitions, and non-degraded preview state before writing documentation pixels.

For a normal local documentation capture:

```powershell
pnpm screenshots:capture:web
```

For an intentional visual refresh on the pinned Windows environment:

```powershell
./scripts/screenshots/capture.ps1 -SkipDesktopBuild -UpdateBaselines
```

`-UpdateBaselines` regenerates all stable Windows snapshots with
`--update-snapshots=all`, refreshes the docs-only state-review screenshots from fresh Playwright test
output, and keeps the documentation captures written by `screenshots.spec.ts`. It does **not** copy
stored baseline PNGs over the docs directory.

The repository also provides the manual **Refresh documentation screenshots** workflow. Run it on a
review branch, not `main`. It uses the pinned `windows-2025` runner and Edge channel, runs the capture
contract tests, regenerates docs and stable Windows baselines, verifies the complete visual suite
without snapshot updates, and commits only the generated PNG changes back to the selected branch.

### Build in E2E mode

```powershell
pnpm exec vite build --mode e2e
```

Vite loads `.env.e2e` for this mode; do not export `VITE_E2E_MODE` into the parent shell. E2E builds
use an isolated output directory in the Playwright configs. Production bundle validation rejects
test-only fault-injection markers if an E2E environment leaks into release assets.

### Run Playwright screenshot tests

```powershell
$env:VITE_SCREENSHOT_MODE = 'true'
$env:SCRIPTOR_CAPTURE_SCREENSHOTS = 'true'
pnpm exec playwright test --config playwright.e2e.config.ts e2e/screenshots.spec.ts --workers=1
```

### Override browser channel

```powershell
$env:PLAYWRIGHT_CHANNEL = 'chrome'
```

## Architecture

The screenshot pipeline uses the same E2E mock IPC bridge as the functional tests:

- **`playwright.e2e.config.ts`** — Playwright config for E2E tests and documentation capture
- **`playwright.visual.config.ts`** — stable visual regression and state-review verification
- **`e2e/screenshots.spec.ts`** — stable screenshot scenarios; writes fresh docs captures and validates baselines
- **`e2e/visual-review.spec.ts`** — responsive and state-review evidence
- **`scripts/screenshots/capture.ps1`** — deterministic capture/orchestration contract
- **`scripts/validation/screenshot-capture-contracts.test.mjs`** — regression guard against stale baseline overwrite
- **`src/e2e/bootstrap.ts`** — mock IPC bridge providing fake vault, Git, indexer, and export data
- **`src/e2e/state.ts`** — in-memory note state for the mock vault
- **`src/screenshot/fixture.ts`** — fixture data (vault, scan, graph, health diagnostics)

After UI changes that affect layout or copy, regenerate and review the updated PNGs. Record the
browser/channel, OS, source commit, viewport, and result in the release PR. See
[`../../validation/FRONTEND_QUALITY.md`](../../validation/FRONTEND_QUALITY.md).
