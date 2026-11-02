import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createGithubArtifactProvider } from './capability-artifact-github.mjs'

const API = 'https://api.github.com/repos/AmirrezaFarnamTaheri/Scriptor/actions/'
const signed = 'https://test-results.blob.core.windows.net/artifacts/130?sig=temporary'
const zip = Buffer.from('zip archive test bytes')
const response = (body, status = 200) => new Response(JSON.stringify(body), { status,
  headers: { 'content-type': 'application/json' } })

test('MAT-022: authenticated metadata and token-free approved signed ZIP transport', async () => {
  const calls = []
  const provider = createGithubArtifactProvider('test-token', async (url, options) => {
    calls.push({ url, options })
    if (url === API + 'runs/120') return response({ id: 120 })
    if (url === API + 'artifacts/130') return response({ id: 130, digest: 'sha256:' + 'a'.repeat(64) })
    if (url === API + 'artifacts/130/zip') {
      return new Response(null, { status: 302, headers: { location: signed } })
    }
    assert.equal(url, signed)
    return new Response(zip, { status: 200 })
  })
  assert.equal((await provider.getRun(120)).id, 120)
  assert.equal((await provider.getArtifact(130)).id, 130)
  const chunks = []
  for await (const chunk of provider.downloadArchive(130)) chunks.push(chunk)
  assert.deepEqual(Buffer.concat(chunks), zip)
  assert.equal(calls.length, 4)
  assert.equal(calls[0].options.headers.Authorization, 'Bearer test-token')
  assert.equal(calls[1].options.headers.Authorization, 'Bearer test-token')
  assert.equal(calls[2].options.headers.Authorization, 'Bearer test-token')
  assert.equal(calls[2].options.redirect, 'manual')
  assert.equal(calls[3].options?.headers?.Authorization, undefined)
  assert.equal(calls[3].options.redirect, 'error')
  assert.equal(calls[3].options.credentials, 'omit')
})

test('MAT-022: missing credentials and untrusted identifiers cannot initiate requests', async () => {
  assert.throws(() => createGithubArtifactProvider(''), /token/i)
  assert.throws(() => createGithubArtifactProvider('bad\ntoken'), /token/i)
  let calls = 0
  const p = createGithubArtifactProvider('test-token', async () => { calls++; return response({ id: 1 }) })
  await assert.rejects(p.getRun(0), /id/i)
  await assert.rejects(p.getArtifact(Number.MAX_SAFE_INTEGER + 1), /id/i)
  await assert.rejects(async () => { for await (const chunk of p.downloadArchive(-1)) void chunk }, /id/i)
  assert.equal(calls, 0)
})

test('MAT-022: an untrusted or plain HTTP redirect is refused without following', async () => {
  for (const location of ['http://test-results.blob.core.windows.net/file',
    'https://evil.example/file', 'https://127.0.0.1/file', 'https://user:pass@test-results.blob.core.windows.net/file']) {
    let calls = 0
    const p = createGithubArtifactProvider('test-token', async (url) => {
      calls++
      assert.equal(url, API + 'artifacts/130/zip')
      return new Response(null, { status: 302, headers: { location } })
    })
    await assert.rejects(async () => { for await (const chunk of p.downloadArchive(130)) void chunk }, /redirect|untrusted/i)
    assert.equal(calls, 1)
  }
})

test('MAT-022: missing CDN body, failed metadata and non-redirect downloads fail closed', async () => {
  const error = createGithubArtifactProvider('test-token', async () => response({ message: 'no' }, 403))
  await assert.rejects(error.getArtifact(130), /403/)
  await assert.rejects(async () => { for await (const chunk of error.downloadArchive(130)) void chunk }, /403/)
  const invalid = createGithubArtifactProvider('test-token', async () => response({ html: 'not a zip' }, 200))
  await assert.rejects(async () => { for await (const chunk of invalid.downloadArchive(130)) void chunk }, /redirect/i)
  const empty = createGithubArtifactProvider('test-token', async url => url.includes('/zip')
    ? new Response(null, { status: 302, headers: { location: signed } })
    : new Response(null, { status: 200 }))
  await assert.rejects(async () => { for await (const chunk of empty.downloadArchive(130)) void chunk }, /empty|body/i)
})
