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

function harness(withCoordinator, { delayList = false } = {}) {
  const slots = []
  let cursor = 0
  let firstRender = true
  let effects = []
  const nativeWrites = []
  const coordinated = []
  const pendingLists = []
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
  const builderComponent = () => null
  const mockCommands = {
    vaultListViewNotes: () => delayList
      ? new Promise((resolve, reject) => { pendingLists.push({ resolve, reject }) })
      : Promise.resolve([{ path: note.metadata.path }]),
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
    './database/DatabaseStudioBuilder': { DatabaseStudioBuilder: builderComponent },
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
  const results = () => {
    const result = find(render(), node => node.type === resultComponent)
    assert.ok(result, 'real Database Studio results renderer is present')
    return result.props
  }
  const currentView = () => {
    const builder = find(render(), node => node.type === builderComponent)
    assert.ok(builder, 'view editor is present')
    return builder.props.view
  }
  const changeView = next => {
    const builder = find(render(), node => node.type === builderComponent)
    assert.ok(builder, 'view editor is present')
    builder.props.onChange(next)
    return results()
  }
  const startLoad = () => {
    const mounted = render()
    const button = find(mounted, node =>
      node.type === 'button' && node.props?.children === 'Load notes')
    assert.ok(button, 'real Database Studio load control is present')
    button.props.onClick()
  }
  const load = async () => {
    startLoad()
    await settle()
    const result = results()
    assert.ok(result?.rows?.length, 'native note was loaded into Database Studio')
    return result
  }
  const completeList = () => {
    const pending = pendingLists.shift()
    assert.ok(pending, 'deferred native view list was requested')
    pending.resolve([{ path: note.metadata.path }])
  }
  const failList = (message) => {
    const pending = pendingLists.shift()
    assert.ok(pending, 'deferred native view list was requested')
    pending.reject(new Error(message))
  }
  const errorText = () => find(render(), node => node.type === 'p' && node.props?.role === 'alert')?.props.children ?? null
  return { render, settle, load, startLoad, completeList, failList, errorText, results, currentView, changeView, nativeWrites, coordinated, note }

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

test('changing a Database Studio view immediately removes stale results, totals, and edit authority', async () => {
  const h = harness(true)
  h.render()
  await h.settle()
  const original = await h.load()
  assert.equal(original.rows.length, 1, 'original view includes the note')

  const next = { ...h.currentView(), filters: [{ field: 'metadata', key: 'status', value: 'Done' }] }
  const after = h.changeView(next)
  assert.equal(after.rows.length, 0, 'old view rows must disappear before the next load')
  assert.equal(after.columns.length, 0, 'old column projections must not describe the new view')
  await assert.rejects(
    original.onEdit(original.rows[0], 'status', 'Done'),
    /view|query|reload|stale/i,
    'an already-captured edit callback must not write once its view changes',
  )
  assert.equal(h.nativeWrites.length, 0, 'stale edit callback cannot reach native frontmatter')
})

test('a delayed Database Studio query cannot publish old-view notes after filters change', async () => {
  const h = harness(true, { delayList: true })
  h.render()
  await h.settle()
  h.startLoad()
  await h.settle()
  const next = { ...h.currentView(), filters: [{ field: 'title', value: 'Other' }] }
  const after = h.changeView(next)
  assert.equal(after.rows.length, 0)

  h.completeList()
  await h.settle()
  const current = h.results()
  assert.equal(current.rows.length, 0, 'the completed old request does not repopulate stale notes')
  assert.equal(current.columns.length, 0, 'the new filter has no loaded projections yet')
})

test('a delayed old-view query failure cannot become an error on the selected new view', async () => {
  const h = harness(true, { delayList: true })
  h.render()
  await h.settle()
  h.startLoad()
  await h.settle()
  h.changeView({ ...h.currentView(), filters: [{ field: 'title', value: 'Other' }] })

  h.failList('Old view native lookup was denied')
  await h.settle()
  assert.equal(h.errorText(), null, 'the new view must not display the previous query failure')
})
