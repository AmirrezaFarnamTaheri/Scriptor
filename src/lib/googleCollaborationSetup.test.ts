import assert from 'node:assert/strict'
import { test } from 'node:test'
import { acceptGoogleResourcePage, googleCollaborationMappingKey, parseGoogleCollaborationSetup, appendGoogleResources } from './googleCollaborationSetup.ts'

test('collaboration setup preserves public folder and transport while accepting legacy configuration', () => {
  assert.deepEqual(parseGoogleCollaborationSetup({ google_drive_folder_id: 'folder-id', google_drive_transport: 'google_docs' }), { folderId: 'folder-id', transport: 'google_docs' })
  assert.deepEqual(parseGoogleCollaborationSetup(undefined), { folderId: '', transport: 'drive_json' })
  assert.throws(() => parseGoogleCollaborationSetup({ google_drive_folder_id: '../bad' }))
  assert.throws(() => parseGoogleCollaborationSetup({ google_drive_transport: 'execute' }))
})

test('collaboration ancestors require confirmed account identity and remain isolated across accounts and vaults', () => {
  const key = googleCollaborationMappingKey('Account@example.com', 'vault', 'folder', 'Note.md')
  assert.equal(key, googleCollaborationMappingKey('account@example.com', 'vault', 'folder', 'Note.md'))
  assert.notEqual(key, googleCollaborationMappingKey('other@example.com', 'vault', 'folder', 'Note.md'))
  assert.notEqual(key, googleCollaborationMappingKey('account@example.com', 'other-vault', 'folder', 'Note.md'))
  assert.notEqual(key, googleCollaborationMappingKey('account@example.com', 'vault', 'other-folder', 'Note.md'))
  assert.throws(() => googleCollaborationMappingKey('', 'vault', 'folder', 'Note.md'))
})

test('resource pages deduplicate identities and stop at the browsing bound', () => {
  assert.deepEqual(appendGoogleResources([{ id: 'a', name: 'Old' }], [{ id: 'a', name: 'Duplicate' }, { id: 'b', name: 'New' }]), [{ id: 'a', name: 'Old' }, { id: 'b', name: 'New' }])
  assert.equal(appendGoogleResources([], Array.from({ length: 1100 }, (_, i) => ({ id: String(i), name: String(i) }))).length, 1000)
})

test('resource pagination rejects cycles before consuming an invalid page', () => {
  const seen = new Set<string>()
  acceptGoogleResourcePage(undefined, 'page-2', seen)
  acceptGoogleResourcePage('page-2', 'page-3', seen)
  assert.throws(() => acceptGoogleResourcePage('page-3', 'page-2', seen), /repeated/)
  assert.deepEqual([...seen], ['', 'page-2'])
  assert.throws(() => acceptGoogleResourcePage('page-2', undefined, seen), /repeated/)
})

test('resource pagination distinguishes a completed bounded listing from a truncated one', () => {
  const seen = new Set<string>()
  for (let page = 0; page < 9; page++) acceptGoogleResourcePage(page ? `page-${page}` : undefined, `page-${page + 1}`, seen)
  assert.throws(() => acceptGoogleResourcePage('page-9', 'page-10', seen), /ten pages/)
  assert.equal(seen.size, 9)
  acceptGoogleResourcePage('page-9', undefined, seen)
  assert.equal(seen.size, 10)
})
