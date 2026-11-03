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

test('MAT-014: nested source/output paths cannot masquerade as independent manifest files', () => {
  const inputAncestor = manifest()
  inputAncestor.inputs.push({ path: 'Notes', kind: 'source', sha256: a })
  assert.throws(() => reviewResearchProjectManifest(inputAncestor, evidence()), /duplicate|overlap/i)
  const outputAncestor = manifest()
  outputAncestor.output.path = 'References'
  assert.throws(() => reviewResearchProjectManifest(outputAncestor, evidence()), /duplicate|overlap/i)
  const nestedOutput = manifest()
  nestedOutput.output.path = 'Notes/Study.md/rendered.pdf'
  assert.throws(() => reviewResearchProjectManifest(nestedOutput, evidence()), /duplicate|overlap/i)
})

test('MAT-014: portable manifest identity rejects case and Unicode-equivalent file aliases', () => {
  const aliases: [string, string][] = [
    ['Notes/Study.md', 'notes/study.md'],
    ['Notes/Study.md', 'notes/study.MD/report.pdf'],
    ['Café.md', 'Cafe\u0301.md'],
    ['Research', 'research/output.pdf'],
  ]
  for (const [source, output] of aliases) {
    const project = manifest()
    project.inputs[0].path = source
    project.output.path = output
    assert.throws(
      () => reviewResearchProjectManifest(project, evidence()),
      /duplicate|overlap/i,
      `portable source path ${source} must not be independent of ${output}`,
    )
  }

  const distinct = manifest()
  distinct.output.path = 'Notes/Study.md2'
  assert.equal(
    reviewResearchProjectManifest(distinct, evidence()).status,
    'unverified',
    'sibling filenames sharing a prefix are not ancestor/descendant aliases',
  )
})

test('MAT-014: portable aliases in observed read evidence cannot certify independent files', () => {
  for (const [source, alias] of [
    ['Notes/Study.md', 'notes/study.md'],
    ['Notes/Study.md', 'NOTES/STUDY.MD/derived.json'],
    ['Café.md', 'Cafe\u0301.md'],
  ]) {
    const project = manifest()
    project.inputs[0].path = source
    const seen = evidence()
    seen.reads[0].path = source
    seen.reads.push({ path: alias, state: 'present', sha256: a })
    assert.throws(
      () => reviewResearchProjectManifest(project, seen),
      /duplicate|overlap/i,
      'an alias of an already observed file must not count as independent native evidence',
    )
  }
  const distinct = evidence()
  distinct.reads.push({ path: 'Notes/Study.md2', state: 'present', sha256: a })
  assert.equal(reviewResearchProjectManifest(manifest(), distinct).status, 'current')
})
