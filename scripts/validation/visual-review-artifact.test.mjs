import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const workflow = fs.readFileSync(path.join(root, '.github/workflows/visual-review.yml'), 'utf8')
const packager = fs.readFileSync(path.join(root, 'scripts/ci/prepare-visual-review-package.ps1'), 'utf8')
const visualReview = fs.readFileSync(path.join(root, 'e2e/visual-review.spec.ts'), 'utf8')
const visualConfig = fs.readFileSync(path.join(root, 'playwright.visual.config.ts'), 'utf8')

test('visual review compares committed baselines before refreshing current images', () => {
  const compare = workflow.indexOf('--update-snapshots=none')
  const refresh = workflow.indexOf('--update-snapshots=all')
  assert.ok(compare >= 0, 'visual comparison must not mutate committed baselines')
  assert.ok(refresh > compare, 'current baselines must be refreshed after comparison evidence is captured')
  assert.match(workflow, /id:\s*visual_compare/)
  assert.match(workflow, /id:\s*visual_refresh/)
  assert.match(workflow, /test-results\/visual-refresh/)
})

test('visual review gates stale snapshots and documentation captures', () => {
  assert.match(
    workflow,
    /git status --porcelain -- e2e\/screenshots\.spec\.ts-snapshots docs\/assets\/screenshots/,
  )
  assert.match(workflow, /VISUAL_COMPARE_OUTCOME/)
  assert.match(workflow, /VISUAL_REFRESH_OUTCOME/)
})

test('clean baseline comparison still rejects stale documentation screenshots', () => {
  const enforcement = workflow.split(/\n(?= {6}- name: )/)
    .find((entry) => entry.startsWith('      - name: Enforce visual review result and committed baselines\n'))
  assert.ok(enforcement, 'missing visual enforcement step')
  const changes = enforcement.indexOf('$changes = git status --porcelain')
  const successBranch = enforcement.indexOf("if ($env:VISUAL_COMPARE_OUTCOME -eq 'success')")
  assert.ok(changes >= 0 && changes < successBranch, 'documentation drift must be computed before the clean-compare exit')
  assert.match(enforcement, /if \(\$changes\) \{[\s\S]*Documentation screenshots are stale[\s\S]*throw/)
})

test('visual artifact has one canonical images directory', () => {
  assert.match(workflow, /name:\s*visual-review\s*\n/)
  assert.match(workflow, /path:\s*artifacts\/visual-review-package/)
  assert.doesNotMatch(workflow, /path:\s*\|[\s\S]*test-results\/visual[\s\S]*e2e\/screenshots\.spec\.ts-snapshots/)
  assert.match(packager, /Join-Path \$packagePath 'images'/)
  assert.match(packager, /Add-VisualImages -SourceRoot 'test-results\/visual'/)
  assert.match(packager, /Add-VisualImages -SourceRoot 'e2e\/screenshots\.spec\.ts-snapshots'/)
  assert.doesNotMatch(packager, /e2e\/visual-review\.spec\.ts-snapshots/)
  assert.match(packager, /Add-VisualImages -SourceRoot 'docs\/assets\/screenshots'/)
  assert.match(packager, /\$seenHashes = @\{\}/)
  assert.match(packager, /deduplicatedSourceCount = \$sourceImageCount - \$manifest\.Count/)
})

test('automatic screenshots are failure-only because successful evidence is explicitly named', () => {
  assert.match(visualConfig, /screenshot:\s*'only-on-failure'/)
  assert.doesNotMatch(visualConfig, /screenshot:\s*'on'/)
})

test('diagnostic baseline refresh reruns only the stable screenshot spec', () => {
  const steps = workflow.split(/\n(?= {6}- name: )/)
  const refresh = steps.find((entry) => entry.startsWith('      - name: Refresh current visual baselines\n'))
  assert.ok(refresh, 'missing diagnostic baseline refresh step')
  assert.match(refresh, /e2e\/screenshots\.spec\.ts/)
  assert.doesNotMatch(refresh, /e2e\/visual-review\.spec\.ts/)
})

test('packager excludes image bytes from evidence tree', () => {
  assert.match(packager, /if \(\$imageExtensions -contains \$file\.Extension\.ToLowerInvariant\(\)\) \{\s*continue\s*\}/)
  assert.match(packager, /imageDirectory = 'images'/)
})


test('cancelled visual runs do not refresh or publish stale evidence', () => {
  const steps = workflow.split(/\n(?= {6}- name: )/)
  const step = (name) => {
    const block = steps.find((entry) => entry.startsWith(`      - name: ${name}\n`))
    assert.ok(block, `missing required visual evidence step: ${name}`)
    return block
  }
  assert.match(
    step('Refresh current visual baselines'),
    /if:\s*\$\{\{ steps\.visual_compare\.outcome != 'success' && !cancelled\(\) \}\}/,
  )
  for (const name of [
    'Enforce visual review result and committed baselines',
    'Finalize visual review evidence',
    'Prepare unified visual review artifact',
    'Upload unified visual review artifact',
  ]) {
    assert.match(step(name), /if:\s*\$\{\{ always\(\) && !cancelled\(\) \}\}/)
  }
  assert.match(step('Capture visual review failure context'), /if:\s*\$\{\{ failure\(\) && !cancelled\(\) \}\}/)
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
    'visual-settings-dark.png',
    'visual-conflict-resolver-dark.png',
  ]) {
    assert.ok(visualReview.includes(image), `missing visual evidence capture: ${image}`)
  }
})


test('major product surfaces keep visual evidence', () => {
  for (const image of [
    "visual-reader-pdf.png",
    "visual-tasks-populated.png",
    "visual-kanban-populated.png",
    "visual-bibliography.png",
    "visual-snippets.png",
    "visual-cheatsheet.png",
    "visual-template-picker.png",
    "visual-obsidian-import.png",
    "visual-support.png",
    "visual-portal.png",
    "visual-quick-capture.png",
    "visual-built-in-modules.png",
    "visual-performance-hud.png",
    "visual-gmail-disconnected.png",
    "visual-settings-integrations-google.png",
    "visual-inbox-populated.png",
    "visual-topbar-customizer.png",
    "visual-color-palettes.png"
]) {
    assert.ok(visualReview.includes(image), `missing product-surface visual evidence: ${image}`)
  }
})
