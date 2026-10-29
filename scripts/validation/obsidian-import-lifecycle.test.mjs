import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

// Exercise the actual ObsidianImportDialog JSX rather than a separate
// reimplementation. The native authorized import is the only mocked boundary.
const compiled = ts.transpileModule(
  readFileSync(new URL('../../src/components/ObsidianImportDialog.tsx', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } },
).outputText

function deferred() {
  let resolve
  let reject
  const promise = new Promise((accept, decline) => { resolve = accept; reject = decline })
  return { promise, resolve, reject }
}

const successfulImport = () => ({
  notesImported: 2, attachmentsImported: 0, skippedFiles: 0, errors: [],
  importedPaths: ['notes/one.md', 'notes/two.md'],
})

function harness(importCommand, { vaultId = 'vault-test', importInFlightByVault = new Set(), browseCommand = async () => null } = {}) {
  const slots = []
  const memo = new Map()
  const effects = new Map()
  const layoutEffects = new Map()
  const pendingEffects = []
  const pendingLayoutEffects = []
  const delayedPassiveCleanups = []
  const imported = []
  const importCalls = []
  const detectCalls = []
  const updatesAfterUnmount = []
  let cursor = 0
  let mounted = true
  const importInFlightByVaultRef = { current: importInFlightByVault }

  const sameDeps = (a, b) => Array.isArray(a) && Array.isArray(b) &&
    a.length === b.length && a.every((value, index) => Object.is(value, b[index]))
  const react = {
    useState(initial) {
      const index = cursor++
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial
      return [slots[index], (next) => {
        if (!mounted) updatesAfterUnmount.push(index)
        slots[index] = typeof next === 'function' ? next(slots[index]) : next
      }]
    },
    useRef(initial) {
      const index = cursor++
      return (slots[index] ??= { current: initial })
    },
    useId() {
      const index = cursor++
      return 'fixture-id-' + index
    },
    useCallback(callback, dependencies) {
      const index = cursor++
      const prior = memo.get(index)
      if (prior && sameDeps(prior.dependencies, dependencies)) return prior.callback
      memo.set(index, { callback, dependencies })
      return callback
    },
    useEffect(callback, dependencies) {
      const index = cursor++
      const prior = effects.get(index)
      if (!prior || !sameDeps(prior.dependencies, dependencies)) {
        pendingEffects.push({ index, callback, dependencies })
      }
    },
    useLayoutEffect(callback, dependencies) {
      const index = cursor++
      const prior = layoutEffects.get(index)
      if (!prior || !sameDeps(prior.dependencies, dependencies)) {
        pendingLayoutEffects.push({ index, callback, dependencies })
      }
    },
  }
  const jsx = (type, props, key) => ({ type, props: props ?? {}, key })
  const icon = () => null
  const dependencies = {
    react,
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'fragment' },
    'lucide-react': { CheckCircle2: icon, FolderOpen: icon, ShieldAlert: icon, X: icon },
    '../bridge/commands/vault.ts': {
      vaultDetectObsidian: async (path) => { detectCalls.push(path); return true },
      vaultImportObsidian: (path, options) => {
        importCalls.push({ path, options })
        return importCommand(path, options)
      },
    },
    '../hooks/useEscapeToClose': { useEscapeToClose() {} },
    '../hooks/useFocusTrap': { useFocusTrap() {} },
    '@tauri-apps/plugin-dialog': { open: browseCommand },
  }
  const module = { exports: {} }
  vm.runInNewContext(compiled, {
    module, exports: module.exports,
    require(id) {
      if (Object.hasOwn(dependencies, id)) return dependencies[id]
      throw new Error('Unexpected import in Obsidian dialog: ' + id)
    },
    console,
  })

  function findAll(node, predicate, results = []) {
    if (Array.isArray(node)) {
      node.forEach(value => findAll(value, predicate, results))
      return results
    }
    if (!node || typeof node !== 'object') return results
    if (predicate(node)) results.push(node)
    findAll(node.props?.children, predicate, results)
    return results
  }
  function render() {
    cursor = 0
    pendingEffects.length = 0
    pendingLayoutEffects.length = 0
    const tree = module.exports.ObsidianImportDialog({
      onClose() {},
      onImported: result => imported.push(result),
      vaultId,
      importInFlightByVault: importInFlightByVaultRef,
    })
    // Layout effects own the commit phase and must run before passive effects.
    for (const pending of pendingLayoutEffects) {
      layoutEffects.get(pending.index)?.cleanup?.()
      const cleanup = pending.callback()
      layoutEffects.set(pending.index, { dependencies: pending.dependencies, cleanup })
    }
    for (const pending of pendingEffects) {
      effects.get(pending.index)?.cleanup?.()
      const cleanup = pending.callback()
      effects.set(pending.index, { dependencies: pending.dependencies, cleanup })
    }
    return tree
  }
  function sourceInput(tree) {
    const input = findAll(tree, node => node.type === 'input' && node.props?.className === 'toolbar-input')[0]
    assert.ok(input, 'the source-folder input exists')
    return input
  }
  function browse(tree) {
    const button = findAll(tree, node => node.type === 'button' && node.props?.children === 'Browse')[0]
    assert.ok(button, 'Browse button exists in real dialog')
    button.props.onClick()
  }
  function submit(tree) {
    const form = findAll(tree, node => node.type === 'form' && node.props?.role === 'dialog')[0]
    assert.ok(form, 'the Obsidian import dialog is rendered')
    form.props.onSubmit({ preventDefault() {} })
  }
  function unmount({ delayPassiveCleanup = false } = {}) {
    mounted = false
    // A React commit removes layout owners before passive cleanup runs.
    for (const effect of layoutEffects.values()) effect.cleanup?.()
    layoutEffects.clear()
    for (const effect of effects.values()) {
      if (!effect.cleanup) continue
      if (delayPassiveCleanup) delayedPassiveCleanups.push(effect.cleanup)
      else effect.cleanup()
    }
    effects.clear()
  }
  function flushPassiveCleanup() {
    for (const cleanup of delayedPassiveCleanups.splice(0)) cleanup()
  }
  async function settle() {
    for (let i = 0; i < 12; i++) await Promise.resolve()
  }
  return { render, sourceInput, browse, submit, unmount, flushPassiveCleanup, settle, imported, importCalls, detectCalls, updatesAfterUnmount }
}

