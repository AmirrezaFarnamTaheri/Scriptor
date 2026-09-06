import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { ZoteroConnector } from './index.ts'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('ZoteroConnector', () => {
  it('verifies credentials at the unscoped /keys/current endpoint', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    const connector = new ZoteroConnector(async (input, init) => {
      calls.push({ url: String(input), init })
      return jsonResponse({ userID: 42 })
    })

    await connector.connect('secret-key')

    assert.equal(calls[0]?.url, 'https://api.zotero.org/keys/current')
    const headers = calls[0]?.init?.headers as Record<string, string>
    assert.equal(headers['Zotero-API-Key'], 'secret-key')
    assert.equal(headers['Zotero-API-Version'], '3')
  })

  it('scopes library requests to the verified user id', async () => {
    const urls: string[] = []
    const connector = new ZoteroConnector(async (input) => {
      const url = String(input)
      urls.push(url)
      if (url.endsWith('/keys/current')) return jsonResponse({ userID: 42 })
      return jsonResponse([])
    })

    await connector.connect('key')
    await connector.listCollections()

    assert.match(urls[1] ?? '', /^https:\/\/api\.zotero\.org\/users\/42\/collections\?/)
  })

  it('does not retain invalid credentials', async () => {
    let authenticated = true
    const connector = new ZoteroConnector(async () =>
      authenticated ? jsonResponse({ userID: 42 }) : jsonResponse({}, 403),
    )
    await connector.connect('valid-key')
    authenticated = false

    await assert.rejects(() => connector.connect('bad-key'), /authentication failed/)
    await assert.rejects(() => connector.listItems(), /Not connected/)
  })

  it('rejects empty API keys before any request', async () => {
    let called = false
    const connector = new ZoteroConnector(async () => {
      called = true
      return jsonResponse({ userID: 42 })
    })
    await assert.rejects(() => connector.connect('   '), /API key is required/)
    assert.equal(called, false)
  })

  it('exports every BibTeX page using the required export limit', async () => {
    const urls: string[] = []
    const connector = new ZoteroConnector(async (input) => {
      const url = String(input)
      urls.push(url)
      if (url.endsWith('/keys/current')) return jsonResponse({ userID: 42 })
      const parsed = new URL(url)
      const start = parsed.searchParams.get('start')
      if (start === '0') {
        return new Response('@article{first}\n', { headers: { 'Total-Results': '150' } })
      }
      if (start === '100') {
        return new Response('@article{second}\n', { headers: { 'Total-Results': '150' } })
      }
      throw new Error(`unexpected Zotero page: ${url}`)
    })

    await connector.connect('key')
    const bib = await connector.exportBibTeX()

    assert.match(urls[1] ?? '', /format=bibtex/)
    assert.match(urls[1] ?? '', /limit=100/)
    assert.match(urls[1] ?? '', /start=0/)
    assert.match(urls[2] ?? '', /start=100/)
    assert.equal(bib, '@article{first}\n\n@article{second}\n')
  })

  it('follows Link rel=next when Total-Results is unavailable', async () => {
    const connector = new ZoteroConnector(async (input) => {
      const url = String(input)
      if (url.endsWith('/keys/current')) return jsonResponse({ userID: 42 })
      const parsed = new URL(url)
      if (parsed.searchParams.get('start') === '0') {
        return new Response('@book{one}\n', {
          headers: {
            Link: '<https://api.zotero.org/users/42/items?format=bibtex&itemType=-attachment%20%7C%7C%20note&start=100&limit=100>; rel="next"',
          },
        })
      }
      return new Response('@book{two}\n')
    })

    await connector.connect('key')
    const bib = await connector.exportBibTeX()
    assert.equal(bib, '@book{one}\n\n@book{two}\n')
  })
})
