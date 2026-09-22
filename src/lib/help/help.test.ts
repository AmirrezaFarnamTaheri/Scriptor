import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { test } from 'node:test'
import { browseGuides, HELP_GUIDES, HELP_BY_ID, searchGuides, searchQuestionAnswers } from './catalog.ts'
import { emptyHelpPreferences, getProgress, HelpProgressStore, parseHelpPreferences, reduceHelpPreferences } from './progress.ts'
import { parseHelpRequest } from './request.ts'
import { HELP_STORAGE_KEY } from './types.ts'

test('all guides have unique ids, authored steps, questions, entry paths, safety, and valid related guides', () => {
  assert.ok(HELP_GUIDES.length >= 103)
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

test('complex feature guides invite once on first open while risky mutations stay manual', () => {
  const firstOpen = HELP_GUIDES.filter((guide) => guide.policy === 'first-open').map((guide) => guide.id).sort()
  assert.deepEqual(firstOpen, ['canvas', 'export', 'git', 'gmail', 'google', 'graph', 'kanban', 'mcp', 'modules', 'plugins', 'reader', 'resource-sync', 'tasks', 'workbench'])
  for (const id of ['restore', 'conflicts', 'rename', 'rename-block', 'rename-section', 'rename-tag', 'link-rewrite', 'permissions', 'code-chunks', 'mcp-drafts', 'external-links', 'mutation-confirmation']) {
    assert.equal(HELP_BY_ID.get(id)?.policy, 'manual', id)
  }
})

test('help search covers questions and workflows without network or vault access', () => {
  assert.equal(searchGuides('customize toolbar')[0]?.id, 'toolbar-customize')
  assert.ok(searchGuides('keychain').some((guide) => guide.id === 'google'))
  assert.ok(searchGuides('annotation').some((guide) => guide.id === 'annotations'))
  assert.ok(searchGuides('operation messages').some((guide) => guide.id === 'activity-output'))
  assert.ok(searchGuides('', 'Recovery').every((guide) => guide.category === 'Recovery'))
  assert.equal(searchGuides('zzzzzzzzzzzzzz').length, 0)
  assert.ok(searchQuestionAnswers('login fail before browser consent').some((result) => result.guide.id === 'google'))
  assert.equal(searchQuestionAnswers('zzzzzzzzzzzzzz').length, 0)
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

test('untrusted persisted state is bounded, filters unknown ids, and migrates first-open state', () => {
  const prefs = parseHelpPreferences(JSON.stringify({ version: 1, hints: false, progress: { graph: { step: -4, completed: 'yes', offered: true }, unknown: { step: 5 } } }))
  assert.deepEqual(Object.keys(prefs.progress), ['graph'])
  assert.deepEqual(prefs.progress.graph, { step: 0, completed: false, offered: true })
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
  assert.equal(getProgress(store.getSnapshot().preferences, 'graph').offered, false)
  assert.equal(calls, 1)
  unsubscribe()
  store.dispatch({ type: 'finish', id: 'graph' })
  assert.equal(calls, 1)
})

test('only the help preference key is written, and reload resumes', () => {
  let raw: string | null = null
  const storage = { getItem(key: string) { assert.equal(key, HELP_STORAGE_KEY); return raw }, setItem(key: string, value: string) { assert.equal(key, HELP_STORAGE_KEY); raw = value } }
  const first = new HelpProgressStore(storage)
  first.dispatch({ type: 'offer', id: 'google' })
  first.dispatch({ type: 'step', id: 'google', step: 2 })
  const reloaded = new HelpProgressStore(storage)
  assert.equal(getProgress(reloaded.getSnapshot().preferences, 'google').step, 2)
  assert.equal(getProgress(reloaded.getSnapshot().preferences, 'google').completed, false)
  assert.equal(getProgress(reloaded.getSnapshot().preferences, 'google').offered, true)
})

test('help requests accept only authored ids and views, never commands or HTML', () => {
  assert.deepEqual(parseHelpRequest({ id: 'graph', view: 'tour' }), { id: 'graph', view: 'tour' })
  assert.equal(parseHelpRequest({ id: '<script>', view: 'tour' }), null)
  assert.equal(parseHelpRequest({ id: 'restore', view: 'execute' }), null)
  assert.equal(parseHelpRequest(null), null)
})


test('every literal contextual help topic points to an authored guide', () => {
  const files = [
    'src/components/AdvancedSettingsSection.tsx',
    'src/components/AiProviderSettings.tsx',
    'src/components/AppearanceSettingsSection.tsx',
    'src/components/BibliographyPanel.tsx',
    'src/components/CanvasPanel.tsx',
    'src/components/CheatsheetPanel.tsx',
    'src/components/CommandPalette.tsx',
    'src/components/ConflictResolverModal.tsx',
    'src/components/DaemonOpsPanel.tsx',
    'src/components/DiagnosticsPanel.tsx',
    'src/components/ExternalChangeBanner.tsx',
    'src/components/ExternalDeepLinkDialog.tsx',
    'src/components/FrontmatterInspector.tsx',
    'src/components/GitPanel.tsx',
    'src/components/GmailManagerPanel.tsx',
    'src/components/GoogleIntegrationSettingsSection.tsx',
    'src/components/GraphPanel.tsx',
    'src/components/KanbanPanel.tsx',
    'src/components/KeyboardShortcutsSettingsSection.tsx',
    'src/components/KnowledgeFiltersPanel.tsx',
    'src/components/LayoutPresetGallery.tsx',
    'src/components/McpPanel.tsx',
    'src/components/NoteHistoryPanel.tsx',
    'src/components/ObsidianImportDialog.tsx',
    'src/components/PanelErrorFallback.tsx',
    'src/components/PerfHudOverlay.tsx',
    'src/components/PublishCenter.tsx',
    'src/components/PublishDiffView.tsx',
    'src/components/ReferencesPreviewPanel.tsx',
    'src/components/ReleaseQualityPanel.tsx',
    'src/components/ResourceSyncPanel.tsx',
    'src/components/SavedViewsPanel.tsx',
    'src/components/SettingsPanel.tsx',
    'src/components/SmartCollectionsPanel.tsx',
    'src/components/SnippetsPanel.tsx',
    'src/components/StatusDockPanel.tsx',
    'src/components/StorePanel.tsx',
    'src/components/SupportPanel.tsx',
    'src/components/TagBrowserPanel.tsx',
    'src/components/TaskPanel.tsx',
    'src/components/TemplatePicker.tsx',
    'src/components/VaultBackupSettings.tsx',
    'src/components/VaultConfigSettingsSection.tsx',
    'src/components/VaultHealthDashboard.tsx',
    'src/components/WorkspaceChromeSettingsSection.tsx',
    'src/components/WritingTargetsPanel.tsx',
    'src/components/app/VaultSidebar.tsx',
    'src/components/chrome/MutationConfirmation.tsx',
    'src/components/inbox/InboxPanel.tsx',
    'src/components/inspector/PreviewQABar.tsx',
    'src/components/portal/PortalPanel.tsx',
    'src/components/portal/QuickCapturePanel.tsx',
    'src/components/reader/ReaderPanel.tsx',
    'src/components/shell/EditorTabBar.tsx',
    'src/components/shell/EditorWorkspace.tsx',
    'src/components/shell/InspectorRail.tsx',
    'src/components/shell/SubsystemToggles.tsx',
    'src/components/shell/WorkspaceStatusFooter.tsx',
    'src/components/themes/ThemeCustomizerModal.tsx',
    'src/components/editor/CustomizableToolbar.tsx',
    'src/components/RenameBlockDialog.tsx',
    'src/components/RenameSectionDialog.tsx',
    'src/components/RenameTagDialog.tsx',
    'src/components/shell/AppTopBar.tsx',
    'src/components/shell/MobileWorkspaceNav.tsx',
    'src/components/TocSidebar.tsx',
    'src/components/TypographyMenu.tsx',
    'src/components/InsertMenu.tsx',
    'src/components/OnboardingTour.tsx',
    'src/components/ExportPreflightPreview.tsx',
    'src/components/ExportPrintPreview.tsx',
    'src/components/git/GitConfirmDialog.tsx',
    'src/components/portal/StickyNotesLayer.tsx',
    'src/components/reader/AnnotationPopover.tsx',
  ]
  for (const path of files) {
    const source = readFileSync(path, 'utf8')
    const ids = [
      ...source.matchAll(/data-help-topic="([a-z0-9-]+)"/g),
      ...source.matchAll(/helpTopic="([a-z0-9-]+)"/g),
    ].map((match) => match[1]!)
    assert.ok(ids.length > 0, `${path} has no contextual Help topic`)
    for (const id of ids) assert.ok(HELP_BY_ID.has(id), `${path} references missing guide ${id}`)
  }
})


test('dynamic contextual help owners resolve only authored guide ids', () => {
  const pluginManager = readFileSync('src/components/plugins/PluginManagerCenter.tsx', 'utf8')
  assert.match(pluginManager, /scope === 'palettes' \? 'appearance' : 'modules'/)
  for (const id of ['appearance', 'modules']) assert.ok(HELP_BY_ID.has(id), id)

  const prompt = readFileSync('src/components/TextPromptDialog.tsx', 'utf8')
  assert.match(prompt, /data-help-topic=\{request\.helpTopic\}/)
  for (const id of ['publish', 'saved-views', 'ai']) assert.ok(HELP_BY_ID.has(id), id)

  const rewrite = readFileSync('src/components/LinkRewriteDialog.tsx', 'utf8')
  assert.match(rewrite, /data-help-topic=\{helpTopic\}/)
  assert.match(rewrite, /helpTopic = 'link-rewrite'/)
  for (const id of ['link-rewrite', 'rename-block', 'rename-section', 'rename-tag']) assert.ok(HELP_BY_ID.has(id), id)
})
