import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

import {
  addTableColumn,
  addTableRow,
  collectTableBlocks,
  findTableBlock,
  prefixBlockquoteLine,
  prefixHeadingLine,
  unwrapSelectionText,
  updateTableCell,
  wrapSelectionText,
} from './transform-logic.ts'

import { analyzeFrontmatter } from './frontmatter.ts'
import { removeListMarkers } from './gfm-commands.ts'
import { htmlToMarkdown, nodeToMarkdown } from './paste-handler.ts'
import { MERMAID_SNIPPETS, MATH_SNIPPETS } from './snippet-catalogs.ts'
import { normalizeSnippetCatalog, parseSnippetCatalogJson } from './snippet-catalog.ts'
import {
  expandSnippetTemplate,
  looksLikeSnippetTemplate,
  resolveSnippetVariables,
} from './snippet-parser.ts'

test('analyzeFrontmatter accepts valid yaml block', () => {
  const markdown = ['---', 'title: Hello', 'tags: one', '---', '', '# Body'].join('\n')
  const analysis = analyzeFrontmatter(markdown)
  assert.equal(analysis.valid, true)
  assert.deepEqual(analysis.warningLines, [])
})

test('analyzeFrontmatter flags unterminated block', () => {
  const analysis = analyzeFrontmatter('---\ntitle: Hello\n')
  assert.equal(analysis.valid, false)
  assert.equal(analysis.error, 'unterminated frontmatter')
  assert.deepEqual(analysis.warningLines, [1])
})

test('analyzeFrontmatter flags lines without key separator', () => {
  const markdown = ['---', 'title Hello', '---', ''].join('\n')
  const analysis = analyzeFrontmatter(markdown)
  assert.equal(analysis.valid, false)
  assert.equal(analysis.warningLines.length, 1)
  assert.equal(analysis.warningLines[0], 2)
})

test('analyzeFrontmatter accepts block sequences and indented continuations', () => {
  const markdown = ['---', 'tags:', '  - one', '  - two', 'title: >', '  folded text', '---', ''].join('\n')
  const analysis = analyzeFrontmatter(markdown)
  assert.equal(analysis.valid, true)
  assert.deepEqual(analysis.warningLines, [])
})

test('analyzeFrontmatter tolerates trailing space on the closing delimiter', () => {
  const markdown = ['---', 'title: Hello', '--- ', ''].join('\n')
  const analysis = analyzeFrontmatter(markdown)
  assert.equal(analysis.valid, true)
  assert.notEqual(analysis.error, 'unterminated frontmatter')
})

test('analyzeFrontmatter validates documents with a leading BOM', () => {
  const analysis = analyzeFrontmatter('\uFEFF---\ntitle Hello\n---\n')
  assert.equal(analysis.valid, false)
  assert.deepEqual(analysis.warningLines, [2])
})

test('wrapSelectionText wraps with markers', () => {
  assert.equal(wrapSelectionText('Hello', '**'), '**Hello**')
})

test('unwrapSelectionText removes markers when present', () => {
  assert.equal(unwrapSelectionText('Hello', '**', '**', '**', '**'), 'Hello')
  assert.equal(unwrapSelectionText('Hello', 'x', 'y', '**', '**'), null)
})

test('prefixHeadingLine adds and preserves heading level', () => {
  assert.equal(prefixHeadingLine('Hello', 1), '# Hello')
  assert.equal(prefixHeadingLine('## Hello', 2), '## Hello')
  assert.equal(prefixHeadingLine('### Hello', 1), '# Hello')
})

test('prefixBlockquoteLine prefixes once', () => {
  assert.equal(prefixBlockquoteLine('Hello'), '> Hello')
  assert.equal(prefixBlockquoteLine('> Hello'), '> Hello')
})

