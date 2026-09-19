import type { ScannedEntry, VaultSection } from '../../types/vault'

export interface OutlineHeading {
  label: string
  level: number
  line: number
}

const WINDOWS_RESERVED_BASENAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i
const PORTABLE_STEM_MAX_BYTES = 180

function truncateUtf8(value: string, maxBytes: number): string {
  const encoder = new TextEncoder()
  let bytes = 0
  let output = ''
  for (const character of value) {
    const characterBytes = encoder.encode(character).byteLength
    if (bytes + characterBytes > maxBytes) break
    output += character
    bytes += characterBytes
  }
  return output
}

export function defaultNotePath(title: string): string {
  let stem = title
    .trim()
    .replace(/\.md$/i, '')
    .replace(/[\\/:*?"<>|\u0000-\u001f\u007f]/g, '-')
    .replace(/[. ]+$/g, '')
    .trim()

  if (!stem || stem === '.' || stem === '..') stem = 'Untitled'
  if (WINDOWS_RESERVED_BASENAME.test(stem)) stem = `_${stem}`

  stem = truncateUtf8(stem, PORTABLE_STEM_MAX_BYTES).replace(/[. ]+$/g, '')
  return `${stem || 'Untitled'}.md`
}

export const DEFAULT_VAULT_CONFIG_SNIPPET = {
  graph_groups: [] as Array<{ tag_prefix: string; color: string }>,
  extra_roots: [] as string[],
}

export function isReaderDocumentPath(path: string): boolean {
  return /\.(pdf|epub)$/i.test(path)
}

export function buildVaultSections(entries: ScannedEntry[]): VaultSection[] {
  const visibleEntries = entries.filter(
    (entry) => entry.kind === 'note' || (entry.kind === 'asset' && isReaderDocumentPath(entry.path)),
  )
  return buildVaultSectionsFromPaths(visibleEntries.map((entry) => entry.path))
}

export function buildVaultSectionsFromPaths(paths: string[]): VaultSection[] {
  const groups = new Map<string, string[]>()

  for (const path of paths) {
    const parts = path.split('/')
    const folder = parts.length > 1 ? parts[0] : 'Vault'
    const existing = groups.get(folder) ?? []
    existing.push(path)
    groups.set(folder, existing)
  }

  return Array.from(groups.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, notePaths]) => ({
      name,
      count: notePaths.length,
      notes: notePaths.sort((left, right) => left.localeCompare(right)),
    }))
}

export function buildVaultSectionsFromSummaries(
  summaries: Array<{ path: string }>,
): VaultSection[] {
  return buildVaultSectionsFromPaths(summaries.map((summary) => summary.path))
}

export function extractOutline(markdown: string): OutlineHeading[] {
  return markdown
    .split('\n')
    .map((line, index) => {
      const match = line.match(/^(#+)\s+(.*)$/)
      if (!match) return null
      return {
        level: match[1].length,
        label: match[2].trim(),
        line: index + 1,
      }
    })
    .filter((entry): entry is OutlineHeading => entry !== null)
}

export function extractWikilinks(markdown: string): string[] {
  const links = new Set<string>()
  const matches = markdown.matchAll(/\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g)
  for (const match of matches) {
    const target = match[1]?.trim()
    if (target) links.add(target)
  }
  return Array.from(links)
}
