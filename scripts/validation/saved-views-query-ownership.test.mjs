import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

// Exercise the actual SavedViewsPanel source. Only React rendering, timers,
// browser storage and the native read boundary are simulated.
const source = ts.transpileModule(
  readFileSync(new URL('../../src/components/SavedViewsPanel.tsx', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } },
).outputText

function deferred() {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}

function harness(queryHandler) {
  const state = []
  const effects = new Map()
  const memoValues = new Map()
  const timerCallbacks = new Map()
  const calls = []
  let cursor = 0
  let nextTimer = 1
  let vault = 'vault-a'
  const nextEffects = []
  const equalDeps = (left, right) =>
    Array.isArray(left) && Array.isArray(right) && left.length === right.length &&
    left.every((value, index) => Object.is(value, right[index]))
  const react = {
    memo: component => component,
    useState(initial) {
      const index = cursor++
      if (!(index in state)) state[index] = typeof initial === 'function' ? initial() : initial
      return [state[index], value => {
        state[index] = typeof value === 'function' ? value(state[index]) : value
      }]
    },
    useCallback(callback, dependencies) {
      const index = cursor++
      const previous = memoValues.get(index)
      if (previous && equalDeps(previous.dependencies, dependencies)) return previous.value
      memoValues.set(index, { value: callback, dependencies })
      return callback
    },
    useMemo(factory, dependencies) {
      const index = cursor++
      const previous = memoValues.get(index)
      if (previous && equalDeps(previous.dependencies, dependencies)) return previous.value
      const value = factory()
      memoValues.set(index, { value, dependencies })
      return value
    },
    useRef(initial) {
      const index = cursor++
      if (!(index in state)) state[index] = { current: initial }
      return state[index]
    },
    useEffect(callback, dependencies) {
      const index = cursor++
      const previous = effects.get(index)
      if (!previous || !equalDeps(previous.dependencies, dependencies)) {
        nextEffects.push({ index, callback, dependencies })
      }
    },
  }
  const jsx = (type, props, key) => ({ type, props: props ?? {}, key })
  const noopComponent = () => null
  const imports = {
    react,
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'fragment' },
    'lucide-react': { Bookmark: noopComponent, Search: noopComponent, X: noopComponent },
    '../bridge/commands': {
      vaultListViewNotes: async filter => {
        calls.push({ filter, vault })
        return queryHandler(filter, vault)
      },
    },
    '../bridge/platform': { isNativeBridgeAvailable: () => true },
    '../hooks/useEscapeToClose': { useEscapeToClose() {} },
    '../lib/vaultPresets': {
      VAULT_SAVED_VIEWS_PATH: '.scriptor/presets/saved-views.json',
      loadVaultPresetJson: async () => null,
      saveVaultPresetJson: async () => {},
    },
    '../types/vault': {},
    '../lib/runtimeSchema': {
      expectArray: value => value, expectRecord: value => value, expectString: value => String(value),
    },
    '../lib/versionedStorage': {
      readVersionedStorage: ({ fallback }) => fallback,
      writeVersionedStorage() {},
    },
    './DatabaseStudioPanel': { DatabaseStudioPanel: noopComponent },
  }
  const module = { exports: {} }
  vm.runInNewContext(source, {
    module, exports: module.exports,
    require(id) {
      if (Object.hasOwn(imports, id)) return imports[id]
      throw new Error('Unexpected Saved Views dependency: ' + id)
    },
    setTimeout(fn) {
      const id = nextTimer++
      timerCallbacks.set(id, fn)
      return id
    },
    clearTimeout(id) { timerCallbacks.delete(id) },
    console,
    crypto: { randomUUID: () => 'fixture-preset' },
  })

  const findAll = (node, predicate, output = []) => {
    if (Array.isArray(node)) {
      node.forEach(child => findAll(child, predicate, output))
      return output
    }
    if (!node || typeof node !== 'object') return output
    if (predicate(node)) output.push(node)
    findAll(node.props?.children, predicate, output)
    return output
  }
  const render = (vaultId = vault) => {
    vault = vaultId
    cursor = 0
    nextEffects.length = 0
    const tree = module.exports.SavedViewsPanel({
      embedded: true, vaultOpen: true, vaultId, onClose() {},
      onOpenNote() {}, promptText: async () => null,
    })
    for (const effect of nextEffects) {
      effects.get(effect.index)?.cleanup?.()
      const cleanup = effect.callback()
      effects.set(effect.index, { dependencies: effect.dependencies, cleanup })
    }
    return tree
  }
  const titleInput = tree => {
    const label = findAll(tree, node => node.type === 'label' &&
      Array.isArray(node.props?.children) &&
      node.props.children.includes('Title contains'))[0]
    assert.ok(label, 'Saved Views title filter is visible')
    const input = findAll(label, node => node.type === 'input')[0]
    assert.ok(input, 'title filter input is available')
    return input
  }
  const paths = tree => {
    const list = findAll(tree, node => node.type === 'ul' &&
      node.props?.className === 'knowledge-note-list')[0]
    assert.ok(list, 'Saved Views result list is visible')
    return findAll(list, node => node.type === 'small').map(node => node.props.children)
  }
  const submit = tree => {
    const form = findAll(tree, node => node.type === 'form' &&
      node.props?.className === 'saved-views-form')[0]
    assert.ok(form, 'Run view form is visible')
    form.props.onSubmit({ preventDefault() {} })
  }
  const fireTimers = () => {
    const active = [...timerCallbacks.entries()]
    timerCallbacks.clear()
    active.forEach(([, fn]) => fn())
  }
  const settle = async () => {
    for (let i = 0; i < 16; i++) await Promise.resolve()
  }
  return { render, titleInput, paths, submit, fireTimers, settle, calls }
}

