import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

// Execute the real TypeScript Git bridge; mock only native Tauri invocation.
const transpile = (path) => ts.transpileModule(
  readFileSync(new URL(path, import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
).outputText

function bridgeHarness() {
  const calls = []
  const module = { exports: {} }
  vm.runInNewContext(transpile('../../src/bridge/commands/git.ts'), {
    module, exports: module.exports, Error,
    require: (id) => {
      if (id === '@tauri-apps/api/core') return {
        invoke: async (command, payload) => {
          calls.push({ command, payload: JSON.parse(JSON.stringify(payload ?? null)) })
          return null
        },
      }
      if (id.endsWith('/native.ts')) return { requireNative: () => {} }
      if (id.endsWith('/authorization.ts')) {
        return { authorizeSensitiveOperation: async () => 'test-token' }
      }
      throw new Error(`Unexpected dependency: ${id}`)
    },
  })
  return { api: module.exports, calls }
}

test('all Git conflict preview reads send the initiating vault to native', async () => {
  const { api, calls } = bridgeHarness()
  await api.gitReadConflictMarkers('same.md', 'vault-A')
  await api.gitShowHeadFile('same.md', 'vault-A')
  await api.gitShowMergeBaseFile('same.md', 'vault-A')
  assert.deepEqual(calls, [
    { command: 'git_read_conflict_markers_cmd', payload: { path: 'same.md', expectedVaultId: 'vault-A' } },
    { command: 'git_show_head_file_cmd', payload: { path: 'same.md', expectedVaultId: 'vault-A' } },
    { command: 'git_show_merge_base_file_cmd', payload: { path: 'same.md', expectedVaultId: 'vault-A' } },
  ])
})

test('Git preview reads reject blank ownership without calling native', async () => {
  const { api, calls } = bridgeHarness()
  await assert.rejects(() => api.gitReadConflictMarkers('same.md', ''), /vault|identity|expected/i)
  await assert.rejects(() => api.gitShowHeadFile('same.md', ''), /vault|identity|expected/i)
  await assert.rejects(() => api.gitShowMergeBaseFile('same.md', ''), /vault|identity|expected/i)
  assert.equal(calls.length, 0)
})

function deferred() {
  let resolve
  const promise = new Promise((ok) => { resolve = ok })
  return { promise, resolve }
}

function auxiliaryHarness() {
  const slots = []
  const effects = []
  let cursor = 0
  let effectCursor = 0
  let scheduled = []
  const baseReads = []
  const bridge = {
    gitShowMergeBaseFile: (path, vaultId) => {
      const d = deferred()
      baseReads.push({ path, vaultId, ...d })
      return d.promise
    },
    vaultReadNote: async () => ({ markdown: '# Same filename' }),
    indexerListBibliography: async () => [],
    indexerListTags: async () => [],
    systemInfo: async () => null,
    vaultListRecentNotes: async () => [],
  }
  const react = {
    useState(initial) {
      const i = cursor++
      if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial
      return [slots[i], (next) => { slots[i] = typeof next === 'function' ? next(slots[i]) : next }]
    },
    useCallback: (callback) => callback,
    useMemo: (factory) => factory(),
    useEffect(callback, deps) {
      const i = effectCursor++
      const previous = effects[i]
      if (previous && previous.deps.length === deps.length && deps.every((v, j) => Object.is(v, previous.deps[j]))) return
      scheduled.push({ i, callback, deps, previous })
    },
  }
  const module = { exports: {} }
  vm.runInNewContext(transpile('../../src/hooks/useWorkspaceAuxiliaryData.ts'), {
    module, exports: module.exports, Error,
    require: (id) => {
      if (id === 'react') return react
      if (id.endsWith('/bridge/commands')) return bridge
      throw new Error(`Unexpected hook dependency: ${id}`)
    },
  })
  const render = (vaultId) => {
    cursor = 0
    effectCursor = 0
    scheduled = []
    const outcome = module.exports.useWorkspaceAuxiliaryData({
      nativeReady: true,
      vaultId,
      activePath: 'same.md',
      rebuildRevision: 0,
      conflictPath: 'same.md',
      settingsOpen: false,
    })
    for (const action of scheduled) {
      action.previous?.cleanup?.()
      effects[action.i] = { deps: action.deps, cleanup: action.callback() }
    }
    return outcome
  }
  return { render, baseReads }
}

test('a same-path conflict preview cannot leak across an A to B vault switch', async () => {
  const h = auxiliaryHarness()
  h.render('vault-A')
  assert.equal(h.baseReads.length, 1)
  h.render('vault-B')
  assert.equal(h.baseReads.length, 2, 'new vault must start its own conflict preview read')
  assert.equal(h.baseReads[0].vaultId, 'vault-A')
  assert.equal(h.baseReads[1].vaultId, 'vault-B')

  h.baseReads[0].resolve('STALE ancestor from A')
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(h.render('vault-B').conflictBasePreview, null, 'late A response must not appear in B')

  h.baseReads[1].resolve('Current ancestor from B')
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(h.render('vault-B').conflictBasePreview, 'Current ancestor from B')
})
