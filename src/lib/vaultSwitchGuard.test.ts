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
