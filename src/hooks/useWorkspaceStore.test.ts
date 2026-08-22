import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createWorkspaceBundle } from '@scriptor/portal'

import { createVaultWorkspacePersistence } from './useWorkspaceStore.ts'

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

describe('vault workspace persistence', () => {
  it('composes updates made before React has rendered the first one', () => {
    const persistence = createVaultWorkspacePersistence(createWorkspaceBundle())

    persistence.apply((current) => ({
      ...current,
      portal: { ...current.portal, items: [{ ...current.portal.items[0]!, title: 'Portal update' }] },
    }))
    persistence.apply((current) => ({
      ...current,
      quickCapture: { ...current.quickCapture, scratchpad: { body: 'Quick capture update' } },
    }))

    assert.equal(persistence.current().portal.items[0]?.title, 'Portal update')
    assert.equal(persistence.current().quickCapture.scratchpad.body, 'Quick capture update')
  })

  it('does not let a late hydration replace a newer local update', () => {
    const persistence = createVaultWorkspacePersistence(createWorkspaceBundle())
    const { generation, revision } = persistence.beginVault('vault-a')

    persistence.apply((current) => ({
      ...current,
      quickCapture: { ...current.quickCapture, scratchpad: { body: 'newer local draft' } },
    }))

    assert.equal(persistence.canApplyHydration(generation, revision), false)
  })

  it('does not reset the current bundle when a bridge callback changes within one vault', () => {
    const persistence = createVaultWorkspacePersistence(createWorkspaceBundle())
    persistence.beginVault('vault-a')
    persistence.apply((current) => ({
      ...current,
      quickCapture: { ...current.quickCapture, scratchpad: { body: 'keep this draft' } },
    }))

    const repeated = persistence.beginVault('vault-a')

    assert.equal(repeated.changed, false)
    assert.equal(persistence.current().quickCapture.scratchpad.body, 'keep this draft')
  })

  it('skips queued writes after the active vault changes', async () => {
    const persistence = createVaultWorkspacePersistence(createWorkspaceBundle())
    const firstVault = persistence.beginVault('vault-a')
    const gate = deferred<void>()
    const started: string[] = []

    const first = persistence.enqueueWrite('vault-a', firstVault.generation, async () => {
      started.push('first')
      await gate.promise
    })
    const stale = persistence.enqueueWrite('vault-a', firstVault.generation, async () => {
      started.push('stale')
    })

    await Promise.resolve()
    persistence.beginVault('vault-b')
    gate.resolve()
    await Promise.all([first, stale])

    assert.deepEqual(started, ['first'])
  })
})
