import test from 'node:test'
import assert from 'node:assert/strict'
import https from 'node:https'
import { EventEmitter } from 'node:events'
import { Readable } from 'node:stream'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { downloadAsset, httpsGet } from './fetch-github-release-asset.mjs'

function mockRequests(t, responses) {
  const requests = []
  t.mock.method(https, 'get', (options, callback) => {
    requests.push(options)
    const request = new EventEmitter()
    request.setTimeout = () => request
    request.destroy = error => { if (error) request.emit('error', error) }
    const response = responses.shift()
    queueMicrotask(() => callback(response))
    return request
  })
  return requests
}

function response(statusCode, location, chunks = []) {
  const stream = Readable.from(chunks)
  stream.statusCode = statusCode
  stream.headers = location ? { location } : {}
  return stream
}

test('HTTPS redirects remove authorization when the origin changes', async t => {
  const requests = mockRequests(t, [response(302, 'https://cdn.example/asset'), response(200)])
  await httpsGet('https://api.github.com/asset', { Authorization: 'Bearer private', Cookie: 'session=private' })
  assert.equal(requests[0].headers.Authorization, 'Bearer private')
  assert.equal(requests[1].headers.Authorization, undefined)
  assert.equal(requests[1].headers.Cookie, undefined)
})

test('relative redirects preserve origin and resolve against the current URL', async t => {
  const requests = mockRequests(t, [response(307, '../next'), response(200)])
  await httpsGet('https://api.github.com/releases/asset', { Authorization: 'Bearer private' })
  assert.equal(requests[1].hostname, 'api.github.com')
  assert.equal(requests[1].path, '/next')
  assert.equal(requests[1].headers.Authorization, 'Bearer private')
})

test('redirects reject non-HTTPS destinations before making a second request', async t => {
  const requests = mockRequests(t, [response(302, 'http://api.github.com/plain')])
  await assert.rejects(httpsGet('https://api.github.com/asset'), /HTTPS/)
  assert.equal(requests.length, 1)
})

test('failed downloads preserve the previous complete binary and remove partial output', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'scriptor-release-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const output = join(directory, 'daemon.exe')
  await writeFile(output, 'previous complete binary')
  const broken = response(200, undefined)
  broken._read = function () { this.push('partial'); this.destroy(new Error('disconnected')) }
  mockRequests(t, [broken])
  await assert.rejects(downloadAsset('https://github.com/asset', output), /disconnected/)
  assert.equal(await readFile(output, 'utf8'), 'previous complete binary')
  assert.deepEqual(await readdir(directory), ['daemon.exe'])
})

test('integrity failures preserve existing output and discard temporary files', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'scriptor-release-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const output = join(directory, 'daemon.exe')
  await writeFile(output, 'previous complete binary')
  mockRequests(t, [response(200, undefined, [Buffer.from('new')]), response(200, undefined, [Buffer.from('new')])])
  await assert.rejects(downloadAsset('https://github.com/asset', output, { expectedSize: 4 }), /size mismatch/)
  await assert.rejects(downloadAsset('https://github.com/asset', output, { expectedSize: 3, expectedSha256: '0'.repeat(64) }), /SHA-256 mismatch/)
  assert.equal(await readFile(output, 'utf8'), 'previous complete binary')
  assert.deepEqual(await readdir(directory), ['daemon.exe'])
})

test('verified downloads promote only the complete body over existing output', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'scriptor-release-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const output = join(directory, 'daemon.exe')
  await writeFile(output, 'previous complete binary')
  const body = Buffer.from('verified binary')
  mockRequests(t, [response(200, undefined, [body.subarray(0, 4), body.subarray(4)])])
  await downloadAsset('https://github.com/asset', output, {
    expectedSize: body.length, expectedSha256: createHash('sha256').update(body).digest('hex'),
  })
  assert.deepEqual(await readFile(output), body)
  assert.deepEqual(await readdir(directory), ['daemon.exe'])
})

test('redirect cycles are bounded and credentials cannot return after crossing origins', async t => {
  const requests = mockRequests(t, [
    response(302, 'https://cdn.example/asset'), response(302, 'https://api.github.com/asset'),
    response(302, 'https://cdn.example/asset'),
  ])
  await assert.rejects(httpsGet('https://api.github.com/asset', { Authorization: 'Bearer private' }, 2), /redirect/i)
  assert.equal(requests.length, 3)
  assert.equal(requests[1].headers.Authorization, undefined)
  assert.equal(requests[2].headers.Authorization, undefined)
})
