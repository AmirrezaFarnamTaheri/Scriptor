import assert from 'node:assert/strict'
import test from 'node:test'
import { parseCitationTokens } from './citationClusters.ts'

test('narrative citations exclude email and retain following punctuation', () => {
  const tokens = parseCitationTokens('As @smith2024. Email name@example.com and -@doe2020.')
  assert.deepEqual(tokens.map(token => token.source), ['@smith2024', '-@doe2020'])
  assert.equal(tokens[0].cluster.narrative, true)
  assert.equal(tokens[1].cluster.items[0]['suppress-author'], true)
})

test('groups produce CSL prefix, locator and author-suppression items', () => {
  const [token] = parseCitationTokens('[see @smith2024, pp. 2–3; -@{doe2020}]')
  assert.deepEqual(token.cluster.items, [
    { id: 'smith2024', prefix: 'see ', label: 'page', locator: '2–3' },
    { id: 'doe2020', 'suppress-author': true },
  ])
  assert.deepEqual(parseCitationTokens('[name@example.com]'), [])
})
