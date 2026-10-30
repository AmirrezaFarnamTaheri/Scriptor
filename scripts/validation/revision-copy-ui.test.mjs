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

test('MAT-004: changed vault, revision or preview cannot complete a stale create-only action', () => {
  assert.match(history, /selectedRevision\?\.content_hash/)
  for (const field of ['vaultId', 'sourcePath', 'revisionId', 'reviewedMarkdown']) {
    assert.match(form, new RegExp('originRef\\.current\\.' + field + ' === origin\\.' + field))
  }
  assert.match(form, /isCurrent: isCurrentOrigin/)
  assert.doesNotMatch(form, /setConfirmCopy\(false\) \}, \[reviewedMarkdown\]/)
})
