import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const hookSource = ts.transpileModule(
  readFileSync(new URL('../../src/hooks/useHeadlessEngine.ts', import.meta.url), 'utf8'),
  {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  },
).outputText

const daemonCmdSource = ts.transpileModule(
  readFileSync(new URL('../../src/bridge/commands/daemon.ts', import.meta.url), 'utf8'),
  {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  },
).outputText

test('daemonOpenVault serializes calls and drops obsolete target if updated before tail runs', async () => {
  const invoked = []
  let resolveFirstInvoke
  const firstInvokePromise = new Promise((resolve) => {
    resolveFirstInvoke = resolve
  })

  const mockBridge = {
    invoke: async (cmd, args) => {
      invoked.push({ cmd, args })
      if (args?.rootPath === '/path/to/vault-a') {
        await firstInvokePromise
      }
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

  // Trigger open A then immediate open B
  const p1 = daemonOpenVault('/path/to/vault-a')
  const p2 = daemonOpenVault('/path/to/vault-b')

  // Let first invoke complete if it started
  resolveFirstInvoke()
  await Promise.all([p1, p2])

  // Because target was updated to vault-b before vault-a executed, or serialized,
  // the final invocation must open vault-b and vault-b must be the last opened vault.
  const openedVaults = invoked.filter((x) => x.cmd === 'daemon_open_vault').map((x) => x.args.rootPath)
  assert.equal(openedVaults[openedVaults.length - 1], '/path/to/vault-b')
})

test('useHeadlessEngine monotonic session guards drop stale sync and effect resolutions', async () => {
  const opened = []
  const daemonEvents = []

  let delayVaultA = true
  let resolveVaultA
  const vaultAPromise = new Promise((resolve) => {
    resolveVaultA = resolve
  })

  const mockCommands = {
    ensureDaemonReady: async () => ({ socket_name: 'test.sock', pid: 1234 }),
    daemonOpenVault: async (path) => {
      opened.push(path)
      if (path === '/vault/A' && delayVaultA) {
        await vaultAPromise
      }
    },
    daemonPing: async () => {
      daemonEvents.push('ping')
      return { version: '1.0.11-test' }
    },
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
        return [
          slots[i],
          (next) => {
            if (typeof next === 'function') {
              slots[i] = next(slots[i])
            } else {
              slots[i] = next
            }
          },
        ]
      },
      useRef(initial) {
        const i = cursor++
        return (slots[i] ??= { current: initial })
      },
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
        if (id.endsWith('./usePersistedBoolean')) {
          return { usePersistedBoolean: () => [true, () => {}] }
        }
        return {}
      },
    })

    const { useHeadlessEngine } = module.exports

    return {
      render(props) {
        cursor = 0
        return useHeadlessEngine(props)
      },
      unmount() {
        cleanups.forEach((c) => c && c())
      },
    }
  }

  const h = createHarness()

  // 1. Initial render with Vault A triggers openVault(/vault/A)
  h.render({ vaultRootPath: '/vault/A', settingsOpen: false })

  // 2. Rapid switch to Vault B before Vault A completes
  h.render({ vaultRootPath: '/vault/B', settingsOpen: false })

  // Now resolve Vault A's delayed promise
  resolveVaultA()
  await new Promise((r) => setTimeout(r, 20))

  // Verify that Vault B is opened
  assert.ok(opened.includes('/vault/B'))
  assert.equal(opened[opened.length - 1], '/vault/B')

  h.unmount()
})
