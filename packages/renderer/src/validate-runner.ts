import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

import { preprocessWikilinks } from './preprocess.ts'
import { renderMarkdownPipeline } from './pipeline.ts'
import { renderMarkdownPreview } from './preview.ts'
import { findPreviewAnchor } from './scroll-sync.ts'
import { preprocessImports } from './remark-import.ts'
import { preprocessWikilinkEmbeds } from './remark-wikilink-embed.ts'
import { parseMpeAttributes } from './remark-mpe-code-chunks.ts'

const fixturesRoot = join(fileURLToPath(new URL('../../test-fixtures/markdown/hostile', import.meta.url)))

test('preprocessWikilinks converts pipe and plain targets', () => {
  assert.equal(
    preprocessWikilinks('See [[Note|Label]] and [[Other]]'),
    'See [Label](#wikilink:Note) and [Other](#wikilink:Other)',
  )
})

test('preprocessWikilinkEmbeds creates embed placeholders', () => {
  const out = preprocessWikilinkEmbeds('Before ![[Note]] after ![[Other#Section]]')
  assert.match(out, /data-wikilink-target="Note"/)
  assert.match(out, /data-wikilink-target="Other"/)
  assert.match(out, /data-wikilink-section="Section"/)
})

test('pipeline renders wikilink embed placeholders', () => {
  const html = renderMarkdownPipeline('See ![[Target#Intro]]')
  assert.match(html, /data-wikilink-embed="true"/)
  assert.match(html, /data-wikilink-target="Target"/)
  assert.match(html, /data-wikilink-section="Intro"/)
})

test('preprocessImports inlines markdown with depth and cycle guards', () => {
  const files = new Map<string, string>([
    ['notes/root.md', 'Root\n@import "child.md"\nTail'],
    ['notes/child.md', 'Child body\n@import "root.md"'],
  ])
  const fetchNote = (path: string) => files.get(path.replace(/\\/g, '/')) ?? null

  const once = preprocessImports('@import "child.md"', { fetchNote, basePath: 'notes/root.md' })
  assert.match(once, /Child body/)

  const cyclic = preprocessImports('@import "root.md"', { fetchNote, basePath: 'notes/child.md' })
  assert.match(cyclic, /Circular import detected/)
})

test('pipeline inlines @import when fetchNote is provided', () => {
  const html = renderMarkdownPipeline('@import "part.md"\n\nAfter', {
    fetchNote: (path) => (path.endsWith('part.md') ? 'Imported **bold**' : null),
    basePath: 'notes/main.md',
  })
  assert.match(html, /<strong[^>]*>bold<\/strong>/)
  assert.match(html, />After</)
})

test('parseMpeAttributes reads brace meta strings', () => {
  assert.deepEqual(parseMpeAttributes('{cmd=powershell hide output=html}'), {
    cmd: 'powershell',
    hide: 'true',
    output: 'html',
  })
})

test('pipeline renders MPE code chunks with parsed attributes', () => {
  const html = renderMarkdownPipeline('```powershell {cmd=powershell hide output=html}\nGet-Date\n```')
  assert.match(html, /data-mpe-chunk="true"/)
  assert.match(html, /data-mpe-lang="powershell"/)
  assert.match(html, /data-mpe-title="powershell"/)
  assert.match(html, /data-mpe-hide="true"/)
  assert.match(html, /data-mpe-output="html"/)
  assert.match(html, /Get/)
  assert.match(html, /class="mpe-code-chunk-run"/)
})

test('pipeline renders markup highlight and underline', () => {
  const html = renderMarkdownPipeline('==bright== and ++emphasis++')
  assert.match(html, /class="markup-highlight"[^>]*>bright<\/mark>/)
  assert.match(html, /class="markup-underline"[^>]*>emphasis<\/span>/)
})

test('pipeline renders [TOC] from headings', () => {
  const html = renderMarkdownPipeline('# Title\n\n[TOC]\n\n## Section\n\n### Detail')
  assert.match(html, /class="markdown-toc"/)
  assert.match(html, /href="#section"/)
  assert.match(html, />Section</)
  assert.match(html, />Detail</)
})

test('pipeline renders ```math fences with KaTeX', () => {
  const html = renderMarkdownPipeline('```math\n\\alpha + \\beta\n```')
  assert.match(html, /katex/i)
})

test('pipeline enableBreaks renders soft line breaks', () => {
  const html = renderMarkdownPipeline('Line one\nLine two', { enableBreaks: true })
  assert.match(html, /<br\s*\/?>/i)
})

test('pipeline renders GFM tables and strikethrough', () => {
  const html = renderMarkdownPipeline('| A | B |\n| --- | --- |\n| 1 | 2 |\n\n~~gone~~')
  assert.match(html, /<table[\s>]/)
  assert.match(html, /<del[^>]*>gone<\/del>/)
})

test('pipeline renders task lists and footnotes', () => {
  const html = renderMarkdownPipeline('- [x] done\n- [ ] todo\n\nFoot[^1]\n\n[^1]: note')
  assert.match(html, /type="checkbox"/)
  assert.match(html, /data-footnotes|footnotes/i)
})

test('pipeline preserves wikilink hrefs', () => {
  const html = renderMarkdownPreview('Link [[Target|Label]]')
  assert.match(html, /href="#wikilink:Target"/)
  assert.match(html, />Label</)
})

test('pipeline annotates elements with source lines', () => {
  const html = renderMarkdownPipeline('# Title\n\nParagraph text.')
  assert.match(html, /data-source-line="1"/)
  assert.match(html, /data-source-line="3"/)
})

test('pipeline renders block math with KaTeX', () => {
  const html = renderMarkdownPipeline('$$\nE = mc^2\n$$')
  assert.match(html, /katex/i)
})

test('pipeline promotes mermaid fences to diagram containers', () => {
  const html = renderMarkdownPipeline('```mermaid\ngraph LR\n  A-->B\n```')
  assert.match(html, /class="mermaid"/)
  assert.match(html, /A-->B/)
})

test('scroll sync helpers find anchors by line', () => {
  if (typeof document === 'undefined') return
  const root = document.createElement('div')
  root.innerHTML = '<p data-source-line="1">A</p><p data-source-line="5">B</p>'
  assert.equal(findPreviewAnchor(root, 3)?.getAttribute('data-source-line'), '1')
  assert.equal(findPreviewAnchor(root, 5)?.getAttribute('data-source-line'), '5')
})

test('renderMarkdownPreview renders through pipeline', () => {
  const html = renderMarkdownPreview('# Hello')
  assert.match(html, /<h1[^>]*>Hello<\/h1>/)
})

test('hostile markdown fixtures strip script and event handlers', () => {
  for (const fixture of ['script-tag.md', 'onclick.md', 'iframe.md', 'data-uri.md']) {
    const markdown = readFileSync(join(fixturesRoot, fixture), 'utf8')
    const html = renderMarkdownPipeline(markdown)
    assert.doesNotMatch(html, /<script/i)
    assert.doesNotMatch(html, /onerror\s*=/i)
    assert.doesNotMatch(html, /<iframe/i)
    assert.doesNotMatch(html, /javascript:/i)
  }
})

console.log('Renderer validation passed')