test('two import submissions in one render turn result in one native authorized import', async () => {
  const pending = deferred()
  const h = harness(() => pending.promise)
  let tree = h.render()
  h.sourceInput(tree).props.onChange({ target: { value: '/fixture/obsidian' } })
  tree = h.render()
  // React has not re-rendered the disabled button yet. A state-only busy
  // flag must not authorize two imports before the next render.
  h.submit(tree)
  h.submit(tree)
  assert.equal(h.importCalls.length, 1, 'one in-flight operation owns this dialog')
  pending.resolve(successfulImport())
  await h.settle()
  assert.equal(h.imported.length, 1)
})

test('import completion after dialog unmount never reports success to another workspace', async () => {
  const pending = deferred()
  const h = harness(() => pending.promise)
  let tree = h.render()
  h.sourceInput(tree).props.onChange({ target: { value: '/fixture/obsidian' } })
  tree = h.render()
  h.submit(tree)
  assert.equal(h.importCalls.length, 1)

  h.unmount() // May be caused by a vault switch or closing the overlay.
  pending.resolve(successfulImport())
  await h.settle()
  assert.equal(h.imported.length, 0, 'late completion is not an active-dialog success')
  assert.equal(h.updatesAfterUnmount.length, 0, 'no stale React state updates')
})

test('import rejection after unmount does not update a destroyed dialog', async () => {
  const pending = deferred()
  const h = harness(() => pending.promise)
  let tree = h.render()
  h.sourceInput(tree).props.onChange({ target: { value: '/fixture/obsidian' } })
  tree = h.render()
  h.submit(tree)
  h.unmount()
  pending.reject(new Error('native import denied'))
  await h.settle()
  assert.equal(h.imported.length, 0)
  assert.equal(h.updatesAfterUnmount.length, 0)
})

test('a failed native import releases single-flight for one explicit retry', async () => {
  const pending = [deferred(), deferred()]
  let attempt = 0
  const h = harness(() => pending[attempt++].promise)
  let tree = h.render()
  h.sourceInput(tree).props.onChange({ target: { value: '/fixture/retry' } })
  tree = h.render()
  h.submit(tree)
  h.submit(tree)
  assert.equal(h.importCalls.length, 1, 'duplicate submit cannot start another authorization')

  pending[0].reject(new Error('ImportVault denied'))
  await h.settle()
  tree = h.render()
  h.submit(tree)
  h.submit(tree)
  assert.equal(h.importCalls.length, 2, 'one new explicit attempt is allowed after failure')
  pending[1].resolve(successfulImport())
  await h.settle()
  assert.equal(h.imported.length, 1, 'only successful new attempt updates the workspace')
  assert.equal(h.updatesAfterUnmount.length, 0)
})

