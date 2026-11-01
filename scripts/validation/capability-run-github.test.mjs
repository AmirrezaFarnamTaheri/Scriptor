import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createGithubRunProvider } from './capability-run-github.mjs'

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json' },
})

test('MAT-022: GitHub metadata provider reads only the owned repository with token kept in headers', async () => {
  const calls = []
  const provider = createGithubRunProvider('test-token', async (url, options) => {
    calls.push({ url, options })
    return json({ id: 100, status: 'completed' })
  })
  assert.deepEqual(await provider.getRun(100), { id: 100, status: 'completed' })
  assert.deepEqual(calls.map(call => call.url), [
    'https://api.github.com/repos/AmirrezaFarnamTaheri/Scriptor/actions/runs/100',
  ])
  assert.equal(calls[0].options.headers.Authorization, 'Bearer test-token')
  assert.equal(JSON.stringify(calls.map(call => call.url)).includes('test-token'), false)
})

test('MAT-022: job steps from a 100-item page cannot hide relevant evidence on page two', async () => {
  const calls = []
  const provider = createGithubRunProvider('test-token', async url => {
    calls.push(url)
    return url.endsWith('&page=1') ? json({ jobs: Array.from({ length: 100 }, (_, id) => ({ id })) })
      : json({ jobs: [{ id: 101, steps: [{ name: 'tests.restart', conclusion: 'success' }] }] })
  })
  const result = await provider.getJobs(100)
  assert.equal(result.jobs.length, 101)
  assert.ok(result.jobs.some(job => job.id === 101))
  assert.equal(calls.length, 2)
  assert.equal(calls.every(url => url.startsWith('https://api.github.com/repos/AmirrezaFarnamTaheri/Scriptor/actions/runs/100/jobs?')), true)
})

test('MAT-022: inaccessible API, absent token and untrusted run IDs fail closed', async () => {
  assert.throws(() => createGithubRunProvider(''), /token|credential/i)
  const provider = createGithubRunProvider('test-token', async () => json({ message: 'forbidden' }, 403))
  await assert.rejects(provider.getRun(100), /403/)
  await assert.rejects(provider.getJobs(100), /403/)
  await assert.rejects(provider.getRun(Number.MAX_SAFE_INTEGER + 1), /run id/i)
  await assert.rejects(provider.getJobs(-2), /run id/i)
})

test('MAT-022: malformed or unbounded job collections cannot falsely establish complete evidence', async () => {
  const malformed = createGithubRunProvider('test-token', async () => json({ jobs: 'unknown' }))
  await assert.rejects(malformed.getJobs(100), /job list|jobs/i)
  let requests = 0
  const oversized = createGithubRunProvider('test-token', async () => {
    requests++
    return json({ jobs: Array.from({ length: 100 }, (_, id) => ({ id })) })
  })
  await assert.rejects(oversized.getJobs(100), /too many|limit|page/i)
  assert.equal(requests, 10)
})