test('an old manually submitted Saved Views query cannot replace results for a newer filter', async () => {
  const older = deferred()
  const h = harness(filter => {
    if (filter.includes('Alpha')) return older.promise
    if (filter.includes('Beta')) return [{ path: 'notes/beta.md', title: 'Beta' }]
    return []
  })
  let tree = h.render()
  h.titleInput(tree).props.onChange({ target: { value: 'Alpha' } })
  tree = h.render()
  h.submit(tree)
  await h.settle()
  assert.equal(h.calls.filter(call => call.filter.includes('Alpha')).length, 1)

  h.titleInput(tree).props.onChange({ target: { value: 'Beta' } })
  h.render()
  h.fireTimers()
  await h.settle()
  assert.deepEqual(h.paths(h.render()), ['notes/beta.md'])

  older.resolve([{ path: 'notes/alpha.md', title: 'Alpha' }])
  await h.settle()
  assert.deepEqual(h.paths(h.render()), ['notes/beta.md'],
    'late manual query cannot overwrite the newer filter result')
})

test('Saved Views hides previous-vault results and reloads even when the filter is unchanged', async () => {
  const h = harness((_, vault) => [{
    path: vault === 'vault-a' ? 'notes/only-in-a.md' : 'notes/only-in-b.md',
    title: vault === 'vault-a' ? 'Vault A' : 'Vault B',
  }])
  h.render('vault-a')
  h.fireTimers()
  await h.settle()
  assert.deepEqual(h.paths(h.render('vault-a')), ['notes/only-in-a.md'])

  const afterSwitch = h.render('vault-b')
  assert.deepEqual(h.paths(afterSwitch), [],
    'vault A rows must not remain visible after switching to vault B')
  h.fireTimers()
  await h.settle()
  assert.deepEqual(h.paths(h.render('vault-b')), ['notes/only-in-b.md'],
    'a new vault requires a new scoped read even with the same filter')
})

test('Saved Views ignores a late previous-vault response after the new vault query succeeds', async () => {
  const oldVault = deferred()
  const h = harness((_, vault) => vault === 'vault-a'
    ? oldVault.promise
    : [{ path: 'notes/only-in-b.md', title: 'Vault B' }])
  h.render('vault-a')
  h.fireTimers()
  await h.settle()

  h.render('vault-b')
  h.fireTimers()
  await h.settle()
  assert.deepEqual(h.paths(h.render('vault-b')), ['notes/only-in-b.md'])

  oldVault.resolve([{ path: 'notes/only-in-a.md', title: 'Vault A' }])
  await h.settle()
  assert.deepEqual(h.paths(h.render('vault-b')), ['notes/only-in-b.md'],
    'a late response must not display another vault after its owner changes')
})
