import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const js = ts.transpileModule(
  readFileSync(new URL('../../src/bridge/commands/vault.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
).outputText

function bridge(invoke) {
  const timers = new Map()
  const calls = []
  const module = { exports: {} }
  let nextId = 0
  vm.runInNewContext(js, {
    module, exports: module.exports, Promise, Error,
    setTimeout: (callback, duration) => {
      const id = ++nextId
      timers.set(id, { callback, duration })
      return id
    },
    clearTimeout: id => timers.delete(id),
    require: name => name === '@tauri-apps/api/core'
      ? { invoke: (cmd, args) => { calls.push({ cmd, args }); return invoke(cmd, args) } }
      : name.endsWith('/native.ts') ? { requireNative: () => {} } : {},
  })
  return { list: module.exports.vaultListBackups, timers, calls }
}

test('hung native backup list has a finite deadline and releases the watchdog', async () => {
  const b = bridge(() => new Promise(() => {}))
  const pending = b.list('C:/Backups')
  assert.equal(b.timers.size, 1, 'an unresolved read must be bounded')
  const [{ callback, duration }] = b.timers.values()
  assert.ok(duration >= 1000 && duration <= 60_000)
  callback()
  await assert.rejects(pending, /backup.*timed out/i)
  assert.equal(b.timers.size, 0)
  assert.deepEqual(b.calls.map(x => x.cmd), ['vault_list_backups'])
})

test('successful backup list returns native result and clears the timer', async () => {
  const entries = [{ name: 'valid', path: 'valid', verified: true }]
  const b = bridge(() => Promise.resolve(entries))
  assert.deepEqual(await b.list('C:/Backups'), entries)
  assert.equal(b.timers.size, 0)
  assert.deepEqual(b.calls[0], { cmd: 'vault_list_backups', args: { backupPath: 'C:/Backups' } })
})

test('native list rejection is preserved and clears the timer', async () => {
  const b = bridge(() => Promise.reject(new Error('Folder inaccessible')))
  await assert.rejects(b.list('C:/Backups'), /Folder inaccessible/)
  assert.equal(b.timers.size, 0)
  assert.equal(b.calls.length, 1)
})
