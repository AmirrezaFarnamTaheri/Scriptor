const ZOTERO_API_BASE = 'https://api.zotero.org'

type FetchLike = typeof globalThis.fetch

export interface ZoteroCollection {
  key: string
  name: string
  parentCollection: string | false
  numItems: number
}

export interface ZoteroItem {
  key: string
  itemType: string
  title: string
  creators: Array<{ creatorType: string; firstName?: string; lastName?: string; name?: string }>
  date: string
  abstractNote?: string
  tags: Array<{ tag: string }>
  publicationTitle?: string
  DOI?: string
  url?: string
}

interface ZoteroApiItem {
  key: string
  data: ZoteroItem
}

interface ZoteroApiCollection {
  key: string
  data: ZoteroCollection
}

/**
 * Read-only Zotero Web API v3 connector.
 *
 * Credentials are always sent only to Zotero's fixed HTTPS API origin. Tests
 * inject a fetch implementation rather than changing the credential origin.
 */
export class ZoteroConnector {
  private apiKey = ''
  private userId: string | null = null
  private readonly fetchImpl: FetchLike

  constructor(fetchImpl: FetchLike = globalThis.fetch) {
    this.fetchImpl = fetchImpl
  }

  async connect(apiKey: string): Promise<void> {
    const key = apiKey.trim()
    if (!key) throw new Error('Zotero API key is required')

    // Verify the key at the API's unscoped current-key endpoint before
    // retaining it as connected state.
    this.apiKey = ''
    this.userId = null
    const response = await this.request('/keys/current', undefined, key, false)
    if (!response.ok) {
      throw new Error(`Zotero authentication failed: ${response.status} ${response.statusText}`)
    }
    const data = (await response.json()) as { userID?: number }
    if (!Number.isSafeInteger(data.userID) || (data.userID ?? 0) <= 0) {
      throw new Error('Could not determine Zotero user ID')
    }
    this.apiKey = key
    this.userId = String(data.userID)
  }

  disconnect(): void {
    this.apiKey = ''
    this.userId = null
  }

  private ensureConnected(): string {
    if (!this.userId || !this.apiKey) {
      throw new Error('Not connected. Call connect() first.')
    }
    return this.userId
  }

  private async request(
    path: string,
    params?: Record<string, string>,
    apiKey = this.apiKey,
    userScoped = true,
  ): Promise<Response> {
    const requestPath = userScoped ? `/users/${this.ensureConnected()}${path}` : path
    const url = new URL(requestPath, ZOTERO_API_BASE)
    if (url.origin !== ZOTERO_API_BASE) {
      throw new Error('Refusing to send Zotero credentials outside the official API origin')
    }
    if (params) {
      for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
    }
    return this.fetchImpl(url.toString(), {
      headers: {
        'Zotero-API-Key': apiKey,
        'Zotero-API-Version': '3',
      },
    })
  }

  async listCollections(): Promise<ZoteroCollection[]> {
    this.ensureConnected()
    const allCollections: ZoteroCollection[] = []
    let start = 0
    const limit = 100

    for (;;) {
      const response = await this.request('/collections', { start: String(start), limit: String(limit) })
      if (!response.ok) throw new Error(`Failed to list collections: ${response.status}`)
      const data = (await response.json()) as ZoteroApiCollection[]
      for (const item of data) {
        allCollections.push({
          key: item.key,
          name: item.data.name,
          parentCollection: item.data.parentCollection,
          numItems: item.data.numItems,
        })
      }
      if (data.length < limit) break
      start += limit
    }

    return allCollections
  }

  async listItems(collectionId?: string): Promise<ZoteroItem[]> {
    this.ensureConnected()
    const path = collectionId ? `/collections/${collectionId}/items` : '/items'
    const allItems: ZoteroItem[] = []
    let start = 0
    const limit = 100
    const seen = new Set<string>()

    for (;;) {
      const response = await this.request(path, {
        itemType: '-attachment || note',
        start: String(start),
        limit: String(limit),
      })
      if (!response.ok) throw new Error(`Failed to list items: ${response.status}`)
      const data = (await response.json()) as ZoteroApiItem[]
      for (const item of data) {
        if (item.data.itemType !== 'attachment' && item.data.itemType !== 'note' && !seen.has(item.key)) {
          seen.add(item.key)
          allItems.push(item.data)
        }
      }
      if (data.length < limit) break
      start += limit
    }

    return allItems
  }

  async exportBibTeX(collectionId?: string): Promise<string> {
    this.ensureConnected()
    const path = collectionId ? `/collections/${collectionId}/items` : '/items'
    const response = await this.request(path, { format: 'bibtex', itemType: '-attachment || note' })
    if (!response.ok) throw new Error(`Failed to export BibTeX: ${response.status}`)
    return response.text()
  }
}
