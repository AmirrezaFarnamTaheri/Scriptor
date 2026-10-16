import assert from 'node:assert/strict'
import test from 'node:test'
import { nextAvailableSnippetName, snippetNameTaken } from './snippetNames.ts'

test('new snippet names skip occupied suffixes and fill gaps without duplicating', () => {
  assert.equal(nextAvailableSnippetName([{ name: 'snippet-1' }, { name: 'snippet-3' }, { name: 'SNIPPET-2 ' }]), 'snippet-4')
  assert.equal(nextAvailableSnippetName([{ name: 'snippet-2' }, { name: 'example' }]), 'snippet-1')
  assert.equal(nextAvailableSnippetName([]), 'snippet-1')
})

test('renames reject trimmed case-insensitive duplicates but allow retaining the current name', () => {
  const list = [{ name: 'Summary' }, { name: 'Quick note' }]
  assert.equal(snippetNameTaken(list, 'Quick note', ' summary '), true)
  assert.equal(snippetNameTaken(list, 'Summary', ' Summary '), false)
  assert.equal(snippetNameTaken(list, 'Summary', 'Other'), false)
})
