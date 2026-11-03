import assert from 'node:assert/strict'
import test from 'node:test'
import { buildPaletteCommands, type PaletteCommandContext } from './buildPaletteCommands.ts'

test('buildPaletteCommands includes open-gmail-manager when setGmailManagerOpen is provided', () => {
  let opened = false
  const commands = buildPaletteCommands({
    workspace: {
      inboxNotes: [],
      favoriteNotes: [],
      recentNotes: [],
      closedTabs: [],
      noteTypes: [],
      templatePaths: [],
      snippetCatalog: [],
      reopenClosedTab: () => {},
      closedTabCount: 0,
      activePath: null,
      setSidebarView: () => {},
      createNote: async () => {},
      openDailyNote: async () => {},
      openRandomNote: async () => {},
      refreshHealth: async () => {},
      fixVaultLint: async () => {},
      loadGraph: async () => {},
      insertSnippet: () => {},
      applyEditorTransform: () => {},
    } as unknown as PaletteCommandContext['workspace'],
    ai: {} as unknown as PaletteCommandContext['ai'],
    mcp: {} as unknown as PaletteCommandContext['mcp'],
    graphDepth: 1,
    graphFullVault: false,
    splitPreview: false,
    setStatusDockTab: () => {},
    setGraphOpen: () => {},
    setCanvasOpen: () => {},
    setGitPanelOpen: () => {},
    setHealthDashboardOpen: () => {},
    setMcpPanelOpen: () => {},
    setSettingsOpen: () => {},
    setBibliographyOpen: () => {},
    setGmailManagerOpen: () => {
      opened = true
    },
  })

  const gmailCommand = commands.find((cmd) => cmd.id === 'open-gmail-manager')
  assert.ok(gmailCommand, 'open-gmail-manager command should exist')
  assert.equal(gmailCommand.label, 'Open Gmail Manager')
  gmailCommand.run()
  assert.equal(opened, true, 'setGmailManagerOpen should be invoked')
})


/**
 * Minimal palette contract fixture. A missing optional launcher is intentional;
 * commands with no effect should not be advertised as actionable.
 */
function availabilityFixture(activePath: string | null = null): PaletteCommandContext {
  return {
    workspace: {
      activePath,
      inboxNotes: [], noteTypes: [], templatePaths: [], snippetCatalog: [],
      closedTabCount: 0,
      setSidebarView: () => {},
      chooseVaultFolder: async () => {},
      rebuildIndex: async () => {},
      refreshHealth: async () => {},
      fixVaultLint: async () => {},
      loadGraph: async () => {},
      organizeNote: async () => {},
      createDailyNote: async () => {},
      createNoteOfType: async () => {},
      createNoteFromTemplate: async () => {},
      draftMarkdown: '', generateLinkReferences: () => {},
    },
    ai: { enabled: false, proposeDraftFromPrompt: async () => '' },
    mcp: { proposeDraftForActiveNote: async () => ({}) },
    graphDepth: 1, graphFullVault: false, splitPreview: false,
    setStatusDockTab: () => {}, setGraphOpen: () => {}, setCanvasOpen: () => {},
    setGitPanelOpen: () => {}, setHealthDashboardOpen: () => {},
    setMcpPanelOpen: () => {}, setSettingsOpen: () => {},
    setBibliographyOpen: () => {},
  }
}

test('palette does not advertise no-op actions when optional launchers are unavailable', () => {
  const commands = buildPaletteCommands(availabilityFixture())
  const ids = new Set(commands.map((command) => command.id))
  for (const id of [
    'open-knowledge-workbench', 'open-publish-center', 'open-tags',
    'open-filters', 'open-saved-views', 'open-smart-collections',
    'open-cheatsheet', 'open-support', 'open-portal', 'open-quick-capture',
    'open-note-history', 'reopen-closed-tab', 'organize-active-note',
  ]) {
    assert.equal(ids.has(id), false, id + ' must not close the palette without an available action')
  }
  assert.ok(ids.has('open-vault'), 'a real command such as Open vault remains available')
})

test('available optional palette actions execute their owner and unavailable closed-tab recovery stays hidden', () => {
  const called: string[] = []
  const context = availabilityFixture('notes/current.md')
  context.openKnowledgeWorkbench = (tab) => called.push('knowledge:' + (tab ?? 'repair'))
  context.setPublishCenterOpen = () => called.push('publish')
  context.setNoteHistoryOpen = () => called.push('history')
  context.workspace.reopenClosedTab = () => called.push('reopen')
  context.workspace.closedTabCount = 0

  let commands = buildPaletteCommands(context)
  assert.equal(commands.some((command) => command.id === 'reopen-closed-tab'), false,
    'no recently closed tab means no recovery action is available')
  for (const id of ['open-knowledge-workbench', 'open-tags', 'open-smart-collections',
    'open-publish-center', 'open-note-history', 'organize-active-note']) {
    assert.ok(commands.some((command) => command.id === id), id + ' should be available with its owner')
  }

  for (const id of ['open-tags', 'open-smart-collections', 'open-publish-center', 'open-note-history']) {
    commands.find((command) => command.id === id)?.run()
  }
  assert.deepEqual(called, ['knowledge:tags', 'knowledge:collections', 'publish', 'history'])

  context.workspace.closedTabCount = 1
  commands = buildPaletteCommands(context)
  commands.find((command) => command.id === 'reopen-closed-tab')?.run()
  assert.deepEqual(called, ['knowledge:tags', 'knowledge:collections', 'publish', 'history', 'reopen'])
})


test('MAT-018: palette only advertises contributed plugin commands the existing owner permits', () => {
  const entry = { pluginId: 'sample-plugin', command: {
    commandId: 'inspect', label: 'Inspect', category: 'Plugin', permission: 'read' as const,
  } }
  const context = availabilityFixture()
  const invoked: string[] = []
  let granted = false
  context.pluginCommands = [entry]
  context.runPluginCommand = (request) => { invoked.push(request.command.commandId) }
  context.canExecutePluginCommand = (_pluginId, permission) => granted && permission === 'read'

  let commands = buildPaletteCommands(context)
  assert.equal(commands.some(command => command.id === 'plugin-sample-plugin-inspect'), false)
  assert.deepEqual(invoked, [], 'denied contributions must not execute')

  granted = true
  commands = buildPaletteCommands(context)
  const permitted = commands.find(command => command.id === 'plugin-sample-plugin-inspect')
  assert.ok(permitted, 'a freshly granted contribution should be actionable')
  permitted.run()
  assert.deepEqual(invoked, ['inspect'])

  context.canExecutePluginCommand = undefined
  assert.equal(buildPaletteCommands(context).some(command => command.id === 'plugin-sample-plugin-inspect'), false,
    'missing permission owner must fail closed instead of advertising a no-op')
})


test('MAT-018: a visible plugin command must not run after permission is revoked', () => {
  const entry = { pluginId: 'revocable', command: {
    commandId: 'write', label: 'Update note', category: 'Plugin', permission: 'write' as const,
  } }
  const context = availabilityFixture()
  let permitted = true
  const invoked: string[] = []
  context.pluginCommands = [entry]
  context.canExecutePluginCommand = () => permitted
  context.runPluginCommand = (request) => { invoked.push(request.command.commandId) }
  const command = buildPaletteCommands(context).find(x => x.id === 'plugin-revocable-write')
  assert.ok(command, 'granted command appears in the palette')
  permitted = false
  command.run()
  assert.deepEqual(invoked, [], 'stale palette callbacks must not invoke revoked plugin commands')
  permitted = true
  command.run()
  assert.deepEqual(invoked, ['write'], 'restored permission allows the retained callback')
})
