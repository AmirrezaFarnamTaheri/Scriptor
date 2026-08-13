/**
 * useConflictStore
 *
 * Manages state for the conflict resolver modal, previously scattered across
 * three separate overlay state values:
 *
 *   conflictPath   — the vault-relative path of the note with a conflict
 *   conflictSource — the raw conflicting content (from the remote/disk)
 *   conflictBase   — optional base (common ancestor) for 3-way preview
 *
 * Design notes:
 * - `openConflict` is atomic: sets all three fields at once, preventing
 *   renders where path is set but source is still empty.
 * - `closeConflict` resets all three fields together.
 * - The modal can derive its open state from `conflictPath !== null`.
 */
import { useCallback, useState } from 'react'

export interface ConflictPayload {
  path: string
  /** Raw conflicting content from the remote or disk side */
  source: string
  /** Optional common ancestor for 3-way diff preview */
  basePreview?: string | null
}

interface ConflictState {
  conflictPath: string | null
  conflictSource: string
  conflictBasePreview: string | null
}

function makeInitialState(): ConflictState {
  return {
    conflictPath: null,
    conflictSource: '',
    conflictBasePreview: null,
  }
}

export function useConflictStore() {
  const [state, setState] = useState<ConflictState>(makeInitialState)

  /** Open the conflict resolver for a specific note. */
  const openConflict = useCallback((payload: ConflictPayload) => {
    setState({
      conflictPath: payload.path,
      conflictSource: payload.source,
      conflictBasePreview: payload.basePreview ?? null,
    })
  }, [])

  /** Close the conflict resolver and reset all state. */
  const closeConflict = useCallback(() => {
    setState(makeInitialState)
  }, [])

  return {
    conflictPath: state.conflictPath,
    conflictSource: state.conflictSource,
    conflictBasePreview: state.conflictBasePreview,
    /** Derived: true when a conflict is active */
    conflictActive: state.conflictPath !== null,
    openConflict,
    closeConflict,
  }
}
