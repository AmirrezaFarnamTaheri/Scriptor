/**
 * useReadingList
 * --------------
 * Tag-based reading queue stored in note frontmatter.
 *
 * Feature 3.5 — Reading List Manager
 *
 * Maintains a list of `ReadingListEntry` items derived from indexed notes that
 * carry a `reading-status` frontmatter tag (`unread` | `reading` | `done`).
 * The hook provides filtering, status promotion, and estimated reading time.
 *
 * Usage:
 *  ```tsx
 *  const { entries, promote, demote, filterByStatus, totalMinutes } =
 *    useReadingList({ indexedNotes, updateNoteFrontmatter })
 *  ```
 *
 * The hook does NOT read the vault directly — the caller provides the list of
 * indexed notes and a save-frontmatter delegate to maintain decoupling.
 */

import { useState, useCallback, useMemo } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ReadingStatus = 'unread' | 'reading' | 'done'

export interface ReadingListNote {
  path: string
  title: string
  /** Word count of the note (from indexer). */
  wordCount?: number
  /** Current reading-status value from frontmatter, if set. */
  readingStatus?: ReadingStatus
}

export interface ReadingListEntry {
  path: string
  title: string
  status: ReadingStatus
  /** Estimated reading time in minutes (250 wpm). */
  estimatedMinutes: number
}

export interface ReadingListConfig {
  notes: ReadingListNote[]
  /** Called when the reading status of a note should be persisted. */
  updateStatus: (path: string, status: ReadingStatus) => Promise<void> | void
}

export interface ReadingListResult {
  /** All entries that have a reading status. */
  entries: ReadingListEntry[]
  /** Filter to a specific status. Returns all entries if undefined. */
  filterByStatus: (status?: ReadingStatus) => ReadingListEntry[]
  /** Advance status: unread → reading → done. No-op if already done. */
  promote: (path: string) => void
  /** Demote status: done → reading → unread. No-op if already unread. */
  demote: (path: string) => void
  /** Set an explicit status. */
  setStatus: (path: string, status: ReadingStatus) => void
  /** Total estimated minutes for filtered set. */
  totalMinutes: (status?: ReadingStatus) => number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_ORDER: ReadingStatus[] = ['unread', 'reading', 'done']
const WORDS_PER_MINUTE = 250

function estimateMinutes(wordCount?: number): number {
  return Math.max(1, Math.round((wordCount ?? 200) / WORDS_PER_MINUTE))
}

function buildEntries(notes: ReadingListNote[]): ReadingListEntry[] {
  return notes
    .filter((n) => n.readingStatus !== undefined)
    .map((n) => ({
      path: n.path,
      title: n.title,
      status: n.readingStatus as ReadingStatus,
      estimatedMinutes: estimateMinutes(n.wordCount),
    }))
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useReadingList({ notes, updateStatus }: ReadingListConfig): ReadingListResult {
  const [overrides, setOverrides] = useState<Record<string, ReadingStatus>>({})

  const entries = useMemo<ReadingListEntry[]>(() => {
    return buildEntries(notes).map((e) => ({
      ...e,
      status: overrides[e.path] ?? e.status,
    }))
  }, [notes, overrides])

  const applyStatus = useCallback(
    (path: string, status: ReadingStatus) => {
      setOverrides((prev) => ({ ...prev, [path]: status }))
      void updateStatus(path, status)
    },
    [updateStatus],
  )

  const promote = useCallback(
    (path: string) => {
      const current = entries.find((e) => e.path === path)?.status ?? 'unread'
      const idx = STATUS_ORDER.indexOf(current)
      if (idx < STATUS_ORDER.length - 1) {
        applyStatus(path, STATUS_ORDER[idx + 1])
      }
    },
    [entries, applyStatus],
  )

  const demote = useCallback(
    (path: string) => {
      const current = entries.find((e) => e.path === path)?.status ?? 'done'
      const idx = STATUS_ORDER.indexOf(current)
      if (idx > 0) {
        applyStatus(path, STATUS_ORDER[idx - 1])
      }
    },
    [entries, applyStatus],
  )

  const setStatus = useCallback(
    (path: string, status: ReadingStatus) => applyStatus(path, status),
    [applyStatus],
  )

  const filterByStatus = useCallback(
    (status?: ReadingStatus) =>
      status ? entries.filter((e) => e.status === status) : entries,
    [entries],
  )

  const totalMinutes = useCallback(
    (status?: ReadingStatus) =>
      filterByStatus(status).reduce((sum, e) => sum + e.estimatedMinutes, 0),
    [filterByStatus],
  )

  return { entries, filterByStatus, promote, demote, setStatus, totalMinutes }
}
