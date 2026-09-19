import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const source = ts.transpileModule(readFileSync(new URL('../../src/hooks/useGoogleCalendarSync.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText

// Isolate the real hook's explicit refresh/sync commands. Effects are excluded:
// these tests do not simulate OAuth, native authorization, or interval scheduling.
function harness(remoteTasks, vaultNotes = []) {
  const slots = []
  let cursor = 0
  const react = {
    useState(initial) {
      const i = cursor++
      if (!(i in slots)) slots[i] = initial
      return [slots[i], (next) => { slots[i] = typeof next === 'function' ? next(slots[i]) : next }]
    },
    useRef(initial) { return slots[cursor++] ??= { current: initial } },
    useCallback: (fn) => fn,
    useEffect() {},
  }
  const batches = []
  const commands = {
    googleCalendarListEvents: async () => [],
    googleCalendarListTasks: async () => remoteTasks,
    googleCalendarGetAuthedEmail: async () => 'test@example.invalid',
    googleCalendarApplyTaskSync: async (_list, mutations) => {
      batches.push(mutations)
      return mutations.map(({ kind }) => ({ kind, success: true }))
    },
  }
  const options = { vaultId: 'vault-a', vaultNotes, vaultTasksComplete: true, config: { enabled: true } }
  const module = { exports: {} }
  vm.runInNewContext(source, {
    module, exports: module.exports,
    require: (id) => id === 'react' ? react
      : id.endsWith('/google_calendar.ts') ? commands
        : id.endsWith('/googleAuthErrors.ts') ? { googleAuthErrorMessage: String, isGoogleAuthRequiredError: () => false } : {},
  })
  const render = () => { cursor = 0; return module.exports.useGoogleCalendarSync(options) }
  return { render, options, commands, batches }
}

const task = (id, title, marker) => ({ id, title, notes: marker, due: null, status: 'needsAction', completed: null })
const local = (id = 'task-a', text = 'Buy milk') => [{ path: 'todo.md', tasks: [{ id, text, checked: false, line: 0, dueDate: null }] }]
const scoped = (vault, id) => `Scriptor source: vault:${encodeURIComponent(vault)}:${id}`

test('sync never completes unscoped remote tasks whose owning vault is unknown', async () => {
  const h = harness([task('remote-b', 'Other vault task', 'Scriptor source: task-b')])
  await h.render().refresh()
  await h.render().syncVaultTasks()
  assert.equal(h.batches.length, 0)
})

test('sync does not adopt an unknown legacy task merely because its title matches', async () => {
  const h = harness([task('remote-b', 'Buy milk', 'Scriptor source: task-b')], local())
  await h.render().refresh()
  await h.render().syncVaultTasks()
  assert.equal(h.batches[0].length, 1)
  assert.equal(h.batches[0][0].kind, 'create')
  assert.equal(h.batches[0][0].notes, scoped('vault-a', 'task-a'))
})

test('legacy path-and-line markers cannot prove which vault owns a remote task', async () => {
  const h = harness([task('remote-b', 'Other task', 'Scriptor source: todo.md#L1')], local())
  await h.render().refresh()
  await h.render().syncVaultTasks()
  assert.equal(h.batches[0].length, 1)
  assert.equal(h.batches[0][0].kind, 'create')
})

test('an exact legacy stable task ID can migrate to the current vault marker', async () => {
  const h = harness([task('remote-a', 'Buy milk', 'Scriptor source: task-a')], local())
  await h.render().refresh()
  await h.render().syncVaultTasks()
  assert.equal(h.batches[0].length, 1)
  assert.equal(h.batches[0][0].kind, 'update')
  assert.equal(h.batches[0][0].taskId, 'remote-a')
  assert.equal(h.batches[0][0].notes, scoped('vault-a', 'task-a'))
})

test('only removed tasks explicitly owned by this vault are completed', async () => {
  const h = harness([
    task('own', 'Removed local task', scoped('vault-a', 'removed')),
    task('foreign', 'Other vault task', scoped('vault-b', 'other')),
    task('unmanaged', 'Personal task', 'No Scriptor ownership'),
  ])
  await h.render().refresh()
  await h.render().syncVaultTasks()
  assert.equal(h.batches[0].length, 1)
  assert.equal(h.batches[0][0].kind, 'complete')
  assert.equal(h.batches[0][0].taskId, 'own')
})

test('a moved task can rebind by unique title only within its own vault', async () => {
  const h = harness([
    task('own', 'Buy milk', scoped('vault-a', 'old-task-id')),
    task('foreign', 'Buy milk', scoped('vault-b', 'foreign-task-id')),
  ], local())
  await h.render().refresh()
  await h.render().syncVaultTasks()
  assert.equal(h.batches[0].length, 1)
  assert.equal(h.batches[0][0].kind, 'update')
  assert.equal(h.batches[0][0].taskId, 'own')
})

test('mirroring requires the active vault identity even for an empty task set', async () => {
  const h = harness([task('remote', 'Task', 'Scriptor source: task')])
  h.options.vaultId = null
  await h.render().refresh()
  await h.render().syncVaultTasks()
  assert.equal(h.batches.length, 0)
})

test('a failed post-write refresh blocks another sync from duplicating stale creates', async () => {
  const h = harness([], local())
  await h.render().refresh()
  h.commands.googleCalendarListTasks = async () => { throw new Error('temporary provider read failure') }
  await h.render().syncVaultTasks()
  assert.equal(h.render().status, 'error')
  await h.render().syncVaultTasks()
  assert.equal(h.batches.length, 1)
})
