import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const source = ts.transpileModule(readFileSync(new URL('../../src/hooks/useWorkspaceEditor.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText

// Exercise the real hook with deterministic scheduling, including React's
// development-mode replay of state updaters. Bridge reads are controlled promises.
function harness() {
  const slots = []
  let cursor = 0
  let effects = []
  const react = {
    useState(initial) {
      const i = cursor++
      if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial
      return [slots[i], (next) => {
        if (typeof next === 'function') { next(slots[i]); slots[i] = next(slots[i]) }
        else slots[i] = next
      }]
    },
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial } },
    useCallback: (fn) => fn,
    useMemo: (fn) => fn(),
    useEffect: (fn) => { effects.push(fn) },
  }
  const pending = []
  const commands = { vaultReadNote: (path) => new Promise((resolve, reject) => pending.push({ path, resolve, reject })) }
  const module = { exports: {} }
  vm.runInNewContext(source, {
    exports: module.exports, module,
    require: (id) => id === 'react' ? react : id.endsWith('/commands') ? commands
      : id.endsWith('/platform') ? { isNativeBridgeAvailable: () => false }
        : id.endsWith('/helpers') ? { extractOutline: () => [], extractWikilinks: () => [] } : {},
    window: { setTimeout: () => 1, clearTimeout: () => {} },
  })
  const refs = Object.fromEntries(['activePath', 'activeNote', 'draftMarkdown', 'isSaving', 'checkExternalChanges'].map((key) => [`${key}Ref`, { current: null }]))
  const options = { editorRefs: refs, setError() {}, logActivity() {}, loadBacklinks: async () => {}, setBacklinks() {}, refreshVaultCore: async () => {}, searchQuery: '', runSearch: async () => {}, vaultConfig: { export: {} }, exportProfilesRef: { current: [] } }
  const render = () => { cursor = 0; effects = []; const result = module.exports.useWorkspaceEditor(options); effects.forEach((fn) => fn()); return result }
  const document = (path, markdown = path, vaultId = 'vault-alpha') => ({ markdown, metadata: { title: path, content_hash: markdown, vault_id: vaultId } })
  const open = async (path, vaultId = 'vault-alpha') => { const task = render().openNote(path); pending.shift().resolve(document(path, path, vaultId)); await task; return render() }
  return { render, pending, refs, document, open, options, commands }
}

test('late external reads cannot replace the newly selected tab', async () => {
  const h = harness()
  await h.open('a.md')
  const check = h.refs.checkExternalChangesRef.current()
  const stale = h.pending.shift()
  await h.open('b.md')
  stale.resolve(h.document('a.md', 'external edit'))
  await check
  assert.equal(h.render().draftMarkdown, 'b.md')
  assert.equal(h.render().externalChangeConflict, null)
})

test('external reads do not replace edits typed while the read was pending', async () => {
  const h = harness()
  await h.open('a.md')
  const check = h.refs.checkExternalChangesRef.current()
  h.render().updateDraft('local edit')
  h.pending.shift().resolve(h.document('a.md', 'disk edit'))
  await check
  assert.equal(h.render().draftMarkdown, 'local edit')
  assert.equal(h.render().externalChangeConflict, null)
})

test('back navigation issues one read despite replayed state updaters and records later navigation', async () => {
  const h = harness()
  await h.open('a.md')
  await h.open('b.md')
  h.render().navigateBack()
  assert.equal(h.pending.length, 1)
  h.pending.shift().resolve(h.document('a.md'))
  await new Promise(setImmediate)
  await h.open('c.md')
  h.render().navigateBack()
  assert.equal(h.pending[0].path, 'a.md')
})

test('repeated back and forward calls before rerender select distinct paths', async () => {
  const h = harness()
  await h.open('a.md')
  await h.open('b.md')
  await h.open('c.md')
  const editor = h.render()
  editor.navigateBack()
  editor.navigateBack()
  assert.equal(h.pending.length, 2)
  assert.equal(h.pending[0].path, 'b.md')
  assert.equal(h.pending[1].path, 'a.md')
  h.pending.shift().resolve(h.document('b.md'))
  h.pending.shift().resolve(h.document('a.md'))
  await new Promise(setImmediate)

  const currentEditor = h.render()
  currentEditor.navigateForward()
  currentEditor.navigateForward()
  assert.equal(h.pending.length, 2)
  assert.equal(h.pending[0].path, 'b.md')
  assert.equal(h.pending[1].path, 'c.md')
})

test('tab activation completes while backlinks are still pending and preserves pins', async () => {
  const h = harness()
  await h.open('a.md')
  h.render().togglePinTab('a.md')
  h.options.loadBacklinks = () => new Promise(() => {})
  const state = await h.open('a.md')
  assert.equal(state.openTabs[0].pinned, true)
})

test('closing the active tab reads its fallback once despite replayed state updaters', async () => {
  const h = harness()
  await h.open('a.md')
  await h.open('b.md')
  h.render().closeTab('b.md')
  assert.equal(h.pending.length, 1)
  assert.equal(h.pending[0].path, 'a.md')
  h.pending.shift().resolve(h.document('a.md'))
  await new Promise(setImmediate)
  assert.equal(h.render().activePath, 'a.md')
})

test('an external read failure preserves the current document', async () => {
  const h = harness()
  await h.open('a.md')
  const check = h.refs.checkExternalChangesRef.current()
  h.pending.shift().reject(new Error('file busy'))
  await check
  assert.equal(h.render().draftMarkdown, 'a.md')
  assert.equal(h.render().externalChangeConflict, null)
})

test('a superseded open-at-line cannot scroll the newly selected note', async () => {
  const h = harness()
  const old = h.render().openNoteAt('a.md', 90)
  const stale = h.pending.shift()
  await h.open('b.md')
  stale.resolve(h.document('a.md'))
  await old
  assert.equal(h.render().activePath, 'b.md')
  assert.equal(h.render().scrollToEditorLine, null)
})

test('slow post-save diagnostics do not keep saving busy or block the next write', async () => {
  const h = harness()
  const writes = []
  h.commands.vaultSaveNote = async (path, markdown) => { writes.push(markdown); return h.document(path, markdown) }
  h.commands.indexerUpdateNote = async () => {}
  h.options.refreshVaultCore = () => new Promise(() => {})
  await h.open('a.md')
  h.render().updateDraft('first edit')
  void h.render().saveActiveNoteNow()
  await new Promise(setImmediate)
  assert.equal(h.render().isSaving, false)
  h.render().updateDraft('second edit')
  void h.render().saveActiveNoteNow()
  await new Promise(setImmediate)
  assert.deepEqual(writes, ['first edit', 'second edit'])
})

test('diagnostic failures do not turn a durable save into a reported write failure', async () => {
  const h = harness()
  const messages = []
  h.commands.vaultSaveNote = async (path, markdown) => h.document(path, markdown)
  h.commands.indexerUpdateNote = async () => {}
  h.options.logActivity = (_kind, message) => messages.push(message)
  h.options.refreshVaultCore = async () => { throw new Error('index busy') }
  await h.open('a.md')
  h.render().updateDraft('saved edit')
  assert.equal(await h.render().saveActiveNoteNow(), true)
  await new Promise(setImmediate)
  assert.equal(h.render().isSaving, false)
  assert.equal(h.render().activeNote.markdown, 'saved edit')
  assert.deepEqual(messages, ['Note saved, but workspace details could not refresh'])
})

test('bursty saves coalesce pending diagnostics to the latest refresh', async () => {
  const h = harness()
  let finishRefresh
  let refreshes = 0
  h.commands.vaultSaveNote = async (path, markdown) => h.document(path, markdown)
  h.commands.indexerUpdateNote = async () => {}
  h.options.refreshVaultCore = async () => {
    refreshes += 1
    if (refreshes === 1) await new Promise((resolve) => { finishRefresh = resolve })
  }
  await h.open('a.md')
  for (const edit of ['one', 'two', 'three']) {
    h.render().updateDraft(edit)
    await h.render().saveActiveNoteNow()
  }
  assert.equal(refreshes, 1)
  finishRefresh()
  await new Promise(setImmediate)
  assert.equal(refreshes, 2)
  assert.equal(h.render().activeNote.markdown, 'three')
})

test('save request binds expected vault identity from active note metadata', async () => {
  const h = harness()
  const calls = []
  h.commands.vaultSaveNote = async (path, markdown, expectedHash, dryRun, expectedVaultId) => {
    calls.push({ path, markdown, expectedHash, dryRun, expectedVaultId })
    return h.document(path, markdown, expectedVaultId)
  }
  h.commands.indexerUpdateNote = async () => {}
  await h.open('a.md', 'vault-gamma')
  h.render().updateDraft('vault bound content')
  await h.render().saveActiveNoteNow()
  assert.equal(calls.length, 1)
  assert.equal(calls[0].expectedVaultId, 'vault-gamma')
})

