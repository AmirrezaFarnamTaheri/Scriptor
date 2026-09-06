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
    setSplitPreview: () => {},
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
