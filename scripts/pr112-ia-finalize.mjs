import fs from 'node:fs'

const read = (path) => fs.readFileSync(path, 'utf8')
const write = (path, text) => fs.writeFileSync(path, text)
function replaceRequired(text, oldText, newText, label) {
  if (!text.includes(oldText)) throw new Error(`Missing replacement target: ${label}`)
  return text.replace(oldText, newText)
}
function replaceIfPresent(text, oldText, newText) {
  return text.includes(oldText) ? text.replace(oldText, newText) : text
}

// Give the command trigger a concrete scope: it opens the palette for commands
// and note navigation. The sidebar remains explicitly note-only.
for (const [path, label] of [
  ['src/lib/i18n/en.json', 'Commands and notes'],
  ['src/lib/i18n/de.json', 'Befehle und Notizen'],
  ['src/lib/i18n/fa.json', 'فرمان‌ها و یادداشت‌ها'],
]) {
  const data = JSON.parse(read(path))
  if (!data.topBar?.typeCommandOrSearch) throw new Error(`Missing topBar.typeCommandOrSearch in ${path}`)
  data.topBar.typeCommandOrSearch = label
  write(path, JSON.stringify(data, null, 2) + '\n')
}

// The inspector preset selector is a single-choice control, not four unrelated
// toggles. Show the selected preset's purpose without requiring a tooltip.
{
  const path = 'src/components/shell/InspectorRail.tsx'
  let text = read(path)
  text = replaceRequired(
    text,
    `{activeMode !== 'plugins' ? <div className="inspector-preset-row" aria-label={t('inspector.presetAria')}>\n        {INSPECTOR_PRESETS.map((entry) => (\n          <button\n            key={entry.id}\n            type="button"\n            className={inspectorPreset === entry.id ? 'active' : undefined}\n            title={t(\`inspector.preset.\${entry.id}.description\`)}\n            aria-pressed={inspectorPreset === entry.id}\n            onClick={() => onInspectorPresetChange(entry.id)}\n          >\n            {t(\`inspector.preset.\${entry.id}.label\`)}\n          </button>\n        ))}\n      </div> : null}`,
    `{activeMode !== 'plugins' ? (\n        <div className="inspector-preset-control">\n          <div className="inspector-preset-row" role="radiogroup" aria-label={t('inspector.presetAria')}>\n            {INSPECTOR_PRESETS.map((entry) => (\n              <button\n                key={entry.id}\n                type="button"\n                role="radio"\n                className={inspectorPreset === entry.id ? 'active' : undefined}\n                title={t(\`inspector.preset.\${entry.id}.description\`)}\n                aria-checked={inspectorPreset === entry.id}\n                onClick={() => onInspectorPresetChange(entry.id)}\n              >\n                {t(\`inspector.preset.\${entry.id}.label\`)}\n              </button>\n            ))}\n          </div>\n          <p className="inspector-preset-description">\n            {t(\`inspector.preset.\${inspectorPreset}.description\`)}\n          </p>\n        </div>\n      ) : null}`,
    'Inspector preset selector',
  )
  write(path, text)
}

// Installed plugin permission management and marketplace browsing are separate
// subviews. This keeps security-sensitive consent review from sharing a scroll
// surface with discovery/install CTAs.
{
  const path = 'src/components/StorePanel.tsx'
  let text = read(path)
  text = replaceRequired(
    text,
    `  const [pendingConsentPluginId, setPendingConsentPluginId] = useState<string | null>(null)\n\n  return (\n    <div className="store-stack">\n      {/* Safe mode banner */}`,
    `  const [pendingConsentPluginId, setPendingConsentPluginId] = useState<string | null>(null)\n  const [pluginView, setPluginView] = useState<'installed' | 'marketplace'>('installed')\n\n  return (\n    <div className="store-stack">\n      <div className="store-plugin-subnav" role="tablist" aria-label="Plugin views">\n        <button\n          type="button"\n          role="tab"\n          aria-selected={pluginView === 'installed'}\n          className={pluginView === 'installed' ? 'active' : undefined}\n          onClick={() => setPluginView('installed')}\n        >\n          Manage installed\n        </button>\n        <button\n          type="button"\n          role="tab"\n          aria-selected={pluginView === 'marketplace'}\n          className={pluginView === 'marketplace' ? 'active' : undefined}\n          onClick={() => setPluginView('marketplace')}\n        >\n          Browse plugins\n        </button>\n      </div>\n\n      {/* Safe mode banner */}`,
    'Plugin subview state and navigation',
  )
  text = replaceRequired(
    text,
    '<div className={`store-banner${safeMode ? \' danger\' : \'\'}`}>',
    '<div className={`store-banner${safeMode ? \' danger\' : \'\'}`} hidden={pluginView !== \'installed\'}>',
    'Plugin safe-mode view scoping',
  )
  text = replaceRequired(
    text,
    `      {/* Installed plugins */}\n      {plugins.length > 0 && (\n        <section>`,
    `      {/* Installed plugins */}\n      {plugins.length > 0 && (\n        <section hidden={pluginView !== 'installed'}>`,
    'Installed plugin view scoping',
  )
  text = replaceRequired(
    text,
    `      {lintSummary && lintSummary.total > 0 && (\n        <div className="store-lint-summary">`,
    `      {lintSummary && lintSummary.total > 0 && (\n        <div className="store-lint-summary" hidden={pluginView !== 'installed'}>`,
    'Plugin lint view scoping',
  )
  text = replaceRequired(
    text,
    `      {/* Marketplace */}\n      {marketplaceCatalog.length > 0 && (\n        <section>`,
    `      {/* Marketplace */}\n      {marketplaceCatalog.length > 0 && (\n        <section hidden={pluginView !== 'marketplace'}>`,
    'Marketplace view scoping',
  )
  text = replaceRequired(
    text,
    `      {marketplaceCatalog.length > 0 && (\n        <section hidden={pluginView !== 'marketplace'}>\n          <h3 className="store-section-label">\n            Available ({marketplaceCatalog.filter((p) => !installedIds.has(p.id)).length})\n          </h3>`,
    `      {marketplaceCatalog.length > 0 && (\n        <section hidden={pluginView !== 'marketplace'}>\n          <h3 className="store-section-label">\n            Marketplace · {marketplaceCatalog.filter((p) => !installedIds.has(p.id)).length} available\n          </h3>`,
    'Marketplace heading',
  )
  write(path, text)
}

