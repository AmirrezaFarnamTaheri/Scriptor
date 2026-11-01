import assert from 'node:assert/strict'
import test from 'node:test'
import { reviewResearchProjectManifest } from './researchProjectManifest.ts'
const a = 'a'.repeat(64), b = 'b'.repeat(64), c = 'c'.repeat(64)
const manifest = () => ({
  schemaVersion: 1, vaultId: 'vault-a', projectId: 'field-study',
  inputs: [{ path: 'Notes/Study.md', kind: 'note', sha256: a }, { path: 'References/current.bib', kind: 'bibliography', sha256: b }],
  output: { path: 'Exports/study.pdf', profile: 'pdf', sha256: c },
  tools: [{ name: 'pandoc', version: '3.6', authorization: 'review-required' }],
})
const evidence = () => ({ vaultId: 'vault-a', reads: [
  { path: 'Notes/Study.md', state: 'present', sha256: a },
  { path: 'References/current.bib', state: 'present', sha256: b },
  { path: 'Exports/study.pdf', state: 'present', sha256: c },
], tools: [{ name: 'pandoc', state: 'available', version: '3.6' }] })
test('MAT-014: same-vault read evidence identifies complete manifest inputs and outputs', () => {
  assert.deepEqual(reviewResearchProjectManifest(manifest(), evidence()), {
    status: 'current', changed: [], missing: [], unverified: [], executionAuthorized: false,
  })
})
test('MAT-014: altered bibliography or output requires a rebuild, without attempting one', () => {
  const seen = evidence(); seen.reads[1].sha256 = c; seen.reads[2].sha256 = a
  assert.deepEqual(reviewResearchProjectManifest(manifest(), seen), {
    status: 'stale', changed: ['References/current.bib', 'Exports/study.pdf'], missing: [], unverified: [], executionAuthorized: false,
  })
})
test('MAT-014: absent source and unavailable tool are reported distinctly', () => {
  const seen = evidence(); seen.reads[0] = { path: 'Notes/Study.md', state: 'missing', sha256: a }; seen.tools = [{ name: 'pandoc', state: 'unavailable', version: '3.6' }]
  assert.deepEqual(reviewResearchProjectManifest(manifest(), seen), {
    status: 'stale', changed: [], missing: ['Notes/Study.md'], unverified: ['tool:pandoc'], executionAuthorized: false,
  })
})
test('MAT-014: unobserved inputs are unverified, not current or absent', () => {
  const seen = evidence(); seen.reads.splice(1, 1)
  const result = reviewResearchProjectManifest(manifest(), seen)
  assert.equal(result.status, 'unverified')
  assert.deepEqual(result.unverified, ['References/current.bib'])
})
test('MAT-014: refuses stale or cross-vault evidence and unknown future schemas', () => {
  const wrong = evidence(); wrong.vaultId = 'vault-b'
  assert.equal(reviewResearchProjectManifest(manifest(), wrong).status, 'unverified')
  const future = manifest(); future.schemaVersion = 2
  assert.throws(() => reviewResearchProjectManifest(future, evidence()), /schema/i)
})
test('MAT-014: refuses unsafe, duplicate, and overlapping vault-owned paths', () => {
  for (const path of ['../secret.md', '/home/private.md', 'C:\\outside.md', 'a//b.md', './note.md']) {
    const input = manifest(); input.inputs[0].path = path
    assert.throws(() => reviewResearchProjectManifest(input, evidence()), /path/i)
  }
  const input = manifest(); input.output.path = 'Notes/Study.md'
  assert.throws(() => reviewResearchProjectManifest(input, evidence()), /duplicate|overlap/i)
})
test('MAT-014: unapproved execution cannot be silently authorized by a manifest', () => {
  const input = manifest(); input.tools[0].authorization = 'approved'
  assert.throws(() => reviewResearchProjectManifest(input, evidence()), /review-required|authorization/i)
  assert.equal(reviewResearchProjectManifest(manifest(), evidence()).executionAuthorized, false)
})
test('MAT-014: no unverifiable duplicate or malformed native evidence may establish current status', () => {
  const seen = evidence(); seen.reads.push(seen.reads[0])
  assert.throws(() => reviewResearchProjectManifest(manifest(), seen), /duplicate/i)
  seen.reads.pop(); seen.reads[0].sha256 = 'wrong'
  assert.throws(() => reviewResearchProjectManifest(manifest(), seen), /sha256/i)
})
