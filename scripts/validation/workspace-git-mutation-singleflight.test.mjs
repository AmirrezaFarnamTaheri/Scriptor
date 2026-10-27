import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const source = ts.transpileModule(
  readFileSync(new URL('../../src/hooks/useWorkspaceGit.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
).outputText

function deferred() {
  let resolve
  let reject
  const promise = new Promise((ok, fail) => { resolve = ok; reject = fail })
  return { promise, resolve, reject }
}

// Exercise the real hook. Native Git and React state scheduling are mocked;
// the mutation callback logic, shared busy state, and rerenders are not.
function harness() {
  const slots = []
  let cursor = 0
  const calls = { commits: [], pulls: [], pushes: [], errors: [], activities: [] }
  const commands = {
    gitCommit: async (...args) => { calls.commits.push(args) },
    gitPull: async (...args) => { calls.pulls.push(args); return { message: 'Pulled' } },
    gitPush: async (...args) => { calls.pushes.push(args); return { message: 'Pushed' } },
    gitStatus: async () => ({ is_repo: true }),
  }
  const react = {
    useState(initial) {
      const i = cursor++
      if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial
      return [slots[i], (value) => { slots[i] = typeof value === 'function' ? value(slots[i]) : value }]
    },
    useRef(initial) {
      const i = cursor++
      return slots[i] ??= { current: initial }
    },
    useCallback: (fn) => fn,
    useEffect() {},
    useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot(),
  }
  class MockStatusController {
    subscribe() { return () => {} }
    getSnapshot() { return { slots: {}, isLoading: false } }
    getStatus() { return { is_repo: true } }
    setActiveVault() {}
    setStatusErrorHandler() {}
    async refresh() {}
  }
  const module = { exports: {} }
  vm.runInNewContext(source, {
    Error,
    module,
    exports: module.exports,
    require: (id) => id === 'react' ? react
      : id.endsWith('/commands') ? commands
        : id.endsWith('/workspace-git-status') ? { WorkspaceGitStatusController: MockStatusController, vaultStatusKey: String }
          : {},
  })
  const options = {
    vaultId: 'vault-alpha',
    refreshVault: async () => {},
    logActivity: (...args) => calls.activities.push(args),
    setError: (value) => calls.errors.push(value),
  }
  const render = () => { cursor = 0; return module.exports.useWorkspaceGit(options) }
  return { render, options, calls, commands }
}

test('two commits submitted before rerender issue only one native mutation', async () => {
  const h = harness()
  const writing = deferred()
  h.commands.gitCommit = (...args) => {
    h.calls.commits.push(args)
    return h.calls.commits.length === 1 ? writing.promise : Promise.resolve()
  }

  const first = h.render().commitFiles(['first.md'], 'First commit')
  const duplicate = h.render().commitFiles(['second.md'], 'Second commit')
  assert.equal(h.render().isGitBusy, true, 'native operation stays visibly busy')
  writing.resolve()
  await Promise.all([first, duplicate])
  assert.equal(h.calls.commits.length, 1, 'duplicate submit must not reach native Git')
  assert.equal(h.render().isGitBusy, false)

  await h.render().commitFiles(['later.md'], 'Later commit')
  assert.equal(h.calls.commits.length, 2, 'a settled mutation releases the operation gate')
})

test('a pending Git pull blocks push after switching vaults until it settles', async () => {
  const h = harness()
  const reading = deferred()
  h.commands.gitPull = (...args) => {
    h.calls.pulls.push(args)
    return reading.promise
  }

  const pulling = h.render().pullRemote('fast-forward')
  h.options.vaultId = 'vault-beta'
  assert.equal(h.render().isGitBusy, true, 'the native mutation stays busy across vault navigation')
  await h.render().pushRemote()
  assert.equal(h.calls.pushes.length, 0, 'new vault cannot start overlapping native Git mutation')

  reading.resolve({ message: 'Pulled' })
  await pulling
  assert.equal(h.render().isGitBusy, false)
  await h.render().pushRemote()
  assert.equal(h.calls.pushes.length, 1)
  assert.deepEqual(h.calls.pulls[0], ['vault-alpha', 'fast-forward'])
})

test('a failed Git write releases the guard for an explicit later retry', async () => {
  const h = harness()
  h.commands.gitCommit = async (...args) => {
    h.calls.commits.push(args)
    if (h.calls.commits.length === 1) throw new Error('native Git rejected the write')
  }

  await h.render().commitFiles(['first.md'], 'Retryable commit')
  assert.equal(h.render().isGitBusy, false)
  assert.equal(h.calls.errors.at(-1), 'native Git rejected the write')
  await h.render().commitFiles(['first.md'], 'Explicit retry')
  assert.equal(h.calls.commits.length, 2)
  assert.equal(h.render().isGitBusy, false)
})
