import assert from 'node:assert/strict'
import test from 'node:test'
import { parseSourceDocument, sourceLanguage } from './sourceFile.ts'

test('source formats stay separate from Markdown and binary documents', () => {
  for (const path of ['main.tex', 'paper.ltx', 'main.py', 'src/lib.rs', 'data.json', 'settings.yaml', 'Cargo.toml']) assert.ok(sourceLanguage(path))
  for (const path of ['Note.md', 'book.pdf', '../main.py', '.scriptor/key.json', 'a\\b.py', 'image.png']) assert.equal(sourceLanguage(path), null)
})
test('source documents reject wrong identity, invalid hashes and oversized content', () => {
  const document = { vault_id: 'v', path: 'main.py', content: 'print(1)\r\n', content_hash: 'a'.repeat(64), language: 'python' }
  assert.equal(parseSourceDocument(document, 'v', 'main.py').content, document.content)
  assert.throws(() => parseSourceDocument(document, 'other', 'main.py'))
  assert.throws(() => parseSourceDocument({ ...document, content_hash: 'invalid' }, 'v', 'main.py'))
  assert.throws(() => parseSourceDocument({ ...document, content: 'x'.repeat(2 * 1024 * 1024 + 1) }, 'v', 'main.py'))
})
