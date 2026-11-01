import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const history = readFileSync(new URL('../../src/components/NoteHistoryPanel.tsx', import.meta.url), 'utf8')

test('MAT-004: vocabulary evolution requires a concrete note path and originating vault', () => {
  assert.match(
    history,
    /\{path && vaultId \? \(\s*<VocabularyEvolution\s+key=\{`\$\{vaultId\}:\$\{path\}`\}\s+path=\{path\}\s+vaultId=\{vaultId\}\s+revisions=\{revisions\}\s*\/>\s*\) : null\}/,
  )
})
