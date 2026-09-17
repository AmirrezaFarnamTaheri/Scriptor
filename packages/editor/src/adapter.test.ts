import assert from 'node:assert/strict'
import test from 'node:test'

import { countWords, countCharacters } from './adapter.ts'

test('countWords accurately counts prose words while ignoring Markdown structural markers', () => {
  const samples = [
    { input: '', expected: 0 },
    { input: '   ', expected: 0 },
    { input: '\t\n\r ', expected: 0 },
    { input: 'one', expected: 1 },
    { input: 'one two three', expected: 3 },
    { input: '  leading and trailing  ', expected: 3 },
    { input: 'multiple   internal     spaces', expected: 3 },
    { input: 'tabs\tand\nnewlines\rmixed', expected: 4 },
    { input: 'unicode\u00a0nbsp\u2003em-space', expected: 3 },
    { input: 'zero\uFEFFwidth\uFEFFjoiner', expected: 3 },
    { input: '# Heading Title', expected: 2 },
    { input: '### Subheading with multiple words', expected: 4 },
    { input: '> Blockquote line here', expected: 3 },
    { input: '>> Nested quote here', expected: 3 },
    { input: '> - [x] Quoted task item', expected: 3 },
    { input: '- [ ] Uncompleted task item', expected: 3 },
    { input: '- [x] Completed task item', expected: 3 },
    { input: '- Simple bullet item', expected: 3 },
    { input: '* Asterisk bullet item', expected: 3 },
    { input: '1. Ordered list item', expected: 3 },
    { input: '---', expected: 0 },
    { input: '***', expected: 0 },
    { input: '___', expected: 0 },
    { input: '| Column A | Column B |\n|---|---|\n| Cell 1 | Cell 2 |', expected: 8 },
    { input: 'Word with **bold** and *italic* and `code` formatting', expected: 8 },
    { input: "Contractions like don't and well-known hyphens", expected: 6 },
    { input: '这是一个测试', expected: 6 },
    { input: 'English word followed by 中文测试', expected: 8 },
    { input: 'Here is prose\n```js\nconst x = 10;\nfunction test() { return x; }\n```\nBack to prose', expected: 6 },
    { input: '\u{20000}\u{20001}', expected: 2 },
    { input: '---\ntitle: Hidden metadata\ntags: [one, two]\n---\nVisible prose only', expected: 3 },
    { input: '\uFEFF---\ntitle: Hidden metadata\n...\nVisible after BOM', expected: 3 },
    { input: '---\nNo closing frontmatter here\nVisible prose', expected: 6 },
  ]
  for (const { input, expected } of samples) {
    assert.equal(
      countWords(input),
      expected,
      `mismatch for ${JSON.stringify(input)}: got ${countWords(input)}, expected ${expected}`,
    )
  }
})

test('countWords handles large generated documents efficiently without memory overhead', () => {
  const words = []
  for (let index = 0; index < 50_000; index++) {
    words.push(`word${index}`)
  }
  const document = words.join(' \t\n') + '   '
  assert.equal(countWords(document), 50_000)
})

test('countCharacters counts code units', () => {
  assert.equal(countCharacters(''), 0)
  assert.equal(countCharacters('abc'), 3)
  assert.equal(countCharacters('a\u00e9'), 2)
})
