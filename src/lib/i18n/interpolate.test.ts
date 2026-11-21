import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { interpolate } from './interpolate.ts'

test('values are inserted literally, including $ replacement patterns', () => {
  assert.equal(interpolate('a {{x}}', { x: '$&' }), 'a $&')
  assert.equal(interpolate('commit "{{message}}"?', { message: "fix $' and $$" }), 'commit "fix $\' and $$"?')
})

test('a value that looks like a placeholder is not substituted again', () => {
  assert.equal(interpolate('{{x}} / {{y}}', { x: '{{y}}', y: 'Z' }), '{{y}} / Z')
})

test('repeated and unknown placeholders', () => {
  assert.equal(interpolate('{{n}} of {{n}}', { n: 3 }), '3 of 3')
  assert.equal(interpolate('{{missing}}', { other: 'x' }), '{{missing}}')
  assert.equal(interpolate('plain'), 'plain')
})

function leaves(value: unknown, path: string, out: Map<string, string>): Map<string, string> {
  if (typeof value === 'string') out.set(path, value)
  else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) leaves(child, path ? `${path}.${key}` : key, out)
  }
  return out
}

// `plural` only carries the English plural suffix; other locales may omit it.
const placeholders = (text: string) =>
  [...new Set([...text.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).filter((name) => name !== 'plural'))].sort().join(',')

test('every locale uses {{name}} placeholders that match English', () => {
  const load = (locale: string) =>
    leaves(JSON.parse(readFileSync(new URL(`./${locale}.json`, import.meta.url), 'utf8')), '', new Map())
  const en = load('en')
  for (const locale of ['en', 'de', 'fa']) {
    for (const [key, text] of load(locale)) {
      assert.doesNotMatch(text, /(?<!\{)\{\w+\}(?!\})/, `${locale}:${key} uses a single-brace placeholder`)
      const english = en.get(key)
      if (english !== undefined) assert.equal(placeholders(text), placeholders(english), `${locale}:${key} placeholders differ from en`)
    }
  }
})
