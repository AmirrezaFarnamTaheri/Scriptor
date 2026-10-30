import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

// Run the actual Database Studio component against controllable native IO.
// Only the browser renderer, domain data fixture and native boundary are mocked.
const source = ts.transpileModule(
  readFileSync(new URL('../../src/components/DatabaseStudioPanel.tsx', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } },
).outputText

function harness(withCoordinator) {
  const slots = []
  let cursor = 0
  let firstRender = true
  let effects = []
  const nativeWrites = []
  const coordinated = []
  const note = {
    metadata: {
      vault_id: 'vault-1', path: 'notes/record.md', title: 'Record',
      content_hash: 'sha-current', modified_at: '2026-10-29T00:00:00Z', tags: [],
    },
    markdown: '---\nstatus: Draft\n---\n\n# Record',
  }
  const react = {
    useState(initial) {
      const i = cursor++
      if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial
      return [slots[i], (next) => {
        slots[i] = typeof next === 'function' ? next(slots[i]) : next
      }]
    },
    useRef(initial) {
      const i = cursor++
      if (!(i in slots)) slots[i] = { current: initial }
      return slots[i]
    },
    useEffect(effect) { if (firstRender) effects.push(effect) },
    useMemo(fn) { return fn() },
  }
  const jsx = (type, props, key) => ({ type, props, key })
  const resultComponent = () => null
  const mockCommands = {
    vaultListViewNotes: async () => [{ path: note.metadata.path }],
    vaultReadNote: async (path) => {
      if (path === '.scriptor/presets/database-studio.md') {
        throw Object.assign(new Error('preset not found'), { code: 'NOT_FOUND' })
      }
      assert.equal(path, note.metadata.path)
      return note
    },
    vaultSaveNote: async () => { throw new Error('unexpected preset save') },
    vaultSaveAsset: async () => { throw new Error('unexpected asset save') },
    vaultFrontmatterSet: async (...args) => { nativeWrites.push(args) },
  }
  const defaults = {
    schemaVersion: 1, id: 'default', label: 'All notes',
    mode: 'table', combine: 'all', filters: [], columns: [{ key: 'status', label: 'Status' }],
  }
  const imports = {
    react,
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'fragment' },
    '../bridge/commands': mockCommands,
    '../bridge/platform': { isNativeBridgeAvailable: () => true },
    '../hooks/useEscapeToClose': { useEscapeToClose: () => {} },
    '../context/WorkspacePanelContext': { useWorkspaceEmbeddedPanel: () => true },
    '../hooks/useFocusTrap': { useFocusTrap: () => {} },
    '../lib/databaseStudio': {
      defaultDatabaseView: () => ({ ...defaults }),
      validateDatabaseView: (view) => view,
      databaseFilterJson: () => '{}',
      scalarFields: () => ({ status: 'Draft' }),
      calculateValue: () => null,
      aggregateColumn: () => ({ count: 0, sum: null, average: null, min: null, max: null }),
      formatScalarCell: (value) => String(value),
      DATABASE_ROW_LIMIT: 200,
      isMissingDatabasePreset: (error) => error?.code === 'NOT_FOUND',
      matchesMetadataFilters: () => true,
    },
    './database/DatabaseStudioBuilder': { DatabaseStudioBuilder: () => null },
    './database/DatabaseStudioResults': { DatabaseStudioResults: resultComponent },
    '../styles/components/database-studio.css': {},
  }
  const module = { exports: {} }
  vm.runInNewContext(source, {
    exports: module.exports, module, TextEncoder, console, Error,
    require(id) {
      if (Object.hasOwn(imports, id)) return imports[id]
      throw new Error('Unexpected Database Studio dependency: ' + id)
    },
  })
  const coordinator = withCoordinator
    ? async (path, mutation) => {
        coordinated.push(path)
        await mutation()
        return true
      }
    : undefined
  const find = (root, predicate) => {
    if (Array.isArray(root)) {
      for (const child of root) {
        const match = find(child, predicate)
        if (match) return match
      }
      return null
    }
    if (!root || typeof root !== 'object') return null
    if (predicate(root)) return root
    return find(root.props?.children, predicate)
  }
  const render = () => {
    cursor = 0
    effects = []
    const tree = module.exports.DatabaseStudioPanel({
      vaultOpen: true, vaultId: 'vault-1',
      embedded: true, onClose: () => {},
      onOpenNote: () => {},
      runSourceNoteMutation: coordinator,
    })
    if (firstRender) {
      firstRender = false
      for (const effect of effects) effect()
    }
    return tree
  }
  const settle = async () => {
    for (let i = 0; i < 16; i++) await Promise.resolve()
  }
  const load = async () => {
    const mounted = render()
    const button = find(mounted, (node) =>
      node.type === 'button' && node.props?.children === 'Load notes')
    assert.ok(button, 'real Database Studio load control is present')
    button.props.onClick()
    await settle()
    const latest = render()
    const result = find(latest, (node) => node.type === resultComponent)
    assert.ok(result?.props?.rows?.length, 'native note was loaded into Database Studio')
    return result.props
  }
  return { render, settle, load, nativeWrites, coordinated, note }
}

test('Database Studio without editor mutation coordinator is read-only and cannot write a frontmatter cell', async () => {
  const h = harness(false)
  h.render()
  await h.settle()
  const result = await h.load()
  assert.equal(result.busy, true, 'inline edit controls must be disabled without draft coordination')
  await assert.rejects(
    result.onEdit(result.rows[0], 'status', 'Done'),
    /source.note.*coordinator|editor.*coordinator|source editor/i,
  )
  assert.equal(h.nativeWrites.length, 0, 'no direct native fallback may bypass unsaved drafts')
})

test('Database Studio with source editor coordinator preserves the reviewed revision and write scope', async () => {
  const h = harness(true)
  h.render()
  await h.settle()
  const result = await h.load()
  assert.equal(result.busy, false, 'coordinated edits remain available')
  await result.onEdit(result.rows[0], 'status', 'Done')
  assert.deepEqual(h.coordinated, [h.note.metadata.path])
  assert.equal(h.nativeWrites.length, 1)
  assert.equal(h.nativeWrites[0][0], h.note.metadata.path)
  assert.equal(h.nativeWrites[0][1], 'status')
  assert.equal(h.nativeWrites[0][2], 'Done')
  assert.equal(h.nativeWrites[0][3], 'sha-current', 'expected hash still protects source revision')
  assert.equal(h.nativeWrites[0][4], 'vault-1', 'native write retains originating vault')
})
