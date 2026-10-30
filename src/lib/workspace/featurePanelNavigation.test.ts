import assert from 'node:assert/strict'
import { test } from 'node:test'
import { openNoteBeforeDismissingPanel } from './featurePanelNavigation.ts'

test('MAT-006 waits for workspace approval before dismissing the originating feature panel', async () => {
  let finish: (approved: boolean) => void = () => {}
  const approval = new Promise<boolean>(resolve => { finish = resolve })
  let dismissed = 0
  let openedPath = ''
  const transition = openNoteBeforeDismissingPanel('notes/current.md', async path => {
    openedPath = path
    return approval
  }, () => { dismissed++ })
  assert.equal(openedPath, 'notes/current.md')
  assert.equal(dismissed, 0, 'panel must remain visible during async editor approval')
  finish(true)
  assert.equal(await transition, true)
  assert.equal(dismissed, 1, 'success closes only after approval')
})

test('MAT-006 blocked dirty-editor navigation keeps the initiating feature panel open', async () => {
  let dismissed = 0
  const approved = await openNoteBeforeDismissingPanel('notes/blocked.md', async () => false, () => { dismissed++ })
  assert.equal(approved, false)
  assert.equal(dismissed, 0)
})

test('MAT-006 native read rejection preserves the panel and propagates the original error', async () => {
  let dismissed = 0
  const denial = new Error('Native vault read denied')
  await assert.rejects(
    openNoteBeforeDismissingPanel('notes/unavailable.md', async () => { throw denial }, () => { dismissed++ }),
    error => error === denial,
  )
  assert.equal(dismissed, 0)
})

test('MAT-006 empty navigation target cannot close a feature panel', async () => {
  let opened = 0
  let dismissed = 0
  assert.equal(await openNoteBeforeDismissingPanel('  ', async () => { opened++; return true }, () => { dismissed++ }), false)
  assert.equal(opened, 0)
  assert.equal(dismissed, 0)
})
