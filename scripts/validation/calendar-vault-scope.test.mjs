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
        : id.endsWith('/googleAuthErrors.ts') ? { googleAuthErrorMessage: String, isGoogleAuthRequiredError: () => false }
          : id.endsWith('/googleOAuthClient.ts') ? { getGoogleOAuthClientId: (legacyClientId) => legacyClientId?.trim() ?? '' }
          : {},
  })
  const render = () => { cursor = 0; return module.exports.useGoogleCalendarSync(options) }
  return { render, options, commands, batches, calls }
}

const task = (id, title, marker) => ({ id, etag: `etag-${id}`, title, notes: marker, due: null, status: 'needsAction', completed: null })
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

test('a moved task cannot silently rebind to a different provider identity by title', async () => {
  const h = harness([
    task('own', 'Buy milk', scoped('vault-a', 'old-task-id')),
    task('foreign', 'Buy milk', scoped('vault-b', 'foreign-task-id')),
  ], local())
  await h.render().refresh()
  await h.render().syncVaultTasks()
  // The moved local task is a new identity. Its old provider record is
  // completed only because it explicitly belongs to this vault; the foreign
  // vault's matching title must never be adopted or modified.
  assert.equal(h.batches[0].length, 2)
  assert.equal(h.batches[0][0].kind, 'create')
  assert.equal(h.batches[0][0].notes, scoped('vault-a', 'task-a'))
  assert.equal(h.batches[0][1].kind, 'complete')
  assert.equal(h.batches[0][1].taskId, 'own')
  assert.equal(h.batches[0][1].etag, 'etag-own')
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
  assert.equal(after.events.length, 0)
  assert.equal(after.tasks.length, 0)
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
  assert.equal(h.render().tasks.length, 0)
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


test('duplicate scoped remote ownership markers require review instead of completing a duplicate', async () => {
  const marker = scoped('vault-a', 'task-a')
  const h = harness([
    task('remote-original', 'Buy milk', marker),
    task('remote-duplicate', 'Buy milk', marker),
  ], local())
  await h.render().refresh()

  const result = await h.render().syncVaultTasks()
  assert.equal(h.batches.length, 0,
    'two provider records for one local ID must not update or complete either record')
  assert.equal(result.created, 0)
  assert.equal(result.updated, 0)
  assert.match(h.render().error ?? '', /duplicate|ambiguous|review/i,
    'the user needs an actionable explanation rather than a guessed provider mutation')
})

test('duplicate local stable task IDs across notes cannot create two provider tasks', async () => {
  const h = harness([], [
    { path: 'one.md', tasks: [{ id: 'same-id', text: 'Original', checked: false, line: 0, dueDate: null }] },
    { path: 'two.md', tasks: [{ id: 'same-id', text: 'Other task', checked: false, line: 0, dueDate: null }] },
  ])
  await h.render().refresh()

  const result = await h.render().syncVaultTasks()
  assert.equal(h.batches.length, 0,
    'duplicated local identity must stop the batch before any provider create')
  assert.equal(result.created, 0)
  assert.equal(result.updated, 0)
  assert.match(h.render().error ?? '', /duplicate|ambiguous|review/i)
})


test('one Google task claiming two distinct local identities must be reviewed', async () => {
  const h = harness([
    task('remote-shared', 'Shared record', scoped('vault-a', 'task-a') + '\n' + scoped('vault-a', 'task-b')),
  ], [
    { path: 'todo.md', tasks: [
      { id: 'task-a', text: 'First task', checked: false, line: 0, dueDate: null },
      { id: 'task-b', text: 'Second task', checked: false, line: 1, dueDate: null },
    ] },
  ])
  await h.render().refresh()

  const result = await h.render().syncVaultTasks()
  assert.equal(h.batches.length, 0, 'a single provider record must not be rebound and duplicated')
  assert.equal(result.created, 0)
  assert.equal(result.updated, 0)
  assert.match(h.render().error ?? '', /duplicate|ambiguous|review|invalid/i)
})

test('two Google tasks with the same legacy stable-ID marker cannot be migrated by guessing', async () => {
  const legacy = 'Scriptor source: task-a'
  const h = harness([
    task('legacy-one', 'First legacy task', legacy),
    task('legacy-two', 'Second legacy task', legacy),
  ], local())
  await h.render().refresh()

  const result = await h.render().syncVaultTasks()
  assert.equal(h.batches.length, 0, 'legacy ownership shared across records is uncertain')
  assert.equal(result.created, 0)
  assert.equal(result.updated, 0)
  assert.match(h.render().error ?? '', /duplicate|ambiguous|review|invalid/i)
})

test('a duplicated remote task ID with different markers cannot authorize two writes', async () => {
  const h = harness([
    task('remote-shared', 'First', scoped('vault-a', 'task-a')),
    task('remote-shared', 'Second', scoped('vault-a', 'task-b')),
  ], [
    { path: 'todo.md', tasks: [
      { id: 'task-a', text: 'First', checked: false, line: 0, dueDate: null },
      { id: 'task-b', text: 'Second', checked: false, line: 1, dueDate: null },
    ] },
  ])
  await h.render().refresh()

  const result = await h.render().syncVaultTasks()
  assert.equal(h.batches.length, 0, 'repeated provider IDs make ownership and revision unreliable')
  assert.equal(result.created, 0)
  assert.equal(result.updated, 0)
  assert.match(h.render().error ?? '', /duplicate|ambiguous|review|invalid/i)
})

test('an empty current-vault ownership marker must not complete an unrelated remote task', async () => {
  const h = harness([
    task('remote-empty', 'Unrecognized owner', 'Scriptor source: vault:vault-a:'),
  ], [])
  await h.render().refresh()

  const result = await h.render().syncVaultTasks()
  assert.equal(h.batches.length, 0, 'malformed ownership is not proof of a deleted local task')
  assert.equal(result.created, 0)
  assert.equal(result.updated, 0)
  assert.match(h.render().error ?? '', /duplicate|ambiguous|review|invalid/i)
})


test('legacy and scoped records claiming the same local task cannot be reconciled by list order', async () => {
  const h = harness([
    task('legacy-copy', 'Buy milk', 'Scriptor source: task-a'),
    task('scoped-copy', 'Buy milk', scoped('vault-a', 'task-a')),
  ], local())
  await h.render().refresh()

  const result = await h.render().syncVaultTasks()
  assert.equal(h.batches.length, 0, 'two marker formats must not bypass unique ownership')
  assert.equal(result.created, 0)
  assert.equal(result.updated, 0)
  assert.match(h.render().error ?? '', /duplicate|ambiguous|review|invalid/i)
})

test('a missing local stable task ID cannot be mirrored as an empty ownership marker', async () => {
  const h = harness([], local('', 'Unidentified task'))
  await h.render().refresh()

  const result = await h.render().syncVaultTasks()
  assert.equal(h.batches.length, 0, 'empty local identity cannot authorize a provider create')
  assert.equal(result.created, 0)
  assert.equal(result.updated, 0)
  assert.match(h.render().error ?? '', /duplicate|ambiguous|review|invalid/i)
})


test('a provider record claimed by two vaults cannot be mutated for either owner', async () => {
  const h = harness([
    task('shared-remote', 'Other vault title', [
      scoped('vault-a', 'task-a'),
      scoped('vault-b', 'task-b'),
    ].join('\n')),
  ], local())
  await h.render().refresh()

  const result = await h.render().syncVaultTasks()
  assert.equal(h.batches.length, 0, 'one provider task cannot safely be owned by different vaults')
  assert.equal(result.created, 0)
  assert.equal(result.updated, 0)
  assert.match(h.render().error ?? '', /vault|owner|ambiguous|review/i)
})

test('a legacy marker cannot migrate a provider record already claimed by another vault', async () => {
  const h = harness([
    task('shared-legacy', 'Original remote title', [
      'Scriptor source: task-a',
      scoped('vault-b', 'task-b'),
    ].join('\n')),
  ], local())
  await h.render().refresh()

  const result = await h.render().syncVaultTasks()
  assert.equal(h.batches.length, 0, 'legacy migration must not overwrite a foreign vault record')
  assert.equal(result.created, 0)
  assert.equal(result.updated, 0)
  assert.match(h.render().error ?? '', /vault|owner|ambiguous|review/i)
})
