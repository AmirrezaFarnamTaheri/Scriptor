import assert from 'node:assert/strict'
import { test } from 'node:test'
import { sameHelpInvitation, selectHelpInvitation, type HelpInvitationCandidate } from './invitations.ts'

const citation = { key: 1, id: 'citations', eligible: true, offered: false, primary: false }
const graph = { key: 2, id: 'graph', eligible: true, offered: false, primary: true }

test('a foreground panel preempts an invitation left in the background', () => {
  const candidates = [{ ...citation, eligible: false, offered: true }, graph]
  assert.deepEqual(selectHelpInvitation(candidates, citation), { key: 2, id: 'graph' })
})

test('a concrete panel is offered before one of its nested widgets', () => {
  assert.deepEqual(selectHelpInvitation([citation, graph], null), { key: 2, id: 'graph' })
})

test('an already displayed offer remains until dismissed in its own scope', () => {
  assert.deepEqual(selectHelpInvitation([{ ...graph, offered: true }], graph), { key: 2, id: 'graph' })
})

test('dismissed and previously offered guides are not offered on reopen', () => {
  assert.equal(selectHelpInvitation([{ ...graph, key: 3, offered: true }], null), null)
  assert.equal(selectHelpInvitation([{ ...graph, key: 3, offered: true }], graph), null)
})

test('a blocking modal with no contextual guide never offers background help', () => {
  assert.equal(selectHelpInvitation([{ ...citation, eligible: false }], citation), null)
})

test('surface identity prevents an old invitation transferring to another mounted copy', () => {
  assert.equal(sameHelpInvitation(graph, { ...graph, key: 3 }), false)
  assert.equal(sameHelpInvitation(null, null), true)
  assert.equal(sameHelpInvitation(graph, null), false)
})

test('selection is stable and does not mutate the candidate list', () => {
  const candidates: readonly HelpInvitationCandidate[] = Object.freeze([Object.freeze(citation), Object.freeze(graph)])
  const first = selectHelpInvitation(candidates, null)
  assert.deepEqual(selectHelpInvitation(candidates, null), first)
  assert.deepEqual(candidates.map(({ id }) => id), ['citations', 'graph'])
})
