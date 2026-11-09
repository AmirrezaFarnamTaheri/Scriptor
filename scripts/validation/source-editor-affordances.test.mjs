import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
const read = file => readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8')

test('source editor uses local Monaco by default and preserves the plain-text fallback', () => {
  const view = read('src/components/SourceFileEditor.tsx')
  const code = read('src/components/SourceMonacoEditor.tsx')
  assert.match(view, /const \[richEditor, setRichEditor\] = useState\(true\)/)
  assert.match(view, /<SourceMonacoEditor/)
  assert.match(view, /aria-pressed=\{richEditor\}/)
  assert.match(view, /aria-pressed=\{!richEditor\}/)
  assert.match(code, /monaco-environment/)
  assert.match(code, /lineNumbers: 'on'/)
  assert.match(code, /KeyMod\.CtrlCmd \| monaco\.KeyCode\.KeyS/)
  assert.match(code, /language=\{LANGUAGE_IDS/)
})
