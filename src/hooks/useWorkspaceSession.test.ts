import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createVaultBoundSessionWrites } from './workspace-session-persistence.ts'

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

describe('vault-bound workspace session writes', () => {
  it('does not run queued session writes after a vault switch', async () => {
    const writes = createVaultBoundSessionWrites()
    const vaultA = writes.beginVault('vault-a')
    const gate = deferred<void>()
    const started: string[] = []

    const first = writes.enqueue('vault-a', vaultA, async () => {
      started.push('first')
      await gate.promise
    })
    const stale = writes.enqueue('vault-a', vaultA, async () => {
      started.push('stale')
    })

    await Promise.resolve()
    writes.beginVault('vault-b')
    gate.resolve()
    await Promise.all([first, stale])

    assert.deepEqual(started, ['first'])
  })

  it('preserves the ordering of writes for one vault', async () => {
    const writes = createVaultBoundSessionWrites()
    const generation = writes.beginVault('vault-a')
    const gate = deferred<void>()
    const started: string[] = []

    const first = writes.enqueue('vault-a', generation, async () => {
      started.push('first')
      await gate.promise
    })
    const second = writes.enqueue('vault-a', generation, async () => {
      started.push('second')
    })

    await Promise.resolve()
    assert.deepEqual(started, ['first'])
    gate.resolve()
    await Promise.all([first, second])
    assert.deepEqual(started, ['first', 'second'])
  })
})
