import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const root = new URL('../../', import.meta.url)
const read = (path) => readFileSync(new URL(path, root), 'utf8')
const messages = Object.fromEntries(
  ['en', 'de', 'fa'].map(locale => [locale, JSON.parse(read(`src/lib/i18n/${locale}.json`))]),
)
const get = (locale, path) => path.split('.').reduce((value, part) => value?.[part], messages[locale])
const placeholders = (value) => [...new Set([...value.matchAll(/\{\{(\w+)\}\}/g)].map(match => match[1]))].sort()

test('all note-exploration entry points share one short localized name', () => {
  for (const locale of ['en', 'de', 'fa']) {
    const title = get(locale, 'knowledge.title')
    assert.ok(title?.trim(), `${locale}: note-explorer title missing`)
    for (const key of ['topBar.workbench', 'graph.workbench', 'mobile.openWorkbench']) {
      assert.equal(get(locale, key), title, `${locale} ${key} differs from the note explorer`)
    }
  }
  assert.equal(get('en', 'knowledge.title'), 'Explore notes')
})

test('prominent help text favors actions over implementation jargon in every locale', () => {
  const paths = [
    'settingsPanel.subtitle', 'settings.vaultConfig', 'settings.workspaceChrome',
    'settings.panelPresentation', 'settings.enableInboxTriage',
    'knowledge.subtitle', 'knowledge.discoverDescription',
    'inspector.preset.balanced.description', 'inspector.previewSyncActive',
    'inspector.publishingHint', 'integrations.google.resourceHelp',
    'integrations.gmail.subtitle', 'integrations.gmail.connectionStatus',
    'mcp.subtitle', 'mcp.authorizationSubtitle', 'mcp.recipesDescription',
    'graph.computingLayout', 'graph.pausedDescription',
    'store.pluginManagement', 'store.runtimeReady',
    'pluginManager.installerProfile', 'themeCustomizer.title',
    'themeCustomizer.livePreview', 'themeCustomizer.loadPreset',
    'advancedSettings.description',
  ]
  const forbidden = /\b(workbench|chrome|runtime|canonical|triage|fidelity|snapshot|metadata|graph-assisted)\b|real-time interactive live preview|default inspector layout|OAuth connection status/i
  for (const key of paths) {
    const english = get('en', key)
    assert.equal(typeof english, 'string', `missing English ${key}`)
    assert.doesNotMatch(english, forbidden, `unclear high-traffic copy in ${key}`)
    for (const locale of ['de', 'fa']) {
      const translated = get(locale, key)
      assert.equal(typeof translated, 'string', `missing ${locale} ${key}`)
      assert.ok(translated.trim(), `empty ${locale} ${key}`)
      assert.deepEqual(placeholders(translated), placeholders(english), `placeholder drift: ${locale} ${key}`)
    }
  }
})

test('note link problems explain what is missing, not use insider jargon', () => {
  const expected = {
    en: {
      orphans: 'No incoming links ({{count}})',
      deadEnds: 'No outgoing links ({{count}})',
      unresolved: 'Broken note links ({{count}})',
    },
    de: {
      orphans: 'Keine eingehenden Links ({{count}})',
      deadEnds: 'Keine ausgehenden Links ({{count}})',
      unresolved: 'Defekte Notizlinks ({{count}})',
    },
    fa: {
      orphans: 'بدون پیوند ورودی ({{count}})',
      deadEnds: 'بدون پیوند خروجی ({{count}})',
      unresolved: 'پیوندهای خراب یادداشت ({{count}})',
    },
  }
  for (const locale of ['en', 'de', 'fa']) {
    for (const [name, copy] of Object.entries(expected[locale])) {
      assert.equal(get(locale, `knowledge.filters.${name}`), copy)
    }
  }
  assert.equal(get('en', 'knowledge.filters.startTriage'), 'Review {{count}} notes')
  assert.equal(get('en', 'knowledge.filters.triageProgress'), 'Reviewing {{current}} of {{count}}: {{title}}')
  assert.equal(get('en', 'inspector.noWikilinks'), 'No links to other notes')
  assert.equal(get('en', 'editor.empty.tagline'), 'Your Markdown files stay in your folder.')
})

