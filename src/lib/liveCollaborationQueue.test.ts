import assert from 'node:assert/strict'
import test from 'node:test'
import { PendingCollaborationQueue } from './liveCollaborationQueue.ts'

const scope = { vaultId: 'vault-a', roomId: 'room_A-123', documentId: 'doc_A-123', epoch: 1, peerId: 'peer_A-123' }
function update(n: number) { return { version: 1 as const, kind: 'LOCAL_UPDATE' as const, ...scope, messageId: `msg_${n}`, clientSeq: n, payload: 'aGk=' } }

test('deduplicates and replays original identities in sequence order', () => {
  const queue = new PendingCollaborationQueue(scope)
  queue.enqueue(update(2)); queue.enqueue(update(1)); queue.enqueue(update(2))
  assert.deepEqual(queue.pending().map(x => x.messageId), ['msg_1', 'msg_2'])
})
test('acknowledges only matching scope, peer, id and sequence', () => {
  const queue = new PendingCollaborationQueue(scope)
  queue.enqueue(update(1))
  assert.equal(queue.acknowledge({ ...scope, messageId: 'msg_1', clientSeq: 3 }), false)
  assert.equal(queue.acknowledge({ ...scope, roomId: 'other', messageId: 'msg_1', clientSeq: 1 }), false)
  assert.deepEqual(queue.pending(), [update(1)])
  assert.equal(queue.acknowledge({ ...scope, messageId: 'msg_1', clientSeq: 1 }), true)
  assert.equal(queue.acknowledge({ ...scope, messageId: 'msg_1', clientSeq: 1 }), false)
  assert.deepEqual(queue.pending(), [])
})
test('quota refusal preserves queued updates and sequence identity', () => {
  const queue = new PendingCollaborationQueue(scope, 3)
  queue.enqueue(update(1))
  assert.throws(() => queue.enqueue(update(2)), /budget/i)
  assert.deepEqual(queue.pending(), [update(1)])
  assert.throws(() => queue.enqueue({ ...update(1), messageId: 'different' }), /sequence/i)
})
test('recovered snapshots reject wrong epoch and duplicate IDs', () => {
  const first = new PendingCollaborationQueue(scope)
  first.enqueue(update(1))
  assert.deepEqual(PendingCollaborationQueue.restore(scope, first.snapshot()).pending(), [update(1)])
  assert.throws(() => PendingCollaborationQueue.restore({ ...scope, epoch: 2 }, first.snapshot()), /scope/i)
  assert.throws(() => PendingCollaborationQueue.restore(scope, { scope, updates: [update(1), { ...update(1), payload: 'YQ==' }] }), /duplicate/i)
})
