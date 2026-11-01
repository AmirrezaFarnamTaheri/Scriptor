import assert from 'node:assert/strict'
import test from 'node:test'
import { assessCapabilityEvidence } from './capability-evidence.mjs'
const sha = 'a'.repeat(40)
const proof = caseId => ({ result: 'passed', sha, url: 'https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/100', caseId })
const packet = () => ({
  schemaVersion: 1, capabilityId: 'database-studio', sourceHead: sha,
  owner: 'team-data', supportWindow: 'maintenance policy 2026-Q4',
  contract: { path: 'docs/CAPABILITIES.md', schemaPolicy: 'v1-incremental' },
  tests: Object.fromEntries(['positive','negative','restart','cancellation','recovery'].map(name => [name, proof(name)])),
  authorization: { model: 'native vault authorization', privacyReview: proof('privacy') },
  performance: proof('25k-performance'),
  docs: { user: 'docs/CAPABILITIES.md', operator: 'docs/VERIFICATION.md' },
  release: { inclusion: proof('release'), artifactSmoke: proof('ci-artifact-smoke') },
  changelog: 'CHANGELOG.md',
})
test('MAT-022: complete evidence index is complete for automated verification, not automatically supported', () => {
  const result = assessCapabilityEvidence(packet())
  assert.equal(result.evidenceIndexComplete, true)
  assert.deepEqual(result.missing, [])
  assert.equal('supported' in result, false)
})
test('MAT-022: missing negative, failed restart or missing recovery proof blocks review', () => {
  const input = packet()
  delete input.tests.negative
  input.tests.restart.result = 'failed'
  input.tests.recovery.url = ''
  const result = assessCapabilityEvidence(input)
  assert.equal(result.evidenceIndexComplete, false)
  assert.deepEqual(result.missing, ['tests.negative', 'tests.restart', 'tests.recovery'])
})
test('MAT-022: stale commit evidence never certifies a newer head', () => {
  const input = packet(); input.release.artifactSmoke.sha = 'b'.repeat(40)
  assert.deepEqual(assessCapabilityEvidence(input).missing, ['release.artifactSmoke'])
})
test('MAT-022: unit tests cannot substitute for CI artifact smoke or privacy evidence', () => {
  const input = packet(); delete input.release.artifactSmoke; delete input.authorization.privacyReview
  const result = assessCapabilityEvidence(input)
  assert.deepEqual(result.missing, ['authorization.privacyReview', 'release.artifactSmoke'])
  assert.equal(result.evidenceIndexComplete, false)
})
test('MAT-022: malformed identity, unsafe document paths and unsupported schemas fail closed', () => {
  for (const [key, value] of [['sourceHead','main'],['capabilityId',''],['schemaVersion',2]]) {
    const input = packet(); input[key] = value
    assert.throws(() => assessCapabilityEvidence(input), /schema|identity|head|commit/i)
  }
  const input = packet(); input.docs.user = '../secret.md'
  assert.throws(() => assessCapabilityEvidence(input), /path/i)
})
test('MAT-022: arbitrary external links do not satisfy the expected CI reference pattern', () => {
  const input = packet(); input.tests.positive.url = 'https://example.org/passing'
  assert.deepEqual(assessCapabilityEvidence(input).missing, ['tests.positive'])
})


test('MAT-022: an unrelated GitHub repository cannot supply readiness evidence', () => {
  const input = packet()
  input.tests.positive.url = 'https://github.com/example-org/another-repo/actions/runs/100'
  assert.deepEqual(assessCapabilityEvidence(input).missing, ['tests.positive'])
})
test('MAT-022: valid Scriptor workflow run links remain eligible for automated verification', () => {
  assert.equal(assessCapabilityEvidence(packet()).evidenceIndexComplete, true)
})

test('MAT-022: an installed-app label without CI artifact smoke cannot complete automated evidence', () => {
  const input = packet()
  input.release.installed = proof('manual-installed')
  delete input.release.artifactSmoke
  const result = assessCapabilityEvidence(input)
  assert.equal(result.evidenceIndexComplete, false)
  assert.deepEqual(result.missing, ['release.artifactSmoke'])
  assert.equal('readyForHumanReview' in result, false)
  assert.equal('supported' in result, false)
})
