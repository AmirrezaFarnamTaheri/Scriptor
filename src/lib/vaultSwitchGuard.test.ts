import assert from 'node:assert/strict'
import test from 'node:test'
import { prepareVaultSwitch, type VaultSwitchDetail } from './vaultSwitchGuard.ts'

test('vault change waits for registered persistence and respects cancellation or failure', async () => {
  const target = new EventTarget()
  let release!: (allowed: boolean) => void
  target.addEventListener('scriptor:vault-change-starting', event => {
    ;(event as CustomEvent<VaultSwitchDetail>).detail.waitUntil(new Promise(resolve => { release = resolve }))
  })
  let finished = false
  const pending = prepareVaultSwitch(target).then(value => { finished = true; return value })
  await Promise.resolve()
  assert.equal(finished, false)
  release(false)
  assert.equal(await pending, false)
  const failed = new EventTarget()
  failed.addEventListener('scriptor:vault-change-starting', event => {
    ;(event as CustomEvent<VaultSwitchDetail>).detail.waitUntil(Promise.reject(new Error('Save failed')))
  })
  assert.equal(await prepareVaultSwitch(failed), false)
  assert.equal(await prepareVaultSwitch(new EventTarget()), true)
})

test('dirty source decisions start sequentially so the next revealed prompt waits for approval', async () => {
  const target = new EventTarget()
  const revealed: string[] = []
  let release!: (allowed: boolean) => void
  target.addEventListener('scriptor:vault-change-starting', event => {
    const detail = (event as CustomEvent<VaultSwitchDetail>).detail
    detail.waitUntil(() => { revealed.push('first'); return new Promise(resolve => { release = resolve }) })
    detail.waitUntil(async () => { revealed.push('second'); return true })
  })
  const pending = prepareVaultSwitch(target)
  await Promise.resolve()
  assert.deepEqual(revealed, ['first'])
  release(true)
  assert.equal(await pending, true)
  assert.deepEqual(revealed, ['first', 'second'])
})

test('refusal or thrown deferred save stops later prompts and observes eager failures', async () => {
  for (const guard of [async () => false, async () => { throw new Error('Save failed') }]) {
    const target = new EventTarget()
    let later = false
    target.addEventListener('scriptor:vault-change-starting', event => {
      const detail = (event as CustomEvent<VaultSwitchDetail>).detail
      detail.waitUntil(guard)
      detail.waitUntil(async () => { later = true; return true })
      detail.waitUntil(Promise.reject(new Error('Already running cleanup failed')))
    })
    assert.equal(await prepareVaultSwitch(target), false)
    assert.equal(later, false)
    await new Promise(resolve => setTimeout(resolve, 0))
  }
})
