import assert from 'node:assert/strict'
import { test } from 'node:test'
import { coordinateNoteMutation } from './coordinateNoteMutation.ts'

test('MAT-005 prevents a delayed save from mutating an earlier note after navigation', async () => {
  let finishSave: (value: boolean) => void = () => { throw new Error('Save was not pending') }
  let current = true
  const writes: string[] = []
  const pending = coordinateNoteMutation({
    sourcePath: 'notes/a.md', activePath: 'notes/a.md', isDirty: true,
    saveActiveNote: () => new Promise<boolean>(resolve => { finishSave = resolve }),
    isStillCurrent: () => current,
    runMutation: async () => { writes.push('mutated a.md') },
  })
  current = false
  finishSave(true)
  assert.equal(await pending, false)
  assert.deepEqual(writes, [], 'no post-save mutation in stale vault or note')
})

test('MAT-005 refuses metadata mutation when a new draft edit arrives during flush', async () => {
  let finishSave: (value: boolean) => void = () => { throw new Error('Save was not pending') }
  let revision = 4
  let writes = 0
  const pending = coordinateNoteMutation({
    sourcePath: 'draft.md', activePath: 'draft.md', isDirty: true,
    saveActiveNote: () => new Promise<boolean>(resolve => { finishSave = resolve }),
    isStillCurrent: () => revision === 4,
    runMutation: async () => { writes++ },
  })
  revision++
  finishSave(true)
  assert.equal(await pending, false)
  assert.equal(writes, 0)
})

test('MAT-005 allows a current successful flush to proceed once', async () => {
  const actions: string[] = []
  const result = await coordinateNoteMutation({
    sourcePath: 'draft.md', activePath: 'draft.md', isDirty: true,
    saveActiveNote: async () => { actions.push('save'); return true },
    isStillCurrent: () => true,
    runMutation: async () => { actions.push('mutate') },
  })
  assert.equal(result, true)
  assert.deepEqual(actions, ['save', 'mutate'])
})

test('MAT-005 blocks the native call when the mutation origin is already stale', async () => {
  let writes = 0
  const result = await coordinateNoteMutation({
    sourcePath: 'other.md', activePath: 'draft.md', isDirty: false,
    saveActiveNote: async () => { throw new Error('unexpected flush') },
    isStillCurrent: () => false,
    runMutation: async () => { writes++ },
  })
  assert.equal(result, false)
  assert.equal(writes, 0)
})
