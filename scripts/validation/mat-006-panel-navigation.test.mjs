import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

// Regression for an existing App.tsx behavior: Health Dashboard used to
// close immediately after requesting navigation, even when the source
// editor had not approved a dirty-note transition.
const app = readFileSync(new URL('../../src/App.tsx', import.meta.url), 'utf8')

test('MAT-006 Health Dashboard dismissal waits for approved note navigation', () => {
  const handler = app.match(/const handleOpenIssueFromHealth = useCallback\([\s\S]*?\n {2}\}, \[openNote, setHealthDashboardOpen[^\]]*\]\)/)?.[0]
  assert.ok(handler, 'Health Dashboard navigation handler exists')
  assert.doesNotMatch(
    handler,
    /void openNote\(path\)\s*setHealthDashboardOpen\(false\)/,
    'closing before the async leaf/editor approval loses the panel on a blocked dirty navigation',
  )
  assert.match(
    handler,
    /openNoteBeforeDismissingPanel/,
    'the feature panel should delegate dismissal to the single approved navigation result',
  )
})
