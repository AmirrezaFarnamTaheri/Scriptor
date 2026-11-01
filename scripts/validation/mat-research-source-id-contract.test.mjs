import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
const ui = readFileSync(new URL('../../src/components/CaptureReviewerPanel.tsx', import.meta.url), 'utf8')
const capture = readFileSync(new URL('../../src/lib/captureReviewer.ts', import.meta.url), 'utf8')

test('MAT-011 capture identity is scoped to a reviewed extraction and carried through note creation', () => {
  assert.match(ui, /sourceIdRef\.current=crypto\.randomUUID\(\)/)
  assert.match(ui, /const sourceId = sourceIdRef\.current \?\? crypto\.randomUUID\(\)/)
  assert.match(ui, /captureMarkdown\(\{url:source,title,author,published,tags,markdown,sourceId\}\)/)
  assert.match(ui, /vaultSaveAsset\(path,[\s\S]*true, vaultId\)/)
  assert.match(capture, /source_id:/)
})

test('MAT-011 changing the originating vault invalidates the prior capture identity', () => {
  assert.match(ui, /useEffect\(\(\)=>\{generation\.current\+=1;sourceIdRef\.current=null;return/)
})
