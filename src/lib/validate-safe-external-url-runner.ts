/**
 * validate-safe-external-url-runner
 * ---------------------------------
 * Behavioural coverage for the external-URL scheme allow-list used before
 * provider-supplied links are rendered as Markdown or handed to the OS opener.
 *
 * Run with: pnpm check:safe-external-url
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { isSafeExternalUrl, safeExternalMarkdownDestination, safeExternalMarkdownText, safeExternalUrl } from './safeExternalUrl.ts'

test('accepts an https URL and returns it unchanged', () => {
  assert.equal(safeExternalUrl('https://meet.example.com/abc-defg'), 'https://meet.example.com/abc-defg')
})

test('accepts a plain http URL', () => {
  assert.equal(safeExternalUrl('http://intranet.example/standup'), 'http://intranet.example/standup')
})

test('accepts a mailto URL for explicit contact actions', () => {
  assert.equal(safeExternalUrl('mailto:support@example.com'), 'mailto:support@example.com')
})

test('trims surrounding whitespace before returning the URL', () => {
  assert.equal(safeExternalUrl('  https://example.com/x  '), 'https://example.com/x')
})

test('returns the canonical URL instead of control characters accepted by the parser', () => {
  assert.equal(
    safeExternalUrl('https://example.com/\n[untrusted](https://evil.example)'),
    'https://example.com/[untrusted](https://evil.example)',
  )
})

test('wraps provider URLs as an unambiguous Markdown destination', () => {
  assert.equal(
    safeExternalMarkdownDestination('https://example.com/path (meeting)'),
    '<https://example.com/path%20(meeting)>',
  )
})

test('encodes opaque mailto angle brackets before wrapping Markdown destinations', () => {
  assert.equal(safeExternalUrl('mailto:a@example.com>'), 'mailto:a@example.com>')
  assert.equal(safeExternalMarkdownDestination('mailto:a@example.com>'), '<mailto:a@example.com%3E>')
  assert.equal(safeExternalMarkdownDestination('mailto:<help@example.com>'), '<mailto:%3Chelp@example.com%3E>')
})

test('renders untrusted event labels as literal single-line Markdown', () => {
  const escaped = safeExternalMarkdownText('Planning\n- **Spoofed** [Join](https://evil.example)')
  assert.equal(escaped.includes('\n'), false)
  assert.equal(escaped.includes('**Spoofed**'), false)
  assert.equal(escaped.includes('[Join]('), false)
  assert.ok(escaped.includes('\\[Join\\]'))
  assert.equal(safeExternalMarkdownText(null), '')
})

test('rejects a javascript: payload', () => {
  assert.equal(safeExternalUrl('javascript:alert(1)'), null)
})

test('rejects a javascript: payload disguised by leading whitespace', () => {
  assert.equal(safeExternalUrl('   javascript:alert(1)'), null)
})

test('rejects a data: URL', () => {
  assert.equal(safeExternalUrl('data:text/html,<script>alert(1)</script>'), null)
})

test('rejects a vbscript: URL', () => {
  assert.equal(safeExternalUrl('vbscript:msgbox(1)'), null)
})

test('rejects a file: URL', () => {
  assert.equal(safeExternalUrl('file:///etc/passwd'), null)
})

test('rejects a relative path because it carries no verifiable scheme', () => {
  assert.equal(safeExternalUrl('/notes/meeting'), null)
})

test('rejects a scheme-relative URL', () => {
  assert.equal(safeExternalUrl('//evil.example.com/x'), null)
})

test('rejects a blank string', () => {
  assert.equal(safeExternalUrl('   '), null)
})

test('rejects null and undefined', () => {
  assert.equal(safeExternalUrl(null), null)
  assert.equal(safeExternalUrl(undefined), null)
})

test('rejects a non-string value', () => {
  assert.equal(safeExternalUrl(42 as unknown as string), null)
})

test('isSafeExternalUrl mirrors the allow-list decision', () => {
  assert.equal(isSafeExternalUrl('https://example.com'), true)
  assert.equal(isSafeExternalUrl('javascript:alert(1)'), false)
  assert.equal(isSafeExternalUrl(null), false)
})
