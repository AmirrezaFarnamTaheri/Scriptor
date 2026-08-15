/**
 * prose-mining
 * ------------
 * CodeMirror-free text mining helpers shared by `prose-autosuggest.ts` (which is
 * CodeMirror-coupled) and by app code that only needs corpus building.
 *
 * Keeping these here means importing `buildVaultCorpus` does not drag the whole
 * CodeMirror runtime into the caller's chunk.
 */

/**
 * Strip code blocks, frontmatter, wikilinks, URLs, and citation markers so we
 * don't mine "garbage" tokens.
 */
export function sanitizeForMining(text: string): string {
  return text
    .replace(/^---[\s\S]*?---\n?/m, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]+`/g, ' ')
    .replace(/\[\[[^\]]*\]\]/g, ' ')
    .replace(/\[@[^\]]*\]/g, ' ')
    .replace(/#[\w/-]+/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
}

/** Extract unique lowercased words from text (>= minLen chars, alpha-only). */
export function extractWords(text: string, minLen = 4): string[] {
  const words = new Set<string>()
  for (const m of sanitizeForMining(text).matchAll(/\b([A-Za-z][a-z]{2,})\b/g)) {
    const w = m[1]?.toLowerCase() ?? ''
    if (w.length >= minLen) words.add(w)
  }
  return Array.from(words)
}

/** Extract up to `limit` bigrams (2-word phrases) from the current doc. */
export function extractBigrams(text: string, limit: number): string[] {
  const sanitized = sanitizeForMining(text)
  const tokens = sanitized.match(/\b[A-Za-z][a-z]{2,}\b/g) ?? []
  const freqMap = new Map<string, number>()
  for (let i = 0; i < tokens.length - 1; i++) {
    const bigram = `${tokens[i]?.toLowerCase()} ${tokens[i + 1]?.toLowerCase()}`
    freqMap.set(bigram, (freqMap.get(bigram) ?? 0) + 1)
  }
  return Array.from(freqMap.entries())
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([bigram]) => bigram)
}

/**
 * Build a vault-wide autosuggest corpus.
 *
 * @param contents  Array of raw Markdown strings from vault notes.
 * @param limit     Max terms to return (sorted by cross-document frequency).
 */
export function buildVaultCorpus(contents: string[], limit = 500): string[] {
  const freq = new Map<string, number>()
  for (const text of contents) {
    for (const word of extractWords(text)) {
      freq.set(word, (freq.get(word) ?? 0) + 1)
    }
  }
  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word]) => word)
}
