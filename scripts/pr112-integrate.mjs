import fs from 'node:fs'

function read(path) {
  return fs.readFileSync(path, 'utf8')
}
function write(path, text) {
  fs.writeFileSync(path, text)
}
function replaceRequired(text, oldText, newText, label) {
  if (!text.includes(oldText)) throw new Error(`Missing replacement target: ${label}`)
  return text.replace(oldText, newText)
}
function replaceIfPresent(text, oldText, newText) {
  return text.includes(oldText) ? text.replace(oldText, newText) : text
}
function replaceAllIfPresent(text, oldText, newText) {
  return text.includes(oldText) ? text.replaceAll(oldText, newText) : text
}

// App-level configuration writes must use the serialized mutation queue and
// inspector health must not mix note-scoped and vault-scoped metrics.
{
  const path = 'src/App.tsx'
  let text = read(path)
  text = replaceRequired(
    text,
    "import { extractPandocCitationKeys } from './lib/citationExtract'\n",
    "import { extractPandocCitationKeys } from './lib/citationExtract'\nimport { mutateVaultConfig } from './lib/vaultConfigMutation'\n",
    'App mutateVaultConfig import',
  )
  text = replaceRequired(text, '  vaultSaveConfig,\n', '', 'App direct vaultSaveConfig import')
  text = replaceRequired(
    text,
    '          onPull={() => void workspace.pullRemote()}\n',
    '          onPull={(strategy) => void workspace.pullRemote(strategy)}\n',
    'App Git pull strategy forwarding',
  )
  text = replaceRequired(
    text,
    `  const healthMetrics = useMemo(\n    () => [\n      ['Links', String(workspace.inspectorLinks.length)],\n      ['Broken', String(workspace.health?.broken_links ?? 0)],\n      ['Orphans', String(workspace.health?.orphan_assets ?? 0)],\n      ['Duplicates', String(workspace.health?.duplicate_titles ?? 0)],\n      ['Frontmatter', String(workspace.health?.invalid_frontmatter ?? 0)],\n      ['Missing cites', String(workspace.health?.unresolved_citations ?? 0)],\n      ['Words', draftWordCount.toLocaleString()],\n      ['Vault words', (workspace.health?.total_words ?? 0).toLocaleString()],\n    ] as Array<[string, string]>,\n    [draftWordCount, workspace.health, workspace.inspectorLinks.length],\n  )\n`,
    `  const healthMetrics = useMemo(\n    () => [\n      ['Broken links', String(workspace.health?.broken_links ?? 0)],\n      ['Orphan assets', String(workspace.health?.orphan_assets ?? 0)],\n      ['Duplicate titles', String(workspace.health?.duplicate_titles ?? 0)],\n      ['Invalid frontmatter', String(workspace.health?.invalid_frontmatter ?? 0)],\n      ['Missing citations', String(workspace.health?.unresolved_citations ?? 0)],\n      ['Indexed notes', String(workspace.health?.indexed_notes ?? 0)],\n      ['Vault words', (workspace.health?.total_words ?? 0).toLocaleString()],\n      ['Cache', workspace.health?.cache_status ?? '—'],\n    ] as Array<[string, string]>,\n    [workspace.health],\n  )\n`,
    'App vault-scoped inspector health metrics',
  )
  text = replaceRequired(
    text,
    `            if (nativeReady) {\n              void vaultSaveConfig({\n                ...workspace.vaultConfig,\n                writing_targets: {\n                  ...workspace.vaultConfig.writing_targets,\n                  daily_words: value,\n                  history_path: workspace.vaultConfig.writing_targets?.history_path ?? '.scriptor/stats-history.json',\n                },\n              })\n            }\n`,
    `            if (nativeReady) {\n              void mutateVaultConfig((current) => ({\n                ...current,\n                writing_targets: {\n                  ...current.writing_targets,\n                  daily_words: value,\n                  history_path: current.writing_targets?.history_path ?? '.scriptor/stats-history.json',\n                },\n              })).catch((error) => {\n                workspace.logActivity(\n                  'error',\n                  'Writing target save failed',\n                  error instanceof Error ? error.message : String(error),\n                )\n              })\n            }\n`,
    'App serialized writing target mutation',
  )
  write(path, text)
}

