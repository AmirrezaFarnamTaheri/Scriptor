import assert from 'node:assert/strict'
import test from 'node:test'

import {
  DEFAULT_HUNSPELL_LOCALE,
  getActiveHunspellLocale,
  loadHunspellLocale,
  resolveHunspellLocale,
  setActiveHunspellLocale,
} from './hunspell-dictionary.ts'

test('unshipped persisted locales fall back to the shipped default dictionary', async () => {
  const originalFetch = globalThis.fetch
  const requests: string[] = []
  globalThis.fetch = async (input) => {
    requests.push(String(input))
    return new Response('2\nScriptor\nMarkdown\n', { status: 200 })
  }

  try {
    assert.equal(resolveHunspellLocale('de'), DEFAULT_HUNSPELL_LOCALE)
    setActiveHunspellLocale('de')
    assert.equal(getActiveHunspellLocale(), DEFAULT_HUNSPELL_LOCALE)
    const dictionary = await loadHunspellLocale('de')
    assert.deepEqual(requests, ['/dictionaries/en_US.dic'])
    assert.ok(dictionary.has('scriptor'))
    assert.ok(dictionary.has('markdown'))
  } finally {
    globalThis.fetch = originalFetch
  }
})
