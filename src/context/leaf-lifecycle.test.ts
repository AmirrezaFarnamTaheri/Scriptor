import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createWorkspaceLeafLifecycle } from './leaf-lifecycle.ts'

test('closing one leaf invokes only its owners and failed shutdown remains retryable', async () => {
  const lifecycle = createWorkspaceLeafLifecycle()
  let otherCalls = 0, attempts = 0
  lifecycle.registerGuard('source', async () => { otherCalls += 1; return false })
  lifecycle.registerGuard('runtime', async () => ++attempts > 1)
  assert.equal(await lifecycle.requestClose('runtime'), false)
  assert.equal(otherCalls, 0)
  assert.equal(await lifecycle.requestClose('runtime'), true)
  assert.equal(attempts, 2)
})

test('concurrent close requests share the same pending decision and cancellation', async () => {
  const lifecycle = createWorkspaceLeafLifecycle()
  let calls = 0, resolve!: (answer: boolean) => void
  lifecycle.registerGuard('dirty', () => { calls += 1; return new Promise<boolean>(accept => { resolve = accept }) })
  const first = lifecycle.requestClose('dirty')
  const second = lifecycle.requestClose('dirty')
  assert.equal(first, second)
  resolve(false)
  assert.equal(await first, false)
  assert.equal(calls, 1)
})

test('guard failures or changed ownership fail closed, and unregistered clean leaves close', async () => {
  const lifecycle = createWorkspaceLeafLifecycle()
  const unregister = lifecycle.registerGuard('broken', async () => { throw new Error('Save failed') })
  assert.equal(await lifecycle.requestClose('broken'), false)
  unregister()
  assert.equal(await lifecycle.requestClose('broken'), true)
  let resolve!: (answer: boolean) => void
  const release = lifecycle.registerGuard('replaced', () => new Promise<boolean>(accept => { resolve = accept }))
  const close = lifecycle.requestClose('replaced')
  release()
  lifecycle.registerGuard('replaced', async () => true)
  resolve(true)
  assert.equal(await close, false)
})
