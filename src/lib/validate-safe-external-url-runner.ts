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

import { isSafeExternalUrl, safeExternalUrl } from './safeExternalUrl.ts'

test('accepts an https URL and returns it unchanged', () => {
  assert.equal(safeExternalUrl('https://meet.example.com/abc-defg'), 'https://meet.example.com/abc-defg')
})

test('accepts a plain http URL', () => {
  assert.equal(safeExternalUrl('http://intranet.example/standup'), 'http://intranet.example/standup')
})

test('trims surrounding whitespace before returning the URL', () => {
  assert.equal(safeExternalUrl('  https://example.com/x  '), 'https://example.com/x')
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
