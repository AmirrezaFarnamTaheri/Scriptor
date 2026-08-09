/**
 * useSearchEverywhereEntries
 * --------------------------
 * Extends the Command Palette with vault-wide "Search Everywhere" results:
 * notes, headings extracted from snippets, and GFM task items.
 *
 * Returns a `searchEverywhere` function compatible with `CommandPalette.searchNotes`
 * prop, plus typed entry arrays for richer rendering.
 *
 * The caller wires `searchEverywhere` into `CommandPalette.searchNotes`. The
 * palette already handles note grouping; this hook normalises headings and
 * tasks into the same `{ path, title }` shape with a prefix badge so the
 * palette can display them without changes.
 *
 * Entry prefixes (injected into `title` for the palette default renderer):
 *  - Notes:    no prefix (existing behaviour)
 *  - Headings: "# " prefix
 *  - Tasks:    "☐ " prefix (open) or "☑ " prefix (checked)
 */

import { useCallback } from 'react'
import { indexerSearch } from '../bridge/commands/indexer'

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const HEADING_RE = /^#{1,6}\s+(.+)/m
const TASK_OPEN_RE = /^- \[ \]\s+(.+)/m
const TASK_DONE_RE = /^- \[x\]\s+(.+)/im

/**
 * Extract heading text from a search snippet if present.
 * Returns null if the snippet doesn't contain a heading.
 */
function extractHeading(snippet: string): string | null {
  const m = snippet.match(HEADING_RE)
  return m ? m[1].trim() : null
}

/**
 * Extract task text from a search snippet if present.
 * Returns { text, done } or null.
 */
function extractTask(snippet: string): { text: string; done: boolean } | null {
  const done = snippet.match(TASK_DONE_RE)
  if (done) return { text: done[1].trim(), done: true }
  const open = snippet.match(TASK_OPEN_RE)
  if (open) return { text: open[1].trim(), done: false }
  return null
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface SearchEverywhereEntry {
  kind: 'note' | 'heading' | 'task'
  path: string
  /** The note title. */
  noteTitle: string
  /** Display title for this specific entry. */
  displayTitle: string
  done?: boolean
}

export interface SearchEverywhereHook {
  /**
   * Typed entries from the last search — useful for custom palette renderers.
   * Updated asynchronously on each search call.
   */
  entries: SearchEverywhereEntry[]
  /**
   * Compatible with `CommandPalette.searchNotes` prop.
   * Returns all entries as `{ path, title }` with type-prefix badges.
   */
  searchEverywhere: (query: string) => Promise<Array<{ path: string; title: string }>>
}

/**
 * @param onEntries  Optional callback receiving typed entries after each search.
 * @param limit      Max indexer results per search. Default 30.
 */
export function useSearchEverywhereEntries(
  onEntries?: (entries: SearchEverywhereEntry[]) => void,
  limit = 30,
): SearchEverywhereHook {
  // We keep entries in a mutable ref rather than state to avoid re-renders
  // inside the async callback — the palette manages its own display state.
  const entriesRef: SearchEverywhereEntry[] = []

  const searchEverywhere = useCallback(
    async (query: string): Promise<Array<{ path: string; title: string }>> => {
      const hits = await indexerSearch(query, limit).catch(() => [])
      const typed: SearchEverywhereEntry[] = []

      for (const hit of hits) {
        // Always include the note itself
        typed.push({ kind: 'note', path: hit.path, noteTitle: hit.title, displayTitle: hit.title })

        // Supplement with heading if snippet contains one
        const heading = extractHeading(hit.snippet)
        if (heading && heading !== hit.title) {
          typed.push({
            kind: 'heading',
            path: hit.path,
            noteTitle: hit.title,
            displayTitle: `# ${heading}`,
          })
        }

        // Supplement with task if snippet contains one
        const task = extractTask(hit.snippet)
        if (task) {
          typed.push({
            kind: 'task',
            path: hit.path,
            noteTitle: hit.title,
            displayTitle: task.done ? `☑ ${task.text}` : `☐ ${task.text}`,
            done: task.done,
          })
        }
      }

      // Update ref and notify caller
      entriesRef.splice(0, entriesRef.length, ...typed)
      onEntries?.(typed)

      // Return in the shape expected by CommandPalette.searchNotes
      return typed.map((e) => ({ path: e.path, title: e.displayTitle }))
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [limit, onEntries],
  )

  return { entries: entriesRef, searchEverywhere }
}
