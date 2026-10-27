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
  assert.match(sync, /Preview changes/)
  assert.match(sync, /Apply these changes/)
  assert.match(sync, /<details className="resource-plan-technical">/)
  assert.doesNotMatch(sync, /Build reviewed plan|AgentStack-managed resources/)
  const history = read('src/components/NoteHistoryPanel.tsx')
  assert.match(history, /<details className="note-history-advanced-stats">/)
  assert.match(history, /Browse saved versions/)
  const repair = read('src/components/HealthRepairCards.tsx')
  assert.match(repair, /<h3>Fix note issues<\/h3>/)
  assert.match(repair, /Preview fix/)
  const board = read('src/components/KanbanPanel.tsx')
  assert.match(board, /<details className="kanban-advanced-help">/)
  assert.doesNotMatch(board, /This note is not a kanban file/)
  const collections = read('src/components/SmartCollectionsPanel.tsx')
  assert.doesNotMatch(collections, /Persistent DQL folders/)
})

test('routine editor tools and update guidance use plain, concrete language', () => {
  const toolbar = read('src/lib/i18n/editorToolbarStrings.ts')
  assert.ok(toolbar.includes("'typography.zapGremlins': 'Remove hidden characters'"))
  assert.ok(toolbar.includes("'typography.stripDuplicateSpaces': 'Remove extra spaces'"))
  assert.doesNotMatch(toolbar, /Zap gremlins|Strip duplicate spaces/)
  for (const locale of ['en', 'de', 'fa']) {
    for (const key of [
      'advancedSettings.updatesHelp', 'advancedSettings.systemMetadata',
      'settings.systemMetadataAvailable', 'editor.transforms.markOrganized',
      'inspector.health.orphanAssets', 'inspector.health.cacheStale', 'aiSettings.description',
    ]) {
      const value = get(locale, key)
      assert.equal(typeof value, 'string', `${locale}: ${key}`)
      assert.ok(value.trim(), `${locale}: ${key} is empty`)
      assert.deepEqual(placeholders(value), placeholders(get('en', key)), `${locale}: ${key} placeholders`)
    }
  }
  assert.doesNotMatch(get('en', 'advancedSettings.updatesHelp'), /checksum-published release artifacts|authenticated delivery channel/i)
  assert.doesNotMatch(get('en', 'advancedSettings.systemMetadata'), /desktop shell|system metadata/i)
  assert.doesNotMatch(get('en', 'editor.transforms.markOrganized'), /triage/i)
  assert.doesNotMatch(get('en', 'aiSettings.description'), /MCP write approval/i)
})

test('automation permissions stay readable at the narrow panel sizes in screenshots', () => {
  const css = read('src/styles/components/mcp-panel.css')
  assert.match(css, /mcp-mode-option-copy small/)
  assert.ok(css.includes('font-size: 12px;'))
  assert.doesNotMatch(css, /\.mcp-mode-option-copy small \{[^}]*font-size: 10px;/)
  assert.ok(css.includes('overflow-wrap: anywhere;'))
})

test('resource sharing names copy differences and safe actions, not internal plan states', () => {
  const source = read('src/components/ResourceSyncPanel.tsx')
  for (const phrase of ['These copies match across apps', 'This app has two identical copies',
    'Move extra copy aside', 'Sync partly finished', 'Content details']) {
    assert.ok(source.includes(phrase), `Missing task-based resource wording: ${phrase}`)
  }
  assert.doesNotMatch(source, /Redundant exact copy inside the same target|Same logical identity with divergent content|Could not inventory agent resources/)
  assert.ok(source.includes('resourceApplyPlan(plan.id, 3)'))
})

test('conflict resolution gives readable choices without changing the underlying ours/theirs semantics', () => {
  const source = read('src/components/ConflictResolverModal.tsx')
  for (const label of ['Keep current changes', 'Keep incoming changes', 'Keep earlier version',
    'Result preview', 'Apply selected changes']) {
    assert.ok(source.includes(label), `Missing plain-language conflict choice: ${label}`)
  }
  assert.doesNotMatch(source, /Keep ours|Keep theirs|Choose ours for all|Choose theirs for all/)
  assert.match(source, /onResolveMerged\(mergedPreview\)/)
  assert.match(source, /chooseAll\('ours'\)/)
  assert.match(source, /chooseAll\('theirs'\)/)
})

