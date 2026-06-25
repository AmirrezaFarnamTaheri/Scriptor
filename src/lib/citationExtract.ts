export interface ExtractedCitation {
  key: string
  line: number
}

const BRACKET_BLOCK = /\[([^\]]*@[^\]]*)\]/g
const BRACED_KEY = /@\{([^}]+)\}/g
const PLAIN_KEY = /@([A-Za-z][A-Za-z0-9:_#.$/-]*)/g
const SUPPRESS_KEY = /-@([A-Za-z][A-Za-z0-9:_#.$/-]*)/g

function pushKey(
  key: string,
  line: number,
  citations: ExtractedCitation[],
  seen: Set<string>,
): void {
  const normalized = key.trim().replace(/[.,;:]+$/, '')
  if (normalized.length === 0) return
  const token = `${line}:${normalized}`
  if (seen.has(token)) return
  seen.add(token)
  citations.push({ key: normalized, line })
}

function pushKeysFromSegment(
  segment: string,
  line: number,
  citations: ExtractedCitation[],
  seen: Set<string>,
): void {
  const consumed: Array<{ start: number; end: number }> = []

  for (const match of segment.matchAll(BRACED_KEY)) {
    const key = match[1]
    if (!key) continue
    if (match.index !== undefined) {
      consumed.push({ start: match.index, end: match.index + match[0].length })
    }
    pushKey(key, line, citations, seen)
  }

  for (const match of segment.matchAll(PLAIN_KEY)) {
    if (match.index === undefined) continue
    if (consumed.some((range) => match.index! >= range.start && match.index! < range.end)) {
      continue
    }
    const key = match[1]
    if (key) {
      pushKey(key, line, citations, seen)
    }
  }
}

/** Extract Pandoc-style citation keys from Markdown (mirrors `crates/indexer/src/citations.rs`). */
export function extractPandocCitations(markdown: string): ExtractedCitation[] {
  const citations: ExtractedCitation[] = []
  const seen = new Set<string>()
  const lines = markdown.split(/\r?\n/)

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const lineNumber = index + 1

    for (const match of line.matchAll(BRACKET_BLOCK)) {
      const inner = match[1] ?? ''
      pushKeysFromSegment(inner, lineNumber, citations, seen)
    }

    const withoutBrackets = line.replace(BRACKET_BLOCK, ' ')

    for (const match of withoutBrackets.matchAll(SUPPRESS_KEY)) {
      const key = match[1]
      if (key) {
        pushKey(key, lineNumber, citations, seen)
      }
    }

    for (const match of withoutBrackets.matchAll(PLAIN_KEY)) {
      if (match.index === undefined) continue
      if (match.index > 0 && withoutBrackets[match.index - 1] === '-') {
        continue
      }
      const key = match[1]
      if (key) {
        pushKey(key, lineNumber, citations, seen)
      }
    }
  }

  return citations
}

export function extractPandocCitationKeys(markdown: string): string[] {
  const keys: string[] = []
  const seen = new Set<string>()
  for (const citation of extractPandocCitations(markdown)) {
    if (seen.has(citation.key)) continue
    seen.add(citation.key)
    keys.push(citation.key)
  }
  return keys
}
