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
})
