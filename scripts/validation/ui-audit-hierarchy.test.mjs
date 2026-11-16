import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')

test('fresh writing layout starts with contextual inspector collapsed', () => {
  const prefs = read('src/hooks/useWorkspaceChrome.ts')
  assert.match(prefs, /DEFAULT_WORKSPACE_CHROME:[^]*?inspectorCollapsed: true,/)
  assert.match(prefs, /DEFAULT_WORKSPACE_CHROME:[^]*?showInspectorHealth: false,/)
})

test('complex side workspaces have a full-width focus state with a safe return to writing', () => {
  const dock = read('src/components/shell/WorkspaceLeafDock.tsx')
  const css = read('src/components/shell/workspace-leaf-dock.css')
  assert.match(dock, /focusedWideWorkspace/)
  assert.match(dock, /Back to writing/)
  assert.match(css, /\.workspace-leaf-dock\.is-focused-workspace \.workspace-leaf-grid/)
})