test('table helpers add row and column', () => {
  const markdown = ['| A | B |', '| --- | --- |', '| 1 | 2 |']
  const block = findTableBlock(markdown, 2)
  assert.ok(block)
  const withRow = addTableRow(block)
  assert.equal(withRow.length, 3)
  assert.deepEqual(withRow[2], ['', ''])

  const withCol = addTableColumn(block)
  assert.equal(withCol[0].length, 3)
  assert.equal(withCol[1].length, 3)
})

test('updateTableCell replaces one cell', () => {
  const markdown = ['| A | B |', '| --- | --- |', '| 1 | 2 |']
  const block = findTableBlock(markdown, 2)
  assert.ok(block)
  const next = updateTableCell(block, 1, 1, '9')
  assert.deepEqual(next[1], ['1', '9'])
})

test('collectTableBlocks finds contiguous pipe tables', () => {
  const markdown = [
    '# Title',
    '| H1 | H2 |',
    '| --- | --- |',
    '| a | b |',
    '',
    '| X |',
    '| --- |',
    '| y |',
  ]
  const blocks = collectTableBlocks(markdown)
  assert.equal(blocks.length, 2)
  assert.equal(blocks[0].rows.length, 2)
  assert.equal(blocks[1].rows.length, 2)
})

test('resolveSnippetVariables substitutes date and title tokens', () => {
  const resolved = resolveSnippetVariables('# ${TITLE} (${CURRENT_YEAR})', {
    title: 'Daily',
    now: new Date('2026-06-20T12:00:00Z'),
  })
  assert.equal(resolved, '# Daily (2026)')
})

test('expandSnippetTemplate expands tab stops and defaults', () => {
  const expanded = expandSnippetTemplate('Hello ${1:world} $2!', 10, {})
  assert.equal(expanded.text, 'Hello world !')
  assert.deepEqual(expanded.tabStops, [
    { index: 1, from: 16, to: 21 },
    { index: 2, from: 22, to: 22 },
    { index: 0, from: 23, to: 23 },
  ])
})

test('expandSnippetTemplate handles choice placeholders', () => {
  const expanded = expandSnippetTemplate('${1|one,two|}', 0, {})
  assert.equal(expanded.text, 'one')
  assert.equal(expanded.tabStops[0]?.index, 1)
  assert.equal(expanded.tabStops[0]?.to, 3)
})

test('looksLikeSnippetTemplate detects textmate syntax', () => {
  assert.equal(looksLikeSnippetTemplate('plain text'), false)
  assert.equal(looksLikeSnippetTemplate('${1:label}'), true)
  assert.equal(looksLikeSnippetTemplate('\\$not a snippet'), false)
})

test('removeListMarkers strips bullet and task prefixes', () => {
  assert.equal(removeListMarkers('- [ ] Task'), 'Task')
  assert.equal(removeListMarkers('1. Item'), 'Item')
  assert.equal(removeListMarkers('* Item'), 'Item')
})

test('htmlToMarkdown converts basic HTML tags', () => {
  const markdown = htmlToMarkdown(
    '<p>Hello <strong>world</strong> and <em>friends</em></p><ul><li>One</li><li>Two</li></ul>',
  )
  assert.match(markdown, /\*\*world\*\*/)
  assert.match(markdown, /\*friends\*/)
  assert.match(markdown, /^- One$/m)
  assert.match(markdown, /^- Two$/m)
})

test('htmlToMarkdown converts links', () => {
  const markdown = htmlToMarkdown('<p>Visit <a href="https://example.com">Example</a></p>')
  assert.equal(markdown.trim(), 'Visit [Example](https://example.com)')
})

// --- paste-handler regression tests ----------------------------------------

interface FakeNode {
  nodeType: number
  textContent: string | null
  tagName: string
  childNodes: FakeNode[]
  children: FakeNode[]
  parentElement: FakeNode | null
  getAttribute(name: string): string | null
}

function textNode(value: string): FakeNode {
  return {
    nodeType: 3,
    textContent: value,
    tagName: '',
    childNodes: [],
    children: [],
    parentElement: null,
    getAttribute: () => null,
  }
}