// Settings uses the same queue. MCP is owned by its runtime and must not be
// overwritten by a stale Settings snapshot.
{
  const path = 'src/components/SettingsPanel.tsx'
  let text = read(path)
  text = replaceRequired(
    text,
    "import { diagnosticsExportSupportBundle, exportDiscover, vaultLoadConfig, vaultSaveConfig } from '../bridge/commands'\n",
    "import { diagnosticsExportSupportBundle, exportDiscover, vaultLoadConfig } from '../bridge/commands'\nimport { mutateVaultConfig } from '../lib/vaultConfigMutation'\n",
    'Settings mutation import',
  )
  text = replaceRequired(
    text,
    '      await vaultSaveConfig(config)\n',
    '      await mutateVaultConfig((current) => ({ ...current, ...config, mcp: current.mcp }))\n',
    'Settings serialized save',
  )
  write(path, text)
}

// Consent copy must describe what the runtime actually grants. Optional
// permissions are intentionally not bundled into enablement.
{
  const path = 'src/components/StorePanel.tsx'
  let text = read(path)
  text = replaceRequired(
    text,
    '              const required = requiredPermissions(plugin)\n',
    "              const required = requiredPermissions(plugin)\n              const optional = plugin.manifest.permissions.filter((entry) => entry.optional)\n",
    'Store optional permission inventory',
  )
  text = replaceRequired(
    text,
    `                            {entry.permission}\n                            {entry.optional ? ' (optional)' : ''}\n`,
    `                            {entry.permission}\n                            {entry.optional ? ' (optional · not granted automatically)' : ' (required)'}\n`,
    'Store permission labels',
  )
  text = replaceRequired(text, '                          Review & grant\n', '                          Review required access\n', 'Store consent button copy')
  text = replaceRequired(
    text,
    '                          aria-label={`Review and grant permissions for ${plugin.manifest.name} in this vault`}\n',
    '                          aria-label={`Review and grant required permissions for ${plugin.manifest.name} in this vault`}\n',
    'Store consent aria label',
  )
  text = replaceAllIfPresent(text, 'Revoke access', 'Revoke this vault')
  text = replaceRequired(
    text,
    `                          plugin.manifest.permissions.length > 0\n                            ? \`Grant \${plugin.manifest.permissions.map((entry) => entry.permission).join(', ')} access to \${plugin.manifest.name} for this vault and enable the plugin?\`\n                            : \`Enable \${plugin.manifest.name} for this vault?\`\n`,
    `                          required.length > 0\n                            ? \`Grant required \${required.join(', ')} access to \${plugin.manifest.name} for this vault and enable the plugin?\${optional.length > 0 ? \` Optional permissions (\${optional.map((entry) => entry.permission).join(', ')}) are not granted automatically.\` : ''}\`\n                            : \`Enable \${plugin.manifest.name} for this vault?\${optional.length > 0 ? \` Optional permissions (\${optional.map((entry) => entry.permission).join(', ')}) are not granted automatically.\` : ''}\`\n`,
    'Store consent confirmation copy',
  )
  text = replaceRequired(
    text,
    '                            plugin.manifest.permissions.map((entry) => entry.permission),\n',
    '                            required,\n',
    'Store grants required permissions only',
  )
  text = replaceRequired(text, '                        confirmLabel="Grant & enable"\n', '                        confirmLabel="Grant required access & enable"\n', 'Store confirmation label')
  write(path, text)
}

// Inspector terminology must stay distinct from the editor's Source/Split/
// Preview modes, and its health card is now vault-scoped.
for (const [path, renderedLabel, healthLabel, presetAria] of [
  ['src/lib/i18n/en.json', 'Rendered output', 'Vault health', 'Inspector content preset'],
  ['src/lib/i18n/de.json', 'Gerenderte Ausgabe', 'Tresorstatus', 'Inspektor-Inhaltsprofil'],
  ['src/lib/i18n/fa.json', 'خروجی رندرشده', 'سلامت خزانه', 'نمایه محتوای بازرس'],
]) {
  const data = JSON.parse(read(path))
  if (!data.inspector?.tabs?.preview || !data.inspector?.noteHealth) {
    throw new Error(`Missing inspector translations in ${path}`)
  }
  data.inspector.tabs.preview = renderedLabel
  data.inspector.noteHealth = healthLabel
  data.inspector.presetAria = presetAria
  if (data.settings?.showInspectorHealth) data.settings.showInspectorHealth = healthLabel === 'Vault health' ? 'Show inspector vault health' : data.settings.showInspectorHealth
  if (data.settingsSection?.showInspectorHealth) data.settingsSection.showInspectorHealth = healthLabel === 'Vault health' ? 'Show inspector vault health' : data.settingsSection.showInspectorHealth
  write(path, JSON.stringify(data, null, 2) + '\n')
}

