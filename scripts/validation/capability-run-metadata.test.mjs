import assert from 'node:assert/strict'
import { test } from 'node:test'
import { verifyCapabilityWorkflowMetadata } from './capability-run-metadata.mjs'

const sourceHead = 'a'.repeat(40)
const repo = 'AmirrezaFarnamTaheri/Scriptor'
const runUrl = 'https://github.com/' + repo + '/actions/runs/100'
const proof = caseId => ({ result: 'passed', sha: sourceHead, url: runUrl, caseId })
const cases = ['positive', 'negative', 'restart', 'cancellation', 'recovery']
const packet = () => ({
  schemaVersion: 1, capabilityId: 'test-capability', sourceHead,
  owner: 'team', supportWindow: 'test', contract: { path: 'docs/CAPABILITIES.md', schemaPolicy: 'v1' },
  tests: Object.fromEntries(cases.map(name => [name, proof('tests.' + name)])),
  authorization: { model: 'native', privacyReview: proof('authorization.privacyReview') },
  performance: proof('performance'), docs: { user: 'docs/CAPABILITIES.md', operator: 'docs/VERIFICATION.md' },
  release: { inclusion: proof('release.inclusion'), artifactSmoke: proof('release.artifactSmoke') },
  changelog: 'CHANGELOG.md',
})
const ids = [...cases.map(name => 'tests.' + name), 'authorization.privacyReview',
  'performance', 'release.inclusion', 'release.artifactSmoke']
const succeededRun = () => ({
  id: 100, head_sha: sourceHead, status: 'completed', conclusion: 'success',
  html_url: runUrl, repository: { full_name: repo },
})
const succeededJobs = () => ({
  jobs: [{ id: 50, status: 'completed', conclusion: 'success',
    steps: ids.map((name, index) => ({ number: index + 1, name, status: 'completed', conclusion: 'success' })) }],
})
const provider = (run = succeededRun(), jobs = succeededJobs()) => ({
  getRun: async () => run, getJobs: async () => jobs,
})

test('MAT-022: a complete evidence index still requires actual run and named step metadata', async () => {
  let runCalls = 0
  let jobCalls = 0
  const result = await verifyCapabilityWorkflowMetadata(packet(), {
    getRun: async id => { assert.equal(id, 100); runCalls++; return succeededRun() },
    getJobs: async id => { assert.equal(id, 100); jobCalls++; return succeededJobs() },
  })
  assert.equal(result.evidenceIndexComplete, true)
  assert.equal(result.runMetadataVerified, true)
  assert.deepEqual(result.unverified, [])
  assert.equal(result.verifiedCases, 9)
  assert.equal(runCalls, 1, 'the shared workflow run must not be refetched for every proof gate')
  assert.equal(jobCalls, 1)
  assert.equal(result.supportGraduated, false)
  assert.equal(result.artifactProvenanceVerified, false,
    'matching run and step names cannot prove packaged artifact hashes or real-provider compatibility')
})

test('MAT-022: a run from another repository or exact source head cannot pass metadata verification', async () => {
  const unrelated = await verifyCapabilityWorkflowMetadata(packet(), provider({
    ...succeededRun(), repository: { full_name: 'example/unrelated' },
  }))
  assert.equal(unrelated.runMetadataVerified, false)
  assert.deepEqual(unrelated.unverified, ids)

  const stale = await verifyCapabilityWorkflowMetadata(packet(), provider({
    ...succeededRun(), head_sha: 'b'.repeat(40),
  }))
  assert.equal(stale.runMetadataVerified, false)
  assert.deepEqual(stale.unverified, ids)
})

test('MAT-022: queued, cancelled, failed or missing workflows do not certify passed evidence', async () => {
  for (const run of [null,
    { ...succeededRun(), status: 'queued', conclusion: null },
    { ...succeededRun(), status: 'completed', conclusion: 'failure' },
    { ...succeededRun(), status: 'completed', conclusion: 'cancelled' },
  ]) {
    const result = await verifyCapabilityWorkflowMetadata(packet(), provider(run))
    assert.equal(result.runMetadataVerified, false)
    assert.deepEqual(result.unverified, ids)
  }
})

