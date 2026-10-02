import assert from 'node:assert/strict'
import { test } from 'node:test'
import { applyPluginManagerTransition } from './pluginManagerTransition.ts'

test('refused registry transition never changes persisted module state', async () => {
  const writes: boolean[] = []
  assert.equal(await applyPluginManagerTransition('plugin.test', true, async () => false, async value => { writes.push(value) }), false)
  assert.deepEqual(writes, [])
})

test('module persistence occurs only after approved registry transition', async () => {
  const steps: string[] = []
  assert.equal(await applyPluginManagerTransition('plugin.test', false, async () => { steps.push('registry'); return true }, async () => { steps.push('persist') }), true)
  assert.deepEqual(steps, ['registry', 'persist'])
})

test('registry error aborts persistence and persistence failure remains visible', async () => {
  let writes = 0
  await assert.rejects(applyPluginManagerTransition('plugin.test', true, async () => { throw new Error('authority') }, async () => { writes++ }), /authority/)
  assert.equal(writes, 0)
  await assert.rejects(applyPluginManagerTransition('plugin.test', true, async () => true, async () => { throw new Error('save') }), /save/)
})
