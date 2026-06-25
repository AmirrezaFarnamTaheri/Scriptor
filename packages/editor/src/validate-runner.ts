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
import { htmlToMarkdown } from './paste-handler.ts'
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

console.log('Editor validation passed')
