import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const root = path.resolve(import.meta.dirname, '../..')
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8')

test('functional and visual Playwright suites use isolated ports and build directories', () => {
  const e2e = read('playwright.e2e.config.ts')
  const visual = read('playwright.visual.config.ts')

  assert.match(e2e, /SCRIPTOR_E2E_PORT \?\? 4184/)
  assert.match(visual, /SCRIPTOR_VISUAL_PORT \?\? 4185/)
  assert.match(e2e, /--outDir dist-e2e/)
  assert.match(visual, /--outDir dist-visual-e2e/)
  assert.match(e2e, /reuseExistingServer: false/)
  assert.match(visual, /reuseExistingServer: false/)
})
