export interface SnippetCatalogEntry {
  name: string
  content: string
  description?: string
}

export function normalizeSnippetCatalog(entries: SnippetCatalogEntry[]): SnippetCatalogEntry[] {
  const seen = new Set<string>()
  const normalized: SnippetCatalogEntry[] = []

  for (const entry of entries) {
    const name = entry.name.trim()
    const content = entry.content
    if (!name || !content || seen.has(name.toLowerCase())) {
      continue
    }
    seen.add(name.toLowerCase())
    normalized.push({
      name,
      content,
      description: entry.description?.trim() || undefined,
    })
  }

  return normalized.sort((left, right) => left.name.localeCompare(right.name))
}

export function parseSnippetCatalogJson(raw: string): SnippetCatalogEntry[] {
  const parsed = JSON.parse(raw) as { snippets?: SnippetCatalogEntry[] }
  if (!Array.isArray(parsed.snippets)) {
    return []
  }
  return normalizeSnippetCatalog(parsed.snippets)
}
