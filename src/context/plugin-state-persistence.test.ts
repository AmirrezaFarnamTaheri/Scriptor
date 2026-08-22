import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createPluginStatePersistenceQueue } from './plugin-state-persistence.ts'

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

describe('plugin state persistence queue', () => {
  it('does not allow an older save to overtake a newer toggle', async () => {
    const queue = createPluginStatePersistenceQueue()
    const first = deferred<void>()
    const started: string[] = []

    const firstSave = queue.enqueue(async () => {
      started.push('enable')
      await first.promise
    })
    const secondSave = queue.enqueue(async () => {
      started.push('disable')
    })

    await Promise.resolve()
    assert.deepEqual(started, ['enable'])
    first.resolve()
    await Promise.all([firstSave, secondSave])
    assert.deepEqual(started, ['enable', 'disable'])
  })

  it('continues with later toggles after a failed save', async () => {
    const queue = createPluginStatePersistenceQueue()
    const started: string[] = []

    const failed = queue.enqueue(async () => {
      started.push('failed')
      throw new Error('disk unavailable')
    })
    const later = queue.enqueue(async () => {
      started.push('later')
    })

    await assert.rejects(failed, /disk unavailable/)
    await later
    assert.deepEqual(started, ['failed', 'later'])
  })
})
