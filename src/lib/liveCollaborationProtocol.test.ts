import assert from 'node:assert/strict'
import test from 'node:test'
import { parseLiveCollaborationScope, parseLiveCollaborationEnvelope, assertLiveCollaborationPermission } from './liveCollaborationProtocol.ts'

const scope = { vaultId: 'vault-a', roomId: 'room_A-123', documentId: 'doc_A-123', epoch: 1, peerId: 'peer_A-123' }
const message = { version: 1, kind: 'LOCAL_UPDATE', ...scope, messageId: 'msg_A-123', clientSeq: 1, payload: 'aGk=' }

test('accepts a bounded typed message with exact session scope', () => {
  assert.deepEqual(parseLiveCollaborationEnvelope(message, scope), message)
  assert.deepEqual(parseLiveCollaborationScope(scope), scope)
})
test('rejects different vault, peer, room, document and epoch', () => {
  for (const key of ['vaultId', 'peerId', 'roomId', 'documentId', 'epoch'] as const) {
    assert.throws(() => parseLiveCollaborationEnvelope({ ...message, [key]: key === 'epoch' ? 2 : 'other' }, scope), /scope mismatch/i)
  }
})
test('rejects unknown fields, kinds, malformed and oversized payloads', () => {
  for (const bad of [
    { ...message, extra: true }, { ...message, kind: 'FORCE_APPLY' },
    { ...message, payload: '$$$$' }, { ...message, payload: 'aGk' },
    { ...message, payload: 'A'.repeat(350_000) }, { ...message, clientSeq: -1 },
    { ...message, messageId: '../escape' },
  ]) assert.throws(() => parseLiveCollaborationEnvelope(bad, scope))
})
test('acknowledgements cannot carry content, awareness is bounded', () => {
  assert.throws(() => parseLiveCollaborationEnvelope({ ...message, kind: 'DURABLE_ACK' }, scope))
  assert.throws(() => parseLiveCollaborationEnvelope({ ...message, kind: 'AWARENESS', payload: 'A'.repeat(5000) }, scope))
})
test('viewers cannot write and revoked peers cannot read or write', () => {
  assert.doesNotThrow(() => assertLiveCollaborationPermission('editor', 'LOCAL_UPDATE'))
  assert.doesNotThrow(() => assertLiveCollaborationPermission('viewer', 'SYNC_VECTOR'))
  assert.throws(() => assertLiveCollaborationPermission('viewer', 'LOCAL_UPDATE'), /not permitted/i)
  assert.throws(() => assertLiveCollaborationPermission('revoked', 'SYNC_VECTOR'), /not permitted/i)
})
