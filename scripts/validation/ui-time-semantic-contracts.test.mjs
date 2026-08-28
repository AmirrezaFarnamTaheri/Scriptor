import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8')

test('Escape hook delegates to one stack-aware coordinator instead of adding listeners per surface', async () => {
  const hook = await read('src/hooks/useEscapeToClose.ts')
  const coordinator = await read('src/lib/overlayEscapeCoordinator.ts')
  assert.match(hook, /overlayEscapeCoordinator\.register/)
  assert.doesNotMatch(hook, /window\.addEventListener/)
  assert.match(coordinator, /stopImmediatePropagation/)
  assert.match(coordinator, /restoreFocus/)
})

test('date-only user semantics use the shared local-date abstraction', async () => {
  const paths = [
    'src/hooks/useWorkspaceNoteFactory.ts',
    'src/hooks/useGoogleCalendarSync.ts',
    'src/App.tsx',
    'src/lib/autoCommitMessage.ts',
    'src/lib/knowledge/dailyNote.ts',
    'src/lib/writingTargets.ts',
    'src/components/TaskPanel.tsx',
    'src/components/GitPanel.tsx',
    'src/components/SettingsPanel.tsx',
    'src/components/app/QuickCaptureWorkspaceLayer.tsx',
    'packages/template-engine/src/variables.ts',
    'packages/editor/src/snippet-parser.ts',
  ]
  for (const path of paths) {
    const source = await read(path)
    assert.doesNotMatch(source, /toISOString\(\)\.slice\(0,\s*10\)/, `${path} must not derive a local date through UTC`)
  }
})

test('known UI-semantic raw colors are owned by semantic tokens', async () => {
  const paths = [
    'src/styles/components/git-diff.css',
    'src/styles/components/rename-dialog.css',
    'src/styles/app/foundation.css',
    'src/styles/app/inspector.css',
    'src/styles/components/canvas-graph.css',
    'src/components/canvas/CanvasStage.tsx',
  ]
  const raw = /#(?:e5534b|b42318|fff4f2|2563eb)/i
  for (const path of paths) {
    assert.doesNotMatch(await read(path), raw, `${path} contains an unowned UI semantic color`)
  }
})
