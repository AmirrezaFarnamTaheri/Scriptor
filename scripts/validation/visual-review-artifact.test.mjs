import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const workflow = fs.readFileSync(path.join(root, '.github/workflows/visual-review.yml'), 'utf8')
const refreshWorkflow = fs.readFileSync(path.join(root, '.github/workflows/refresh-screenshots.yml'), 'utf8')
const packager = fs.readFileSync(path.join(root, 'scripts/ci/prepare-visual-review-package.ps1'), 'utf8')
const visualReview = fs.readFileSync(path.join(root, 'e2e/visual-review.spec.ts'), 'utf8')
const visualConfig = fs.readFileSync(path.join(root, 'playwright.visual.config.ts'), 'utf8')

test('visual review covers ready PR heads and protected-branch pushes', () => {
  assert.match(workflow, /pull_request:\s*\n\s*types: \[opened, synchronize, reopened, ready_for_review\]/)
  assert.match(workflow, /push:\s*\n\s*branches: \[main, master\]/)
  assert.match(workflow, /if: github\.event_name != 'pull_request' \|\| github\.event\.pull_request\.draft == false/)
})


test('visual review compares committed baselines without mutating them', () => {
  assert.match(workflow, /Compare against committed visual baselines/)
  assert.match(workflow, /--update-snapshots=none/)
  assert.match(workflow, /id:\s*visual_compare/)
  assert.doesNotMatch(workflow, /Refresh current visual baselines/)
  assert.doesNotMatch(workflow, /--update-snapshots=all/)
  assert.doesNotMatch(workflow, /id:\s*visual_refresh/)
})


test('PR visual review is read-only for tracked documentation screenshots', () => {
  assert.match(workflow, /SCRIPTOR_SCREENSHOT_OUTPUT_DIR: test-results\/visual\/documentation-screenshots/)
  assert.match(workflow, /git status --porcelain -- e2e\/screenshots\.spec\.ts-snapshots/)
  assert.doesNotMatch(
    workflow.split(/\n(?= {6}- name: )/)
      .find((entry) => entry.startsWith('      - name: Enforce visual review result and read-only baselines\n')) ?? '',
    /docs\/assets\/screenshots/,
  )
  assert.match(workflow, /VISUAL_COMPARE_OUTCOME/)
  assert.doesNotMatch(workflow, /VISUAL_REFRESH_OUTCOME|steps\.visual_refresh/)
})

test('explicit refresh remains the sole tracked-gallery writer', () => {
  assert.match(refreshWorkflow, /Regenerate current-source docs and stable Windows baselines/)
  assert.match(refreshWorkflow, /git add -- ':\(glob\)docs\/assets\/screenshots\/\*\.png'/)
  assert.match(refreshWorkflow, /-IncludeTrackedGallery/)
})

test('screenshot refresh creates its evidence directory before recording source identity', () => {
  const sourceIdentity = refreshWorkflow.split(/\n(?= {6}- name: )/)
    .find((entry) => entry.startsWith('      - name: Record screenshot source identity\n')) ?? ''
  assert.match(sourceIdentity, /New-Item -ItemType Directory -Force artifacts \| Out-Null/)
  assert.match(sourceIdentity, /Set-Content artifacts\/screenshot-source\.txt/)
  assert.ok(
    sourceIdentity.indexOf('New-Item -ItemType Directory -Force artifacts') <
      sourceIdentity.indexOf('Set-Content artifacts/screenshot-source.txt'),
    'artifacts directory must exist before source identity is written',
  )
})

test('visual artifact has one canonical images directory', () => {
  assert.match(workflow, /name:\s*visual-review\s*\n/)
  assert.match(workflow, /path:\s*artifacts\/visual-review-package/)
  assert.doesNotMatch(workflow, /path:\s*\|[\s\S]*test-results\/visual[\s\S]*e2e\/screenshots\.spec\.ts-snapshots/)
  assert.match(packager, /Join-Path \$packagePath 'images'/)
  assert.match(packager, /Add-VisualImages -SourceRoot 'test-results\/visual'/)
  assert.doesNotMatch(packager, /Add-VisualImages -SourceRoot 'e2e\/screenshots\.spec\.ts-snapshots'/)
  assert.doesNotMatch(packager, /e2e\/visual-review\.spec\.ts-snapshots/)
  assert.match(packager, /if \(\$IncludeTrackedGallery\)/)
  assert.match(packager, /Add-VisualImages -SourceRoot 'docs\/assets\/screenshots'/)
  assert.match(packager, /\$seenHashes = @\{\}/)
  assert.match(packager, /deduplicatedSourceCount = \$sourceImageCount - \$manifest\.Count/)
  assert.match(packager, /redundantNamedCaptureCount = \$redundantNamedCaptures\.Count/)
  assert.match(packager, /Test-NamedVisualCapture/)
  assert.match(packager, /Redundant visual evidence/)
  assert.match(packager, /explicitly named captures with identical image bytes/)
})

test('automatic screenshots are failure-only because successful evidence is explicitly named', () => {
  assert.match(visualConfig, /screenshot:\s*'only-on-failure'/)
  assert.doesNotMatch(visualConfig, /screenshot:\s*'on'/)
})

