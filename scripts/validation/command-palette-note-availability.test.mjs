import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const source = ts.transpileModule(
  readFileSync(new URL('../../src/components/CommandPalette.tsx', import.meta.url), 'utf8'),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  },
).outputText

// Execute the actual CommandPalette component with controlled React state.
// Mock only its React rendering scheduler and external i18n/help/search boundaries.
function renderPalette(onOpenNote, commands = []) {
  const values = ['note', 0, {
    query: 'note',
    hits: [{ path: 'notes/selected.md', title: 'Selected note' }],
  }, null]
  let cursor = 0
  const effects = []
  const timers = new Map()
  let nextTimer = 0
  const searches = []
  const mockWindow = {
    setTimeout(callback) {
      const id = ++nextTimer
      timers.set(id, callback)
      return id
    },
    clearTimeout(id) { timers.delete(id) },
    requestAnimationFrame() { throw new Error('No Help action should run in this fixture') },
  }
  const react = {
    Fragment: 'fragment',
    memo: (component) => component,
    useState: (initial) => [cursor < values.length ? values[cursor++] : initial, () => {}],
    useRef: (initial) => ({ current: initial }),
    useEffect: (effect) => { effects.push(effect) },
    useMemo: (calculate) => calculate(),
  }
  const jsx = (type, props, key) => ({ type, props, key })
  const jsxRuntime = { jsx, jsxs: jsx, Fragment: react.Fragment }
  const opened = []
  let closed = 0
  const imports = {
    react,
    'react/jsx-runtime': jsxRuntime,
    'lucide-react': { Search: () => null },
    '../hooks/useEscapeToClose': { useEscapeToClose: () => {} },
    '../hooks/useFocusTrap': { useFocusTrap: () => {} },
    '../lib/i18n': { useI18n: () => ({ locale: 'en', t: (key) => key }) },
    '../lib/paletteScore': { scoreCommand: () => 1 },
    '../lib/help/request': { requestHelp: () => {} },
    '../lib/help/labels': { helpLabels: () => ({ title: 'Help & guides' }) },
  }
  const module = { exports: {} }
  vm.runInNewContext(source, {
    module,
    exports: module.exports,
    window: mockWindow,
    require: (id) => {
      if (Object.hasOwn(imports, id)) return imports[id]
      throw new Error('Unexpected dependency: ' + id)
    },
  })

  const tree = module.exports.CommandPalette({
    commands,
    onClose: () => { closed++ },
    searchNotes: async (query) => {
      searches.push(query)
      return [{ path: 'notes/selected.md', title: 'Selected note' }]
    },
    onOpenNote: onOpenNote ? (path) => { opened.push(path) } : undefined,
  })
  // React effects run after the component renders; timers stay under test control.
  for (const effect of effects) effect()
  const runTimers = () => {
    const pending = [...timers.values()]
    timers.clear()
    for (const tick of pending) tick()
  }
  const match = (node, pred) => {
    if (Array.isArray(node)) {
      for (const item of node) {
        const found = match(item, pred)
        if (found) return found
      }
      return null
    }
    if (!node || typeof node !== 'object') return null
    if (pred(node)) return node
    return match(node.props?.children, pred)
  }
  const getButton = (id) => match(tree, (node) =>
    node.type === 'button' && node.props?.id === 'command-palette-item-' + id)
  const hit = getButton('note:notes/selected.md')
  return { hit, getButton, opened, searches, runTimers, get scheduledTimers() { return timers.size }, get closed() { return closed } }
}

test('note search never advertises a selectable result without an open-note handler', () => {
  const palette = renderPalette(false)
  assert.equal(palette.hit, null, 'a note option that cannot open is an inert command')
  assert.equal(palette.closed, 0)
  assert.equal(palette.scheduledTimers, 0, 'no opener must not schedule native note search')
  palette.runTimers()
  assert.deepEqual(palette.searches, [], 'missing opener must not issue an unreviewable search')
})

test('note results remain actionable when an owner callback exists', () => {
  const palette = renderPalette(true)
  assert.equal(palette.scheduledTimers, 1, 'available opener retains the debounced search')
  palette.runTimers()
  assert.deepEqual(palette.searches, ['note'])
  assert.ok(palette.hit, 'a note with an actual opener stays discoverable')
  palette.hit.props.onClick()
  assert.deepEqual(palette.opened, ['notes/selected.md'])
  assert.equal(palette.closed, 1)
})

test('MAT-018: a revoked plugin command cannot execute or dismiss an open palette', () => {
  let permitted = true
  let invoked = 0
  const palette = renderPalette(false, [{
    id: 'plugin-example-edit', label: 'Edit note', category: 'Plugin',
    isAvailable: () => permitted,
    run: () => { invoked += 1 },
  }])
  const button = palette.getButton('plugin-example-edit')
  assert.ok(button, 'available plugin command remains visible for review')
  permitted = false
  button.props.onClick()
  assert.equal(invoked, 0, 'revoked permission must prevent a stale command from executing')
  assert.equal(palette.closed, 0, 'revoked permission must not silently dismiss the palette')
  permitted = true
  button.props.onClick()
  assert.equal(invoked, 1, 'fresh permission permits the same command on retry')
  assert.equal(palette.closed, 1, 'confirmed action dismisses the palette')
})
