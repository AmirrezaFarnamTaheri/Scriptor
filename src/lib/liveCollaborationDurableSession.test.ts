import assert from 'node:assert/strict'
import test from 'node:test'
import { CollaborativeMarkdown } from './liveCollaborationYjs.ts'
import { DurableCollaborationSession } from './liveCollaborationDurableSession.ts'
import type { LiveCollaborationEnvelope } from './liveCollaborationProtocol.ts'

const scope = (peerId = 'alice') => ({
  vaultId: 'vault_' + peerId,
  roomId: 'room_consent',
  documentId: 'document_consent',
  peerId,
  epoch: 1,
  notePath: 'notes/shared.md',
})
const author = (peerId = 'alice') => ({
  peerId,
  roomId: 'room_consent',
  documentId: 'document_consent',
  epoch: 1,
})
const initial = () => {
  const owner = new CollaborativeMarkdown(scope())
  const seed = owner.initializeOwner('base')
  return { owner, seed }
}

type RecordUpdate = { messageId: string; clientSeq: number; payload: string }

class FakeJournal {
  stored: RecordUpdate[] = []
  attempts: LiveCollaborationEnvelope[] = []
  failNext = false
  stoppedLeases: string[] = []
  async stop(_scope: ReturnType<typeof scope>, lease: string) {
    this.stoppedLeases.push(lease)
  }
  private gate: Promise<void> | null = null
  private release: (() => void) | null = null
  deferNext() {
    this.gate = new Promise(resolve => { this.release = resolve })
  }
  unblock() {
    this.release?.()
    this.gate = null
    this.release = null
  }
  async append(_scope: ReturnType<typeof scope>, _lease: string, envelope: LiveCollaborationEnvelope) {
    this.attempts.push({ ...envelope })
    if (this.gate) await this.gate
    if (this.failNext) {
      this.failNext = false
      throw new Error('simulated ambiguous native journal failure')
    }
    const old = this.stored.find(item => item.messageId === envelope.messageId)
    if (old) {
      assert.equal(old.clientSeq, envelope.clientSeq)
      assert.equal(old.payload, envelope.payload)
      return { locallyDurable: true, duplicate: true }
    }
    assert.ok(envelope.payload)
    assert.ok(!this.stored.some(item => item.clientSeq === envelope.clientSeq))
    this.stored.push({ messageId: envelope.messageId, clientSeq: envelope.clientSeq, payload: envelope.payload! })
    return { locallyDurable: true, duplicate: false }
  }
  async pending(_scope: ReturnType<typeof scope>, _lease: string, afterSequence: number) {
    return this.stored.filter(item => item.clientSeq > afterSequence)
      .sort((a, b) => a.clientSeq - b.clientSeq).slice(0, 64)
  }
}

test('staging does not mutate the active document before a durable native receipt', async () => {
  const { owner } = initial()
  const store = new FakeJournal()
  const session = new DurableCollaborationSession(scope(), 'lease_1', store, owner)
  await session.restore()
  store.deferNext()
  const saved = session.edit(4, 4, ' prepared')
  assert.equal(session.ready, true)
  assert.equal(session.value, 'base')
  assert.equal(session.pendingForRelay().length, 0)
  store.unblock()
  const outgoing = await saved
  assert.ok(outgoing)
  assert.equal(session.value, 'base prepared')
  assert.equal(session.pendingForRelay().length, 1)
  assert.equal(session.pendingForRelay()[0].messageId, outgoing.messageId)
  session.stop()
})

test('ambiguous native append must not mutate or publish; retry must reuse bytes and identity', async () => {
  const { owner } = initial()
  const store = new FakeJournal()
  const session = new DurableCollaborationSession(scope(), 'lease_2', store, owner)
  await session.restore()
  store.failNext = true
  await assert.rejects(session.edit(4, 4, ' safe'), /ambiguous/)
  assert.equal(session.value, 'base')
  assert.equal(session.pendingForRelay().length, 0)
  assert.equal(store.attempts.length, 1)
  await assert.rejects(session.edit(4, 4, ' wrong'), /retry|pending|durable/i)
  const outgoing = await session.retry()
  assert.ok(outgoing)
  assert.deepEqual(store.attempts, [store.attempts[0], store.attempts[0]])
  assert.equal(session.value, 'base safe')
  assert.equal(session.pendingForRelay().length, 1)
  assert.equal(store.stored.length, 1)
})

test('ambiguous success with native idempotence still completes exactly one local transaction', async () => {
  const { owner } = initial()
  const store = new FakeJournal()
  const originalAppend = store.append.bind(store)
  let simulated = false
  store.append = async (...args) => {
    const receipt = await originalAppend(...args)
    if (!simulated) { simulated = true; throw new Error('reply lost after FULL/WAL commit') }
    return receipt
  }
  const session = new DurableCollaborationSession(scope(), 'lease_3', store, owner)
  await session.restore()
  await assert.rejects(session.edit(4, 4, '!'), /reply lost/)
  assert.equal(session.value, 'base')
  await session.retry()
  assert.equal(store.stored.length, 1)
  assert.equal(session.value, 'base!')
})

