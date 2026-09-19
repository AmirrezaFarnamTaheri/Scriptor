import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const workflow = fs.readFileSync(path.join(root, '.github/workflows/visual-review.yml'), 'utf8')
const packager = fs.readFileSync(path.join(root, 'scripts/ci/prepare-visual-review-package.ps1'), 'utf8')

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
    /git status --porcelain -- e2e\/visual-review\.spec\.ts-snapshots e2e\/screenshots\.spec\.ts-snapshots docs\/assets\/screenshots/,
  )
  assert.match(workflow, /VISUAL_COMPARE_OUTCOME/)
  assert.match(workflow, /VISUAL_REFRESH_OUTCOME/)
})

test('visual artifact has one canonical images directory', () => {
  assert.match(workflow, /name:\s*visual-review\s*\n/)
  assert.match(workflow, /path:\s*artifacts\/visual-review-package/)
  assert.doesNotMatch(workflow, /path:\s*\|[\s\S]*test-results\/visual[\s\S]*e2e\/screenshots\.spec\.ts-snapshots/)
  assert.match(packager, /Join-Path \$packagePath 'images'/)
  assert.match(packager, /Add-VisualImages -SourceRoot 'test-results\/visual'/)
  assert.match(packager, /Add-VisualImages -SourceRoot 'e2e\/screenshots\.spec\.ts-snapshots'/)
  assert.match(packager, /Add-VisualImages -SourceRoot 'e2e\/visual-review\.spec\.ts-snapshots'/)
  assert.match(packager, /Add-VisualImages -SourceRoot 'docs\/assets\/screenshots'/)
})

test('packager excludes image bytes from evidence tree', () => {
  assert.match(packager, /if \(\$imageExtensions -contains \$file\.Extension\.ToLowerInvariant\(\)\) \{\s*continue\s*\}/)
  assert.match(packager, /imageDirectory = 'images'/)
})


test('cancelled visual runs do not refresh or publish stale evidence', () => {
  const guardedAlways = (workflow.match(/if:\s*\$\{\{ always\(\) && !cancelled\(\) \}\}/g) ?? []).length
  assert.ok(guardedAlways >= 5, 'refresh, enforcement, finalization, packaging, and upload must stop after cancellation')
  assert.match(workflow, /if:\s*\$\{\{ failure\(\) && !cancelled\(\) \}\}/)
})
