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
  const calls = { commits: [], pulls: [], pushes: [], errors: [], activities: [], gitRefreshes: [], workspaceRefreshes: [] }
  const commands = {
    gitCommit: async (...args) => { calls.commits.push(args) },
    gitPull: async (...args) => { calls.pulls.push(args); return { message: 'Pulled' } },
    gitPush: async (...args) => { calls.pushes.push(args); return { message: 'Pushed' } },
    gitStatus: async () => ({ is_repo: true }),
  }
  const effects = []
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
    useEffect(callback) { effects.push(callback) },
    useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot(),
  }
  class MockStatusController {
    subscribe() { return () => {} }
    getSnapshot() { return { slots: {}, isLoading: false } }
    getStatus() { return { is_repo: true } }
    setActiveVault() {}
    setStatusErrorHandler() {}
    async refresh(...args) { calls.gitRefreshes.push(args) }
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
    refreshVault: async () => { calls.workspaceRefreshes.push(options.vaultId) },
    logActivity: (...args) => calls.activities.push(args),
    setError: (value) => calls.errors.push(value),
  }
  const render = () => { cursor = 0; effects.length = 0; const result = module.exports.useWorkspaceGit(options); for (const effect of effects) effect(); return result }
  return { render, options, calls, commands }
}

test('single-flight Git commit preserves the initiating vault ID through native submission', async () => {
  const h = harness()
  const original = h.render().commitFiles(['notes/one.md'], 'Change in A')
  h.options.vaultId = 'vault-beta'
  h.render()
  await original
  assert.deepEqual(h.calls.commits[0], [['notes/one.md'], 'Change in A', 'vault-alpha'], 'native commit must be scoped to the originating vault')
})

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

test('late Git pull cannot refresh the newly selected vault', async () => {
  const h = harness()
  const pendingPull = deferred()
  h.commands.gitPull = async (...args) => {
    h.calls.pulls.push(args)
    return pendingPull.promise
  }

  const operation = h.render().pullRemote('fast-forward')
  h.options.vaultId = 'vault-beta'
  h.render()
  pendingPull.resolve({ message: 'Pulled vault-alpha' })
  await operation

  assert.deepEqual(h.calls.workspaceRefreshes, [], 'the old pull must not rescan the current vault')
  assert.deepEqual(h.calls.gitRefreshes, [], 'the old pull must not refresh the new vault Git status')
  assert.equal(h.render().isGitBusy, false, 'completion releases the shared mutation guard')

  h.commands.gitPull = async (...args) => { h.calls.pulls.push(args); return { message: 'Pulled vault-beta' } }
  await h.render().pullRemote('fast-forward')
  assert.deepEqual(h.calls.workspaceRefreshes, ['vault-beta'], 'same-vault pull continues to refresh')
  assert.equal(h.calls.gitRefreshes.length, 1, 'same-vault Git status is refreshed')
})

test('late Git commit cannot refresh status for another vault', async () => {
  const h = harness()
  const pendingCommit = deferred()
  h.commands.gitCommit = (...args) => {
    h.calls.commits.push(args)
    return pendingCommit.promise
  }

  const operation = h.render().commitFiles(['original.md'], 'Original vault commit')
  h.options.vaultId = 'vault-beta'
  h.render()
  pendingCommit.resolve()
  await operation

  assert.equal(h.calls.commits.length, 1, 'the originating write was submitted once')
  assert.deepEqual(h.calls.gitRefreshes, [], 'its late completion must not read another vault')
  assert.equal(h.render().isGitBusy, false)
})

test('switching away and back cannot revive the previous pull refresh owner', async () => {
  const h = harness()
  const pendingPull = deferred()
  h.commands.gitPull = () => pendingPull.promise

  const operation = h.render().pullRemote('fast-forward')
  h.options.vaultId = 'vault-beta'
  h.render()
  h.options.vaultId = 'vault-alpha'
  h.render()
  pendingPull.resolve({ message: 'Old pull completed' })
  await operation

  assert.deepEqual(h.calls.workspaceRefreshes, [], 'ABA navigation must not revive a stale operation')
  assert.deepEqual(h.calls.gitRefreshes, [], 'old pull cannot reuse the new same-name vault session')
})

for (const mutation of ['commit', 'pull', 'push']) {
  test(`a stale failed Git ${mutation} does not overwrite a different vault's workspace error`, async () => {
    const h = harness()
    const pending = deferred()
    if (mutation === 'commit') h.commands.gitCommit = () => pending.promise
    if (mutation === 'pull') h.commands.gitPull = () => pending.promise
    if (mutation === 'push') h.commands.gitPush = () => pending.promise

    const previousVault = h.render()
    const action = mutation === 'commit'
      ? previousVault.commitFiles(['note.md'], 'Before switch')
      : mutation === 'pull'
        ? previousVault.pullRemote('fast-forward')
        : previousVault.pushRemote()

    h.options.vaultId = 'vault-beta'
    h.render()
    const currentErrors = [...h.calls.errors]
    pending.reject(new Error('Old vault Git operation failed'))
    await action

    assert.deepEqual(h.calls.errors, currentErrors, 'the old vault must not surface a workspace-wide error in vault-beta')
    assert.equal(h.calls.activities.at(-1)?.[0], 'error', 'old operation failure remains auditable')
    assert.equal(h.render().isGitBusy, false, 'the native operation gate must still release')
  })
}

test('an A-B-A navigation does not resurrect a stale Git error from the first A session', async () => {
  const h = harness()
  const pending = deferred()
  h.commands.gitPull = () => pending.promise
  const oldPull = h.render().pullRemote('fast-forward')
  h.options.vaultId = 'vault-beta'
  h.render()
  h.options.vaultId = 'vault-alpha'
  h.render()
  const currentErrors = [...h.calls.errors]
  pending.reject(new Error('Old session pull failed'))
  await oldPull
  assert.deepEqual(h.calls.errors, currentErrors, 'a new session with the same vault ID is not the original operation')
  assert.equal(h.calls.activities.at(-1)?.[0], 'error')
  assert.equal(h.render().isGitBusy, false)
})
