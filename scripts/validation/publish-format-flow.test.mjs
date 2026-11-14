import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const read = file => readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8')
test('publishing uses one selected format with a recommended offline PDF default', () => {
  const publish = read('src/components/PublishCenter.tsx')
  assert.match(publish, /useState\('pdf-offline'\)/)
  assert.match(publish, /<select aria-label="Export format"/)
  assert.match(publish, /onExport\(selectedProfile\.id, false\)/)
  assert.match(publish, /onExport\(selectedProfile\.id, true\)/)
  assert.match(publish, /selectedProfile\.outputDirectory/)
  assert.doesNotMatch(publish, /<ul className="publish-profile-list">/)
})
