import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const form = readFileSync(new URL('../../src/components/RevisionCopyForm.tsx', import.meta.url), 'utf8')
const history = readFileSync(new URL('../../src/components/NoteHistoryPanel.tsx', import.meta.url), 'utf8')

test('MAT-004: history offers reviewed create-only revision copies without destructive restore', () => {
  assert.match(history, /<RevisionCopyForm/)
  assert.match(history, /previewReady && currentReady/)
  assert.match(form, /copyReviewedRevisionAsNewNote/)
  assert.match(form, /vaultSaveNote\(path, markdown, expectedHash, false, expectedVaultId\)/)
  assert.match(form, /readRevision: vaultReadNoteHistoryRevision/)
  assert.match(form, /Confirm separate revision copy/)
  assert.doesNotMatch(form, /vaultRestoreNoteHistoryRevision/)
})
