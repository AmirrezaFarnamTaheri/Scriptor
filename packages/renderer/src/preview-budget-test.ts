import assert from 'node:assert/strict'
import { test } from 'node:test'

import { renderMarkdownPreview } from './preview.ts'
import { applyPreviewPostProcess, combinePreviewWarnings } from './preview-result.ts'

import { generateLargePreviewFixture, generateMediumPreviewFixture, generateSmallPreviewFixture } from './benchmark-fixtures.ts'

const results: Record<string, { ms: number; budget: number; pass: boolean }> = {}

const small = generateSmallPreviewFixture()
const medium = generateMediumPreviewFixture()
const large = generateLargePreviewFixture()

const SMALL_BUDGET = 100
const MEDIUM_BUDGET = 250

test('small fixture renders under 100ms', () => {
  const start = performance.now()
  const html = renderMarkdownPreview(small)
  const elapsed = performance.now() - start
  results.small = { ms: +elapsed.toFixed(2), budget: SMALL_BUDGET, pass: elapsed < SMALL_BUDGET }
  assert.ok(html.length > 0, 'rendered output must not be empty')
  assert.ok(elapsed < SMALL_BUDGET, `small render took ${elapsed.toFixed(2)}ms (budget ${SMALL_BUDGET}ms)`)
})

test('medium fixture renders under 250ms', () => {
  const start = performance.now()
  const html = renderMarkdownPreview(medium)
  const elapsed = performance.now() - start
  results.medium = { ms: +elapsed.toFixed(2), budget: MEDIUM_BUDGET, pass: elapsed < MEDIUM_BUDGET }
  assert.ok(html.length > 0, 'rendered output must not be empty')
  assert.ok(elapsed < MEDIUM_BUDGET, `medium render took ${elapsed.toFixed(2)}ms (budget ${MEDIUM_BUDGET}ms)`)
})

test('large fixture renders without error', () => {
  const start = performance.now()
  const html = renderMarkdownPreview(large)
  const elapsed = performance.now() - start
  results.large = { ms: +elapsed.toFixed(2), budget: 0, pass: true }
  assert.ok(html.length > 0, 'rendered output must not be empty')
})

test('post-process exceptions preserve the core Markdown HTML', () => {
  const coreHtml = '<h1>Research Plan</h1>'
  const result = applyPreviewPostProcess(coreHtml, () => {
    throw new Error('renderer extension crashed')
  })

  assert.equal(result.html, coreHtml)
  assert.match(result.warning ?? '', /Preview extension failed/)
  assert.match(result.warning ?? '', /Showing the core Markdown render/)
})

test('invalid post-process results preserve the core Markdown HTML', () => {
  const coreHtml = '<p>Stable preview</p>'
  const invalidPostProcessor = (() => 42) as unknown as (html: string) => string
  const result = applyPreviewPostProcess(coreHtml, invalidPostProcessor)

  assert.equal(result.html, coreHtml)
  assert.match(result.warning ?? '', /non-string/)
})

test('preview warnings are de-duplicated without dropping distinct failures', () => {
  assert.equal(
    combinePreviewWarnings('Extension failed.', 'Extension failed.', 'Mermaid failed.'),
    'Extension failed. Mermaid failed.',
  )
})

process.on('exit', () => {
  console.log(JSON.stringify(results, null, 2))
})