function elementNode(
  tagName: string,
  childNodes: FakeNode[] = [],
  attributes: Record<string, string> = {},
): FakeNode {
  const element: FakeNode = {
    nodeType: 1,
    textContent: null,
    tagName: tagName.toUpperCase(),
    childNodes,
    children: childNodes.filter((child) => child.nodeType === 1),
    parentElement: null,
    getAttribute: (name: string) => attributes[name] ?? null,
  }
  for (const child of childNodes) {
    child.parentElement = element
  }
  return element
}

function toMarkdown(node: FakeNode): string {
  return nodeToMarkdown(node as unknown as Node)
}

test('nested lists keep their indentation instead of flattening', () => {
  const nested = elementNode('ul', [
    elementNode('li', [
      textNode('One'),
      elementNode('ul', [elementNode('li', [textNode('One A')]), elementNode('li', [textNode('One B')])]),
    ]),
    elementNode('li', [textNode('Two')]),
  ])

  assert.equal(toMarkdown(nested), ['- One', '  - One A', '  - One B', '- Two', '', ''].join('\n'))
})

test('nested ordered lists restart numbering per level', () => {
  const nested = elementNode('ol', [
    elementNode('li', [
      textNode('First'),
      elementNode('ol', [elementNode('li', [textNode('Inner one')]), elementNode('li', [textNode('Inner two')])]),
    ]),
    elementNode('li', [textNode('Second')]),
  ])

  assert.equal(
    toMarkdown(nested),
    ['1. First', '  1. Inner one', '  2. Inner two', '2. Second', '', ''].join('\n'),
  )
})

test('links from the DOM path drop unsafe schemes', () => {
  const hostile = elementNode('a', [textNode('click me')], { href: 'javascript:alert(1)' })
  assert.equal(toMarkdown(hostile), 'click me')

  const smuggled = elementNode('a', [textNode('x')], { href: 'java script:alert(1)' })
  assert.equal(toMarkdown(smuggled), 'x')

  const dataUrl = elementNode('a', [textNode('y')], { href: '  DATA:text/html;base64,PHNjcmlwdD4=' })
  assert.equal(toMarkdown(dataUrl), 'y')

  const empty = elementNode('a', [], { href: 'vbscript:msgbox(1)' })
  assert.equal(toMarkdown(empty), 'link')
})

test('links from the DOM path keep allowed schemes', () => {
  assert.equal(
    toMarkdown(elementNode('a', [textNode('Example')], { href: 'https://example.com' })),
    '[Example](https://example.com)',
  )
  assert.equal(
    toMarkdown(elementNode('a', [textNode('Mail')], { href: 'mailto:a@example.com' })),
    '[Mail](mailto:a@example.com)',
  )
  assert.equal(toMarkdown(elementNode('a', [textNode('Rel')], { href: 'notes/other.md' })), '[Rel](notes/other.md)')
  assert.equal(toMarkdown(elementNode('a', [textNode('Anchor')], { href: '#section' })), '[Anchor](#section)')
})

test('link targets with parentheses or spaces are percent-encoded', () => {
  const markdown = toMarkdown(
    elementNode('a', [textNode('Doc')], { href: 'https://example.com/a (b)/c d.png' }),
  )
  assert.equal(markdown, '[Doc](https://example.com/a%20%28b%29/c%20d.png)')
  const target = markdown.slice(markdown.indexOf('](') + 2, -1)
  assert.ok(!/[ ()]/.test(target), 'link target must not contain raw spaces or parentheses')
})

test('htmlToMarkdown fallback path sanitizes and encodes link targets', () => {
  const hostile = htmlToMarkdown('<p>Go <a href="javascript:alert(1)">here</a></p>')
  assert.ok(!hostile.includes('javascript:'))
  assert.ok(!hostile.includes(']('))
  assert.match(hostile, /Go here/)

  const messy = htmlToMarkdown('<p><a href="https://example.com/a (b)">Doc</a></p>')
  assert.equal(messy.trim(), '[Doc](https://example.com/a%20%28b%29)')
})

