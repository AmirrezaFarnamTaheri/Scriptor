/**
 * paletteScore.ts — single fuzzy scorer for the command palette (F-3, I-5).
 *
 * # Invariant I-5
 * There must be exactly ONE fuzzy-scoring implementation for the palette.
 * Do NOT implement alternative scoring in `buildPaletteCommands.ts`,
 * `CommandPalette.tsx`, or any plugin. Instead, extend this module.
 *
 * # Algorithm
 * 1. Exact prefix match → highest tier (score 1 000 000+)
 * 2. Contiguous substring match → high tier (score 100 000+)
 * 3. Initials match (first char of each word) → medium tier (50 000+)
 * 4. Subsequence (fuzzy) match → scored by match density
 * 5. Keyword bag fallback → scored by keyword overlap
 *
 * All comparison is normalised: lower-case, diacritics stripped.
 *
 * # Usage
 * ```ts
 * import { scoreCommand } from './paletteScore'
 *
 * const results = commands
 *   .map(cmd => ({ cmd, score: scoreCommand(query, cmd) }))
 *   .filter(({ score }) => score > 0)
 *   .sort((a, b) => b.score - a.score)
 *   .map(({ cmd }) => cmd)
 * ```
 */

export interface ScoredItem {
  /** Primary display label (used as the main match target). */
  label: string
  /** Optional supplemental keywords (e.g. aliases, category names). */
  keywords?: string[]
}

/**
 * Score `item` against a user `query`.
 *
 * Returns `0` when the item should be excluded from results.
 * Higher scores rank higher in the palette list.
 */
export function scoreCommand(query: string, item: ScoredItem): number {
  if (!query) {
    // Empty query → show all items with a neutral score.
    return 1
  }

  const q = normalise(query)
  const label = normalise(item.label)

  // Tier 1: exact prefix on the label.
  if (label.startsWith(q)) {
    return 1_000_000 + (100_000 - label.length)
  }

  // Tier 2: contiguous substring in the label.
  const subIdx = label.indexOf(q)
  if (subIdx !== -1) {
    // Prefer matches that start earlier and in shorter labels.
    return 100_000 + (1_000 - subIdx * 10) + (100 - label.length)
  }

  // Tier 3: initials match — first character of each word.
  if (initialsMatch(q, label)) {
    return 50_000
  }

  // Tier 4: fuzzy subsequence match on label.
  const fuzzyLabelScore = subsequenceScore(q, label)
  if (fuzzyLabelScore > 0) {
    return fuzzyLabelScore
  }

  // Tier 5: keyword bag fallback.
  if (item.keywords && item.keywords.length > 0) {
    const keywordScore = keywordBagScore(q, item.keywords)
    if (keywordScore > 0) {
      return keywordScore
    }
  }

  return 0
}

/**
 * Normalise a string for comparison:
 *  - lower-case
 *  - NFD → strip combining diacritical marks
 *  - collapse whitespace
 */
function normalise(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Returns true when every character in `query` is the first character of
 * a word in `label` (in order). E.g. "ov" matches "Open Vault".
 */
function initialsMatch(query: string, label: string): boolean {
  const words = label.split(/\s+/)
  const initials = words.map((w) => w[0] ?? '').join('')
  return subsequenceScore(query, initials) > 0
}

/**
 * Compute a fuzzy subsequence score.
 *
 * Checks that every character of `query` appears in `text` in order.
 * Score is proportional to how compactly the characters cluster together.
 * Returns `0` when there is no match.
 */
function subsequenceScore(query: string, text: string): number {
  if (query.length === 0) return 1
  if (query.length > text.length) return 0

  let qi = 0
  let firstMatchIndex = -1
  let lastMatchIndex = -1

  for (let ti = 0; ti < text.length && qi < query.length; ti++) {
    if (text[ti] === query[qi]) {
      if (firstMatchIndex === -1) firstMatchIndex = ti
      lastMatchIndex = ti
      qi++
    }
  }

  if (qi < query.length) {
    // Not all query characters were matched.
    return 0
  }

  // Score: reward tight clusters; penalise sparse matches and long texts.
  const span = lastMatchIndex - firstMatchIndex + 1
  const density = query.length / span
  const positionBonus = Math.max(0, 10 - firstMatchIndex)
  return Math.round(density * 10_000) + positionBonus
}

/**
 * Score `query` against a keyword bag.
 * Returns a positive score when at least one keyword contains the query as a
 * prefix or substring; `0` otherwise.
 */
function keywordBagScore(query: string, keywords: string[]): number {
  let best = 0
  for (const kw of keywords) {
    const k = normalise(kw)
    if (k.startsWith(query)) {
      best = Math.max(best, 20_000 + (1_000 - k.length))
    } else if (k.includes(query)) {
      best = Math.max(best, 10_000)
    } else {
      const s = subsequenceScore(query, k)
      if (s > 0) best = Math.max(best, Math.round(s * 0.5))
    }
  }
  return best
}

// ── Helpers exposed for testing ───────────────────────────────────────────────
/** @internal */
export const _internals = {
  normalise,
  initialsMatch,
  subsequenceScore,
  keywordBagScore,
}
