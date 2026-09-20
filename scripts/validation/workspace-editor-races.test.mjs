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
function harness({ native = false } = {}) {
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
  const commands = {
    vaultReadNote: (path) => new Promise((resolve, reject) => pending.push({ path, resolve, reject })),
    vaultRecordRecentNote: async () => {},
    indexerRecordRecentAccess: async () => {},
  }
  const listeners = new Map()
  const closeHandlers = []
  const appWindow = {
    onCloseRequested: async (handler) => { closeHandlers.push(handler); return () => {} },
    destroy: async () => {},
  }
  const module = { exports: {} }
  vm.runInNewContext(source, {
    exports: module.exports, module,
    require: (id) => id === 'react' ? react : id.endsWith('/commands') ? commands
      : id.endsWith('/platform') ? { isNativeBridgeAvailable: () => native, isDesktopWindowRuntime: () => native }
        : id === '@tauri-apps/api/window' ? { getCurrentWindow: () => appWindow }
          : id.includes('vaultErrors') ? { isContentHashMismatchError: () => false }
        : id.endsWith('/helpers') ? { extractOutline: () => [], extractWikilinks: () => [] } : {},
    window: {
      setTimeout: () => 1, clearTimeout: () => {},
      addEventListener: (type, handler) => listeners.set(type, handler),
      removeEventListener: (type, handler) => { if (listeners.get(type) === handler) listeners.delete(type) },
    },
  })
  const refs = Object.fromEntries(['activePath', 'activeNote', 'draftMarkdown', 'isSaving', 'checkExternalChanges'].map((key) => [`${key}Ref`, { current: null }]))
  const options = { editorRefs: refs, setError() {}, logActivity() {}, loadBacklinks: async () => {}, setBacklinks() {}, refreshVaultCore: async () => {}, searchQuery: '', runSearch: async () => {}, vaultConfig: { export: {} }, exportProfilesRef: { current: [] } }
  const render = () => { cursor = 0; effects = []; const result = module.exports.useWorkspaceEditor(options); effects.forEach((fn) => fn()); return result }
  const document = (path, markdown = path, vaultId = 'vault-alpha') => ({ markdown, metadata: { title: path, content_hash: markdown, vault_id: vaultId } })
  const open = async (path, vaultId = 'vault-alpha') => { const task = render().openNote(path); pending.shift().resolve(document(path, path, vaultId)); await task; return render() }
  return { render, pending, refs, document, open, options, commands, listeners, closeHandlers, appWindow }
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
  const closeTask = h.render().closeTab('b.md')
  await new Promise(setImmediate)
  assert.equal(h.pending.length, 1)
  assert.equal(h.pending[0].path, 'a.md')
  h.pending.shift().resolve(h.document('a.md'))
  await closeTask
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



test('explicit disk reload cannot overwrite a different active note', async () => {
  const h = harness()
  await h.open('a.md')
  const reload = h.render().reloadActiveNoteFromDisk()
  const stale = h.pending.shift()
  await h.open('b.md')
  stale.resolve(h.document('a.md', 'reloaded A'))
  await reload
  assert.equal(h.render().activePath, 'b.md')
  assert.equal(h.render().activeNote.metadata.title, 'b.md')
  assert.equal(h.render().draftMarkdown, 'b.md')
})

test('explicit disk reload preserves edits typed after the reload was requested', async () => {
  const h = harness()
  await h.open('a.md')
  const reload = h.render().reloadActiveNoteFromDisk()
  h.render().updateDraft('newer local edit')
  h.pending.shift().resolve(h.document('a.md', 'older disk edit'))
  await reload
  assert.equal(h.render().draftMarkdown, 'newer local edit')
  assert.equal(h.render().isNoteDirty, true)
})

test('the latest explicit reload wins when disk reads finish out of order', async () => {
  const h = harness()
  await h.open('a.md')
  const oldReload = h.render().reloadActiveNoteFromDisk()
  const oldRead = h.pending.shift()
  const newReload = h.render().reloadActiveNoteFromDisk()
  h.pending.shift().resolve(h.document('a.md', 'new disk content'))
  await newReload
  oldRead.resolve(h.document('a.md', 'old disk content'))
  await oldReload
  assert.equal(h.render().draftMarkdown, 'new disk content')
})

test('browser unload is allowed when clean and prevented while a draft or write is pending', async () => {
  const h = harness()
  await h.open('a.md')
  let prevented = 0
  const event = { preventDefault: () => { prevented += 1 }, returnValue: undefined }
  h.listeners.get('beforeunload')(event)
  assert.equal(prevented, 0)
  h.render().updateDraft('local edit')
  h.render()
  h.listeners.get('beforeunload')(event)
  assert.equal(prevented, 1)
  assert.equal(event.returnValue, '')
  let finishWrite
  h.commands.vaultSaveNote = (path, markdown) => new Promise((resolve) => { finishWrite = () => resolve(h.document(path, markdown)) })
  h.commands.indexerUpdateNote = async () => {}
  const save = h.render().saveActiveNoteNow()
  await new Promise(setImmediate)
  h.listeners.get('beforeunload')(event)
  assert.equal(prevented, 2)
  finishWrite()
  await save
  h.render()
  h.listeners.get('beforeunload')(event)
  assert.equal(prevented, 2)
})

test('repeated native close requests stay prevented until the pending write is durable', async () => {
  const h = harness({ native: true })
  await h.open('a.md')
  h.render().updateDraft('must survive close')
  h.render()
  await new Promise(setImmediate)
  let finishWrite
  let destroys = 0
  h.commands.vaultSaveNote = (path, markdown) => new Promise((resolve) => { finishWrite = () => resolve(h.document(path, markdown)) })
  h.commands.indexerUpdateNote = async () => {}
  h.appWindow.destroy = async () => { destroys += 1 }
  const close = h.closeHandlers.at(-1)
  let prevented = 0
  const event = { preventDefault: () => { prevented += 1 } }
  const firstClose = close(event)
  await new Promise(setImmediate)
  await close(event)
  assert.equal(prevented, 2, 'a second request must not bypass the pending save')
  assert.equal(destroys, 0)
  finishWrite()
  await firstClose
  assert.equal(destroys, 1)
})

test('failed native window destruction is reported and a later dirty close can retry', async () => {
  const h = harness({ native: true })
  const errors = []
  h.options.setError = (message) => { if (message) errors.push(message) }
  h.commands.vaultSaveNote = async (path, markdown) => h.document(path, markdown)
  h.commands.indexerUpdateNote = async () => {}
  await h.open('a.md')
  h.render().updateDraft('first edit')
  h.render()
  await new Promise(setImmediate)
  let destroys = 0
  h.appWindow.destroy = async () => { destroys += 1; if (destroys === 1) throw new Error('window busy') }
  const close = h.closeHandlers.at(-1)
  let prevented = 0
  const event = { preventDefault: () => { prevented += 1 } }
  await assert.doesNotReject(close(event))
  assert.ok(errors.some((message) => message.includes('window busy')))
  h.render().updateDraft('second edit')
  h.render()
  await close(event)
  assert.equal(prevented, 2)
  assert.equal(destroys, 2)
})

test('native close retains edits created during the final flush instead of destroying the window', async () => {
  const h = harness({ native: true })
  const writes = []
  let destroys = 0
  h.commands.vaultSaveNote = (path, markdown) => new Promise((resolve) => { writes.push(() => resolve(h.document(path, markdown))) })
  h.commands.indexerUpdateNote = async () => {}
  h.appWindow.destroy = async () => { destroys += 1 }
  await h.open('a.md')
  h.render().updateDraft('first edit')
  h.render()
  await new Promise(setImmediate)
  const close = h.closeHandlers.at(-1)({ preventDefault() {} })
  await new Promise(setImmediate)
  h.render().updateDraft('second edit')
  writes.shift()()
  await new Promise(setImmediate)
  h.render().updateDraft('third edit')
  writes.shift()()
  await close
  assert.equal(destroys, 0)
  assert.equal(h.render().draftMarkdown, 'third edit')
  assert.equal(h.render().isNoteDirty, true)
})

test('reactivating the dirty active tab saves its draft before reading disk', async () => {
  const h = harness()
  await h.open('a.md')
  let diskMarkdown = 'a.md'
  h.commands.vaultSaveNote = async (path, markdown) => { diskMarkdown = markdown; return h.document(path, markdown) }
  h.commands.indexerUpdateNote = async () => {}
  h.render().updateDraft('unsaved local content')
  const open = h.render().openNote('a.md')
  await new Promise(setImmediate)
  h.pending.shift().resolve(h.document('a.md', diskMarkdown))
  await open
  assert.equal(h.render().draftMarkdown, 'unsaved local content')
  assert.equal(diskMarkdown, 'unsaved local content')
})

test('typing while navigation reads disk cancels navigation and preserves the newer draft', async () => {
  const h = harness()
  await h.open('a.md')
  const open = h.render().openNote('b.md')
  h.render().updateDraft('new edit during navigation')
  h.pending.shift().resolve(h.document('b.md'))
  assert.equal(await open, false)
  assert.equal(h.render().activePath, 'a.md')
  assert.equal(h.render().draftMarkdown, 'new edit during navigation')
})

test('a failed fallback read retains the active tab and reports the close failure', async () => {
  const h = harness()
  const errors = []
  h.options.setError = (message) => { if (message) errors.push(message) }
  await h.open('a.md')
  await h.open('b.md')
  const close = h.render().closeTab('b.md')
  await new Promise(setImmediate)
  h.pending.shift().reject(new Error('fallback file unavailable'))
  assert.equal(await close, false)
  assert.equal(h.render().activePath, 'b.md')
  assert.deepEqual(Array.from(h.render().openTabs, (tab) => tab.path), ['a.md', 'b.md'])
  assert.ok(errors.some((message) => message.includes('fallback file unavailable')))
})

test('closing a tab retains newer edits made while its save was pending', async () => {
  const h = harness()
  await h.open('a.md')
  h.render().updateDraft('first edit')
  let finishWrite
  h.commands.vaultSaveNote = (path, markdown) => new Promise((resolve) => { finishWrite = () => resolve(h.document(path, markdown)) })
  h.commands.indexerUpdateNote = async () => {}
  const close = h.render().closeTab('a.md')
  await new Promise(setImmediate)
  h.render().updateDraft('newer edit')
  finishWrite()
  assert.equal(await close, false)
  assert.equal(h.render().activePath, 'a.md')
  assert.equal(h.render().draftMarkdown, 'newer edit')
  assert.equal(h.render().openTabs.length, 1)
})
