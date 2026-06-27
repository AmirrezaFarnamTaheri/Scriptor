const ZOTERO_API_BASE = 'https://api.zotero.org'

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

export class ZoteroConnector {
  private baseUrl: string
  private apiKey: string
  private userId: string | null = null

  constructor() {
    this.baseUrl = ZOTERO_API_BASE
    this.apiKey = ''
  }

  async connect(url: string, apiKey: string): Promise<void> {
    this.baseUrl = url.replace(/\/+$/, '')
    this.apiKey = apiKey

    const response = await this.fetch('/keys/current')
    if (!response.ok) {
      throw new Error(`Zotero authentication failed: ${response.status} ${response.statusText}`)
    }
    const data = (await response.json()) as { userID?: number; id?: number }
    this.userId = String(data.userID ?? data.id ?? '')
    if (!this.userId) {
      throw new Error('Could not determine Zotero user ID')
    }
  }

  private ensureConnected(): string {
    if (!this.userId) {
      throw new Error('Not connected. Call connect() first.')
    }
    return this.userId
  }

  private async fetch(path: string, params?: Record<string, string>): Promise<Response> {
    const url = new URL(`/users/${this.userId ?? '0'}${path}`, this.baseUrl)
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value)
      }
    }
    return globalThis.fetch(url.toString(), {
      headers: {
        'Zotero-API-Key': this.apiKey,
        'Zotero-API-Version': '3',
      },
    })
  }

  async listCollections(): Promise<ZoteroCollection[]> {
    this.ensureConnected()
    const response = await this.fetch('/collections')
    if (!response.ok) {
      throw new Error(`Failed to list collections: ${response.status}`)
    }
    const data = (await response.json()) as ZoteroApiCollection[]
    return data.map((item) => ({
      key: item.key,
      name: item.data.name,
      parentCollection: item.data.parentCollection,
      numItems: item.data.numItems,
    }))
  }

  async listItems(collectionId?: string): Promise<ZoteroItem[]> {
    this.ensureConnected()
    const path = collectionId ? `/collections/${collectionId}/items` : '/items'
    const response = await this.fetch(path, { itemType: '-attachment || note' })
    if (!response.ok) {
      throw new Error(`Failed to list items: ${response.status}`)
    }
    const data = (await response.json()) as ZoteroApiItem[]
    return data
      .filter((item) => item.data.itemType !== 'attachment' && item.data.itemType !== 'note')
      .map((item) => item.data)
  }

  async exportBibTeX(collectionId?: string): Promise<string> {
    this.ensureConnected()
    const path = collectionId ? `/collections/${collectionId}/items` : '/items'
    const response = await this.fetch(path, { format: 'bibtex', itemType: '-attachment || note' })
    if (!response.ok) {
      throw new Error(`Failed to export BibTeX: ${response.status}`)
    }
    return response.text()
  }

  async importToVault(vaultPath: string, bibtex: string): Promise<void> {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const targetDir = vaultPath
    const targetFile = path.join(targetDir, 'references.bib')

    await fs.promises.mkdir(targetDir, { recursive: true })

    let existing = ''
    try {
      existing = await fs.promises.readFile(targetFile, 'utf-8')
    } catch {
      // File doesn't exist yet
    }

    if (existing.trim() && !existing.endsWith('\n')) {
      existing += '\n'
    }

    await fs.promises.writeFile(targetFile, existing + bibtex, 'utf-8')
  }
}
