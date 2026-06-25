export interface VaultQuerySearchHit {
  path: string
  title: string
  snippet: string
}

export interface VaultQueryBacklink {
  fromPath: string
  fromTitle: string
  line: number
}

export interface VaultQueryHealthIssue {
  kind: string
  path: string
  detail: string
  line: number | null
}

export interface ReadOnlyVaultQuery {
  search(query: string, limit?: number): Promise<VaultQuerySearchHit[]>
  readNote(path: string): Promise<{ path: string; title: string; markdown: string }>
  backlinks(path: string): Promise<VaultQueryBacklink[]>
  healthIssues(): Promise<VaultQueryHealthIssue[]>
}

export function createVaultQueryAdapter(handlers: ReadOnlyVaultQuery): ReadOnlyVaultQuery {
  return {
    search: (query, limit) => handlers.search(query, limit),
    readNote: (path) => handlers.readNote(path),
    backlinks: (path) => handlers.backlinks(path),
    healthIssues: () => handlers.healthIssues(),
  }
}
