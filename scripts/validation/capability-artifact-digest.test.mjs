import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { test } from 'node:test'
import { verifyGithubArtifactProvenance } from './capability-artifact-digest.mjs'

const REPOSITORY = 'AmirrezaFarnamTaheri/Scriptor'
const HEAD = 'a'.repeat(40)
const ZIP = Buffer.from('deterministic example archive bytes')
const HASH = createHash('sha256').update(ZIP).digest('hex')
const proof = () => ({ sourceHead: HEAD, runId: 120, artifactId: 130, artifactName: 'desktop-smoke', sha256: HASH })
const run = () => ({ id: 120, status: 'completed', conclusion: 'success', head_sha: HEAD,
  html_url: `https://github.com/${REPOSITORY}/actions/runs/120`, repository: { full_name: REPOSITORY } })
const artifact = () => ({ id: 130, name: 'desktop-smoke', expired: false, size_in_bytes: ZIP.length,
  url: `https://api.github.com/repos/${REPOSITORY}/actions/artifacts/130`,
  archive_download_url: `https://api.github.com/repos/${REPOSITORY}/actions/artifacts/130/zip`,
  workflow_run: { id: 120, head_sha: HEAD }, digest: `sha256:${HASH}` })
const provider = (r = run(), a = artifact(), data = ZIP) => ({
  getRun: async id => { assert.equal(id, 120); return r },
  getArtifact: async id => { assert.equal(id, 130); return a },
  downloadArchive: async function* (id) { assert.equal(id, 130); yield data.subarray(0, 8); yield data.subarray(8) },
})

test('MAT-022: independent digest of complete source-bound artifact zip verifies exactly', async () => {
  const result = await verifyGithubArtifactProvenance(proof(), provider())
  assert.equal(result.artifactDigestVerified, true)
  assert.equal(result.verifiedBytes, ZIP.length)
  assert.equal(result.supportGraduated, false)
})

test('MAT-022: no network calls for malformed evidence or invalid SHA', async () => {
  let calls = 0
  const spy = {
    getRun: async () => { calls++; return run() }, getArtifact: async () => { calls++; return artifact() },
    downloadArchive: async function* () { calls++; yield ZIP },
  }
  for (const bad of [{ ...proof(), sourceHead: 'main' }, { ...proof(), artifactId: 0 },
    { ...proof(), artifactName: '../insecure' }, { ...proof(), sha256: 'not-a-sha' }]) {
    const result = await verifyGithubArtifactProvenance(bad, spy)
    assert.equal(result.artifactDigestVerified, false)
  }
  assert.equal(calls, 0)
})

test('MAT-022: wrong run repository, SHA, conclusion and run URL never authorize artifact download', async () => {
  const invalidRuns = [
    { ...run(), head_sha: 'b'.repeat(40) },
    { ...run(), repository: { full_name: 'example/unrelated' } },
    { ...run(), conclusion: 'skipped' },
    { ...run(), html_url: 'https://github.com/example/else/actions/runs/120' },
  ]
  for (const invalid of invalidRuns) {
    let downloads = 0
    const p = { ...provider(invalid), downloadArchive: async function* () { downloads++; yield ZIP } }
    const result = await verifyGithubArtifactProvenance(proof(), p)
    assert.equal(result.artifactDigestVerified, false)
    assert.equal(downloads, 0)
  }
})

test('MAT-022: mismatched, expired and renamed archive metadata never authorize download', async () => {
  const invalidArtifacts = [
    { ...artifact(), id: 131 }, { ...artifact(), expired: true },
    { ...artifact(), workflow_run: { id: 999, head_sha: HEAD } },
    { ...artifact(), workflow_run: { id: 120, head_sha: 'b'.repeat(40) } },
    { ...artifact(), name: 'other' }, { ...artifact(), digest: undefined },
    { ...artifact(), digest: 'sha256:' + 'b'.repeat(64) },
    { ...artifact(), size_in_bytes: 129 * 1024 * 1024 },
    { ...artifact(), url: 'https://api.github.com/repos/foreign/repo/actions/artifacts/130' },
    { ...artifact(), archive_download_url: 'https://evil.example/zip' },
  ]
  for (const invalid of invalidArtifacts) {
    let downloads = 0
    const p = { ...provider(run(), invalid), downloadArchive: async function* () { downloads++; yield ZIP } }
    const result = await verifyGithubArtifactProvenance(proof(), p)
    assert.equal(result.artifactDigestVerified, false, JSON.stringify(invalid))
    assert.equal(downloads, 0)
  }
})

test('MAT-022: truncated or tampered bytes fail closed even if Actions metadata says successful', async () => {
  for (const bytes of [ZIP.subarray(0, ZIP.length - 1), Buffer.from(ZIP.toString().replace('archive', 'archiveX'))]) {
    const result = await verifyGithubArtifactProvenance(proof(), provider(run(), artifact(), bytes))
    assert.equal(result.artifactDigestVerified, false)
    assert.equal(result.supportGraduated, false)
  }
})

test('MAT-022: oversized byte stream and provider transport errors cannot become a proof', async () => {
  const oversized = { ...provider(), downloadArchive: async function* () { yield Buffer.alloc(129 * 1024 * 1024) } }
  assert.equal((await verifyGithubArtifactProvenance(proof(), oversized)).artifactDigestVerified, false)
  const broken = { ...provider(), getArtifact: async () => { throw new Error('API 403 forbidden') } }
  assert.equal((await verifyGithubArtifactProvenance(proof(), broken)).artifactDigestVerified, false)
  assert.equal((await verifyGithubArtifactProvenance(proof(), null)).artifactDigestVerified, false)
})
