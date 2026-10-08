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

test('buildRfc5322Message rejects CRLF header injection and normalizes body line endings', () => {
  assert.throws(
    () => buildRfc5322Message('victim@example.com\r\nBcc: attacker@example.com', 'Subject', 'Body'),
    /recipient.*line break/i,
  )
  assert.throws(
    () => buildRfc5322Message('victim@example.com', 'Subject\nBcc: attacker@example.com', 'Body'),
    /subject.*line break/i,
  )

  const rawBase64 = buildRfc5322Message('test@example.com', 'Safe', 'A\rB\nC\r\nD')
  const restoredBase64 = rawBase64.replace(/-/g, '+').replace(/_/g, '/')
  const padded = restoredBase64.padEnd(restoredBase64.length + ((4 - (restoredBase64.length % 4)) % 4), '=')
  const decoded = Buffer.from(padded, 'base64').toString('utf8')
  assert.ok(decoded.endsWith('A\r\nB\r\nC\r\nD\r\n'))
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

test('Gmail import keeps provider HTML and Markdown syntax inert while preserving text', () => {
  const markdown = buildGmailMarkdown({ id: 'a1', threadId: 'b1', subject: 'Title\n# injected',
    from: '<img src=x onerror=alert(1)>', date: 'today', snippet: '',
    plainText: '<script>alert(1)</script>\n![beacon](https://example.com/pixel)\n[run](command:danger)' })
  assert.ok(!markdown.includes('<script>'))
  assert.ok(!markdown.includes('<img'))
  assert.ok(!markdown.includes('\n# injected'))
  assert.match(markdown, /&lt;script&gt;/)
  assert.ok(markdown.includes('\\!\\[beacon\\]\\(https://example\\.com/pixel\\)'))
  assert.ok(markdown.includes('\\[run\\]\\(command:danger\\)'))
})

test('Gmail MIME encodes Unicode subjects and rejects header control characters', () => {
  const encoded = buildRfc5322Message('person@example.com', 'سلام '.repeat(30), 'body')
  const decoded = Buffer.from(encoded, 'base64url').toString('utf8')
  assert.match(decoded, /Subject: =\?UTF-8\?B\?/)
  assert.ok(decoded.split('\r\n').every(line => line.length <= 998))
  assert.throws(() => buildRfc5322Message('person@example.com', 'bad\0subject', 'body'), /control/i)
})

test('Gmail MIME wraps long UTF-8 body lines without changing their text', () => {
  const body = 'سلام'.repeat(400)
  const envelope = Buffer.from(buildRfc5322Message('person@example.com', 'Long body', body), 'base64url').toString('utf8')
  assert.match(envelope, /Content-Transfer-Encoding: base64/)
  assert.ok(envelope.split('\r\n').every(line => line.length <= 998))
  const encodedBody = envelope.split('\r\n\r\n')[1]
  assert.equal(Buffer.from(encodedBody, 'base64').toString('utf8'), body)
})
