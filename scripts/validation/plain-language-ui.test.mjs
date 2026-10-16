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

test('major workflow explanations avoid internal-only language', () => {
  const checks = [
    ['src/components/ResourceSyncPanel.tsx', /Inventory what is contained and installed|Each physical instance keeps|Canonical resource/],
    ['src/components/VaultHealthDashboard.tsx', /No broken health checks were found in the current diagnostic snapshot/],
    ['src/components/PublishCenter.tsx', /Validate the export command and inputs without writing an artifact|Artifact written to disk/],
    ['src/components/PublishingStudioPanel.tsx', /Plan eligibility and publication field actions for indexed notes/],
  ]
  for (const [path, jargon] of checks) assert.doesNotMatch(read(path), jargon, path)
})
