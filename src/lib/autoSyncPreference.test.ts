import assert from 'node:assert/strict'
import test from 'node:test'
import { autoSyncPreferenceKey, readAutoSyncEnabled, writeAutoSyncEnabled, decideAutoSync } from './autoSyncPreference.ts'

test('auto-sync is ON for a connected project unless a user explicitly turns it OFF', () => {
  const saved = new Map<string, string>()
  const storage = {
    getItem: (key: string) => saved.get(key) ?? null,
    setItem: (key: string, value: string) => { saved.set(key, value) },
  }
  const key = autoSyncPreferenceKey('overleaf', 'vault-1', 'project-id', 'main.tex')
  assert.equal(readAutoSyncEnabled(storage, key), true)
  writeAutoSyncEnabled(storage, key, false)
  assert.equal(readAutoSyncEnabled(storage, key), false)
  writeAutoSyncEnabled(storage, key, true)
  assert.equal(readAutoSyncEnabled(storage, key), true)
})
test('disabling one authoring target never disables another account, project, or document', () => {
  const google = autoSyncPreferenceKey('google_drive', 'vault-1', 'writer@example.com', 'folder-1', 'notes/a.md')
  assert.notEqual(google, autoSyncPreferenceKey('google_drive', 'vault-1', 'another@example.com', 'folder-1', 'notes/a.md'))
  assert.notEqual(google, autoSyncPreferenceKey('google_drive', 'vault-2', 'writer@example.com', 'folder-1', 'notes/a.md'))
  assert.notEqual(google, autoSyncPreferenceKey('google_drive', 'vault-1', 'writer@example.com', 'folder-1', 'notes/b.md'))
  assert.notEqual(autoSyncPreferenceKey('overleaf', 'vault-1', 'proj001', 'main.tex'), autoSyncPreferenceKey('overleaf', 'vault-1', 'proj002', 'main.tex'))
  assert.throws(() => autoSyncPreferenceKey('overleaf', '', 'proj001', 'main.tex'))
  assert.throws(() => autoSyncPreferenceKey('overleaf', 'vault-1', 'proj001', '../main.tex'))
})
test('corrupt preferences and storage failures fail closed rather than silently starting sync', () => {
  const key = autoSyncPreferenceKey('overleaf', 'vault-1', 'proj001', 'main.tex')
  assert.equal(readAutoSyncEnabled({ getItem: () => 'true' }, key), false)
  assert.equal(readAutoSyncEnabled({ getItem: () => { throw new Error('blocked') } }, key), false)
  assert.throws(() => writeAutoSyncEnabled({ setItem: () => { throw new Error('full') } }, key, false))
})
test('automatic sync only modifies fast-forward copies after a known shared baseline', () => {
  assert.equal(decideAutoSync(null, 'local', 'remote'), 'review')
  assert.equal(decideAutoSync(null, 'same', 'same'), 'equal')
  assert.equal(decideAutoSync('same', 'same', 'changed remotely'), 'pull')
  assert.equal(decideAutoSync('same', 'changed locally', 'same'), 'push')
  assert.equal(decideAutoSync('same', 'changed locally', 'changed remotely'), 'review')
  assert.equal(decideAutoSync('same', 'same', null), 'review')
  assert.equal(decideAutoSync('same', 'same', 'same'), 'equal')
})
