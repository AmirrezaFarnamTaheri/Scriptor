import assert from 'node:assert/strict'
import test from 'node:test'
import { AutoRevisionInbox } from './autoRevisionInbox.ts'

test('historical IDs are not silently applied, but new peer revisions are candidates', () => {
  const inbox = new AutoRevisionInbox()
  assert.deepEqual(inbox.observe(['historical-a', 'historical-b']), [])
  assert.equal(inbox.canPublish, true)
  assert.deepEqual(inbox.observe(['new-peer', 'historical-a']), ['new-peer'])
  inbox.markHandled('new-peer')
  assert.deepEqual(inbox.observe(['new-peer', 'historical-a']), [])
})

test('failed reads remain unhandled and block local upload until addressed', () => {
  const inbox = new AutoRevisionInbox()
  inbox.observe([])
  assert.deepEqual(inbox.observe(['unread']), ['unread'])
  inbox.blockForReview()
  assert.equal(inbox.canPublish, false)
  assert.deepEqual(inbox.observe(['unread']), [])
  inbox.releaseReview()
  assert.deepEqual(inbox.observe(['unread']), ['unread'])
})

test('conflicts block outbound syncing even after their IDs are marked seen', () => {
  const inbox = new AutoRevisionInbox()
  inbox.observe(['existing'])
  inbox.markHandled('incoming')
  inbox.blockForReview()
  assert.deepEqual(inbox.observe(['existing', 'incoming']), [])
  assert.equal(inbox.canPublish, false)
  inbox.releaseReview()
  assert.equal(inbox.canPublish, true)
})

test('each incoming poll processes a bounded batch and leaves later revisions pending', () => {
  const inbox = new AutoRevisionInbox()
  inbox.observe([])
  const ids = Array.from({ length: 17 }, (_, i) => `rev-${i}`)
  assert.deepEqual(inbox.observe(ids, 5), ids.slice(0, 5))
  for (const id of ids.slice(0, 5)) inbox.markHandled(id)
  assert.deepEqual(inbox.observe(ids, 5), ids.slice(5, 10))
  assert.equal(inbox.canPublish, true)
  inbox.reset()
  assert.equal(inbox.canPublish, false)
  assert.deepEqual(inbox.observe(ids), [])
})