test('recovery replays all 65 native pending updates in pages with stable order and sequence', async () => {
  const { owner, seed } = initial()
  const store = new FakeJournal()
  for (let sequence = 1; sequence <= 65; sequence += 1) {
    const update = owner.change(owner.value.length, owner.value.length, String(sequence % 10))
    store.stored.push({
      messageId: 'update_' + sequence,
      clientSeq: sequence,
      payload: Buffer.from(update).toString('base64'),
    })
  }
  const recovered = new CollaborativeMarkdown(scope())
  recovered.hydrate(seed)
  const session = new DurableCollaborationSession(scope(), 'lease_4', store, recovered)
  assert.equal(session.ready, false)
  assert.throws(() => session.pendingForRelay(), /recover|ready/i)
  await session.restore()
  assert.equal(session.value, owner.value)
  assert.equal(session.pendingForRelay().length, 65)
  const outgoing = await session.edit(session.value.length, session.value.length, 'next')
  assert.equal(outgoing?.clientSeq, 66)
})

test('recovery continues after a short byte-limited page before admitting new edits', async () => {
  const { owner, seed } = initial()
  const journal = new FakeJournal()
  for (let sequence = 1; sequence <= 5; sequence += 1) {
    const update = owner.change(owner.value.length, owner.value.length, String(sequence))
    journal.stored.push({
      messageId: 'byte_page_' + sequence,
      clientSeq: sequence,
      payload: Buffer.from(update).toString('base64'),
    })
  }
  let pageReads = 0
  const originalPending = journal.pending.bind(journal)
  // Model a native 1 MiB page cap returning fewer than the 64 row limit.
  journal.pending = async (...args) => {
    pageReads += 1
    return (await originalPending(...args)).slice(0, 2)
  }
  const recovered = new CollaborativeMarkdown(scope())
  recovered.hydrate(seed)
  const session = new DurableCollaborationSession(scope(), 'lease_byte_pages', journal, recovered)
  await session.restore()
  assert.equal(session.value, owner.value)
  assert.equal(session.pendingForRelay().length, 5)
  assert.ok(pageReads >= 4, 'recovery must read through the final empty page')
  const outgoing = await session.edit(session.value.length, session.value.length, 'next')
  assert.equal(outgoing?.clientSeq, 6, 'next sequence must not reuse an unrecovered update')
})

test('bad native recovery payload fails closed and never permits an additional edit', async () => {
  const { owner } = initial()
  const store = new FakeJournal()
  store.stored.push({ messageId: 'bad', clientSeq: 1, payload: 'not-base64!' })
  const session = new DurableCollaborationSession(scope(), 'lease_5', store, owner)
  await assert.rejects(session.restore(), /base64|payload|recover/i)
  assert.equal(session.ready, false)
  await assert.rejects(session.edit(4, 4, '!'), /recover|ready/i)
  assert.equal(session.value, 'base')
})

test('stop before a delayed native result cannot commit the edit after vault switch', async () => {
  const { owner } = initial()
  const store = new FakeJournal()
  const session = new DurableCollaborationSession(scope(), 'lease_6', store, owner)
  await session.restore()
  store.deferNext()
  const pending = session.edit(4, 4, 'stale')
  session.stop()
  store.unblock()
  await assert.rejects(pending, /stopped|closed|session/i)
  assert.equal(session.ready, false)
})

test('a second editor command is refused until the first journal commit finishes', async () => {
  const { owner } = initial()
  const store = new FakeJournal()
  const session = new DurableCollaborationSession(scope(), 'lease_7', store, owner)
  await session.restore()
  store.deferNext()
  const first = session.edit(4, 4, 'a')
  await assert.rejects(session.edit(4, 4, 'b'), /pending|in.flight|retry/i)
  store.unblock()
  await first
  assert.equal(session.value, 'basea')
})

test('scope mismatch cannot bind an existing peer document to another vault, room or epoch', async () => {
  const { owner } = initial()
  const store = new FakeJournal()
  assert.throws(
    () => new DurableCollaborationSession({ ...scope(), roomId: 'other' }, 'lease_8', store, owner),
    /scope|room|document/i,
  )
  assert.throws(
    () => new DurableCollaborationSession({ ...scope(), vaultId: 'other' }, 'lease_8', store, owner),
    /scope|vault/i,
  )
})

test('replayed local transactions converge with a trusted remote peer without publishing uncommitted bytes', async () => {
  const { owner, seed } = initial()
  const bob = new CollaborativeMarkdown(scope('bob'))
  bob.hydrate(seed)
  const journal = new FakeJournal()
  const session = new DurableCollaborationSession(scope(), 'lease_9', journal, owner)
  await session.restore()
  const local = await session.edit(4, 4, ' alice')
  assert.ok(local)
  const remote = bob.change(4, 4, ' bob')
  bob.applyRemote(Buffer.from(local.payload!, 'base64'), author())
  owner.applyRemote(remote, author('bob'))
  assert.equal(session.value, bob.value)
  assert.match(session.value, / alice/)
  assert.match(session.value, / bob/)
  assert.equal(session.pendingForRelay().length, 1)
})


test('closing a durable session revokes its native lease without deleting pending data', async () => {
  const { owner } = initial()
  const store = new FakeJournal()
  const session = new DurableCollaborationSession(scope(), 'lease_clean', store, owner)
  await session.restore()
  const outgoing = await session.edit(4, 4, ' retained')
  assert.ok(outgoing)
  assert.equal(store.stored.length, 1)
  await session.close()
  assert.equal(session.ready, false)
  assert.deepEqual(store.stoppedLeases, ['lease_clean'])
  assert.equal(store.stored.length, 1, 'stopping must never discard the native journal')
  await session.close()
  assert.deepEqual(store.stoppedLeases, ['lease_clean'], 'closing twice must be idempotent')
  await assert.rejects(session.edit(4, 4, 'unauthorized'), /recover|ready|session/i)
})
