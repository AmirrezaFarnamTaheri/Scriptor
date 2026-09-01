import assert from 'node:assert/strict'
import { test } from 'node:test'

import { fuseKeywordAndSemantic } from '../lib/searchFusion.ts'

function keywordHit(path: string, title = path) {
  return { note_id: path, path, title, snippet: `kw: ${path}` }
}

test('fusion keeps keyword hits and flags semantic overlap', () => {
  const keyword = [keywordHit('a.md'), keywordHit('b.md'), keywordHit('c.md')]
  const semantic = [
    { note_path: 'b.md', score: 0.91 },
    { note_path: 'd.md', score: 0.84 },
  ]
  const fused = fuseKeywordAndSemantic(keyword, semantic, 25)

  // b.md ranks first: present in both lists (RRF boost).
  assert.equal(fused[0].path, 'b.md')
  assert.equal(fused[0].semantic, true)

  // a.md/c.md keep their keyword snippets and no badge.
  const a = fused.find((hit) => hit.path === 'a.md')
  assert.equal(a?.semantic ?? false, false)
  assert.ok(a?.snippet.startsWith('kw:'))

  // d.md is semantic-only: injected with a marker snippet.
  const d = fused.find((hit) => hit.path === 'd.md')
  assert.equal(d?.semantic, true)
  assert.ok(d?.snippet.includes('semantic match'))
})

test('fusion respects maxResults and tolerates an empty semantic list', () => {
  const keyword = ['a.md', 'b.md', 'c.md', 'd.md'].map(keywordHit)
  const fused = fuseKeywordAndSemantic(keyword, [], 2)
  assert.equal(fused.length, 2)
  assert.equal(fused[0].path, 'a.md')
  assert.equal(fused.every((hit) => !hit.semantic), true)
})

test('fusion handles disjoint lists', () => {
  const keyword = [keywordHit('a.md')]
  const semantic = [{ note_path: 'z.md', score: 0.5 }]
  const fused = fuseKeywordAndSemantic(keyword, semantic, 25)
  assert.equal(fused.length, 2)
  // a.md outranks z.md: keyword rank 1 plus nothing beats rank-1 semantic alone.
  assert.equal(fused[0].path, 'a.md')
})
