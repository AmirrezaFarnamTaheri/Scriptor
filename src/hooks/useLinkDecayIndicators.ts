/**
 * useLinkDecayIndicators
 * -----------------------
 * Identifies "orphan hub" notes — notes that have many inbound links
 * but have not been edited in N days. These are high-traffic but potentially
 * stale notes that may need attention.
 *
 * Algorithm:
 *  1. Fetch all notes from the indexer summary.
 *  2. Count inbound backlinks for each note via the existing graph data
 *     (or approximate via the search index).
 *  3. Filter to notes whose `modified_at` is older than `staleDays` and whose
 *     backlink count exceeds `minBacklinks`.
 *
 * Returns are sorted by backlink count descending (most-linked stale notes first).
 */

import { useState, useEffect, useCallback } from 'react'
import { indexerListNoteSummaries, indexerBacklinks } from '../bridge/commands/indexer'
import type { NoteIndexSummary } from '../types/vault'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DecayIndicator {
  path: string
  title: string
  /** Days since last modification (rounded down). */
  daysSinceModified: number
  /** Number of notes that link to this note. */
  backlinkCount: number
  modified_at: string
}

export type DecayStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface DecayIndicatorsResult {
  status: DecayStatus
  indicators: DecayIndicator[]
  error?: string
  refresh: () => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysSince(isoDate: string): number {
  const ms = Date.now() - new Date(isoDate).getTime()
  return Math.floor(ms / (1000 * 60 * 60 * 24))
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface DecayIndicatorConfig {
  /** Notes older than this many days are considered stale. Default: 30 */
  staleDays?: number
  /** Minimum inbound backlink count to be surfaced. Default: 2 */
  minBacklinks?: number
  /** Max results to return. Default: 20 */
  limit?: number
  /** Whether to auto-fetch on mount. Default: true */
  enabled?: boolean
}

export function useLinkDecayIndicators(config: DecayIndicatorConfig = {}): DecayIndicatorsResult {
  const { staleDays = 30, minBacklinks = 2, limit = 20, enabled = true } = config
  const [status, setStatus] = useState<DecayStatus>('idle')
  const [indicators, setIndicators] = useState<DecayIndicator[]>([])
  const [error, setError] = useState<string | undefined>()
  const [trigger, setTrigger] = useState(0)

  const refresh = useCallback(() => setTrigger((n) => n + 1), [])

  useEffect(() => {
    if (!enabled) return

    let cancelled = false

    ;(async () => {
      setStatus('loading')
      try {
        const notes: NoteIndexSummary[] = await indexerListNoteSummaries()

        // Pre-filter by staleness (cheap) before fetching backlinks
        const staleNotes = notes.filter(
          (n) => !n.archived && daysSince(n.modified_at) >= staleDays,
        )

        // Fetch backlink counts in batches of 10 (keep bridge call count bounded)
        const results: DecayIndicator[] = []
        const batchSize = 10
        for (let i = 0; i < staleNotes.length; i += batchSize) {
          if (cancelled) return
          const batch = staleNotes.slice(i, i + batchSize)
          await Promise.all(
            batch.map(async (note) => {
              try {
                const backlinks = await indexerBacklinks(note.path)
                const backlinkCount = backlinks.length
                if (backlinkCount >= minBacklinks) {
                  results.push({
                    path: note.path,
                    title: note.title,
                    daysSinceModified: daysSince(note.modified_at),
                    backlinkCount,
                    modified_at: note.modified_at,
                  })
                }
              } catch {
                // Skip notes that fail backlink lookup
              }
            }),
          )
          if (results.length >= limit * 2) break // early exit if we have enough candidates
        }

        if (cancelled) return

        const sorted = results
          .sort((a, b) => b.backlinkCount - a.backlinkCount)
          .slice(0, limit)

        setIndicators(sorted)
        // Clear any error from a previous attempt, so a recovered refresh does
        // not leave a stale message rendered next to a 'ready' status.
        setError(undefined)
        setStatus('ready')
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Failed to compute decay indicators.')
        setStatus('error')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [staleDays, minBacklinks, limit, enabled, trigger])

  return { status, indicators, error, refresh }
}
