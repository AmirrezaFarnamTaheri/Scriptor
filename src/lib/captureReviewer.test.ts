import assert from 'node:assert/strict'
import test from 'node:test'
import { captureMarkdown, captureTarget, parseCaptureExtraction } from './captureReviewer.ts'
test('capture preview validates UTF-8 bounds and requires attributable source HTML', () => {
  const payload = {url:'https://example.org/final',title:'Article',site_name:null,published_at:null,markdown:'Reviewed text',word_count:2,source_html:'<article>Original source</article>'}
  assert.equal(parseCaptureExtraction(payload).source_html, payload.source_html)
  assert.throws(() => parseCaptureExtraction({...payload,source_html:'界'.repeat(800000)}))
  assert.throws(() => parseCaptureExtraction({...payload,url:'javascript:alert(1)'}))
  assert.throws(() => parseCaptureExtraction({...payload,source_html:undefined}))
})
test('capture targets confine notes to relative Markdown paths', () => {
  assert.equal(captureTarget('Research','A paper'), 'Research/A paper.md')
  for (const path of ['../outside','C:/outside','/outside','Research/../outside']) assert.throws(() => captureTarget(path,'Paper'))
})
test('reviewed capture metadata is quoted and source URL stays attributable', () => {
  const markdown = captureMarkdown({url:'https://example.org/article',title:'A "paper"',author:'Jane',published:'2026-10-01',tags:'research, reading',markdown:'Reviewed body'})
  assert.match(markdown, /title: "A \\"paper\\""/)
  assert.match(markdown, /source_url: "https:\/\/example.org\/article"/)
  assert.match(markdown, /Reviewed body/)
  assert.throws(()=>captureMarkdown({url:'https://example.org/article',title:'Paper',author:'',published:'2026-02-30',tags:'',markdown:'Body'}))
  assert.throws(()=>captureMarkdown({url:'https://example.org/article',title:'Paper',author:'',published:'',tags:'',markdown:'界'.repeat(800000)}))
})