test('backup recovery and snippets have honest confirmation and name-collision guards', () => {
  const backup = read('src/components/VaultBackupSettings.tsx')
  const snippets = read('src/components/SnippetsPanel.tsx')
  assert.match(backup, /setPendingAction\(createPendingBackupAction\(backupScope, entry\.name, 'restore'\)\)/)
  assert.match(backup, /setPendingAction\(createPendingBackupAction\(backupScope, entry\.name, 'delete'\)\)/)
  assert.match(backup, /<MutationConfirmation/)
  assert.match(backup, /pendingAction && matchesBackupActionScope\(pendingAction, backupScope, entry\.name\)/)
  assert.match(snippets, /snippetNameTaken/)
  assert.match(snippets, /nextAvailableSnippetName/)
  assert.match(snippets, /Discard unsaved snippet edits/)
  assert.doesNotMatch(backup, /DR backup|legacy\/unverified/)
})

test('external change recovery warns before discarding or overwriting user edits', () => {
  const actions = read('src/components/ExternalChangeActions.tsx')
  const banner = read('src/components/ExternalChangeBanner.tsx')
  const diagnostics = read('src/components/DiagnosticsPanel.tsx')
  assert.match(actions, /<MutationConfirmation/)
  assert.match(actions, /Your unsaved edits in Scriptor will be discarded/)
  assert.match(actions, /they will overwrite changes made outside Scriptor/)
  assert.match(actions, /onCancel=\{\(\) => setPending\(null\)\}/)
  assert.match(banner, /<ExternalChangeActions/)
  assert.match(diagnostics, /<ExternalChangeActions/)
  assert.doesNotMatch(banner, /onClick=\{onKeepEditing\}/)
})

test('Drive sharing uses task language but keeps incoming-review consent and conflict details', () => {
  const source = read('src/components/CollaborationPanel.tsx')
  assert.match(source, /collaborationUi\.docsConsent/)
  assert.match(source, /collaborationUi\.saveReviewed/)
  assert.match(source, /collaborationUi\.versionDetails/)
  assert.match(source, /hasUnresolvedSharedConflict/)
  assert.match(source, /runSourceNoteMutation/)
  assert.doesNotMatch(source, /Optional Google Docs text translation|Reviewed translated merge|Remove saved credential/)
})

test('saved note groups use readable status and confirm removal without deleting notes', () => {
  const source = read('src/components/SmartCollectionsPanel.tsx')
  assert.match(source, /collectionsUi\.needsVault/)
  assert.match(source, /MutationConfirmation/)
  assert.match(source, /onCancel=\{\(\) => setPendingRemoval\(null\)\}/)
  assert.doesNotMatch(source, /DQL collections|run its DQL query|note\(s\) matched/)
})

test('files, search groups, article capture, and reports explain tasks without internal jargon', () => {
  const files = read('src/components/AssetDeckPanel.tsx')
  const cheat = read('src/components/CheatsheetPanel.tsx')
  const collections = read('src/components/SmartCollectionsPanel.tsx')
  const capture = read('src/components/CaptureReviewerPanel.tsx')
  const database = read('src/components/DatabaseStudioPanel.tsx')
  const perf = read('src/components/ReleaseQualityPanel.tsx')
  assert.match(files, /How file usage is counted/)
  assert.doesNotMatch(files, /Usage reflects the derived link index|Inventory reached its processing limit/)
  assert.match(collections, /collectionsUi\.query/)
  assert.equal(get('en', 'collectionsUi.query'), 'Rule for matching notes')
  assert.doesNotMatch(collections, /Search rule \(DQL\)/)
  assert.match(cheat, /Diagram examples/)
  assert.match(capture, /Original page text/)
  assert.match(database, /Totals for loaded notes/)
  assert.match(perf, /Performance checks/)
})

