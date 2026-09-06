import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildGmailMarkdown,
  buildRfc5322Message,
  encodeBase64Url,
  gmailImportedNoteTitle,
  toYamlScalar,
} from './gmailRfc5322.ts'

test('encodeBase64Url formats bytes without padding and with URL-safe chars', () => {
  const input = new TextEncoder().encode('Hello >? World!')
  const encoded = encodeBase64Url(input)
  assert.ok(!encoded.includes('+'), 'should not contain +')
  assert.ok(!encoded.includes('/'), 'should not contain /')
  assert.ok(!encoded.includes('='), 'should not contain =')
})

test('buildRfc5322Message generates valid base64url encoded MIME envelope', () => {
  const rawBase64 = buildRfc5322Message('test@example.com', 'Test Subject', 'Line 1\nLine 2')
  const restoredBase64 = rawBase64.replace(/-/g, '+').replace(/_/g, '/')
  const padded = restoredBase64.padEnd(restoredBase64.length + ((4 - (restoredBase64.length % 4)) % 4), '=')
  const decoded = Buffer.from(padded, 'base64').toString('utf8')

  assert.ok(decoded.includes('To: test@example.com\r\n'))
  assert.ok(decoded.includes('Subject: Test Subject\r\n'))
  assert.ok(decoded.includes('Content-Type: text/plain; charset=utf-8\r\n'))
  assert.ok(decoded.includes('Line 1\r\nLine 2\r\n'))
})

test('toYamlScalar safely encodes strings preventing YAML injection and multiline breakout', () => {
  assert.equal(toYamlScalar('Simple Subject'), '"Simple Subject"')
  assert.equal(toYamlScalar('Email: "Urgent" update'), '"Email: \\"Urgent\\" update"')

  const injectionAttempt = 'From Name\nadmin: true\n_archived: true'
  const scalar = toYamlScalar(injectionAttempt)
  assert.ok(!scalar.includes('\n'), 'scalar must not contain literal newlines')
  assert.equal(scalar, '"From Name\\nadmin: true\\n_archived: true"')
  assert.equal(toYamlScalar(null), '""')
  assert.equal(toYamlScalar(undefined), '""')
})

test('gmailImportedNoteTitle makes duplicate subjects unique by immutable Gmail id', () => {
  assert.equal(gmailImportedNoteTitle('Meeting', '18f4abc'), 'Meeting -- gmail-18f4abc')
  assert.equal(gmailImportedNoteTitle('   ', '18f4abc'), 'Untitled Email -- gmail-18f4abc')
})

test('buildGmailMarkdown preserves identifiers and prefers complete body text over snippet', () => {
  const markdown = buildGmailMarkdown({
    id: '18f4abc',
    threadId: 'thread-1',
    subject: 'Status: "Green"',
    from: 'Sender <sender@example.com>',
    date: 'Mon, 1 Jan 2026 12:00:00 +0000',
    snippet: 'short snippet',
    plainText: 'Complete message body',
  })

  assert.match(markdown, /gmail_id: "18f4abc"/)
  assert.match(markdown, /thread_id: "thread-1"/)
  assert.match(markdown, /title: "Status: \\"Green\\""/)
  assert.match(markdown, /Complete message body/)
  assert.ok(!markdown.endsWith('short snippet\n'))
})
