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
function renderPalette(onOpenNote) {
  const values = ['note', 0, {
    query: 'note',
    hits: [{ path: 'notes/selected.md', title: 'Selected note' }],
  }, null]
  let cursor = 0
  const react = {
    Fragment: 'fragment',
    memo: (component) => component,
    useState: (initial) => [cursor < values.length ? values[cursor++] : initial, () => {}],
    useRef: (initial) => ({ current: initial }),
    useEffect: () => {},
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
    require: (id) => {
      if (Object.hasOwn(imports, id)) return imports[id]
      throw new Error('Unexpected dependency: ' + id)
    },
  })

  const tree = module.exports.CommandPalette({
    commands: [],
    onClose: () => { closed++ },
    searchNotes: async () => [{ path: 'notes/selected.md', title: 'Selected note' }],
    onOpenNote: onOpenNote ? (path) => { opened.push(path) } : undefined,
  })
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
  const hit = match(tree, (node) =>
    node.type === 'button' && node.props?.id === 'command-palette-item-note:notes/selected.md')
  return { hit, opened, get closed() { return closed } }
}

test('note search never advertises a selectable result without an open-note handler', () => {
  const palette = renderPalette(false)
  assert.equal(palette.hit, null, 'a note option that cannot open is an inert command')
  assert.equal(palette.closed, 0)
})

test('note results remain actionable when an owner callback exists', () => {
  const palette = renderPalette(true)
  assert.ok(palette.hit, 'a note with an actual opener stays discoverable')
  palette.hit.props.onClick()
  assert.deepEqual(palette.opened, ['notes/selected.md'])
  assert.equal(palette.closed, 1)
})