test('Obsidian import checks browsed folders automatically without touching source files', () => {
  const source = read('src/components/ObsidianImportDialog.tsx')
  assert.match(source, /void validateSource\(path\)/)
  assert.match(source, /check !== checkGeneration\.current/)
  assert.match(source, /Keep note properties \(YAML frontmatter\)/)
  assert.match(source, /disabled=\{isImporting \|\| isValidating/)
  assert.doesNotMatch(source, /<span>Preserve YAML frontmatter<\/span>/)
})

test('snippet renaming allows clearing and replacing the field before committing', () => {
  const source = read('src/components/SnippetsPanel.tsx')
  assert.match(source, /value=\{nameDraft \?\? active\.name\}/)
  assert.match(source, /setNameDraft\(event\.target\.value\)/)
  assert.match(source, /onBlur=\{\(\) => \{/)
  assert.match(source, /stagedName/)
  assert.match(source, /snippetNameTaken\(snippets, selected, nextName\)/)
  assert.doesNotMatch(source, /if \(!nextName\.trim\(\)\) \{[\s\S]{0,100}return/)
})

test('unsaved snippet confirmation replaces the bounded modal footer instead of overflowing it', () => {
  const source = read('src/components/SnippetsPanel.tsx')
  const css = read('src/styles/app/workspace.css')
  assert.match(source, /className=\{`snippets-footer/)
  assert.match(source, /confirmDiscard \? <MutationConfirmation/)
  assert.match(css, /\.snippets-footer\.is-confirming \{ display: block; \}/)
  assert.doesNotMatch(source, /<\/footer>\s*\{confirmDiscard/)
})

test('vault navigation offers contextual next steps without showing dead-end controls', () => {
  const sidebar = read('src/components/app/VaultSidebar.tsx')
  const search = read('src/hooks/useSearchStore.ts')
  const css = read('src/styles/app/workspace.css')
  for (const key of ['emptyVault', 'vaultLoadFailed', 'noSearchResults', 'clearSearch', 'moreCreateOptions']) {
    for (const locale of ['en', 'de', 'fa']) {
      assert.equal(typeof get(locale, `vaultSidebar.${key}`), 'string', `${locale} missing ${key}`)
      assert.ok(get(locale, `vaultSidebar.${key}`).trim(), `${locale} empty ${key}`)
    }
  }
  assert.match(sidebar, /!vault \? \(/)
  assert.match(sidebar, /onClick=\{onChooseVault\}/)
  assert.match(sidebar, /onClick=\{onCreateNote\}/)
  assert.match(sidebar, /onSearchQueryChange\(''\)/)
  assert.match(sidebar, /<details className="vault-create-options">/)
  assert.match(search, /setSearchResults\(\[\]\)\s+setIsSearching\(true\)/)
  assert.match(css, /\.vault-search-clear:focus-visible/)
})

test('workspace settings keep uncommon layout switches behind an accessible disclosure', () => {
  const src = read('src/components/WorkspaceChromeSettingsSection.tsx')
  assert.match(src, /<details className="workspace-layout-advanced">/)
  for (const key of ['showTopBar', 'showFormatToolbar', 'showEditorStatus', 'showLineNumbers']) {
    assert.match(src, new RegExp(`'\\b${key}\\b'`))
  }
  for (const locale of ['en', 'de', 'fa']) {
    assert.ok(get(locale, 'settingsPanel.moreWorkspaceOptions')?.trim())
  }
  const css = read('src/styles/components/settings-panel.css')
  assert.match(css, /\.workspace-layout-advanced > summary:focus-visible/)
})

test('packaged Google sign-in never asks end users for a developer OAuth client ID', () => {
  const settings = read('src/components/GoogleIntegrationSettingsSection.tsx')
  const gmail = read('src/components/GmailManagerPanel.tsx')
  assert.ok(settings.includes('import.meta.env.DEV ? <details className="google-developer-setup">'))
  assert.ok(gmail.includes('!hasPackagedGoogleOAuthClient() && import.meta.env.DEV'))
  assert.ok(gmail.includes('onClick={() => void handleStartAuth()}'))
  assert.ok(!settings.includes('{sync.enabled ? <>'), 'Calendar connection should not require enabling a toggle')
  assert.ok(settings.includes('<details className="google-calendar-options">'))
  assert.ok(settings.includes('enabled: true, google_client_id:'))
  for (const locale of ['en', 'de', 'fa']) assert.ok(get(locale, 'integrations.google.calendarOptions')?.trim())
})

test('Drive uses the app identity and does not ask production users for an OAuth ID', () => {
  const panel = read('src/components/CollaborationPanel.tsx')
  assert.ok(panel.includes('!hasPackagedGoogleOAuthClient() && import.meta.env.DEV'))
  assert.ok(!panel.includes('polling.starting || !clientId.trim()'))
  assert.ok(panel.includes("setError(t('integrations.google.notConfigured'))"))
})

test('one-click Google uses system-browser consent while preserving local write approvals', () => {
  const rust = read('apps/desktop/src-tauri/src/authorization.rs')
  assert.ok(rust.includes('if operation.uses_google_browser_consent()'))
  assert.ok(rust.includes('.issue(operation, account_scope, bound_vault_id)'))
  for (const operation of ['GoogleDriveAuth', 'GoogleCalendarAuth', 'GoogleGmailAuth']) {
    assert.ok(rust.includes('Self::' + operation), operation)
  }
  assert.ok(rust.includes('if !approved {'))
  assert.ok(rust.includes('GoogleGmailWrite'))
  assert.ok(rust.includes('GoogleDriveWrite'))
})
