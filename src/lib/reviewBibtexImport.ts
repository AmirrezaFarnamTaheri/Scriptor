/** A bounded, read-only key review. This is not a full BibTeX field parser.
 * Actual saving remains with the existing native create-only vault writer.
 */
export interface BibliographyKeyCollision {
  readonly key: string
  readonly sourcePaths: readonly string[]
}

export interface BibliographyImportReview {
  readonly keys: readonly string[]
  readonly added: readonly string[]
  readonly collisions: readonly BibliographyKeyCollision[]
}

type IndexedReference = { readonly key: string; readonly source_path?: string | null }
const MAX_BIB_BYTES = 8 * 1024 * 1024
const MAX_REFERENCES = 10_000
const KEY_PATTERN = /^[A-Za-z0-9_:+./-]+$/

function validateText(content: string): void {
  if (!content || new TextEncoder().encode(content).byteLength > MAX_BIB_BYTES) {
    throw new Error('BibTeX input must contain 1–8 MiB of text or less.')
  }
  for (let i = 0; i < content.length; i += 1) {
    const value = content.charCodeAt(i)
    if (value === 0) throw new Error('Invalid NUL in BibTeX input.')
    if (value >= 0xd800 && value <= 0xdbff) {
      const next = content.charCodeAt(i + 1)
      if (!(next >= 0xdc00 && next <= 0xdfff)) throw new Error('Invalid UTF-16 surrogate in BibTeX input.')
      i += 1
    } else if (value >= 0xdc00 && value <= 0xdfff) {
      throw new Error('Invalid UTF-16 surrogate in BibTeX input.')
    }
  }
}

function skipTrivia(text: string, startingAt: number): number {
  let position = startingAt
  while (position < text.length) {
    const character = text[position]
    if (/\s/.test(character!)) { position += 1; continue }
    if (character === '%') {
      while (position < text.length && text[position] !== '\n') position += 1
      continue
    }
    break
  }
  return position
}

/** Finds one complete entry body, ignoring embedded @, escaped quotes and braces. */
function afterEntryBody(text: string, openingAt: number, opener: '{' | '('): number {
  let braceDepth = 0
  let inQuote = false
  let escaped = false
  for (let i = openingAt + 1; i < text.length; i += 1) {
    const character = text[i]
    if (escaped) { escaped = false; continue }
    if (character === '\\') { escaped = true; continue }
    if (character === '"' && braceDepth === 0) { inQuote = !inQuote; continue }
    if (inQuote) continue
    if (character === '{') { braceDepth += 1; continue }
    if (character === '}') {
      if (braceDepth > 0) { braceDepth -= 1; continue }
      if (opener === '{') return i + 1
      throw new Error('Malformed BibTeX entry with unmatched brace.')
    }
    if (character === ')' && opener === '(' && braceDepth === 0) return i + 1
  }
  throw new Error('Unclosed BibTeX entry or quoted field.')
}

function importedCitationKeys(content: string): string[] {
  const keys: string[] = []
  const seen = new Set<string>()
  let position = 0
  while ((position = skipTrivia(content, position)) < content.length) {
    if (content[position] !== '@') {
      throw new Error('BibTeX input contains non-entry text outside a comment or directive.')
    }
    position += 1
    const typeStart = position
    while (position < content.length && /[a-z]/i.test(content[position]!)) position += 1
    const kind = content.slice(typeStart, position).toLowerCase()
    if (!kind) throw new Error('Malformed BibTeX entry type.')
    position = skipTrivia(content, position)
    const opener = content[position]
    if (opener !== '{' && opener !== '(') throw new Error('Malformed BibTeX entry delimiter.')
    const afterBody = afterEntryBody(content, position, opener)
    if (!['comment', 'string', 'preamble'].includes(kind)) {
      const comma = content.indexOf(',', position + 1)
      if (comma < 0 || comma >= afterBody) throw new Error('Malformed BibTeX citation key: expected a comma.')
      const key = content.slice(position + 1, comma).trim()
      if (!KEY_PATTERN.test(key) || key.length > 128) throw new Error('Invalid BibTeX citation key.')
      if (seen.has(key)) throw new Error('Duplicate citation key in BibTeX import: ' + key)
      seen.add(key)
      keys.push(key)
      if (keys.length > MAX_REFERENCES) throw new Error('BibTeX review exceeds the 10,000-reference limit.')
    }
    position = afterBody
  }
  if (keys.length === 0) throw new Error('No reference entries found in the BibTeX import.')
  return keys
}

/**
 * Collisions refer only to the currently indexed bibliography entries. A
 * subsequent native create-only write still guards against file replacement.
 */
export function reviewBibtexImport(
  content: string,
  existing: readonly IndexedReference[],
): BibliographyImportReview {
  validateText(content)
  const keys = importedCitationKeys(content)
  const indexed = new Map<string, Set<string>>()
  for (const entry of existing) {
    if (!entry?.key) continue
    const sources = indexed.get(entry.key) ?? new Set<string>()
    if (entry.source_path?.trim()) sources.add(entry.source_path)
    indexed.set(entry.key, sources)
  }
  const added: string[] = []
  const collisions: BibliographyKeyCollision[] = []
  for (const key of keys) {
    const sources = indexed.get(key)
    if (sources === undefined) added.push(key)
    else collisions.push({
      key, sourcePaths: [...sources].sort((a, b) => a < b ? -1 : a > b ? 1 : 0),
    })
  }
  return { keys, added, collisions }
}
