import assert from 'node:assert/strict'
import test from 'node:test'
import { translateGoogleDoc, docsPlainTextExport } from './collaborationDocs.ts'
test('Docs translation retains headings, table text and explicit loss disclosure', () => {
  const result = translateGoogleDoc({ title: 'Research', body: { content: [
    { paragraph: { paragraphStyle: { namedStyleType: 'HEADING_2' }, elements: [{ textRun: { content: 'Finding\n' } }] } },
    { table: { tableRows: [{ tableCells: [{ content: [{ paragraph: { elements: [{ textRun: { content: 'Cell\n' } }] } }] }] }] } },
    { paragraph: { elements: [{ inlineObjectElement: { inlineObjectId: 'image' } }] } },
  ] } })
  assert.match(result.markdown, /## Finding/)
  assert.match(result.markdown, /Cell/)
  assert.match(result.markdown, /omitted embedded object/)
  assert.ok(result.warnings.some(value => /table/i.test(value)))
  assert.ok(result.warnings.some(value => /comments/i.test(value)))
})
test('Docs nested tabs preserve text and reject unsupported shapes instead of silent success', () => {
  const result = translateGoogleDoc({ tabs: [{ documentTab: { body: { content: [{ paragraph: { elements: [{ textRun: { content: 'Arabic فارسی\n' } }] } }] } }, childTabs: [] }] })
  assert.match(result.markdown, /Arabic فارسی/)
  assert.throws(() => translateGoogleDoc({ body: { content: [{ surprise: 'content' }] } }), /Unsupported/)
  assert.throws(() => translateGoogleDoc({ body: { content: [] } }), /text/)
})
test('Docs export is an explicit bounded plain text copy and never treats Markdown as rich HTML', () => {
  const result = docsPlainTextExport('# Title\n<script>alert(1)</script>')
  assert.equal(result, '# Title\n<script>alert(1)</script>')
  assert.throws(() => docsPlainTextExport('x'.repeat(1_572_865)), /limit/)
})
