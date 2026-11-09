import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const read = (file) => readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8')

test('hidden plugin banner and vault health never leak into marketplace', () => {
  const css = read('src/styles/components/store-panel.css')
  assert.match(css, /\.store-(?:banner|lint-summary)\[hidden\][^{]*\{[^}]*display:\s*none\b/s)
})

test('inspector export preview is not hardcoded to HTML independently of selected export format', () => {
  const inspector = read('src/components/shell/InspectorRail.tsx')
  assert.doesNotMatch(inspector, /exportWithProfile\(['"]html-standalone['"],\s*true\)/)
})

test('saved database view selection stays in sync with the current view', () => {
  const db = read('src/components/DatabaseStudioPanel.tsx')
  assert.doesNotMatch(db, /<select\s+value=""\s+onChange=/)
})

test('reload saved source file is absent before a saved document exists', () => {
  const source = read('src/components/SourceFileEditor.tsx')
  assert.match(source, /\{document\s*&&\s*<button[^>]*>Reload saved file<\/button>\}/)
})
