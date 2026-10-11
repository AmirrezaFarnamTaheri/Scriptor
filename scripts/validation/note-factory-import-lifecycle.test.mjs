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
