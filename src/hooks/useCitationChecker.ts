/**
 * useCitationChecker
 * -------------------
 * Scans all `[@key]` / `@key` Pandoc-style citation references in the active
 * note and reports which keys are missing from the loaded bibliography.
 *
 * - `missingKeys`  — cited in text but absent from bibliography
 * - `unusedKeys`   — defined in bibliography but never cited in this note
 * - `validKeys`    — cited and present in bibliography
 *
 * This is purely a frontend computation; no bridge calls are made.
 */

import { useMemo } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CitationCheckResult {
  /** Keys cited in the note that are not in the bibliography. */
  missingKeys: string[]
  /** Keys in the bibliography that are never cited in the note. */
  unusedKeys: string[]
  /** Keys cited and resolved in the bibliography. */
  validKeys: string[]
}

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

/**
 * Extract all citation keys from Markdown content.
 * Matches:
 *  - `[@key]`         — Pandoc default
 *  - `[@key1; @key2]` — multiple in one bracket
 *  - `@key`           — bare citation (optional)
 */
function extractCitedKeys(content: string): Set<string> {
  const keys = new Set<string>()
  // Bracket citations: [@key] or [@key1; @key2; -@key3]
  for (const m of content.matchAll(/\[([^\]]+)\]/g)) {
    const inner = m[1] ?? ''
    if (!inner.includes('@')) continue
    for (const part of inner.split(';')) {
      const km = part.trim().match(/^-?@([\w:-]+)/)
      if (km?.[1]) keys.add(km[1])
    }
  }
  // Bare @citations outside brackets
  for (const m of content.matchAll(/(?<![[\w])@([\w:-]+)/g)) {
    if (m[1]) keys.add(m[1])
  }
  return keys
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Check citation completeness for the active note.
 *
 * @param content          Raw Markdown content of the active note.
 * @param bibliographyKeys All keys loaded from the vault bibliography (BibTeX/CSL).
 */
export function useCitationChecker(
  content: string,
  bibliographyKeys: readonly string[],
): CitationCheckResult {
  return useMemo(() => {
    const cited = extractCitedKeys(content)
    const bibSet = new Set(bibliographyKeys)

    const missingKeys: string[] = []
    const validKeys: string[] = []

    for (const key of cited) {
      if (bibSet.has(key)) {
        validKeys.push(key)
      } else {
        missingKeys.push(key)
      }
    }

    const unusedKeys = bibliographyKeys.filter((k) => !cited.has(k))

    return {
      missingKeys: missingKeys.sort(),
      unusedKeys: unusedKeys.sort(),
      validKeys: validKeys.sort(),
    }
  }, [content, bibliographyKeys])
}
