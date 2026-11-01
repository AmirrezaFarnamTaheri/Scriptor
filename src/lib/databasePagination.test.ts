import assert from 'node:assert/strict'
import { test } from 'node:test'
import { selectDatabasePage } from './databasePagination.ts'
const items = (count: number) => Array.from({ length: count }, (_, index) => ({
  path: `notes/${String(index).padStart(5, '0')}.md`, title: `Note ${index}`,
}))
test('201 bounded hits yields exactly 200 and a continuation cursor', () => {
  const result = selectDatabasePage(items(201), 200)
  assert.equal(result.candidates.length, 200)
  assert.equal(result.nextCursor, 'notes/00199.md')
})
test('200 hits completes the current indexed page without inventing full-vault totals', () => {
  const result = selectDatabasePage(items(200), 200)
  assert.equal(result.candidates.length, 200)
  assert.equal(result.nextCursor, null)
})
test('empty native response ends pagination without losing vault ownership', () => {
  assert.deepEqual(selectDatabasePage([], 200), { candidates: [], nextCursor: null })
})
test('stale or unordered native responses cannot be used as continuation cursors', () => {
  assert.throws(() => selectDatabasePage([items(2)[1], items(2)[0]], 200), /order/)
  assert.throws(() => selectDatabasePage([items(1)[0], items(1)[0]], 200), /order/)
  assert.throws(() => selectDatabasePage(items(1), 200, items(1)[0].path), /cursor/)
})
test('a page above the native limit fails closed', () => {
  assert.throws(() => selectDatabasePage(items(202), 200), /limit/)
  assert.throws(() => selectDatabasePage(items(1), 0), /limit/)
})