test('Obsidian import overlay remounts on active vault change, invalidating old dialog ownership', () => {
  const overlay = readFileSync(
    new URL('../../src/components/app/CapabilityWorkflowOverlays.tsx', import.meta.url), 'utf8',
  )
  const composition = readFileSync(
    new URL('../../src/hooks/useWorkspaceComposition.ts', import.meta.url), 'utf8',
  )
  const app = readFileSync(new URL('../../src/App.tsx', import.meta.url), 'utf8')
  assert.match(overlay, /<ObsidianImportDialog\s+key=\{props\.vaultId \?\? 'closed'\}/)
  assert.match(overlay, /const importInFlightByVault = useRef<Set<string>>\(new Set\(\)\)/)
  assert.match(overlay, /importInFlightByVault=\{importInFlightByVault\}/)
  assert.doesNotMatch(overlay, /importInFlightByVault=\{importInFlightByVault\.current\}/)
  assert.match(overlay, /vaultId=\{props\.vaultId \?\? null\}/)

  assert.match(composition, /managerProps:\s*\{[^}]*vaultId/)
  assert.match(app, /<CapabilityWorkflowOverlays[\s\S]*\{\.\.\.composition\.managerProps\}/)
})

test('closing and reopening the same vault cannot start another import until the first settles', async () => {
  const claims = new Set()
  const operations = [deferred(), deferred()]
  let attempts = 0
  const importCommand = () => operations[attempts++].promise
  const first = harness(importCommand, { vaultId: 'same-vault', importInFlightByVault: claims })
  let tree = first.render()
  first.sourceInput(tree).props.onChange({ target: { value: '/fixture/obsidian-one' } })
  tree = first.render()
  first.submit(tree)
  assert.equal(attempts, 1, 'first dialog starts exactly one authorized import')
  first.unmount() // Closing a dialog does not cancel the native import.

  const reopened = harness(importCommand, { vaultId: 'same-vault', importInFlightByVault: claims })
  let newTree = reopened.render()
  reopened.sourceInput(newTree).props.onChange({ target: { value: '/fixture/obsidian-two' } })
  newTree = reopened.render()
  reopened.submit(newTree)
  assert.equal(attempts, 1, 'same-vault remount must not submit a second native import')

  operations[0].resolve(successfulImport())
  await first.settle()
  assert.equal(first.imported.length, 0, 'closed dialog must not announce old native success')
  reopened.submit(newTree)
  assert.equal(attempts, 2, 'a new explicit import is allowed after native settlement')
  operations[1].resolve(successfulImport())
  await reopened.settle()
  assert.equal(reopened.imported.length, 1)
})

test('commit-phase dialog cleanup rejects native success before passive effects are cleaned up', async () => {
  const request = deferred()
  const h = harness(() => request.promise, { vaultId: 'first-vault' })
  let tree = h.render()
  h.sourceInput(tree).props.onChange({ target: { value: '/fixture/obsidian' } })
  tree = h.render()
  h.submit(tree)
  h.unmount({ delayPassiveCleanup: true })
  request.resolve(successfulImport())
  await h.settle()
  assert.equal(h.imported.length, 0, 'no callback after the overlay was removed at commit')
  assert.equal(h.updatesAfterUnmount.length, 0, 'no state writes during the passive-cleanup gap')
  h.flushPassiveCleanup()
})

test('late native folder chooser after closing import dialog cannot validate or write stale UI', async () => {
  const chooser = deferred()
  const h = harness(async () => successfulImport(), { browseCommand: async () => chooser.promise })
  const tree = h.render()
  h.browse(tree)
  await h.settle() // the native folder picker is still outstanding
  h.unmount({ delayPassiveCleanup: true })
  chooser.resolve('/fixture/old-vault-chosen-after-close')
  await h.settle()
  assert.deepEqual(h.detectCalls, [], 'the unmounted dialog must not start a new native folder validation')
  assert.deepEqual(h.updatesAfterUnmount, [], 'a native chooser response must not write state after close')
  h.flushPassiveCleanup()
})
