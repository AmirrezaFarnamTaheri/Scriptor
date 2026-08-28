import assert from 'node:assert/strict'
import test from 'node:test'
import { formatLocalDate, millisecondsUntilNextLocalDate, offsetLocalDate, parseLocalDate } from './local.ts'

test('formatLocalDate uses local calendar fields instead of UTC serialization', () => {
  const local = new Date(2026, 0, 2, 0, 30, 0)
  assert.equal(formatLocalDate(local), '2026-01-02')
})

test('offsetLocalDate advances calendar dates without UTC round-trips', () => {
  assert.equal(offsetLocalDate('2026-03-08', 1), '2026-03-09')
  assert.equal(offsetLocalDate('2026-01-01', -1), '2025-12-31')
})

test('parseLocalDate rejects impossible dates', () => {
  assert.throws(() => parseLocalDate('2026-02-30'), /Invalid local ISO date/)
})

test('midnight delay is positive and targets the next local day', () => {
  const now = new Date(2026, 5, 10, 23, 59, 59, 900)
  const delay = millisecondsUntilNextLocalDate(now)
  assert.ok(delay >= 100 && delay < 1000)
})
