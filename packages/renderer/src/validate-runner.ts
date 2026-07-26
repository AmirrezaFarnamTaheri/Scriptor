import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

import { unified } from 'unified'
import { visit } from 'unist-util-visit'
import remarkParse from 'remark-parse'

import { escapeAttr, escapeHtml, slugify } from './escape.ts'
import { preprocessWikilinks } from './preprocess.ts'
import { sanitizeStyleAttribute } from './rehype-safe-style.ts'
import { remarkToc } from './remark-toc.ts'
import { remarkMpeCodeChunks } from './remark-mpe-code-chunks.ts'

/*
 * Regression suites that used to be dead code: nothing imported them, so
 * `pnpm check:renderer` never executed a single XSS fixture or perf budget.
 * They register their own node:test cases on import — keep these imports.
 */
import { auditMarkup } from './xss-test.ts'
import './preview-budget-test.ts'
import { renderMarkdownPipeline } from './pipeline.ts'
import { renderMarkdownPreview } from './preview.ts'
import { findPreviewAnchor } from './scroll-sync.ts'
import { preprocessImports, preprocessImportsAsync } from './remark-import.ts'
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

test('preprocessImportsAsync inserts imported text literally', async () => {
  const notes = new Map<string, string>([
    ['notes/math.md', 'Cost is $$x^2$$ and pattern $& stays $1 literal'],
  ])
  const out = await preprocessImportsAsync('@import "math.md"\n\nAfter', {
    fetchNote: async (path) => notes.get(path) ?? null,
    basePath: 'notes/main.md',
  })
  assert.match(out, /Cost is \$\$x\^2\$\$ and pattern \$& stays \$1 literal/)
  assert.match(out, /After/)
})

