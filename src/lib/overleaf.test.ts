import assert from 'node:assert/strict'
import { test } from 'node:test'
import { overleafProjectId, overleafFilePath, parseOverleafSnapshot } from './overleaf.ts'
test('Overleaf accepts only the supported cloud project and literal relative TeX paths', () => {
  assert.equal(overleafProjectId('https://www.overleaf.com/project/abcdef123456'), 'abcdef123456')
  for (const value of ['https://evil.test/project/abcdef', 'https://token@git.overleaf.com/abcdef', 'abc', 'abcdef?token=x']) assert.throws(() => overleafProjectId(value))
  assert.equal(overleafFilePath('chapters/main.tex'), 'chapters/main.tex')
  for (const value of ['../main.tex', '.git/config', 'a\\main.tex', 'https://evil/main.tex', 'main.md']) assert.throws(() => overleafFilePath(value))
})
test('Overleaf snapshot distinguishes absent remote file from unreadable/invalid content', () => {
  const value = { head: 'a'.repeat(40), content: null, content_hash: null }
  assert.deepEqual(parseOverleafSnapshot(value), value)
  assert.throws(() => parseOverleafSnapshot({ ...value, content: '', content_hash: null }))
  assert.throws(() => parseOverleafSnapshot({ ...value, head: 'unknown' }))
  assert.throws(() => parseOverleafSnapshot({ ...value, content: 'x'.repeat(2 * 1024 * 1024 + 1), content_hash: 'a'.repeat(64) }))
})
