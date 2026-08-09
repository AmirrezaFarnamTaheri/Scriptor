/**
 * useNoteRelationshipMatrix
 * -------------------------
 * Feature 2.8 — Note Relationship Matrix
 *
 * Computes a symmetric co-occurrence matrix between notes based on shared
 * tags, shared backlink targets, and bidirectional wikilink connections.
 * Each cell `matrix[A][B]` holds a `RelationshipScore` with weighted
 * sub-scores and a combined total.
 *
 * The matrix is pure-frontend: it operates on data already loaded from the
 * indexer (backlinks, tags, graph edges) without additional bridge calls.
 *
 * Usage:
 *  ```tsx
 *  const { matrix, topRelated, computeMatrix } = useNoteRelationshipMatrix()
 *
 *  // Feed data:
 *  computeMatrix({ notes, backlinkMap, tagMap })
 *
 *  // Query:
 *  const related = topRelated('path/to/note.md', 5)
 *  ```
 */

import { useState, useCallback } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RelationshipScore {
  /** Notes share at least one tag. */
  sharedTags: number
  /** A links to B or B links to A. */
  linkConnection: number
  /** A and B are both linked from/to a common third note. */
  coReference: number
  /** Weighted sum: tags×1 + link×3 + coref×2 */
  total: number
}

export interface MatrixInput {
  /** All note paths to include. */
  notePaths: string[]
  /** Map of path → tag list. */
  tagMap: Map<string, string[]>
  /** Map of path → array of outgoing link targets (resolved paths). */
  outLinksMap: Map<string, string[]>
}

export type RelationshipMatrix = Map<string, Map<string, RelationshipScore>>

export interface NoteRelationshipMatrixResult {
  matrix: RelationshipMatrix
  /** Returns the N most-related notes to `path`, sorted by total desc. */
  topRelated: (path: string, n?: number) => Array<{ path: string; score: RelationshipScore }>
  computeMatrix: (input: MatrixInput) => void
  isPending: boolean
}

// ---------------------------------------------------------------------------
// Score weights
// ---------------------------------------------------------------------------

const W_TAG = 1
const W_LINK = 3
const W_COREF = 2

function weightedTotal(s: Omit<RelationshipScore, 'total'>): number {
  return s.sharedTags * W_TAG + s.linkConnection * W_LINK + s.coReference * W_COREF
}

// ---------------------------------------------------------------------------
// Matrix computation (synchronous — runs in one tick for <500 notes)
// ---------------------------------------------------------------------------

function computeRelationshipMatrix(input: MatrixInput): RelationshipMatrix {
  const { notePaths, tagMap, outLinksMap } = input
  const matrix: RelationshipMatrix = new Map()

  // Build reverse link index: target → set of sources
  const inLinksMap = new Map<string, Set<string>>()
  for (const [src, targets] of outLinksMap) {
    for (const tgt of targets) {
      if (!inLinksMap.has(tgt)) inLinksMap.set(tgt, new Set())
      inLinksMap.get(tgt)!.add(src)
    }
  }

  for (let i = 0; i < notePaths.length; i++) {
    const a = notePaths[i]
    const tagsA = new Set(tagMap.get(a) ?? [])
    const outA = new Set(outLinksMap.get(a) ?? [])
    const inA = inLinksMap.get(a) ?? new Set()

    for (let j = i + 1; j < notePaths.length; j++) {
      const b = notePaths[j]
      const tagsB = tagMap.get(b) ?? []
      const outB = new Set(outLinksMap.get(b) ?? [])
      const inB = inLinksMap.get(b) ?? new Set()

      // Shared tags
      const sharedTags = tagsB.filter((t) => tagsA.has(t)).length

      // Directional link (A→B or B→A)
      const linked = (outA.has(b) ? 1 : 0) + (outB.has(a) ? 1 : 0)

      // Co-reference: both a and b link to the same third note
      let coRef = 0
      for (const t of outA) {
        if (t !== a && t !== b && outB.has(t)) coRef++
      }
      // Also: both a and b are linked to by the same third note
      for (const src of inA) {
        if (src !== a && src !== b && inB.has(src)) coRef++
      }

      const score: RelationshipScore = {
        sharedTags,
        linkConnection: linked,
        coReference: Math.min(coRef, 10), // cap to avoid runaway scores
        get total() {
          return weightedTotal(this)
        },
      }

      // Symmetric: store both directions
      if (!matrix.has(a)) matrix.set(a, new Map())
      if (!matrix.has(b)) matrix.set(b, new Map())
      matrix.get(a)!.set(b, score)
      matrix.get(b)!.set(a, score)
    }
  }

  return matrix
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useNoteRelationshipMatrix(): NoteRelationshipMatrixResult {
  const [matrix, setMatrix] = useState<RelationshipMatrix>(new Map())
  const [isPending, setIsPending] = useState(false)

  const computeMatrix = useCallback((input: MatrixInput) => {
    setIsPending(true)
    // Defer to next tick to avoid blocking render
    setTimeout(() => {
      const result = computeRelationshipMatrix(input)
      setMatrix(result)
      setIsPending(false)
    }, 0)
  }, [])

  const topRelated = useCallback(
    (path: string, n = 10) => {
      const row = matrix.get(path)
      if (!row) return []
      return [...row.entries()]
        .map(([p, score]) => ({ path: p, score }))
        .filter((e) => e.score.total > 0)
        .sort((a, b) => b.score.total - a.score.total)
        .slice(0, n)
    },
    [matrix],
  )

  return { matrix, topRelated, computeMatrix, isPending }
}