test('import paths may not escape the vault or reference URLs', async () => {
  const fetched: string[] = []
  const fetchNote = (path: string) => {
    fetched.push(path)
    return null
  }
  const traversal = preprocessImports('@import "../../etc/passwd"', {
    fetchNote,
    basePath: 'notes/main.md',
  })
  assert.match(traversal, /Import path not allowed/)

  const absolute = preprocessImports('@import "/etc/passwd"', { fetchNote })
  assert.match(absolute, /Import path not allowed/)

  const url = await preprocessImportsAsync('@import "https://evil.example/x.md"', {
    fetchNote: async (path) => {
      fetched.push(path)
      return null
    },
  })
  assert.match(url, /Import path not allowed/)
  assert.deepEqual(fetched, [])

  const inVault = preprocessImports('@import "../sibling.md"', {
    fetchNote: (path) => (path === 'sibling.md' ? 'Sibling body' : null),
    basePath: 'notes/main.md',
  })
  assert.match(inVault, /Sibling body/)
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

test('pipeline renders [TOC] with anchors that match emitted heading ids', () => {
  const html = renderMarkdownPipeline('# Title\n\n[TOC]\n\n## Section\n\n### Detail')
  assert.match(html, /class="markdown-toc"/)
  assert.match(html, />Section</)
  assert.match(html, />Detail</)
  const hrefs = [...html.matchAll(/href="#([^"]+)"/g)].map((match) => match[1])
  assert.ok(hrefs.length >= 3, 'TOC should link every heading')
  for (const href of hrefs) {
    assert.match(html, new RegExp(`<h[1-6][^>]*\\bid="${href}"`), `anchor #${href} should resolve`)
  }
})

test('pipeline TOC anchors survive duplicate and unicode headings', () => {
  const html = renderMarkdownPipeline('[TOC]\n\n## Notes\n\n## Notes\n\n## Café π')
  const hrefs = [...html.matchAll(/href="#([^"]+)"/g)].map((match) => match[1])
  assert.equal(new Set(hrefs).size, 3, 'duplicate headings should get de-duplicated anchors')
  assert.ok(hrefs.some((href) => href.endsWith('notes')))
  assert.ok(hrefs.some((href) => href.endsWith('notes-1')))
  assert.ok(hrefs.some((href) => href.endsWith('café-π')))
  for (const href of hrefs) {
    assert.match(html, new RegExp(`<h2[^>]*\\bid="${href}"`), `anchor #${href} should resolve`)
  }
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

// --- canonical escaping helpers -------------------------------------------
// These used to be six divergent private copies of `escapeHtml` (remark-toc's
// omitted `"`, remark-mpe-code-chunks' included it) plus four of `escapeAttr`
// and two of `slugify`. They now all resolve to ./escape.ts.

test('escapeHtml escapes all five HTML-significant characters', () => {
  assert.equal(escapeHtml(`&<>"'`), '&amp;&lt;&gt;&quot;&#39;')
  // Ampersand must be escaped first or the other entities get double-escaped.
  assert.equal(escapeHtml('&lt;'), '&amp;lt;')
  assert.equal(escapeHtml('plain text'), 'plain text')
})

test('escapeAttr escapes the five characters plus the mXSS backtick', () => {
  assert.equal(escapeAttr('a`b'), 'a&#96;b')
  assert.equal(escapeAttr(`" onerror="alert(1)`), '&quot; onerror=&quot;alert(1)')
  for (const char of ['&', '<', '>', '"', "'", '`']) {
    assert.doesNotMatch(escapeAttr(`x${char}y`), new RegExp(`x\\${char}y`), `${char} must not survive`)
  }
})

test('slugify is unicode-aware so distinct non-latin headings do not collide', () => {
  assert.equal(slugify('Hello World'), 'hello-world')
  assert.equal(slugify('Café π'), 'café-π')
  // The old ASCII-only embed-client copy collapsed both of these to '', which
  // made `![[Note#π]]` resolve against a `## Ω` heading.
  assert.notEqual(slugify('π'), slugify('Ω'))
})

function renderRawHtmlNodes(markdown: string, plugin: () => unknown): string {
  const tree = unified().use(remarkParse).use(plugin as never).parse(markdown)
  const processed = unified().use(remarkParse).use(plugin as never).runSync(tree)
  let html = ''
  visit(processed, 'html', (node: { value?: string }) => {
    html += node.value ?? ''
  })
  return html
}

test('remark-toc escapes quotes in heading text (previously divergent copy omitted ")', () => {
  const html = renderRawHtmlNodes('# Say "hi" & <b>x</b>\n\n[TOC]\n', remarkToc)
  assert.match(html, /class="markdown-toc"/)
  assert.doesNotMatch(html, /<a href="#[^"]*">Say "hi"/, 'raw double quotes must not reach the TOC link text')
  assert.match(html, /&quot;hi&quot;/)
  assert.match(html, /&amp;/)
  // the href is attribute context and must be escapeAttr-clean
  const href = /href="([^"]*)"/.exec(html)?.[1] ?? ''
  assert.doesNotMatch(href, /["'`<>]/)
})

test('remark-toc TOC anchors survive a heading crafted to break out of the href', () => {
  // The payload survives as escaped link *text*; what must not happen is it
  // becoming a live attribute on the <a> or <h1>.
  const html = renderMarkdownPipeline('# a" onmouseover="alert(1)\n\n[TOC]\n')
  assert.deepEqual(auditMarkup(html), [])
  assert.doesNotMatch(html, /<[^>]*\sonmouseover/i)
})

test('mpe code chunk attributes cannot break out of their quoted attribute', () => {
  const html = renderRawHtmlNodes(
    '```powershell {title=a\'" onload="alert(1)}\nGet-Date\n```',
    remarkMpeCodeChunks,
  )
  assert.doesNotMatch(html, /\son(?:load|error|click)\s*=/i, 'no handler attribute may be synthesised')
  assert.match(html, /data-mpe-title="/)
  // every emitted attribute name must be a plain data-mpe-* identifier
  for (const name of html.matchAll(/\s([^\s=<>"']+)=/g)) {
    assert.match(name[1] ?? '', /^[a-z][a-z0-9-]*$/, `attribute name "${name[1]}" is not a plain identifier`)
  }
  const rendered = renderMarkdownPipeline('```powershell {title=a\'" onload="alert(1)}\nx\n```')
  assert.deepEqual(auditMarkup(rendered), [])
})

// --- inline style filtering ------------------------------------------------

test('sanitizeStyleAttribute strips CSS exfiltration and overlay primitives', () => {
  assert.equal(sanitizeStyleAttribute('background:url(https://evil.example/beacon)'), '')
  assert.equal(sanitizeStyleAttribute('background:url(javascript:alert(1))'), '')
  assert.equal(sanitizeStyleAttribute('background:expression(alert(1))'), '')
  assert.equal(sanitizeStyleAttribute('-moz-binding:url(http://evil/x.xml)'), '')
  assert.equal(sanitizeStyleAttribute('behavior:url(#default#time2)'), '')
  assert.equal(sanitizeStyleAttribute('position:fixed;top:0;left:0'), 'top:0;left:0')
  assert.equal(sanitizeStyleAttribute('position:sticky'), '')
  // KaTeX layout declarations must survive untouched.
  assert.equal(
    sanitizeStyleAttribute('height:0.8em;vertical-align:-0.2em;position:relative;top:2px'),
    'height:0.8em;vertical-align:-0.2em;position:relative;top:2px',
  )
})

test('pipeline strips dangerous CSS from author-supplied span styles', () => {
  const html = renderMarkdownPipeline('<span style="background:url(javascript:alert(1));position:fixed">x</span>')
  assert.doesNotMatch(html, /javascript:/i)
  assert.doesNotMatch(html, /position\s*:\s*fixed/i)
  assert.match(html, /<span[^>]*>x<\/span>/)
})

test('pipeline still renders KaTeX inline styles', () => {
  const html = renderMarkdownPipeline('$$\n\\frac{1}{2}\n$$')
  assert.match(html, /katex/i)
  assert.match(html, /style="[^"]*height:/)
})

test('<style> content is removed, not leaked as visible text', () => {
  const html = renderMarkdownPipeline('<style>@import url("javascript:alert(1)");</style>')
  assert.doesNotMatch(html, /javascript:/i)
  assert.doesNotMatch(html, /@import/i)
})
