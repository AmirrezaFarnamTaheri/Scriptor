import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { renderMarkdownPipeline } from './pipeline.ts'

const markdown = readFileSync(new URL('../../test-fixtures/markdown/semantic-fidelity/mixed-note.md', import.meta.url), 'utf8')

test('MAT-007 shared fixture preserves preview source lines and hides frontmatter', () => {
  const html = renderMarkdownPipeline(markdown)
  assert.match(html, /<h1[^>]*data-source-line="5"[^>]*>Semantic fidelity study<\/h1>/)
  assert.doesNotMatch(html, /title:\s*Semantic fidelity study|tags:\s*\[research,\s*labor\]/)
  assert.match(html, /href="#wikilink:Lab%20Notes"/)
  assert.match(html, /Lab notes/)
})

test('MAT-007 shared fixture renders GFM, extended tasks, citations, math and sanitized HTML', () => {
  const html = renderMarkdownPipeline(markdown)
  assert.match(html, /<table[\s>]/)
  assert.match(html, /data-task-state="in-progress"/)
  assert.match(html, /data-task-state="forwarded"/)
  assert.match(html, /type="checkbox"/)
  assert.match(html, /smith2024/)
  assert.match(html, /footnotes/i)
  assert.match(html, /katex/i)
  assert.match(html, /class="mermaid"/)
  assert.match(html, /<em\b[^>]*>Safe emphasis<\/em>/)
  // The renderer intentionally disables single-dollar inline math in this profile.
  // This authored text must survive unchanged while fenced/block math renders.
  assert.match(html, /Equation \$x\^2 \+ 1\$\./)
  assert.doesNotMatch(html, /<script\b|onerror\s*=|javascript:/i)
})