test('clipboard collections are read as array-likes, not iterables', () => {
  const source = fs.readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), 'paste-handler.ts'),
    'utf8',
  )
  assert.ok(source.includes('Array.from(items)'), 'DataTransferItemList must be converted with Array.from')
  assert.ok(source.includes('Array.from(files)'), 'FileList must be converted with Array.from')
  assert.doesNotMatch(
    source,
    /for\s*\(\s*const\s+\w+\s+of\s+(items|files)\s*\)/,
    'DataTransferItemList/FileList are not iterable per spec',
  )
})

test('snippet catalogs expose mermaid and math templates', () => {
  assert.equal(MERMAID_SNIPPETS.length, 4)
  assert.ok(MERMAID_SNIPPETS.every((entry) => entry.content.includes('```mermaid')))
  assert.equal(MATH_SNIPPETS.length, 2)
  assert.ok(MATH_SNIPPETS.some((entry) => entry.content.startsWith('$')))
  assert.ok(MATH_SNIPPETS.some((entry) => entry.content.startsWith('$$')))
})

test('parseSnippetCatalogJson normalizes vault snippets', () => {
  const catalog = parseSnippetCatalogJson(
    JSON.stringify({
      snippets: [
        { name: ' task ', content: '- [ ] ${1:x}\n', description: 'Task' },
        { name: 'task', content: 'duplicate' },
      ],
    }),
  )
  assert.equal(catalog.length, 1)
  assert.equal(catalog[0]?.name, 'task')
  assert.deepEqual(normalizeSnippetCatalog(catalog), catalog)
})

const roundtripDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../test-fixtures/markdown/roundtrip')

