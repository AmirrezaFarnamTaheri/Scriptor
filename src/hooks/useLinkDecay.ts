/**
 * useLinkDecay
 * -------------
 * Feature 2.3 — Link Decay Indicators.
 *
 * Detects "stale" wikilinks based on when the *target* note was last modified.
 * Links to notes that haven't been updated in a long time are considered
 * "decayed" — potentially outdated references that deserve review.
 *
 * Data source:
 *  - Uses the indexer SQLite cache (via Tauri IPC) to get `modified_at` for
 *    each linked-to note path.
 *  - Falls back to an in-memory map when offline / in browser dev mode.
 *
 * Decay tiers (configurable via `thresholds`):
 *  - 'fresh'   < 30 days since target was modified
 *  - 'aging'   30–90 days
 *  - 'stale'   90–180 days
 *  - 'decayed' > 180 days
 *
 * Usage:
 *  ```tsx
 *  const { linkDecay, decayForPath, refresh, loading } =
 *    useLinkDecay({ links: outboundLinks, thresholds })
 *  ```
 */

import { useState, useEffect, useCallback, useMemo } from 'react'

import { indexerBatchNoteMeta } from '../bridge/commands/indexer.ts'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DecayTier = 'fresh' | 'aging' | 'stale' | 'decayed' | 'unknown'

export interface DecayThresholds {
  /** Days since last modification for 'aging'. Default: 30. */
  aging: number
  /** Days since last modification for 'stale'. Default: 90. */
  stale: number
  /** Days since last modification for 'decayed'. Default: 180. */
  decayed: number
}

export const DEFAULT_DECAY_THRESHOLDS: DecayThresholds = {
  aging: 30,
  stale: 90,
  decayed: 180,
}

export interface LinkDecayEntry {
  /** Vault-relative target path. */
  path: string
  /** Display title of the target note. */
  title: string | null
  /** ISO-8601 string of target's last modification. */
  modifiedAt: string | null
  /** Age in days since last modification. null if unknown. */
  ageDays: number | null
  tier: DecayTier
  /** True when the target path does not exist in the vault. */
  broken: boolean
}

export interface LinkDecayOptions {
  /** Outbound wikilink target paths from the active note. */
  links: string[]
  thresholds?: Partial<DecayThresholds>
  /** Opt-in to auto-refresh on focus. Default: true. */
  refreshOnFocus?: boolean
}

export interface LinkDecayResult {
  /** Decay info keyed by vault-relative target path. */
  linkDecay: Map<string, LinkDecayEntry>
  /** Convenience lookup — returns 'unknown' for paths not yet loaded. */
  decayForPath: (path: string) => LinkDecayEntry | null
  /** Counts per tier across all outbound links. */
  summary: Record<DecayTier, number>
  loading: boolean
  refresh: () => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeTier(ageDays: number | null, t: DecayThresholds): DecayTier {
  if (ageDays === null) return 'unknown'
  if (ageDays < t.aging) return 'fresh'
  if (ageDays < t.stale) return 'aging'
  if (ageDays < t.decayed) return 'stale'
  return 'decayed'
}

function ageDays(iso: string | null): number | null {
  if (!iso) return null
  const ms = Date.now() - new Date(iso).getTime()
  return ms / 86_400_000
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useLinkDecay({
  links,
  thresholds: thresholdOverrides,
  refreshOnFocus = true,
}: LinkDecayOptions): LinkDecayResult {
  const thresholds: DecayThresholds = { ...DEFAULT_DECAY_THRESHOLDS, ...thresholdOverrides }

  const [decayMap, setDecayMap] = useState<Map<string, LinkDecayEntry>>(new Map())
  const [loading, setLoading] = useState(false)

  const fetchDecay = useCallback(async () => {
    if (links.length === 0) {
      setDecayMap(new Map())
      return
    }
    setLoading(true)
    try {
      // Batch fetch note metadata from indexer
      const results = await indexerBatchNoteMeta(links)

      const next = new Map<string, LinkDecayEntry>()
      for (const r of results) {
        const days = ageDays(r.modified_at)
        next.set(r.path, {
          path: r.path,
          title: r.title,
          modifiedAt: r.modified_at,
          ageDays: days,
          tier: r.exists ? computeTier(days, thresholds) : 'unknown',
          broken: !r.exists,
        })
      }
      setDecayMap(next)
    } catch {
      // In browser / non-native mode: create unknown entries for all links
      const fallback = new Map<string, LinkDecayEntry>()
      for (const path of links) {
        fallback.set(path, {
          path,
          title: null,
          modifiedAt: null,
          ageDays: null,
          tier: 'unknown',
          broken: false,
        })
      }
      setDecayMap(fallback)
    } finally {
      setLoading(false)
    }
  }, [links, thresholds.aging, thresholds.stale, thresholds.decayed]) // eslint-disable-line react-hooks/exhaustive-deps

  // Initial fetch + when links change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async loader sets loading before first await
    void fetchDecay()
  }, [fetchDecay])

  // Refresh on window focus
  useEffect(() => {
    if (!refreshOnFocus) return
    const handler = () => void fetchDecay()
    window.addEventListener('focus', handler)
    return () => window.removeEventListener('focus', handler)
  }, [fetchDecay, refreshOnFocus])

  const decayForPath = useCallback(
    (path: string): LinkDecayEntry | null => decayMap.get(path) ?? null,
    [decayMap],
  )

  const summary = useMemo<Record<DecayTier, number>>(() => {
    const counts: Record<DecayTier, number> = {
      fresh: 0, aging: 0, stale: 0, decayed: 0, unknown: 0,
    }
    for (const entry of decayMap.values()) {
      counts[entry.tier]++
    }
    return counts
  }, [decayMap])

  return { linkDecay: decayMap, decayForPath, summary, loading, refresh: fetchDecay }
}
