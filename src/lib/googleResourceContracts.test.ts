import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseGoogleCalendars, parseGoogleTaskLists, parseGmailMessagePage, parseGmailMessageContent, validateGmailListRequest } from './googleResourceContracts.ts'

describe('Google resource boundaries', () => {
  it('preserves calendar access roles and rejects inconsistent write capability', () => {
    const calendar = { id: 'team@example.com', summary: 'Team', accessRole: 'reader', primary: false, writable: false }
    assert.deepEqual(parseGoogleCalendars([calendar]), [calendar])
    assert.throws(() => parseGoogleCalendars([{ ...calendar, writable: true }]))
    assert.throws(() => parseGoogleCalendars([{ ...calendar, accessRole: 'administrator' }]))
    assert.throws(() => parseGoogleCalendars([calendar, calendar]))
    assert.throws(() => parseGoogleCalendars([{ ...calendar, id: 'team\n@example.com' }]))
  })

  it('retains opaque task-list IDs and rejects malformed or duplicate resources', () => {
    assert.deepEqual(parseGoogleTaskLists([{ id: 'MDQxMjM0', title: 'Research' }]), [{ id: 'MDQxMjM0', title: 'Research' }])
    assert.throws(() => parseGoogleTaskLists([{ id: '', title: 'Research' }]))
    assert.throws(() => parseGoogleTaskLists([{ id: 'a', title: 42 }]))
    assert.throws(() => parseGoogleTaskLists(Array.from({ length: 1001 }, (_, id) => ({ id: String(id), title: 'List' }))))
  })

  it('returns pagination without silently discarding invalid message references', () => {
    const message = { id: 'abc_123', threadId: 'def-123', subject: 'Subject', from: 'sender@example.com', date: '', snippet: '<plain text>' }
    assert.deepEqual(parseGmailMessagePage({ messages: [message], nextPageToken: 'opaque+/=' }), { messages: [message], nextPageToken: 'opaque+/=' })
    assert.throws(() => parseGmailMessagePage({ messages: [message, message], nextPageToken: null }))
    assert.throws(() => parseGmailMessagePage({ messages: [{ ...message, id: '../message' }], nextPageToken: null }))
    assert.throws(() => parseGmailMessagePage({ messages: [], nextPageToken: 'same' }, 'same'))
    assert.throws(() => parseGmailMessagePage({ messages: [], nextPageToken: '\n' }))
    assert.throws(() => parseGmailMessagePage({ messages: [message], nextPageToken: null }, null, 0))
  })

  it('bounds inputs without rewriting Gmail query syntax', () => {
    assert.equal(validateGmailListRequest('from:me newer_than:1d', 25, 'opaque+/='), undefined)
    for (const size of [0, 51, 1.5, NaN]) assert.throws(() => validateGmailListRequest('', size, null))
    assert.throws(() => validateGmailListRequest('é'.repeat(257), 25, null))
    assert.throws(() => validateGmailListRequest('x\ny', 25, null))
    assert.throws(() => validateGmailListRequest('', 25, 'x'.repeat(2049)))
  })

  it('binds bounded plain-text details to the selected message', () => {
    const message = { id: 'abc', threadId: 'def', subject: '', from: '', date: '', snippet: '', plainText: 'plain\n<untrusted HTML>' }
    assert.equal(parseGmailMessageContent(message, 'abc').plainText, message.plainText)
    assert.throws(() => parseGmailMessageContent(message, 'other'))
    assert.throws(() => parseGmailMessageContent({ ...message, plainText: '\0' }, 'abc'))
    assert.throws(() => parseGmailMessageContent({ ...message, plainText: 'x'.repeat(5 * 1024 * 1024 + 1) }, 'abc'))
  })
})
