import assert from 'node:assert/strict'
import test from 'node:test'
import { hasSourceIdentityClaim } from './docs-contract-utils.mjs'

test('source identity contract accepts equivalent spacing and hyphenation', () => {
  assert.equal(hasSourceIdentityClaim('source identity evidence'), true)
  assert.equal(hasSourceIdentityClaim('source-identity evidence'), true)
  assert.equal(hasSourceIdentityClaim('source-attributable release'), true)
})

test('source identity contract rejects unrelated provenance wording', () => {
  assert.equal(hasSourceIdentityClaim('checksums and provenance'), false)
})
