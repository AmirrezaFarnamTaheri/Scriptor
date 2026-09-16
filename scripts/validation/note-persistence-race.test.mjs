import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const source = ts.transpileModule(
  readFileSync(new URL('../../src/hooks/useWorkspaceEditor.ts', import.meta.url), 'utf8'),
  {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  },
).outputText

function harness() {
  const slots = []
  let cursor = 0
  let effects = []
  const react = {
    useState(initial) {
      const i = cursor++
      if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial
      return [
        slots[i],
        (next) => {
          if (typeof next === 'function') {
            next(slots[i])
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
    useMemo: (fn) => fn(),
    useEffect: (fn) => {
      effects.push(fn)
    },
  }

  let nextTimerId = 1
  const timers = new Map()
  const windowMock = {
    setTimeout: (fn, delay = 0) => {
      const id = nextTimerId++
      timers.set(id, { fn, delay })
      return id
    },
    clearTimeout: (id) => {
      timers.delete(id)
    },
  }

  const saveCalls = []
  const indexerCalls = []
  const loggedErrors = []
  let currentError = null

  const diskStorage = new Map()

  const document = (path, markdown = path, vaultId = 'vault-alpha') => ({
    markdown,
    metadata: {
      title: path,
      content_hash: `hash-${markdown}`,
      vault_id: vaultId,
      path,
    },
  })

  const commands = {
    vaultReadNote: async (path) => {
      await new Promise((resolve) => setImmediate(resolve))
      const doc = diskStorage.get(path) ?? document(path, path, 'vault-alpha')
      diskStorage.set(path, doc)
      return doc
    },
    vaultSaveNote: async (path, markdown, expectedHash, dryRun, vaultId) => {
      saveCalls.push({ path, markdown, expectedHash, dryRun, vaultId })
      const doc = {
        markdown,
        metadata: {
          title: path,
          content_hash: `hash-${markdown}`,
          vault_id: vaultId ?? 'vault-alpha',
          path,
        },
      }
      diskStorage.set(path, doc)
      return doc
    },
    indexerUpdateNote: async (path) => {
      indexerCalls.push(path)
    },
  }

  const module = { exports: {} }
  vm.runInNewContext(source, {
    exports: module.exports,
    module,
    require: (id) =>
      id === 'react'
        ? react
        : id.endsWith('/commands')
          ? commands
          : id.includes('vaultErrors')
            ? { isContentHashMismatchError: (msg) => typeof msg === 'string' && (msg.includes('conflict') || msg.includes('mismatch')) }
            : id.endsWith('/platform')
              ? { isNativeBridgeAvailable: () => false }
              : id.endsWith('/helpers')
                ? { extractOutline: () => [], extractWikilinks: () => [] }
                : {},
    window: windowMock,
  })

  const refs = Object.fromEntries(
    ['activePath', 'activeNote', 'draftMarkdown', 'isSaving', 'checkExternalChanges'].map((key) => [
      `${key}Ref`,
      { current: null },
    ]),
  )

  const options = {
    editorRefs: refs,
    setError: (err) => {
      currentError = err
    },
    logActivity: (kind, message, detail) => {
      if (kind === 'error') loggedErrors.push({ message, detail })
    },
    loadBacklinks: async () => {},
    setBacklinks: () => {},
    refreshVaultCore: async () => {},
    searchQuery: '',
    runSearch: async () => {},
    vaultConfig: { export: {} },
    exportProfilesRef: { current: [] },
  }

  const render = () => {
    cursor = 0
    effects = [];
    const result = module.exports.useWorkspaceEditor(options)
    effects.forEach((fn) => fn())
    return result
  }

  const open = async (path, vaultId = 'vault-alpha') => {
    if (!diskStorage.has(path)) {
      diskStorage.set(path, document(path, path, vaultId))
    }
    const task = render().openNote(path)
    await task
    return render()
  }

  return {
    render,
    saveCalls,
    indexerCalls,
    loggedErrors,
    getError: () => currentError,
    refs,
    document,
    open,
    options,
    commands,
    diskStorage,
    timers,
  }
}

test('typing in Note A and immediately clicking Tab B within 100ms guarantees Note A is saved and indexed', async () => {
  const h = harness()
  await h.open('note-a.md')

  // User types in note A
  h.render().updateDraft('# Note A Content Edit')

  // Debounced save timer is scheduled, has not yet fired
  assert.equal(h.saveCalls.length, 0)
  assert.ok(h.timers.size > 0, 'Debounced timer was scheduled')

  // User immediately switches to note B before timer fires
  await h.open('note-b.md')

  // Note A must be saved to disk and indexed immediately upon switching
  const noteASave = h.saveCalls.find((c) => c.path === 'note-a.md')
  assert.ok(noteASave, 'Note A was saved on tab switch')
  assert.equal(noteASave.markdown, '# Note A Content Edit')
  assert.ok(h.indexerCalls.includes('note-a.md'), 'Note A was indexed')
  assert.equal(h.render().activePath, 'note-b.md')
})

test('switching Note A -> Note B -> Note A in rapid succession preserves newest edits without stale read overwrite', async () => {
  const h = harness()
  await h.open('note-a.md')

  // Type edit v1
  h.render().updateDraft('version 2 of note A')

  // Switch to note B (triggers flush of note A)
  await h.open('note-b.md')
  assert.equal(h.render().activePath, 'note-b.md')

  // Switch back to note A
  await h.open('note-a.md')
  assert.equal(h.render().activePath, 'note-a.md')
  assert.equal(h.render().draftMarkdown, 'version 2 of note A')
})

test('closing a dirty tab immediately flushes pending draft before tab removal', async () => {
  const h = harness()
  await h.open('note-a.md')
  await h.open('note-b.md')

  // Edit note B
  h.render().updateDraft('Unsaved draft in Note B')
  assert.equal(h.saveCalls.filter((c) => c.path === 'note-b.md').length, 0)

  // Close note B tab
  h.render().closeTab('note-b.md')

  // Wait for queue flush
  await new Promise(setImmediate)

  const noteBSave = h.saveCalls.find((c) => c.path === 'note-b.md')
  assert.ok(noteBSave, 'Closing dirty tab flushed pending draft')
  assert.equal(noteBSave.markdown, 'Unsaved draft in Note B')

  // Active path fell back to note A
  assert.equal(h.render().activePath, 'note-a.md')
  assert.ok(!h.render().openTabs.some((t) => t.path === 'note-b.md'))
})

test('closing a dirty tab reports error if background save fails', async () => {
  const h = harness()
  await h.open('note-a.md')
  await h.open('note-b.md')

  // Make vaultSaveNote fail for note B
  h.commands.vaultSaveNote = async (path, markdown) => {
    if (path === 'note-b.md') {
      throw new Error('EACCES: permission denied')
    }
    return h.document(path, markdown)
  }

  // Edit note B and close tab
  h.render().updateDraft('Critical text')
  h.render().closeTab('note-b.md')

  await new Promise(setImmediate)
  await new Promise(setImmediate)
  await new Promise((resolve) => setTimeout(resolve, 50))

  assert.ok(
    h.loggedErrors.some((e) => e.message.includes('note-b.md') || e.detail?.includes('permission denied')) ||
      (h.getError() && h.getError().includes('permission denied')),
    'Failure to save closing tab was logged',
  )
})

test('isSaveRequestCurrent checks document identity rather than global navigation generation', async () => {
  const h = harness()
  await h.open('note-a.md', 'vault-alpha')

  // Edit note-a
  h.render().updateDraft('content 1')
  // Trigger save
  const saveTask = h.render().saveActiveNoteNow()

  // Step history without changing document
  h.render().recordNoteHistory?.('other.md')

  const result = await saveTask
  assert.equal(result, true)
  assert.equal(h.render().activeNote.markdown, 'content 1')
})
