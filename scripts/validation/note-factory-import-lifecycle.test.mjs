import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const source = ts.transpileModule(readFileSync(new URL('../../src/hooks/useWorkspaceNoteFactory.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText

test('a Gmail note saved during vault replacement cannot navigate or change the new workspace', async () => {
  let current = true, release, entered
  const started = new Promise(done => { entered = done })
  const pendingSave = new Promise(done => { release = done })
  const calls = []
  const module = { exports: {} }
  vm.runInNewContext(source, {
    module, exports: module.exports,
    require: id => id === 'react' ? { useCallback: fn => fn }
      : id.includes('/bridge/') ? {
        vaultSaveNote: async (...args) => { calls.push(['save', ...args]); entered(); await pendingSave },
        indexerUpdateNote: async () => calls.push(['index']),
      } : { defaultNotePath: title => `${title}.md` },
  })
  const factory = module.exports.useWorkspaceNoteFactory({
    vault: { id: 'vault-a' }, vaultConfig: {}, setError: () => calls.push(['error']),
    refreshVaultCore: async () => calls.push(['refresh']), openNote: async () => calls.push(['open']),
    setSidebarView: () => calls.push(['sidebar']), logActivity: () => calls.push(['activity']),
  })
  const imported = factory.createNote('Email', '# Email', { requireMissing: true, isCurrent: () => current })
  await started; current = false; release()
  assert.equal(await imported, 'Email.md')
  assert.deepEqual(calls.map(call => call[0]), ['error', 'save'])
  assert.equal(calls[1].at(-1), 'vault-a')
})


test('all new-note entry points use native create-only compare-and-swap', async () => {
  const saves = []
  const module = { exports: {} }
  vm.runInNewContext(source, {
    module, exports: module.exports,
    require: id => id === 'react' ? { useCallback: fn => fn }
      : id === '@scriptor/core/date' ? { formatLocalDate: () => '2026-10-14' }
      : id.includes('/bridge/') ? {
        vaultBuildNoteMarkdown: async title => '# ' + title,
        vaultLoadTemplate: async () => '# Template',
        vaultPlanDailyNote: async () => ({ path: 'daily/2026-10-14.md', markdown: '# Daily' }),
        vaultReadNote: async () => { throw new Error('not found') },
        vaultSaveNote: async (...args) => { saves.push(args) },
        indexerUpdateNote: async () => {},
      }
      : id.includes('/knowledge/dailyNote') ? { offsetIsoDate: () => '2026-10-14' }
      : { defaultNotePath: title => title + '.md' },
  })
  const factory = module.exports.useWorkspaceNoteFactory({
    vault: { id: 'test-vault' }, vaultConfig: {}, noteTypes: [], inboxNotes: [],
    setError: () => {}, setSidebarView: () => {}, logActivity: () => {},
    refreshVaultCore: async () => {}, refreshNoteSummaries: async () => {},
    openNote: async () => true, syncActiveNoteContent: async () => {},
  })
  await factory.createNote()
  await factory.createNoteOfType('Idea')
  await factory.createNoteFromTemplate('Templates/base.md')
  await factory.createDailyNoteForOffset(0)
  await factory.createNoteFromWikilink('Reference')
  assert.equal(saves.length, 5)
  for (const args of saves) {
    assert.equal(args[2], '<missing>', args[0] + ' should never silently overwrite')
    assert.equal(args[4], 'test-vault')
  }
})

test('daily note read failure cannot replace an existing destination', async () => {
  const actions = []
  const module = { exports: {} }
  vm.runInNewContext(source, {
    module, exports: module.exports,
    require: id => id === 'react' ? { useCallback: fn => fn }
      : id === '@scriptor/core/date' ? { formatLocalDate: () => '2026-10-14' }
      : id.includes('/bridge/') ? {
        vaultPlanDailyNote: async () => ({ path: 'daily/2026-10-14.md', markdown: '# New daily' }),
        vaultReadNote: async () => { throw new Error('Transient read failed') },
        vaultSaveNote: async (path, markdown, expected) => {
          assert.equal(expected, '<missing>')
          actions.push('attempted-create-only')
          throw new Error('Hash mismatch: existing daily note preserved')
        },
      }
      : id.includes('/knowledge/dailyNote') ? { offsetIsoDate: () => '2026-10-14' }
      : { defaultNotePath: title => title + '.md' },
  })
  const factory = module.exports.useWorkspaceNoteFactory({
    vault: { id: 'test-vault' }, vaultConfig: {}, noteTypes: [], inboxNotes: [],
    setError: error => actions.push(error), setSidebarView: () => {}, logActivity: () => {},
    refreshVaultCore: async () => {}, refreshNoteSummaries: async () => {},
    openNote: async () => { actions.push('open'); return true },
    syncActiveNoteContent: async () => {},
  })
  await factory.createDailyNoteForOffset(0)
  assert.deepEqual(actions, [
    'attempted-create-only',
    'Hash mismatch: existing daily note preserved',
  ])
})


test('repeated New commands use numbered filenames without clobbering prior notes', async () => {
  const existing = new Map()
  const module = { exports: {} }
  vm.runInNewContext(source, {
    module, exports: module.exports,
    require: id => id === 'react' ? { useCallback: fn => fn }
      : id === '@scriptor/core/date' ? { formatLocalDate: () => '2026-10-14' }
      : id.includes('/bridge/') ? {
        vaultBuildNoteMarkdown: async title => '# ' + title,
        vaultSaveNote: async (path, markdown, expected) => {
          assert.equal(expected, '<missing>')
          if (existing.has(path)) throw new Error('content hash mismatch for ' + path + '; expected <missing>, found oldhash')
          existing.set(path, markdown)
        },
        indexerUpdateNote: async () => {},
      }
      : { defaultNotePath: title => title + '.md' },
  })
  const factory = module.exports.useWorkspaceNoteFactory({
    vault: { id: 'test-vault' }, vaultConfig: {}, noteTypes: [], inboxNotes: [],
    setError: () => {}, setSidebarView: () => {}, logActivity: () => {},
    refreshVaultCore: async () => {}, refreshNoteSummaries: async () => {},
    openNote: async () => true, syncActiveNoteContent: async () => {},
  })
  assert.equal(await factory.createNote(), 'Untitled 2026-10-14.md')
  assert.equal(await factory.createNote(), 'Untitled 2026-10-14 (2).md')
  assert.equal(existing.size, 2)
  assert.equal(existing.get('Untitled 2026-10-14.md'), '# Untitled 2026-10-14')
  assert.equal(await factory.createNote('Untitled 2026-10-14', '# collision', { requireMissing: true }), null)
  assert.equal(existing.size, 2)
})
