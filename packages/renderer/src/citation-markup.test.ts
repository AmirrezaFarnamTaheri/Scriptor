import assert from 'node:assert/strict'
import test from 'node:test'
import { sanitizeRenderedHtml } from './pipeline.ts'

test('citation status and source survive final sanitization without event handlers', () => {
  const html = sanitizeRenderedHtml('<span class="preview-citation" data-resolved="false" title="[@missing]" aria-label="Unresolved citation: @missing" onclick="alert(1)">[@missing]</span>')
  assert.match(html, /data-resolved="false"/)
  assert.match(html, /aria-label="Unresolved citation: @missing"/)
  assert.match(html, /title="\[@missing\]"/)
  assert.doesNotMatch(html, /onclick/)
  assert.doesNotMatch(sanitizeRenderedHtml('<span data-resolved="invented">text</span>'), /data-resolved/)
})