test('dense graph canvas instructions follow the active interface language', () => {
  const graphCanvas = read('src/components/GraphCanvas.tsx')
  assert.match(graphCanvas, /t\('graph\.canvasAria'/)
  assert.match(graphCanvas, /t\('graph\.canvasNodeAnnouncement'/)
  assert.doesNotMatch(graphCanvas, /Knowledge graph with \$\{nodes\.length\} nodes/)
  for (const locale of ['en', 'de', 'fa']) {
    const aria = get(locale, 'graph.canvasAria')
    const selection = get(locale, 'graph.canvasNodeAnnouncement')
    assert.ok(aria?.length > 20)
    assert.ok(selection?.length > 10)
    assert.deepEqual(placeholders(aria), ['edges', 'nodes'])
    assert.deepEqual(placeholders(selection), ['index', 'name', 'total'])
  }
})

test('major workflow explanations avoid internal-only language', () => {
  const checks = [
    ['src/components/ResourceSyncPanel.tsx', /Inventory what is contained and installed|Each physical instance keeps|Canonical resource/],
    ['src/components/VaultHealthDashboard.tsx', /No broken health checks were found in the current diagnostic snapshot/],
    ['src/components/PublishCenter.tsx', /Validate the export command and inputs without writing an artifact|Artifact written to disk/],
    ['src/components/PublishingStudioPanel.tsx', /Plan eligibility and publication field actions for indexed notes/],
  ]
  for (const [path, jargon] of checks) assert.doesNotMatch(read(path), jargon, path)
})


test('everyday settings, sharing and planning labels stay clear in all shipped languages', () => {
  const keys = [
    'settings.subtitle', 'settingsPanel.persistence', 'settingsPanel.workspaceChrome',
    'settingsPanel.resetWorkspaceChrome', 'settingsPanel.saveVaultConfig',
    'settingsPanel.configLoaded', 'settingsPanel.configSaved', 'settingsPanel.configReadFailed',
    'editor.error.detail', 'editor.empty.openBody', 'store.layoutHint',
    'plannerWorkspace.explanation', 'plannerWorkspace.reviewSync',
    'appearanceSettings.blurNone', 'integrations.google.clientLifecycle',
  ]
  for (const key of keys) {
    const english = get('en', key)
    assert.equal(typeof english, 'string', `Missing English ${key}`)
    assert.ok(english.trim(), `Empty English ${key}`)
    for (const locale of ['de', 'fa']) {
      const translated = get(locale, key)
      assert.equal(typeof translated, 'string', `Missing ${locale} ${key}`)
      assert.ok(translated.trim(), `Empty ${locale} ${key}`)
      assert.deepEqual(placeholders(translated), placeholders(english), `Variable drift: ${locale} ${key}`)
    }
  }
  const oldJargon = /workspace chrome|vault configuration|bidirectional sync|editor surface failed|desktop runtime, vault workflow/i
  for (const key of keys) assert.doesNotMatch(get('en', key), oldJargon, `Unclear copy: ${key}`)
  for (const locale of ['en', 'de', 'fa']) {
    assert.match(get(locale, 'integrations.google.saveConnectionFailed'), /\{error\}/)
  }
})

test('sync review and recovery lead with actions and hide technical details on demand', () => {
  const sync = read('src/components/ResourceSyncPanel.tsx')
  assert.match(sync, />Preview changes<\//)
  assert.match(sync, />Apply these changes<\//)
  assert.match(sync, /<details className="resource-plan-technical">/)
  assert.doesNotMatch(sync, /Build reviewed plan|AgentStack-managed resources/)
  const history = read('src/components/NoteHistoryPanel.tsx')
  assert.match(history, /<details className="note-history-advanced-stats">/)
  assert.match(history, /Browse saved versions/)
  const repair = read('src/components/HealthRepairCards.tsx')
  assert.match(repair, /<h3>Fix note issues<\/h3>/)
  assert.match(repair, />Preview fix<\//)
  const board = read('src/components/KanbanPanel.tsx')
  assert.match(board, /<details className="kanban-advanced-help">/)
  assert.doesNotMatch(board, /This note is not a kanban file/)
  const collections = read('src/components/SmartCollectionsPanel.tsx')
  assert.doesNotMatch(collections, /Persistent DQL folders/)
})