test('MAT-022: false case identifiers, skipped steps, and failed job assertions fail closed', async () => {
  const jobs = succeededJobs()
  jobs.jobs[0].steps = jobs.jobs[0].steps.filter(step => step.name !== 'tests.restart')
  let result = await verifyCapabilityWorkflowMetadata(packet(), provider(succeededRun(), jobs))
  assert.equal(result.runMetadataVerified, false)
  assert.deepEqual(result.unverified, ['tests.restart'])

  jobs.jobs[0].steps.push({ number: 20, name: 'tests.restart', status: 'completed', conclusion: 'skipped' })
  result = await verifyCapabilityWorkflowMetadata(packet(), provider(succeededRun(), jobs))
  assert.deepEqual(result.unverified, ['tests.restart'])

  jobs.jobs[0].conclusion = 'failure'
  result = await verifyCapabilityWorkflowMetadata(packet(), provider(succeededRun(), jobs))
  assert.deepEqual(result.unverified, ids)
})

test('MAT-022: malformed proof index and invalid run identifiers never cause provider calls', async () => {
  const input = packet()
  input.tests.negative.url = 'https://github.com/unrelated/project/actions/runs/10'
  let called = 0
  const result = await verifyCapabilityWorkflowMetadata(input, {
    getRun: async () => { called++; return succeededRun() },
    getJobs: async () => { called++; return succeededJobs() },
  })
  assert.equal(result.evidenceIndexComplete, false)
  assert.equal(result.runMetadataVerified, false)
  assert.equal(called, 0)
  const oversized = packet()
  oversized.tests.negative.url = 'https://github.com/' + repo + '/actions/runs/99999999999999999999999999'
  const invalid = await verifyCapabilityWorkflowMetadata(oversized, provider())
  assert.equal(invalid.runMetadataVerified, false)
  assert.ok(invalid.unverified.includes('tests.negative'))
})

test('MAT-022: provider API errors must remain unverified and never become a support claim', async () => {
  const result = await verifyCapabilityWorkflowMetadata(packet(), {
    getRun: async () => { throw Error('rate limited') },
    getJobs: async () => { throw Error('unavailable') },
  })
  assert.equal(result.runMetadataVerified, false)
  assert.deepEqual(result.unverified, ids)
  assert.equal(result.supportGraduated, false)
})


test('MAT-022: malformed run repository metadata is unverified rather than throwing', async () => {
  const result = await verifyCapabilityWorkflowMetadata(packet(), provider({
    ...succeededRun(), repository: { full_name: 123 },
  }))
  assert.equal(result.runMetadataVerified, false)
  assert.deepEqual(result.unverified, ids)
})

test('MAT-022: a failed earlier workflow attempt cannot be certified by a later successful rerun', async () => {
  const input = packet()
  input.tests.negative.url = runUrl + '/attempts/1'
  const laterSuccess = { ...succeededRun(), run_attempt: 2 }
  const result = await verifyCapabilityWorkflowMetadata(input, provider(laterSuccess))
  assert.equal(result.evidenceIndexComplete, true)
  assert.equal(result.runMetadataVerified, false)
  assert.deepEqual(result.unverified, ['tests.negative'])
  assert.equal(result.verifiedCases, 8)
})

test('MAT-022: a pinned successful attempt is accepted only for matching run metadata', async () => {
  const input = packet()
  input.tests.negative.url = runUrl + '/attempts/2'
  const result = await verifyCapabilityWorkflowMetadata(input, provider({ ...succeededRun(), run_attempt: 2 }))
  assert.equal(result.runMetadataVerified, true)
  assert.deepEqual(result.unverified, [])
})

test('MAT-022: malformed run URL suffixes cannot substitute for exact CI proof', async () => {
  for (const suffix of ['/attempts/0', '/attempts/2/jobs/999', '/unrelated']) {
    const input = packet()
    input.tests.negative.url = runUrl + suffix
    const result = await verifyCapabilityWorkflowMetadata(input, provider({ ...succeededRun(), run_attempt: 2 }))
    assert.equal(result.runMetadataVerified, false, suffix)
    assert.ok(result.unverified.includes('tests.negative'), suffix)
  }
})