test('screenshot refresh publishes one canonical deduplicated evidence tree', () => {
  assert.match(refreshWorkflow, /Prepare canonical screenshot evidence/)
  assert.match(refreshWorkflow, /prepare-visual-review-package\.ps1/)
  assert.match(refreshWorkflow, /path:\s*artifacts\/visual-review-package/)
  assert.doesNotMatch(
    refreshWorkflow,
    /path:\s*\|[\s\S]*docs\/assets\/screenshots[\s\S]*e2e\/screenshots\.spec\.ts-snapshots[\s\S]*test-results/,
  )
  assert.doesNotMatch(refreshWorkflow, /artifacts\/screenshots-before|Preserve previous gallery hero/)
  assert.doesNotMatch(packager, /screenshots-before/)
})

test('packager excludes image bytes from evidence tree', () => {
  assert.match(packager, /if \(\$imageExtensions -contains \$file\.Extension\.ToLowerInvariant\(\)\) \{\s*continue\s*\}/)
  assert.match(packager, /imageDirectory = 'images'/)
})


test('cancelled visual runs do not publish stale evidence', () => {
  const steps = workflow.split(/\n(?= {6}- name: )/)
  const step = (name) => {
    const block = steps.find((entry) => entry.startsWith(`      - name: ${name}\n`))
    assert.ok(block, `missing required visual evidence step: ${name}`)
    return block
  }
  for (const name of [
    'Enforce visual review result and read-only baselines',
    'Finalize visual review evidence',
    'Prepare unified visual review artifact',
    'Upload unified visual review artifact',
  ]) {
    assert.match(step(name), /if:\s*\$\{\{ always\(\) && !cancelled\(\) \}\}/)
  }
  assert.match(step('Capture visual review failure context'), /if:\s*\$\{\{ failure\(\) && !cancelled\(\) \}\}/)
  assert.doesNotMatch(workflow, /Refresh current visual baselines/)
})

test('expanded visual evidence matrix remains captured', () => {
  for (const image of [
    'visual-workspace-rtl-fa.png',
    'visual-workspace-de-1024.png',
    'visual-workspace-ui-zoom-125.png',
    'visual-workspace-ui-zoom-200-editor.png',
    'visual-workspace-ui-zoom-200-inspector.png',
    'visual-workspace-device-scale-125.png',
    'visual-vault-loading.png',
    'visual-large-vault-bottom.png',
    'visual-graph-dense-120.png',
    'visual-inspector-metrics-1024.png',
    'visual-dock-problems.png',
    'visual-dock-output.png',
    'visual-settings-dark.png',
    'visual-settings-advanced.png',
    'visual-onboarding-dark.png',
    'visual-layout-presets.png',
    'visual-conflict-resolver-dark.png',
    'visual-help-restraint.png',
    'visual-help-mcp-guide.png',
    'visual-help-mobile-390.png',
    'visual-mobile-320.png',
    'visual-mobile-dark-390.png',
    'visual-mobile-rtl-fa-390.png',
    'visual-workspace-high-contrast.png',
  ]) {
    assert.ok(visualReview.includes(image), `missing visual evidence capture: ${image}`)
  }
})


test('Help visual evidence proves centralized, non-injected guidance', () => {
  for (const image of [
    'visual-help-restraint.png',
    'visual-help-mcp-guide.png',
    'visual-help-mobile-390.png',
  ]) {
    assert.ok(visualReview.includes(image), `missing restrained Help evidence capture: ${image}`)
  }
  assert.match(visualReview, /\.help-affordance, \.help-trigger, \.help-invitation/)
  assert.match(visualReview, /toHaveCount\(0\)/)
})

test('major product surfaces keep visual evidence', () => {
  for (const image of [
    "visual-empty-workspace.png",
    "visual-reader-pdf.png",
    "visual-tasks-populated.png",
    "visual-git-confirmation.png",
    "visual-history-restore-confirmation.png",
    "visual-writing-targets.png",
    "visual-frontmatter.png",
    "visual-editor-toolbar-customizer.png",
    "visual-search-results.png",
    "visual-kanban-populated.png",
    "visual-bibliography.png",
    "visual-snippets.png",
    "visual-cheatsheet.png",
    "visual-cheatsheet-bottom.png",
    "visual-template-picker.png",
    "visual-obsidian-import.png",
    "visual-support.png",
    "visual-canvas-populated.png",
    "visual-mcp-sharing-inventory.png",
    "visual-editor-recovery.png",
    "visual-typography-popover.png",
    "visual-insert-popover.png",
    "visual-mobile-editor-390.png",
    "visual-portal.png",
    "visual-quick-capture.png",
    "visual-sticky-note-overlay.png",
    "visual-external-change-conflict.png",
    "visual-built-in-modules.png",
    "visual-performance-hud.png",
    "visual-gmail-disconnected.png",
    "visual-settings-integrations-google.png",
    "visual-inbox-populated.png",
    "visual-topbar-customizer.png",
    "visual-color-palettes.png",
    "visual-rename-preview.png",
    "visual-knowledge-views.png",
    "visual-knowledge-collections.png",
    "visual-knowledge-tags.png",
    "visual-knowledge-discover.png"
]) {
    assert.ok(visualReview.includes(image), `missing product-surface visual evidence: ${image}`)
  }
})
