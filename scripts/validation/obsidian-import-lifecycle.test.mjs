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

function harness(importCommand) {
  const slots = []
  const memo = new Map()
  const effects = new Map()
  const pendingEffects = []
  const imported = []
  const importCalls = []
  const updatesAfterUnmount = []
  let cursor = 0
  let mounted = true

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
  }
  const jsx = (type, props, key) => ({ type, props: props ?? {}, key })
  const icon = () => null
  const dependencies = {
    react,
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'fragment' },
    'lucide-react': { CheckCircle2: icon, FolderOpen: icon, ShieldAlert: icon, X: icon },
    '../bridge/commands/vault.ts': {
      vaultDetectObsidian: async () => true,
      vaultImportObsidian: (path, options) => {
        importCalls.push({ path, options })
        return importCommand(path, options)
      },
    },
    '../hooks/useEscapeToClose': { useEscapeToClose() {} },
    '../hooks/useFocusTrap': { useFocusTrap() {} },
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
    const tree = module.exports.ObsidianImportDialog({
      onClose() {},
      onImported: result => imported.push(result),
    })
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
  function submit(tree) {
    const form = findAll(tree, node => node.type === 'form' && node.props?.role === 'dialog')[0]
    assert.ok(form, 'the Obsidian import dialog is rendered')
    form.props.onSubmit({ preventDefault() {} })
  }
  function unmount() {
    mounted = false
    for (const effect of effects.values()) effect.cleanup?.()
    effects.clear()
  }
  async function settle() {
    for (let i = 0; i < 12; i++) await Promise.resolve()
  }
  return { render, sourceInput, submit, unmount, settle, imported, importCalls, updatesAfterUnmount }
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
