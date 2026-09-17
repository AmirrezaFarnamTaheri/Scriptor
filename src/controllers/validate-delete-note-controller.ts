import assert from 'node:assert/strict'

import { createDeleteNoteController } from './deleteNoteController.ts'

async function run() {
  const order: string[] = []
  let releaseDelete: (() => void) | undefined
  let closeForce: boolean | undefined
  const controller = createDeleteNoteController({
    deleteNote: async (path) => {
      order.push(`delete:${path}`)
      await new Promise<void>((resolve) => {
        releaseDelete = resolve
      })
      return { path, deleted: true }
    },
    closeTab: async (path, force) => {
      order.push(`close:${path}`)
      closeForce = force
      return true
    },
    rebuildIndex: async () => {
      order.push('rebuild')
    },
    refreshVault: async () => {
      order.push('refresh')
    },
  })
  const first = controller.deleteNote('notes/a.md')
  const duplicate = await controller.deleteNote('notes/b.md')
  assert.deepEqual(duplicate, {
    ok: false,
    path: 'notes/b.md',
    stage: 'busy',
    reason: 'Deletion is already in progress.',
  })
  releaseDelete?.()
  assert.deepEqual(await first, { ok: true, path: 'notes/a.md' })
  assert.equal(closeForce, true, 'deleted notes must be force-closed without re-saving their draft')
  assert.deepEqual(order, ['delete:notes/a.md', 'close:notes/a.md', 'rebuild', 'refresh'])

  for (const failureStage of ['delete', 'close', 'rebuild', 'refresh'] as const) {
    const failureOrder: string[] = []
    const failing = createDeleteNoteController({
      deleteNote: async (path) => {
        failureOrder.push('delete')
        if (failureStage === 'delete') throw new Error('cancelled or disk failure')
        return { path, deleted: true }
      },
      closeTab: async () => {
        failureOrder.push('close')
        if (failureStage === 'close') throw new Error('tab close failed')
        return true
      },
      rebuildIndex: async () => {
        failureOrder.push('rebuild')
        if (failureStage === 'rebuild') throw new Error('rebuild failed')
      },
      refreshVault: async () => {
        failureOrder.push('refresh')
        if (failureStage === 'refresh') throw new Error('refresh failed')
      },
    })
    const outcome = await failing.deleteNote('notes/failure.md')
    assert.equal(outcome.ok, false)
    if (!outcome.ok) assert.equal(outcome.stage, failureStage)
    assert.deepEqual(
      failureOrder,
      failureStage === 'delete' ? ['delete'] : ['delete', 'close', 'rebuild', 'refresh'],
    )
  }

  const refusedClose = createDeleteNoteController({
    deleteNote: async (path) => ({ path, deleted: true }),
    closeTab: async (_path, force) => {
      assert.equal(force, true)
      return false
    },
    rebuildIndex: async () => undefined,
    refreshVault: async () => undefined,
  })
  assert.deepEqual(await refusedClose.deleteNote('notes/refused.md'), {
    ok: false,
    path: 'notes/refused.md',
    stage: 'close',
    reason: 'close: Deleted note tab could not be closed.',
  })

  const multipleFailures = createDeleteNoteController({
    deleteNote: async (path) => ({ path, deleted: true }),
    closeTab: async () => {
      throw new Error('tab close failed')
    },
    rebuildIndex: async () => {
      throw new Error('rebuild failed')
    },
    refreshVault: async () => undefined,
  })
  assert.deepEqual(await multipleFailures.deleteNote('notes/multiple.md'), {
    ok: false,
    path: 'notes/multiple.md',
    stage: 'close',
    reason: 'close: tab close failed; rebuild: rebuild failed',
  })
}

await run()
