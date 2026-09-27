import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { deriveEffectiveGitSelection, selectGitPanelState } from '../../src/lib/gitPanelState.ts'
import { formatShortcut, isValidShortcut, matchesShortcut } from '../../src/lib/keyboardShortcuts.ts'

const READY_STATUS = {
  is_repo: true,
  branch: 'main',
  changed_files: [],
  clean: true,
  ahead: 0,
  behind: 0,
  has_upstream: true,
  has_conflicts: false,
  conflicted_files: [],
}

test('Git panel state selection covers every owned async state', () => {
  assert.equal(selectGitPanelState(null, null, true), 'loading')
  assert.equal(selectGitPanelState(null, null, false), 'not-repository')
  assert.equal(selectGitPanelState(null, 'bridge unavailable', false), 'error')
  assert.equal(selectGitPanelState(READY_STATUS, 'bridge unavailable', true), 'loading')
  assert.equal(selectGitPanelState({ ...READY_STATUS, is_repo: false }, null, false), 'not-repository')
  assert.equal(selectGitPanelState(READY_STATUS, null, false), 'ready')

  const hookSource = readFileSync(new URL("../../src/hooks/useWorkspaceGit.ts", import.meta.url), "utf8")
  const controllerSource = readFileSync(
    new URL("../../src/hooks/workspace-git-status.ts", import.meta.url),
    "utf8",
  )
  const workspaceSource = readFileSync(new URL("../../src/hooks/useVaultWorkspace.ts", import.meta.url), "utf8")

  // Status freshness is owned by the framework-free per-vault controller.
  assert.match(hookSource, /new WorkspaceGitStatusController\(gitStatus\)/)
  assert.match(hookSource, /useSyncExternalStore\(controller\.subscribe, controller\.getSnapshot\)/)
  // The vault-open flow must pass the opened vault explicitly: neither a
  // closure-captured nor a ref-read id can be trusted before setVault commits.
  assert.match(workspaceSource, /refreshGit\(opened\.vault\.id\)/)
  // Refresh sequencing stays guard-protected and results land per vault.
  assert.match(controllerSource, /const ticket = this\.guard\.issue\(\)/)
  assert.match(controllerSource, /this\.guard\.isCurrent\(ticket\)/)
  assert.match(controllerSource, /explicitVaultId === undefined \? this\.currentKey : vaultStatusKey\(explicitVaultId\)/)
  assert.match(controllerSource, /this\.write\(targetKey/)
  assert.match(controllerSource, /GIT_STATUS_MAX_VAULT_SLOTS/)
  assert.doesNotMatch(controllerSource, /setError\(/, "status freshness must not touch workspace-wide error state")
})

test('Git selection distinguishes untouched defaults from an explicit empty selection', () => {
  assert.deepEqual(deriveEffectiveGitSelection(null, ['active.md', 'other.md'], ['active.md']), ['active.md'])
  assert.deepEqual(deriveEffectiveGitSelection(new Set(), ['active.md', 'other.md'], ['active.md']), [])
  assert.deepEqual(
    deriveEffectiveGitSelection(
      new Set(['removed.md', 'kept.md']),
      ['kept.md', 'new.md'],
      ['new.md'],
    ),
    ['kept.md'],
  )
  assert.deepEqual(
    deriveEffectiveGitSelection(new Set(['removed.md']), ['new.md'], ['new.md']),
    [],
  )
})

test('Configured shortcuts match platform modifiers and render truthful labels', () => {
  assert.equal(isValidShortcut('Ctrl+K'), true)
  assert.equal(isValidShortcut(' Ctrl + Shift + K '), true)
  for (const malformed of ['+Ctrl+K', 'Ctrl++K', 'Ctrl+K+']) {
    assert.equal(isValidShortcut(malformed), false, `${malformed} must be rejected`)
  }
  assert.equal(formatShortcut('Mod+G', 'MacIntel'), '⌘G')
  assert.equal(formatShortcut('Mod+G', 'Win32'), 'Ctrl+G')
  assert.equal(formatShortcut('Mod+Shift+B', 'MacIntel'), '⌘⇧B')
  assert.equal(
    matchesShortcut({ key: 'g', metaKey: true, ctrlKey: false, altKey: false, shiftKey: false }, 'Mod+G', 'MacIntel'),
    true,
  )
  assert.equal(
    matchesShortcut({ key: 'g', metaKey: false, ctrlKey: true, altKey: false, shiftKey: false }, 'Mod+G', 'Win32'),
    true,
  )
  assert.equal(
    matchesShortcut({ key: 'g', metaKey: false, ctrlKey: false, altKey: true, shiftKey: false }, 'Mod+G', 'Win32'),
    false,
  )
})

test('Git file rows keep actions outside the checkbox label and handlers stable', () => {
  const fileRowSource = readFileSync(new URL('../../src/components/git/GitFileRow.tsx', import.meta.url), 'utf8')
  const panelSource = readFileSync(new URL('../../src/components/GitPanel.tsx', import.meta.url), 'utf8')
  const labelBlock = fileRowSource.match(/<label htmlFor=\{checkboxId\}>([\s\S]*?)<\/label>/)?.[1]

  assert.ok(labelBlock, 'Git file-row label must remain explicitly associated with the checkbox')
  assert.doesNotMatch(labelBlock, /<button\b/, 'Git file-row label must not contain nested buttons')
  assert.match(fileRowSource, /className="git-file-row-actions"/)
  assert.match(panelSource, /deriveEffectiveGitSelection|useGitPanelState/)
})

test('MCP empty states are localized and keep non-tool tabs available', () => {
  const source = readFileSync(new URL('../../src/components/McpPanel.tsx', import.meta.url), 'utf8')

  assert.match(source, /<Server aria-hidden="true" size=\{32\} className="text-muted" \/>/)
  assert.match(source, /t\('mcp\.noToolsRegistered'\)/)
  assert.match(source, /t\('mcp\.enableReadOnly'\)/)
  assert.doesNotMatch(source, /mode === 'off' \|\| tools\.length === 0/)
  assert.match(source, /tab === 'drafts'/)
  assert.match(source, /tab === 'audit'/)
})

test('Git shortcut names remain accessible without positioned top-bar tooltips', () => {
  const topBar = readFileSync(new URL('../../src/components/shell/AppTopBar.tsx', import.meta.url), 'utf8')
  const chrome = readFileSync(new URL('../../src/components/chrome/WorkspaceChrome.tsx', import.meta.url), 'utf8')
  const shortcuts = readFileSync(new URL('../../src/hooks/useAppKeyboardShortcuts.ts', import.meta.url), 'utf8')

  assert.match(topBar, /aria-label=\{gitShortcut \? `\$\{gitTitle\} \(\$\{gitShortcut\}\)` : gitTitle\}/)
  assert.match(topBar, /getShortcut\('open-git'/)
  assert.match(topBar, /getShortcut\('toggle-vault-sidebar'/)
  assert.match(topBar, /getShortcut\('toggle-inspector'/)
  assert.match(topBar, /title=\{gitTitle\}/)
  assert.doesNotMatch(topBar, /className="custom-tooltip" aria-hidden="true"/)
  assert.match(chrome, /className="custom-tooltip" aria-hidden="true"/)
  assert.match(shortcuts, /run\('open-git', openGit\)/)
  assert.match(shortcuts, /run\('toggle-vault-sidebar', toggleVaultSidebar\)/)
  assert.match(shortcuts, /run\('toggle-inspector', toggleInspector\)/)
})

test('Global shortcut guards and persistence respect React and editable-target semantics', () => {
  const appShortcuts = readFileSync(new URL('../../src/hooks/useAppKeyboardShortcuts.ts', import.meta.url), 'utf8')
  const shortcutStorage = readFileSync(new URL('../../src/hooks/useKeyboardShortcuts.ts', import.meta.url), 'utf8')

  assert.match(appShortcuts, /target instanceof HTMLInputElement/)
  assert.match(appShortcuts, /target instanceof HTMLTextAreaElement/)
  assert.match(appShortcuts, /target instanceof HTMLElement && target\.isContentEditable/)
  assert.doesNotMatch(appShortcuts, /\[contenteditable="true"\]/)

  assert.match(shortcutStorage, /const pendingPersistenceRef = useRef/)
  assert.match(shortcutStorage, /if \(pendingPersistenceRef\.current !== overrides\) return/)
  assert.match(shortcutStorage, /pendingPersistenceRef\.current = null\s+saveOverrides\(overrides\)/)
  assert.doesNotMatch(
    shortcutStorage,
    /setOverrides\(\([^)]*\) => \{[\s\S]*?saveOverrides\(/,
    'React state updater functions must stay side-effect free',
  )
})

test('Empty reading-time status is a neutral placeholder in every locale', () => {
  for (const locale of ['en', 'de', 'fa']) {
    const data = JSON.parse(
      readFileSync(new URL(`../../src/lib/i18n/${locale}.json`, import.meta.url), 'utf8'),
    )
    assert.equal(data.editor.status.minReadEmpty, '—', `${locale} zero-minute reading time must be neutral`)
    assert.doesNotMatch(
      data.editor.status.minReadEmpty,
      /min|Min|دقیقه/,
      `${locale} zero-minute reading time must not append a duration label`,
    )
  }
})

test('Vault health metric names and cache status read the same everywhere', () => {
  // The inspector, the workspace footer and the health dashboard all show the
  // same snapshot. They used to pick their own wording ("Missing citations" vs
  // "Unresolved citations") and their own casing for the cache status
  // ("Fresh" vs the raw `fresh` wire value), so the same number read two ways.
  const healthFormatter = readFileSync(
    new URL('../../src/lib/vaultHealth.ts', import.meta.url),
    'utf8',
  )
  assert.match(healthFormatter, /cacheStatusLabel/, 'a single formatter must own the cache status label')

  for (const file of [
    '../../src/App.tsx',
    '../../src/components/shell/WorkspaceStatusFooter.tsx',
    '../../src/components/VaultHealthDashboard.tsx',
  ]) {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8')
    // Require the call, not just the absence of the old ternary: a surface that
    // dropped the label entirely would satisfy a grep-only guard.
    assert.match(
      source,
      /cacheStatusLabel\(t,/,
      `${file} must format the cache status through the shared helper`,
    )
    assert.doesNotMatch(
      source,
      /cache_status === 'fresh'/,
      `${file} must not re-derive the cache status label`,
    )
  }

  // The dashboard must render the shared label rather than the raw wire value.
  const dashboard = readFileSync(
    new URL('../../src/components/VaultHealthDashboard.tsx', import.meta.url),
    'utf8',
  )
  assert.doesNotMatch(
    dashboard,
    /\['Cache',\s*summary\.cache_status\]/,
    'the health dashboard must not print the raw lowercase cache status',
  )

  const en = JSON.parse(readFileSync(new URL('../../src/lib/i18n/en.json', import.meta.url), 'utf8'))
  assert.equal(
    en.inspector.health.missingCitations,
    'Unresolved citations',
    'the inspector citation metric must use the health dashboard wording',
  )
})

test('Git error and retry copy is localized in every locale', () => {
  for (const locale of ['en', 'de', 'fa']) {
    const data = JSON.parse(
      readFileSync(new URL(`../../src/lib/i18n/${locale}.json`, import.meta.url), 'utf8'),
    )
    assert.equal(typeof data.actions.retry, 'string', `${locale} must define actions.retry`)
    for (const key of [
      'checkingStatus',
      'statusUnavailable',
      'loadingStatus',
      'workingTreeClean',
      'changedFiles',
      'activeNoteChanged',
      'everythingUpToDate',
      'openNote',
      'previewDiff',
      'resolve',
      'note',
    ]) {
      assert.equal(typeof data.git[key], 'string', `${locale} must define git.${key}`)
    }
  }

  const panel = readFileSync(new URL('../../src/components/GitPanel.tsx', import.meta.url), 'utf8')
  assert.doesNotMatch(panel, /t\('actions\.retry'\) \?\?/)
  assert.match(panel, /t\('git\.statusUnavailable'\)/)
  assert.match(panel, /t\('git\.everythingUpToDate'/)
})
