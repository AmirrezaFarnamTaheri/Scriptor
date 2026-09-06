import assert from 'node:assert/strict'
import test from 'node:test'
import { buildRfc5322Message, encodeBase64Url } from './gmailRfc5322.ts'

test('encodeBase64Url formats bytes without padding and with URL-safe chars', () => {
  const input = new TextEncoder().encode('Hello >? World!')
  const encoded = encodeBase64Url(input)
  assert.ok(!encoded.includes('+'), 'should not contain +')
  assert.ok(!encoded.includes('/'), 'should not contain /')
  assert.ok(!encoded.includes('='), 'should not contain =')
})

test('buildRfc5322Message generates valid base64url encoded MIME envelope', () => {
  const to = 'test@example.com'
  const subject = 'Test Subject'
  const body = 'Line 1\nLine 2'
  const rawBase64 = buildRfc5322Message(to, subject, body)

  // Decode and check content
  const restoredBase64 = rawBase64.replace(/-/g, '+').replace(/_/g, '/')
  const padded = restoredBase64.padEnd(restoredBase64.length + ((4 - (restoredBase64.length % 4)) % 4), '=')
  const decoded = Buffer.from(padded, 'base64').toString('utf8')

  assert.ok(decoded.includes('To: test@example.com\r\n'))
  assert.ok(decoded.includes('Subject: Test Subject\r\n'))
  assert.ok(decoded.includes('Content-Type: text/plain; charset=utf-8\r\n'))
  assert.ok(decoded.includes('Line 1\r\nLine 2\r\n'))
})