// Style the new hierarchy with existing semantic tokens.
{
  const path = 'src/styles/components/store-panel.css'
  let text = read(path)
  text = replaceRequired(
    text,
    `.store-panel-body {\n  flex: 1;\n  overflow-y: auto;\n  padding: 12px 16px;\n}\n`,
    `.store-panel-body {\n  flex: 1;\n  overflow-y: auto;\n  padding: 12px 16px;\n}\n\n.store-plugin-subnav {\n  display: grid;\n  grid-template-columns: repeat(2, minmax(0, 1fr));\n  gap: 4px;\n  padding: 3px;\n  border: 1px solid var(--border);\n  border-radius: var(--radius-md);\n  background: var(--surface-muted);\n}\n\n.store-plugin-subnav button {\n  min-width: 0;\n  min-height: 34px;\n  border: 0;\n  border-radius: calc(var(--radius-md) - 2px);\n  background: transparent;\n  color: var(--text-muted);\n  font: inherit;\n  cursor: pointer;\n}\n\n.store-plugin-subnav button.active,\n.store-plugin-subnav button[aria-selected='true'] {\n  background: var(--surface-raised);\n  color: var(--ink-strong);\n  box-shadow: var(--shadow-sm);\n}\n`,
    'Plugin subview styles',
  )
  write(path, text)
}

// The screenshot suite must fail if the reviewed surface is absent or renamed.
{
  const path = 'e2e/screenshots.spec.ts'
  let text = read(path)
  text = replaceIfPresent(text, "  await expect(historyPanel.getByText('Revision preview')).toBeVisible()\n", "  await expect(historyPanel.getByText('Compare before restoring')).toBeVisible()\n  await expect(historyPanel.getByLabel('Current note and selected revision comparison')).toBeVisible()\n")
  text = replaceIfPresent(
    text,
    `  const shortcutsTab = settings.getByRole('tab', { name: /Keyboard|Shortcuts/i })\n  if (await shortcutsTab.isVisible()) {\n    await shortcutsTab.click()\n    await page.waitForTimeout(500)\n  }\n`,
    `  const shortcutsTab = settings.getByRole('tab', { name: /Keyboard|Shortcuts/i })\n  await expect(shortcutsTab).toBeVisible()\n  await shortcutsTab.click()\n  await expect(settings.getByRole('table', { name: 'Keyboard shortcuts' })).toBeVisible()\n  await page.waitForTimeout(500)\n`,
  )
  text = replaceIfPresent(
    text,
    `  const resolveBtn = gitPanel.getByRole('button', { name: /resolve/i }).first()\n  if (await resolveBtn.isVisible()) {\n    await resolveBtn.click()\n  } else {\n    await gitPanel.locator('.conflict-resolve-btn, [title*="conflict"], [title*="Resolve"]').first().click()\n  }\n`,
    `  const resolveBtn = gitPanel.getByRole('button', { name: /resolve/i }).first()\n  await expect(resolveBtn).toBeVisible()\n  await resolveBtn.click()\n`,
  )
  write(path, text)
}

for (const path of ['scripts/pr112-ia-finalize.mjs', '.github/workflows/pr112-ia-finalize.yml']) {
  if (fs.existsSync(path)) fs.rmSync(path)
}
