import assert from 'node:assert/strict'
import test from 'node:test'
import { filterVaultSections } from './filterVaultSections.ts'

const sections = [
  { id: 'research', count: 2, notes: ['A.md', 'B.md'] },
  { id: 'daily', count: 1, notes: ['Daily.md'] },
]

test('an empty search restores the original vault groups', () => {
  assert.deepEqual(filterVaultSections(sections, '', []), sections)
})

test('a completed query with no matches shows no sections, not the entire vault', () => {
  assert.deepEqual(filterVaultSections(sections, 'no such note', []), [])
})

test('a query returns only matching paths and counts', () => {
  assert.deepEqual(filterVaultSections(sections, 'A', [{ path: 'A.md' }]), [
    { id: 'research', count: 1, notes: ['A.md'] },
  ])
})
