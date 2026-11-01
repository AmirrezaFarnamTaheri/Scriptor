import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
const ui = readFileSync(new URL('../../src/components/NoteHistoryPanel.tsx', import.meta.url), 'utf8')
test('MAT-003 history panel does not report empty revisions during loading or read failure', () => {
  const begin = ui.indexOf("readStatus === 'loading'")
  const error = ui.indexOf("readStatus === 'error'")
  const empty = ui.indexOf("readStatus === 'empty'")
  assert.ok(begin >= 0 && error > begin && empty > error)
  assert.match(ui, /role="alert">Note history could not be inspected/)
  assert.match(ui, /No empty history has been confirmed/)
  assert.match(ui, /noteHistoryReadStatus\(/)
})
