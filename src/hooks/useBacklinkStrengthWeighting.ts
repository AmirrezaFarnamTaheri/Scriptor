/**
 * useBacklinkStrengthWeighting
 * -----------------------------
 * Feature 2.7 — Weight backlinks by connection strength.
 *
 * Scores each backlink to the focus note on three axes:
 *
 *  1. **Frequency**  — how many times the focus note is linked in the source note
 *  2. **Recency**    — notes modified more recently score higher (exponential decay)
 *  3. **Context**    — link appears in body (1.0) vs frontmatter ref (0.5) vs
 *                      a list-item bullet (0.8) vs heading (1.2)
 *
 * Final score = frequency_weight × recency_weight × context_weight
 * Normalised to [0, 1] across the returned set.
 *
 * Usage:
 *  ```tsx
 *  const { scored, loading, refresh } = useBacklinkStrengthWeighting({
 *    focusPath: activeNote,
 *    rawBacklinks,
 *  })
 *  ```
 */

import { useState, useEffect, useCallback, useMemo } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Raw backlink shape from indexer_backlinks Tauri command. */
export interface RawBacklinkHit {
  path: string
  title: string
  /** Snippet of text surrounding the link mention */
  snippet?: string
  /** Number of times focus note is linked in this source */
  link_count?: number
  /** ISO-8601 modified timestamp of the source note */
  modified_at?: string
  /** Context kind: 'body' | 'frontmatter' | 'list' | 'heading' */
  context_kind?: string
}

export interface ScoredBacklink extends RawBacklinkHit {
  /** Raw composite score (not normalised). */
  rawScore: number
  /** Normalised score in [0, 1]. */
  score: number
  /** 0–100 integer "strength" for display. */
  strength: number
  /** Badge label: 'strong' ≥70, 'moderate' ≥40, 'weak' <40. */
  strengthLabel: 'strong' | 'moderate' | 'weak'
}

export interface BacklinkStrengthWeightingOptions {
  /** Path of the note whose backlinks are being scored. */
  focusPath: string | null
  /** Raw backlinks from the indexer. */
  rawBacklinks: RawBacklinkHit[]
  /**
   * Half-life in days for the recency decay function.
   * A note modified `halfLifeDays` ago scores 0.5 for recency.
   * Default: 30.
   */
  halfLifeDays?: number
  /** Sort order for the result. Default: 'score-desc'. */
  sortOrder?: 'score-desc' | 'score-asc' | 'alpha' | 'recent'
}

export interface BacklinkStrengthWeightingResult {
  /** Scored and sorted backlinks. */
  scored: ScoredBacklink[]
  loading: boolean
  /** Re-score with current rawBacklinks (call after a refresh). */
  refresh: () => void
}

// ---------------------------------------------------------------------------
// Scoring helpers
// ---------------------------------------------------------------------------

const CONTEXT_WEIGHTS: Record<string, number> = {
  heading: 1.2,
  body: 1.0,
  list: 0.8,
  frontmatter: 0.5,
}

function contextWeight(kind?: string): number {
  return CONTEXT_WEIGHTS[kind ?? 'body'] ?? 1.0
}

/**
 * Exponential decay: score = 2^(-daysSince / halfLife)
 * Returns 1.0 for brand-new notes, approaches 0 for very old ones.
 */
function recencyWeight(modifiedAt?: string, halfLifeDays = 30): number {
  if (!modifiedAt) return 0.5 // unknown → neutral
  const ageMs = Date.now() - new Date(modifiedAt).getTime()
  const ageDays = ageMs / 86_400_000
  return Math.pow(2, -ageDays / halfLifeDays)
}

function frequencyWeight(linkCount?: number): number {
  const count = linkCount ?? 1
  // Logarithmic so 1→1.0, 2→1.5, 4→2.0, 10→2.8 …
  return Math.max(1, 1 + Math.log2(count))
}

function scoreBacklink(bl: RawBacklinkHit, halfLifeDays: number): number {
  const f = frequencyWeight(bl.link_count)
  const r = recencyWeight(bl.modified_at, halfLifeDays)
  const c = contextWeight(bl.context_kind)
  return f * r * c
}

function normalise(items: Array<{ rawScore: number }>): number[] {
  const max = items.reduce((m, i) => Math.max(m, i.rawScore), 0)
  if (max === 0) return items.map(() => 0)
  return items.map((i) => i.rawScore / max)
}

function toLabel(strength: number): 'strong' | 'moderate' | 'weak' {
  if (strength >= 70) return 'strong'
  if (strength >= 40) return 'moderate'
  return 'weak'
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useBacklinkStrengthWeighting({
  focusPath,
  rawBacklinks,
  halfLifeDays = 30,
  sortOrder = 'score-desc',
}: BacklinkStrengthWeightingOptions): BacklinkStrengthWeightingResult {
  const [revision, setRevision] = useState(0)
  const [loading, setLoading] = useState(false)

  // Trigger whenever rawBacklinks reference changes or revision bumped
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- brief loading flag cleared next frame
    setLoading(true)
    // Scoring is synchronous but guard against stale renders
    const t = requestAnimationFrame(() => setLoading(false))
    return () => cancelAnimationFrame(t)
  }, [rawBacklinks, revision, focusPath])

  const scored = useMemo<ScoredBacklink[]>(() => {
    if (!focusPath || rawBacklinks.length === 0) return []

    // Compute raw scores
    const withRaw = rawBacklinks.map((bl) => ({
      ...bl,
      rawScore: scoreBacklink(bl, halfLifeDays),
    }))

    // Normalise
    const norms = normalise(withRaw)

    const result: ScoredBacklink[] = withRaw.map((bl, i) => {
      const score = norms[i]
      const strength = Math.round(score * 100)
      return {
        ...bl,
        score,
        strength,
        strengthLabel: toLabel(strength),
      }
    })

    // Sort
    switch (sortOrder) {
      case 'score-asc':
        return result.sort((a, b) => a.score - b.score)
      case 'alpha':
        return result.sort((a, b) => (a.title ?? a.path).localeCompare(b.title ?? b.path))
      case 'recent':
        return result.sort((a, b) => {
          const ta = a.modified_at ? new Date(a.modified_at).getTime() : 0
          const tb = b.modified_at ? new Date(b.modified_at).getTime() : 0
          return tb - ta
        })
      case 'score-desc':
      default:
        return result.sort((a, b) => b.score - a.score)
    }
  }, [focusPath, rawBacklinks, halfLifeDays, sortOrder, revision]) // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(() => setRevision((r) => r + 1), [])

  return { scored, loading, refresh }
}
