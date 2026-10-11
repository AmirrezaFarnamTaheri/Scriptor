import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const source = ts.transpileModule(readFileSync(new URL('../../src/hooks/useWorkspaceRename.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText

function harness({ saves = true, guarded = true, activePath = 'Linked.md' } = {}) {
  const events = []
  const commands = Object.fromEntries(['vaultRenameApply', 'vaultRenameTagApply', 'vaultRenameSectionApply', 'vaultRenameBlockApply', 'indexerRebuild'].map(name => [name, async () => { events.push(name); return { edits: 1 } }]))
  const module = { exports: {} }
  vm.runInNewContext(source, {
    module, exports: module.exports,
    require: id => id === 'react' ? { useState: value => [value, () => {}], useCallback: fn => fn } : commands,
  })
  const hook = module.exports.useWorkspaceRename({
    activePath, setError: message => { if (message) events.push('error') }, logActivity() {},
    flushAllPendingSaves: async () => { events.push('flush'); return saves },
    runNoteMutation: async (path, mutation) => { events.push(`guard:${path}`); if (!guarded) return false; await mutation(); events.push('refresh-active'); return true },
    refreshVault: async () => { events.push('refresh-vault') },
    openNote: async path => { events.push(`open:${path}`) }, loadGraph: async () => {},
  })
  return { hook, events }
}

const operations = [
  ['note', hook => hook.applyRename('Renamed.md', true, 'Other.md'), 'vaultRenameApply'],
  ['tag', hook => hook.applyTagRename('old', 'new'), 'vaultRenameTagApply'],
  ['section', hook => hook.applySectionRename('Other.md', 'Old', 'New', true), 'vaultRenameSectionApply'],
  ['block', hook => hook.applyBlockRename('Other.md', 'old', 'new', true), 'vaultRenameBlockApply'],
]

for (const [name, apply, command] of operations) {
  test(`${name} rename aborts before disk mutation when a draft save fails`, async () => {
    const { hook, events } = harness({ saves: false })
    await assert.rejects(apply(hook), /Rename cancelled/)
    assert.deepEqual(events, ['flush', 'error'])
  })
  test(`${name} rename flushes and refreshes the active linked buffer`, async () => {
    const { hook, events } = harness()
    await apply(hook)
    assert.deepEqual(events.slice(0, 4), ['flush', 'guard:Linked.md', command, 'refresh-active'])
  })
}

test('a busy editor prevents a link rewrite and propagates failure', async () => {
  const { hook, events } = harness({ guarded: false })
  await assert.rejects(hook.applyTagRename('old', 'new'), /Retry the rename/)
  assert.deepEqual(events, ['flush', 'guard:Linked.md', 'error'])
})

test('moving the active note opens its destination after persistence and mutation', async () => {
  const { hook, events } = harness({ activePath: 'Other.md' })
  await hook.applyRename('Renamed.md', true)
  assert.deepEqual(events, ['flush', 'vaultRenameApply', 'indexerRebuild', 'refresh-vault', 'open:Renamed.md'])
})
