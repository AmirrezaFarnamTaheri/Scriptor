import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const root = path.resolve(import.meta.dirname, '../..')
const capture = fs.readFileSync(path.join(root, 'scripts/screenshots/capture.ps1'), 'utf8')
const screenshots = fs.readFileSync(path.join(root, 'e2e/screenshots.spec.ts'), 'utf8')
const visualWorkflow = fs.readFileSync(path.join(root, '.github/workflows/visual-review.yml'), 'utf8')
const galleryDir = path.join(root, 'docs/assets/screenshots')
const baselineDir = path.join(root, 'e2e/screenshots.spec.ts-snapshots')

test('documentation capture never mirrors stable baselines back over fresh screenshots', () => {
  assert.doesNotMatch(capture, /e2e\/screenshots\.spec\.ts-snapshots[\s\S]*Copy-Item/)
  assert.doesNotMatch(capture, /\$snapshotDirs\s*=/)
  assert.match(capture, /current-source captures directly here/)
})

test('intentional baseline refresh forces all snapshots and uses one worker', () => {
  assert.match(capture, /--update-snapshots=all/)
  assert.match(capture, /--workers=1/)
})

test('docs-only visual review states are copied only from fresh test output', () => {
  for (const source of [
    'visual-editor-recovery.png',
    'visual-mcp-sharing-inventory.png',
    'visual-typography-popover.png',
    'visual-insert-popover.png',
  ]) {
    assert.ok(capture.includes(source), `missing docs-only capture mapping for ${source}`)
  }
  assert.match(capture, /test-results\/visual/)
})


test('PR comparison redirects documentation captures while explicit refresh keeps the tracked default', () => {
  assert.match(screenshots, /process\.env\.SCRIPTOR_SCREENSHOT_OUTPUT_DIR/)
  assert.match(screenshots, /docs\/assets\/screenshots/)
  assert.match(visualWorkflow, /SCRIPTOR_SCREENSHOT_OUTPUT_DIR: test-results\/visual\/documentation-screenshots/)
})

test('tracked screenshot gallery contains no stale or redundant generated PNGs', () => {
  const direct = [...screenshots.matchAll(/shotPath\('([^']+)'\)/g)].map((match) => `${match[1]}.png`)
  const mapped = [...capture.matchAll(/"visual-[^"]+\.png"\s*=\s*"([^"]+\.png)"/g)].map((match) => match[1])
  const expected = [...new Set([...direct, ...mapped])].sort()
  const tracked = fs.readdirSync(galleryDir).filter((name) => name.endsWith('.png')).sort()
  assert.deepEqual(tracked, expected)
})

test('stable Windows baseline directory contains exactly the asserted screenshot baselines', () => {
  const asserted = [...screenshots.matchAll(/toHaveScreenshot\('([^']+\.png)'/g)]
    .map((match) => match[1].replace(/\.png$/, '-win32.png'))
  const expected = [...new Set(asserted)].sort()
  const tracked = fs.readdirSync(baselineDir).filter((name) => name.endsWith('-win32.png')).sort()
  assert.deepEqual(tracked, expected)
})