test('roundtrip fixtures preserve structure markers', () => {
  const files = fs.readdirSync(roundtripDir).filter((name) => name.endsWith('.md'))
  assert.ok(files.length >= 5)
  for (const file of files) {
    const markdown = fs.readFileSync(path.join(roundtripDir, file), 'utf8')
    assert.ok(markdown.length > 0, `${file} should not be empty`)
    if (file === 'frontmatter.md') {
      const analysis = analyzeFrontmatter(markdown)
      assert.equal(analysis.valid, true)
    }
    if (file === 'headings.md') {
      assert.match(markdown, /^# Top Level/m)
      assert.match(markdown, /^## Second Level/m)
    }
    if (file === 'task-lists.md') {
      assert.match(markdown, /- \[ \]/)
      assert.match(markdown, /- \[x\]/)
    }
    if (file === 'fenced-code.md') {
      assert.match(markdown, /```rust/)
    }
  }
})

import { lintLinkReferences, lintMarkdownDocument, generateLinkReferenceDefinitions } from './remark-lint.ts'

test('lintMarkdownDocument flags trailing spaces and heading jumps', () => {
  const markdown = '# Top\n\n### Jumped\n\nLine with spaces   \n'
  const messages = lintMarkdownDocument(markdown)
  assert.ok(messages.some((message) => message.ruleId === 'no-trailing-spaces'))
  assert.ok(messages.some((message) => message.ruleId === 'heading-increment'))
})

test('lintLinkReferences detects missing Foam reference definitions', () => {
  const markdown = 'See [note-label] for details.'
  const messages = lintLinkReferences(markdown)
  assert.ok(messages.some((message) => message.ruleId === 'foam-missing-reference'))
})

test('lintLinkReferences ignores wikilinks and citation keys', () => {
  const markdown = 'Uses [@smith2024] and [[Field Notes]] with [note-label] missing.'
  const messages = lintLinkReferences(markdown)
  assert.equal(
    messages.filter((message) => message.ruleId === 'foam-missing-reference').length,
    1,
  )
  assert.match(messages[0]!.message, /note-label/)
})

test('generateLinkReferenceDefinitions appends placeholder definitions', () => {
  const markdown = 'See [note-label] for details.'
  const next = generateLinkReferenceDefinitions(markdown)
  assert.match(next, /\[note-label\]:\s+note-label\.md/)
})

test('link reference rules ignore task-list checkboxes', () => {
  const markdown = ['# Tasks', '', '- [x] done item', '- [ ] open item', '1. [X] numbered done', ''].join('\n')
  const messages = lintLinkReferences(markdown)
  assert.equal(messages.filter((message) => message.ruleId === 'foam-missing-reference').length, 0)
  assert.equal(generateLinkReferenceDefinitions(markdown), markdown)
})

test('link reference rules skip fenced code regions', () => {
  const markdown = ['Text', '', '```', 'array[index] and [not-a-ref]', '```', ''].join('\n')
  const messages = lintLinkReferences(markdown)
  assert.equal(messages.filter((message) => message.ruleId === 'foam-missing-reference').length, 0)
  assert.equal(generateLinkReferenceDefinitions(markdown), markdown)
})

import { replaceDelimited } from './typography-transforms.ts'

test('replaceDelimited keeps delimiter parity when text starts with the delimiter', () => {
  assert.equal(replaceDelimited("'", '"')("'hello'"), '"hello"')
  assert.equal(replaceDelimited('`', '"')('`hello` and `world`'), '"hello" and "world"')
  assert.equal(replaceDelimited('"', '*')('"hello"'), '*hello*')
})

import { findSiblingIndex, sectionRange } from './move-section.ts'
import type { TocEntry } from './toc-field.ts'

test('move-section targets siblings, skipping child headings', () => {
  // ## A (pos 0) / ### A1 (pos 20) / ## B (pos 40) in a 60-char doc
  const entries = [
    { line: 1, pos: 0, text: 'A', level: 2, renderedLevel: '1', id: 'a' },
    { line: 3, pos: 20, text: 'A1', level: 3, renderedLevel: '1.1', id: 'a1' },
    { line: 5, pos: 40, text: 'B', level: 2, renderedLevel: '2', id: 'b' },
  ] satisfies TocEntry[]
  assert.equal(findSiblingIndex(entries, 0, 1), 2)
  assert.equal(findSiblingIndex(entries, 2, -1), 0)
  assert.equal(findSiblingIndex(entries, 1, 1), -1)
  assert.equal(findSiblingIndex(entries, 1, -1), -1)
  assert.deepEqual(sectionRange(entries, 0, 60), { from: 0, to: 40 })
  assert.deepEqual(sectionRange(entries, 1, 60), { from: 20, to: 40 })
  assert.deepEqual(sectionRange(entries, 2, 60), { from: 40, to: 60 })
})

import { generateTocFromMarkdown } from './pure/toc.ts'

test('generateTocFromMarkdown parses heading hierarchy, rendered level, and anchor ids', () => {
  const markdown = [
    '# Heading 1',
    'Some intro paragraph',
    '```',
    '# Not a heading in code fence',
    '```',
    '## Subheading [link]',
    '### Code `test`',
    '# Second Heading',
  ].join('\n')

  const toc = generateTocFromMarkdown(markdown)
  assert.equal(toc.length, 4)
  assert.deepEqual(toc[0], {
    line: 1,
    pos: 0,
    text: 'Heading 1',
    level: 1,
    renderedLevel: '1',
    id: 'heading-1',
  })
  assert.deepEqual(toc[1], {
    line: 6,
    pos: 0,
    text: 'Subheading [link]',
    level: 2,
    renderedLevel: '1.1',
    id: 'subheading-link',
  })
  assert.deepEqual(toc[2], {
    line: 7,
    pos: 0,
    text: 'Code `test`',
    level: 3,
    renderedLevel: '1.1.1',
    id: 'code-test',
  })
  assert.deepEqual(toc[3], {
    line: 8,
    pos: 0,
    text: 'Second Heading',
    level: 1,
    renderedLevel: '2',
    id: 'second-heading',
  })
})
