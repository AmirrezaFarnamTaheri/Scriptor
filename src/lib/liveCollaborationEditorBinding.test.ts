import assert from 'node:assert/strict'
import test from 'node:test'
import { CollaborativeMarkdown } from './liveCollaborationYjs.ts'
import { DurableCollaborationSession, type DurableLocalJournalPort } from './liveCollaborationDurableSession.ts'
import { CollaborationEditorController, singleTextEdit } from './liveCollaborationEditorBinding.ts'

const scope = (peerId: string) => ({
  vaultId: 'vault_alpha', roomId: 'room_alpha', documentId: 'doc_beta',
  epoch: 1, peerId, notePath: 'notes/live.md',
})

async function setup(markdown = 'start') {
  const model = new CollaborativeMarkdown(scope('alice'))
  const updates = model.initializeOwner(markdown)
  const persisted: Array<{ messageId: string; clientSeq: number; payload: string }> = []
  let fail = false
  const journal: DurableLocalJournalPort = {
    append: async (_scope, _lease, message) => {
      if (fail) throw new Error('native disk unavailable')
      persisted.push({ messageId: message.messageId, clientSeq: message.clientSeq, payload: message.payload! })
      return { locallyDurable: true, duplicate: false }
    },
    pending: async () => [],
  }
  const session = new DurableCollaborationSession(scope('alice'), 'session_one', journal, model)
  await session.restore()
  return { session, updates, model, persisted, setFail: (value: boolean) => { fail = value } }
}

function surface(initial: string) {
  const data = { text: initial, readOnly: false, history: [] as string[], selection: 0 }
  return {
    data,
    getValue: () => data.text,
    setReadOnly: (value: boolean) => { data.readOnly = value },
    applyRemoteEdit: ({ from, to, insert }: { from: number; to: number; insert: string }) => {
      data.text = data.text.slice(0, from) + insert + data.text.slice(to)
      if (data.selection >= to) data.selection += insert.length - (to - from)
    },
  }
}

test('minimal UTF-16 text splice retains unchanged prefix/suffix, RTL and emoji', () => {
  assert.deepEqual(singleTextEdit('ab\u{1F642}سلامz', 'ab\u{1F642}درودz'), { from: 4, to: 8, insert: 'درود' })
  assert.equal(singleTextEdit('same', 'same'), null)
})

test('editor input is frozen through durable native journal and fails closed on an ambiguous append', async () => {
  const { session, persisted, setFail } = await setup()
  const editor = surface('start')
  const controller = new CollaborationEditorController(session, editor)
  editor.data.text = 'start!'
  setFail(true)
  await assert.rejects(controller.localChange(), /native disk unavailable/)
  assert.equal(session.value, 'start')
  assert.equal(editor.data.readOnly, true)
  assert.equal(persisted.length, 0)
  setFail(false)
  await controller.retry()
  assert.equal(session.value, 'start!')
  assert.equal(editor.data.text, 'start!')
  assert.equal(editor.data.readOnly, false)
  assert.equal(persisted.length, 1)
  controller.dispose()
  await session.close()
})

test('remote updates are incremental, cannot become local outbox messages, and preserve editor undo and cursor', async () => {
  const { session, updates, persisted } = await setup('abc')
  const bob = new CollaborativeMarkdown({ ...scope('bob'), vaultId: 'vault_bob' })
  bob.hydrate(updates)
  const editor = surface('abc')
  editor.data.history.push('local-undo-record')
  editor.data.selection = 3
  const controller = new CollaborationEditorController(session, editor)
  const update = bob.change(0, 0, '\u{1F642}')
  session.receiveRemote(update, { roomId: 'room_alpha', documentId: 'doc_beta', epoch: 1, peerId: 'bob' })
  assert.equal(editor.data.text, '\u{1F642}abc')
  assert.equal(editor.data.selection, 5)
  assert.deepEqual(editor.data.history, ['local-undo-record'])
  assert.equal(persisted.length, 0)
  controller.dispose()
  bob.close()
  await session.close()
})

test('a session permits one owning editor and rejects a stale editor after unmount', async () => {
  const { session } = await setup()
  const editor = surface('start')
  const controller = new CollaborationEditorController(session, editor)
  assert.throws(() => new CollaborationEditorController(session, surface('start')), /owner|owned|already/i)
  controller.dispose()
  const successor = new CollaborationEditorController(session, surface('start'))
  successor.dispose()
  await session.close()
})

test('unsynchronized editor text is not silently replaced with a remote snapshot at attachment', async () => {
  const { session } = await setup('canonical')
  assert.throws(() => new CollaborationEditorController(session, surface('unreviewed draft')), /draft|mismatch|canonical/i)
  await session.close()
})
