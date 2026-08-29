import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const root = process.env.SCRIPTOR_SOURCE_ROOT ?? process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')

test('every advertised spellcheck locale ships its dictionary asset', () => {
  const source = read('packages/editor/src/hunspell-dictionary.ts')
  const advertised = [...source.matchAll(/dic:\s*'([^']+)'/g)].map((match) => match[1])
  assert.ok(advertised.length >= 1, 'at least one locale must be advertised')
  const seen = new Set()
  for (const url of advertised) {
    assert.match(url, /^\/dictionaries\/[A-Za-z0-9_.-]+\.dic$/, `malformed dictionary URL: ${url}`)
    assert.ok(!seen.has(url), `duplicate dictionary URL: ${url}`)
    seen.add(url)
    const asset = path.join(root, 'public', url.replace(/^\//, ''))
    assert.ok(fs.existsSync(asset), `advertised locale asset missing: ${url} (add the .dic file or remove the LOCALE_MAP entry)`)
  }
})

test('the default spellcheck dictionary is the en-US asset', () => {
  const source = read('packages/editor/src/hunspell-dictionary.ts')
  assert.match(source, /'en-US':\s*\{\s*dic:\s*'\/dictionaries\/en_US\.dic'/)
  assert.ok(fs.existsSync(path.join(root, 'public/dictionaries/en_US.dic')), 'en_US.dic must exist in public/dictionaries/')
})
