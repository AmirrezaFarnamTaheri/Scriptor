import assert from 'node:assert/strict'
import { test } from 'node:test'
import { evaluateDatabaseQueryCoverage as check } from './databaseQueryCoverage.ts'
test('client arrays are never authoritative full-vault counts', () => {
  const r = check({ candidatesReported: 200, candidatesExamined: 200, loaded: 200, skipped: 0, sourceCoverage: 'unverified' })
  assert.equal(r.completeness, 'unverified')
  assert.equal(r.exactMatchCount, null)
  assert.equal(r.aggregatesComplete, false)
})
test('first 200 of 25000 are partial even when server proves full enumeration', () => {
  const r = check({ candidatesReported: 25000, candidatesExamined: 200, loaded: 200, skipped: 0, sourceCoverage: 'exhaustive' })
  assert.equal(r.completeness, 'partial')
  assert.match(r.description, /loaded notes only/)
})
test('missed reads block authoritative count', () => {
  assert.equal(check({ candidatesReported: 6, candidatesExamined: 6, loaded: 5, skipped: 1, sourceCoverage: 'exhaustive' }).exactMatchCount, null)
})
test('complete native enumeration with no skips can report exact count', () => {
  const r = check({ candidatesReported: 9, candidatesExamined: 9, loaded: 7, skipped: 0, sourceCoverage: 'exhaustive' })
  assert.equal(r.exactMatchCount, 7)
  assert.equal(r.aggregatesComplete, true)
})
test('invalid or overcounted evidence is rejected', () => {
  assert.throws(() => check({ candidatesReported: 3, candidatesExamined: 4, loaded: 4, skipped: 0, sourceCoverage: 'unverified' }))
  assert.throws(() => check({ candidatesReported: 3, candidatesExamined: 3, loaded: 4, skipped: 0, sourceCoverage: 'unverified' }))
})
