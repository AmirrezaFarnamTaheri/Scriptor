import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { test } from 'node:test'
import { browseGuides, HELP_GUIDES, HELP_BY_ID, searchGuides } from './catalog.ts'
import { emptyHelpPreferences, getProgress, HelpProgressStore, parseHelpPreferences, reduceHelpPreferences } from './progress.ts'
import { parseHelpRequest } from './request.ts'
import { HELP_STORAGE_KEY } from './types.ts'

test('all guides have unique ids, authored steps, questions, entry paths, safety, and valid related guides', () => {
  assert.ok(HELP_GUIDES.length >= 70)
  assert.equal(HELP_BY_ID.size, HELP_GUIDES.length)
  for (const guide of HELP_GUIDES) {
    assert.match(guide.id, /^[a-z][a-z0-9-]+$/)
    assert.ok(guide.steps.length >= 4, guide.id)
    assert.ok(guide.questions.length >= 2, guide.id)
    assert.ok(guide.entry.length > 10 && guide.prerequisite.length > 10 && guide.safety.length > 20, guide.id)
    assert.ok(guide.roots.length > 0 && guide.source.length > 5, guide.id)
    assert.ok(existsSync(guide.source), `${guide.id} source missing: ${guide.source}`)
    assert.ok(guide.steps.every(([title, body]) => title.length > 2 && body.length > 40), guide.id)
    for (const id of guide.related) assert.ok(HELP_BY_ID.has(id), `${guide.id} -> ${id}`)
  }
})

test('only the overview is automatic first-run; dangerous operations are manual', () => {
  assert.deepEqual(HELP_GUIDES.filter((guide) => guide.policy === 'first-run').map((guide) => guide.id), ['workspace'])
  for (const id of ['restore', 'conflicts', 'rename', 'permissions', 'code-chunks', 'mcp-drafts']) assert.equal(HELP_BY_ID.get(id)?.policy, 'manual')
  for (const id of ['google', 'gmail', 'reader', 'kanban', 'tasks']) assert.equal(HELP_BY_ID.get(id)?.experimental, true)
})

test('all feature guides are on demand; only the workspace overview is first-run', () => {
  for (const guide of HELP_GUIDES) {
    assert.equal(guide.policy, guide.id === 'workspace' ? 'first-run' : 'manual', guide.id)
  }
})

test('help search covers questions and workflows without network or vault access', () => {
  assert.equal(searchGuides('customize toolbar')[0]?.id, 'toolbar-customize')
  assert.ok(searchGuides('keychain').some((guide) => guide.id === 'google'))
  assert.ok(searchGuides('annotation').some((guide) => guide.id === 'annotations'))
  assert.ok(searchGuides('operation messages').some((guide) => guide.id === 'activity-output'))
  assert.ok(searchGuides('', 'Recovery').every((guide) => guide.category === 'Recovery'))
  assert.equal(searchGuides('zzzzzzzzzzzzzz').length, 0)
})

test('idle Help browsing stays contextual while search and categories expose the full corpus', () => {
  const contextual = browseGuides('mcp', '', '')
  assert.ok(contextual.length > 1)
  assert.ok(contextual.length < HELP_GUIDES.length / 4)
  assert.equal(contextual[0]?.id, 'mcp')
  assert.ok(contextual.every((guide) => guide.id === 'mcp' || HELP_BY_ID.get('mcp')!.related.includes(guide.id)))

  const searched = browseGuides('mcp', 'keychain', '')
  assert.ok(searched.some((guide) => guide.id === 'google'))
  assert.deepEqual(
    browseGuides('mcp', '', 'Recovery').map((guide) => guide.id),
    searchGuides('', 'Recovery').map((guide) => guide.id),
  )
})

test('reading, progress, completion, and reset are independent', () => {
  const empty = emptyHelpPreferences()
  const progressed = reduceHelpPreferences(empty, { type: 'step', id: 'graph', step: 999 })
  assert.equal(getProgress(progressed, 'graph').step, HELP_BY_ID.get('graph')!.steps.length - 1)
  assert.equal(getProgress(progressed, 'graph').completed, false)
  const done = reduceHelpPreferences(progressed, { type: 'finish', id: 'graph' })
  assert.equal(getProgress(done, 'graph').completed, true)
  const reset = reduceHelpPreferences(done, { type: 'reset' })
  assert.deepEqual(reset.progress, {})
  assert.equal(reduceHelpPreferences(empty, { type: 'step', id: 'unknown', step: 1 }), empty)
})

test('untrusted persisted state is bounded, filters unknown ids, and ignores retired invitation fields', () => {
  const prefs = parseHelpPreferences(JSON.stringify({ version: 1, hints: false, progress: { graph: { step: -4, completed: 'yes', offered: true }, unknown: { step: 5 } } }))
  assert.deepEqual(Object.keys(prefs.progress), ['graph'])
  assert.deepEqual(prefs.progress.graph, { step: 0, completed: false })
  assert.throws(() => parseHelpPreferences('{'))
  assert.throws(() => parseHelpPreferences(JSON.stringify({ version: 88 })))
  assert.throws(() => parseHelpPreferences(' '.repeat(100_001)))
})

test('denied storage does not prevent help, and snapshots stay stable until a change', () => {
  const store = new HelpProgressStore({ getItem() { throw new Error('denied') }, setItem() { throw new Error('quota') } })
  const first = store.getSnapshot()
  assert.equal(store.getSnapshot(), first)
  let calls = 0
  const unsubscribe = store.subscribe(() => { calls += 1 })
  store.dispatch({ type: 'step', id: 'graph', step: 1 })
  assert.equal(store.getSnapshot().storageWarning, true)
  assert.equal(getProgress(store.getSnapshot().preferences, 'graph').step, 1)
  assert.equal(calls, 1)
  unsubscribe()
  store.dispatch({ type: 'finish', id: 'graph' })
  assert.equal(calls, 1)
})

test('only the help preference key is written, and reload resumes', () => {
  let raw: string | null = null
  const storage = { getItem(key: string) { assert.equal(key, HELP_STORAGE_KEY); return raw }, setItem(key: string, value: string) { assert.equal(key, HELP_STORAGE_KEY); raw = value } }
  const first = new HelpProgressStore(storage)
  first.dispatch({ type: 'step', id: 'google', step: 2 })
  const reloaded = new HelpProgressStore(storage)
  assert.equal(getProgress(reloaded.getSnapshot().preferences, 'google').step, 2)
  assert.equal(getProgress(reloaded.getSnapshot().preferences, 'google').completed, false)
})

test('help requests accept only authored ids and views, never commands or HTML', () => {
  assert.deepEqual(parseHelpRequest({ id: 'graph', view: 'tour' }), { id: 'graph', view: 'tour' })
  assert.equal(parseHelpRequest({ id: '<script>', view: 'tour' }), null)
  assert.equal(parseHelpRequest({ id: 'restore', view: 'execute' }), null)
  assert.equal(parseHelpRequest(null), null)
})
