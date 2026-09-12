import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const root = path.resolve(import.meta.dirname, '../..')
const capture = fs.readFileSync(path.join(root, 'scripts/screenshots/capture.ps1'), 'utf8')

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
