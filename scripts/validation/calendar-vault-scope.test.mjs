import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const source = ts.transpileModule(readFileSync(new URL('../../src/hooks/useGoogleCalendarSync.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText

// Isolate the real hook's explicit commands. Effects are excluded: these tests
// exercise lifecycle ownership deterministically without opening a real browser
// or touching the OS keychain.
function deferred() {
  let resolve
  let reject
  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

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
  const calls = { disconnect: 0, startAuth: 0, createTask: 0 }
  const commands = {
    googleCalendarListEvents: async () => [],
    googleCalendarListTasks: async () => remoteTasks,
    googleCalendarGetAuthedEmail: async () => 'test@example.invalid',
    googleCalendarStartAuth: async () => {
      calls.startAuth += 1
      return 'test@example.invalid'
    },
    googleCalendarDisconnect: async () => {
      calls.disconnect += 1
    },
    googleCalendarCreateTask: async ({ title, notes, due }) => {
      calls.createTask += 1
      return { id: `created-${calls.createTask}`, title, notes, due: due ?? null, status: 'needsAction', completed: null }
    },
    googleCalendarCompleteTask: async () => {},
    googleCalendarDeleteTask: async () => {},
    googleCalendarApplyTaskSync: async (_list, mutations) => {
      batches.push(mutations)
      return mutations.map(({ kind }) => ({ kind, success: true }))
    },
  }
  const options = {
    vaultId: 'vault-a',
    vaultNotes,
    vaultTasksComplete: true,
    config: {
      enabled: true,
      google_client_id: 'client-id',
      google_calendar_id: 'primary',
      google_task_list_id: '@default',
      lookahead_days: 7,
    },
  }
  const module = { exports: {} }
  vm.runInNewContext(source, {
    module, exports: module.exports,
    require: (id) => id === 'react' ? react
      : id.endsWith('/google_calendar.ts') ? commands
        : id.endsWith('/googleAuthErrors.ts') ? { googleAuthErrorMessage: String, isGoogleAuthRequiredError: () => false } : {},
  })
  const render = () => { cursor = 0; return module.exports.useGoogleCalendarSync(options) }
  return { render, options, commands, batches, calls }
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


test('disconnect invalidates an in-flight provider refresh', async () => {
  const h = harness([])
  const events = deferred()
  const tasks = deferred()
  const email = deferred()
  h.commands.googleCalendarListEvents = async () => events.promise
  h.commands.googleCalendarListTasks = async () => tasks.promise
  h.commands.googleCalendarGetAuthedEmail = async () => email.promise

  const pendingRefresh = h.render().refresh()
  assert.equal(h.render().status, 'syncing')

  await h.render().disconnect()
  assert.equal(h.calls.disconnect, 1)
  assert.equal(h.render().status, 'disconnected')

  events.resolve([{ id: 'late-event', summary: 'Late event', start: '2026-09-20', end: '2026-09-20', allDay: true }])
  tasks.resolve([task('late-task', 'Late task', scoped('vault-a', 'late'))])
  email.resolve('late@example.invalid')
  await pendingRefresh

  const after = h.render()
  assert.equal(after.status, 'disconnected')
  assert.deepEqual(after.events, [])
  assert.deepEqual(after.tasks, [])
  assert.equal(after.authedEmail, null)
  assert.equal(after.error, null)
})

test('disconnect invalidates an in-flight task creation result', async () => {
  const h = harness([])
  const created = deferred()
  h.commands.googleCalendarCreateTask = async () => {
    h.calls.createTask += 1
    return created.promise
  }

  const pendingCreate = h.render().pushTask({ title: 'Late task' })
  await h.render().disconnect()
  created.resolve(task('late-created', 'Late task', scoped('vault-a', 'late-created')))
  const providerResult = await pendingCreate

  assert.equal(providerResult?.id, 'late-created')
  assert.equal(h.calls.createTask, 1)
  assert.deepEqual(h.render().tasks, [])
  assert.equal(h.render().status, 'disconnected')
})

test('disconnect invalidates an in-flight OAuth completion before hydration', async () => {
  const h = harness([])
  const auth = deferred()
  let hydrationReads = 0
  h.commands.googleCalendarStartAuth = async () => {
    h.calls.startAuth += 1
    return auth.promise
  }
  h.commands.googleCalendarListEvents = async () => {
    hydrationReads += 1
    return []
  }
  h.commands.googleCalendarListTasks = async () => {
    hydrationReads += 1
    return []
  }
  h.commands.googleCalendarGetAuthedEmail = async () => {
    hydrationReads += 1
    return 'hydrated@example.invalid'
  }

  const pendingAuth = h.render().startAuth()
  assert.equal(h.render().status, 'authorizing')
  await h.render().disconnect()
  auth.resolve('authorized@example.invalid')

  assert.equal(await pendingAuth, false)
  assert.equal(h.calls.startAuth, 1)
  assert.equal(hydrationReads, 0)
  assert.equal(h.render().status, 'disconnected')
  assert.equal(h.render().authedEmail, null)
})
