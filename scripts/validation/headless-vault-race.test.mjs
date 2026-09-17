import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const hookSource = ts.transpileModule(
  readFileSync(new URL('../../src/hooks/useHeadlessEngine.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
).outputText
const daemonCmdSource = ts.transpileModule(
  readFileSync(new URL('../../src/bridge/commands/daemon.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
).outputText
const nativeDaemonSource = readFileSync(new URL('../../apps/desktop/src-tauri/src/commands/daemon.rs', import.meta.url), 'utf8')
const nativeIndexerSource = readFileSync(new URL('../../apps/desktop/src-tauri/src/commands/indexer.rs', import.meta.url), 'utf8')
const nativeExportSource = readFileSync(new URL('../../apps/desktop/src-tauri/src/commands/export.rs', import.meta.url), 'utf8')
const nativeGitSource = readFileSync(new URL('../../apps/desktop/src-tauri/src/commands/git.rs', import.meta.url), 'utf8')

test('daemonOpenVault serializes calls and drops obsolete target if updated before tail runs', async () => {
  const invoked = []
  let resolveFirstInvoke
  const firstInvokePromise = new Promise((resolve) => { resolveFirstInvoke = resolve })
  const mockBridge = {
    invoke: async (cmd, args) => {
      invoked.push({ cmd, args })
      if (args?.rootPath === '/path/to/vault-a') await firstInvokePromise
      return null
    },
    requireNative: () => {},
  }
  const module = { exports: {} }
  vm.runInNewContext(daemonCmdSource, {
    exports: module.exports,
    module,
    require: (id) => {
      if (id === '@tauri-apps/api/core') return { invoke: mockBridge.invoke }
      if (id.endsWith('/native.ts')) return { requireNative: mockBridge.requireNative }
      if (id.endsWith('/authorization.ts')) return { authorizeSensitiveOperation: async () => 'mock-token' }
      if (id.includes('vaultValidators')) {
        return {
          parseBacklinkHits: (x) => x,
          parseExportJobOutput: (x) => x,
          parseGraphQueryOutput: (x) => x,
          parseNoteIndexSummaries: (x) => x,
          parseRebuildSummary: (x) => x,
          parseRenameNoteApplyOutput: (x) => x,
          parseSaveNoteOutput: (x) => x,
          parseSearchHits: (x) => x,
          parseVaultHealthDiagnostics: (x) => x,
          parseVaultHealthReport: (x) => x,
        }
      }
      return {}
    },
  })
  const { daemonOpenVault } = module.exports
  const p1 = daemonOpenVault('/path/to/vault-a')
  const p2 = daemonOpenVault('/path/to/vault-b')
  resolveFirstInvoke()
  await Promise.all([p1, p2])
  const openedVaults = invoked.filter((x) => x.cmd === 'daemon_open_vault').map((x) => x.args.rootPath)
  assert.ok(!openedVaults.includes('/path/to/vault-a'))
  assert.deepEqual(openedVaults, ['/path/to/vault-b'])
})

test('useHeadlessEngine monotonic session guards drop stale sync and effect resolutions', async () => {
  const opened = []
  const daemonEvents = []
  let resolveVaultA
  const vaultAPromise = new Promise((resolve) => { resolveVaultA = resolve })
  const mockCommands = {
    ensureDaemonReady: async () => ({ socket_name: 'test.sock', pid: 1234 }),
    daemonOpenVault: async (path) => {
      opened.push(path)
      if (path === '/vault/A') await vaultAPromise
    },
    daemonPing: async () => { daemonEvents.push('ping'); return { version: '1.0.11-test' } },
    daemonStart: async () => ({ socket_name: 'test.sock', pid: 1234 }),
    setHeadlessEngineMode: async () => {},
  }
  function createHarness() {
    const slots = []
    let cursor = 0
    let cleanups = []
    const react = {
      useState(initial) {
        const i = cursor++
        if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial
        return [slots[i], (next) => { slots[i] = typeof next === 'function' ? next(slots[i]) : next }]
      },
      useRef(initial) { const i = cursor++; return (slots[i] ??= { current: initial }) },
      useCallback: (fn) => fn,
      useEffect: (fn, deps) => {
        const i = cursor++
        const prevDeps = slots[i]
        const depsChanged = !prevDeps || deps.some((d, idx) => d !== prevDeps[idx])
        slots[i] = deps
        if (depsChanged) {
          if (cleanups[i]) cleanups[i]()
          const cleanup = fn()
          if (typeof cleanup === 'function') cleanups[i] = cleanup
        }
      },
    }
    const module = { exports: {} }
    vm.runInNewContext(hookSource, {
      exports: module.exports,
      module,
      require: (id) => {
        if (id === 'react') return react
        if (id.endsWith('/commands')) return mockCommands
        if (id.endsWith('/platform')) return { isNativeBridgeAvailable: () => true }
        if (id.endsWith('./usePersistedBoolean')) return { usePersistedBoolean: () => [true, () => {}] }
        return {}
      },
    })
    const { useHeadlessEngine } = module.exports
    return {
      render(props) { cursor = 0; return useHeadlessEngine(props) },
      unmount() { cleanups.forEach((cleanup) => cleanup && cleanup()) },
    }
  }
  const h = createHarness()
  h.render({ vaultRootPath: '/vault/A', settingsOpen: false })
  h.render({ vaultRootPath: '/vault/B', settingsOpen: false })
  resolveVaultA()
  await new Promise((resolve) => setTimeout(resolve, 20))
  assert.ok(opened.includes('/vault/B'))
  assert.equal(opened[opened.length - 1], '/vault/B')
  assert.equal(daemonEvents.length, 1)
  h.unmount()
})

test('every vault-relative daemon bridge uses the verified-vault gateway', () => {
  assert.ok(nativeDaemonSource.includes('state.vault_switch_lock.try_lock()'))
  assert.ok(nativeDaemonSource.includes('Err(TryLockError::WouldBlock)'))
  assert.ok(nativeDaemonSource.includes('verify_daemon_vault(state)?'))
  assert.ok(nativeDaemonSource.includes('a vault transition is in progress; retry after it completes'))

  const wrappers = [
    'bridge_reload_config', 'bridge_rebuild_index', 'bridge_update_note_index',
    'bridge_search', 'bridge_list_note_summaries', 'bridge_backlinks', 'bridge_graph',
    'bridge_git_status', 'bridge_save_note', 'bridge_rename_apply', 'bridge_health_report',
    'bridge_health_diagnostics', 'bridge_export_run_note', 'bridge_export_run_markdown',
    'bridge_export_start_note', 'bridge_export_job_status', 'bridge_export_cancel',
  ]
  for (const wrapper of wrappers) {
    const start = nativeDaemonSource.indexOf(`fn ${wrapper}`)
    assert.notEqual(start, -1, `${wrapper} must exist`)
    const body = nativeDaemonSource.slice(start, nativeDaemonSource.indexOf('\n}', start) + 2)
    assert.ok(body.includes('state: &AppState'), `${wrapper} must receive desktop session state`)
    assert.ok(body.includes('with_verified_vault('), `${wrapper} must verify daemon/Desktop vault identity`)
  }

  for (const call of [
    'bridge_rebuild_index(&state)', 'bridge_update_note_index(&state, path)',
    'bridge_search(&state, query', 'bridge_backlinks(&state, path)',
    'bridge_graph(&state, focus_path', 'bridge_list_note_summaries(&state)',
  ]) assert.ok(nativeIndexerSource.includes(call), `indexer headless path must use checked call: ${call}`)

  for (const call of [
    'bridge_export_run_note(&state,', 'bridge_export_run_markdown(&state,',
    'bridge_export_start_note(&state,', 'bridge_export_cancel(&state,',
  ]) assert.ok(nativeExportSource.includes(call), `export headless path must use checked call: ${call}`)

  assert.ok(nativeGitSource.includes('bridge_git_status(&state)'))
})