// Inspector-tab tests follow the distinct label. Editor Preview controls are
// buttons, not tabs, so these replacements remain scoped to the inspector.
for (const path of [
  'e2e/visual-review.spec.ts',
  'e2e/screenshot-geometry.spec.ts',
  'e2e/preview-resilience.spec.ts',
  'e2e/screenshots.spec.ts',
]) {
  let text = read(path)
  text = replaceAllIfPresent(text, "getByRole('tab', { name: 'Preview', exact: true })", "getByRole('tab', { name: 'Rendered output', exact: true })")
  text = replaceAllIfPresent(text, "getByRole('tab', { name: 'Preview', selected: true })", "getByRole('tab', { name: 'Rendered output', selected: true })")
  text = replaceAllIfPresent(text, "getByRole('tab', { name: 'Preview' })", "getByRole('tab', { name: 'Rendered output' })")
  write(path, text)
}
{
  const path = 'e2e/frontend-polish-regressions.spec.ts'
  let text = read(path)
  text = replaceIfPresent(text, "['Inspector', 'Preview', 'Plugins']", "['Inspector', 'Rendered output', 'Plugins']")
  write(path, text)
}

// Bring screenshot navigation in line with progressive disclosure and require
// the feature under test to exist rather than silently capturing a fallback.
{
  const path = 'e2e/screenshots.spec.ts'
  let text = read(path)
  text = replaceIfPresent(
    text,
    "  await page.locator('.top-actions').getByRole('button', { name: 'Graph', exact: true }).click()\n",
    "  await openCommandPalette(page)\n  await runCommand(page, 'Open graph')\n",
  )
  text = replaceIfPresent(
    text,
    "  await page.locator('.top-actions').getByRole('button', { name: 'Canvas', exact: true }).click()\n",
    "  await openCommandPalette(page)\n  await runCommand(page, 'Open canvas')\n",
  )
  text = replaceIfPresent(
    text,
    "  await page.locator('.top-actions').getByRole('button', { name: 'Workbench', exact: true }).click()\n",
    "  await openCommandPalette(page)\n  await runCommand(page, 'Open knowledge workbench')\n",
  )
  text = replaceAllIfPresent(text, "getByRole('dialog', { name: 'Publish center' })", "getByRole('dialog', { name: 'Export and publish' })")
  text = replaceAllIfPresent(text, "getByRole('button', { name: 'Close Publish center' })", "getByRole('button', { name: 'Close Export and publish' })")
  text = replaceAllIfPresent(text, "getByText('No issues detected')", "getByText('Vault looks healthy')")
  text = replaceAllIfPresent(text, "getByRole('dialog', { name: 'Resolve merge conflict' })", "getByRole('dialog', { name: 'Resolve merge conflicts' })")
  text = replaceIfPresent(
    text,
    `  const shortcutsTab = settingsPanel.getByRole('tab', { name: 'Keyboard shortcuts', exact: true })\n  if (await shortcutsTab.isVisible()) {\n    await shortcutsTab.click()\n    await settleLayout(page)\n  }\n`,
    `  const shortcutsTab = settingsPanel.getByRole('tab', { name: 'Keyboard shortcuts', exact: true })\n  await expect(shortcutsTab).toBeVisible()\n  await shortcutsTab.click()\n  await expect(settingsPanel.getByRole('table', { name: 'Keyboard shortcuts' })).toBeVisible()\n  await settleLayout(page)\n`,
  )
  write(path, text)
}

// The temporary patcher and workflow must never remain in the product branch.
for (const path of ['scripts/pr112-integrate.mjs', '.github/workflows/pr112-integrate.yml']) {
  if (fs.existsSync(path)) fs.rmSync(path)
}
