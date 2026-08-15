/**
 * useRenameDialogStore
 *
 * Manages state for all rename-related dialogs that were previously coupled
 * into the app shell:
 *
 * - Note rename (path + boolean flag)
 * - Tag rename (tag string)
 * - Section rename (path + label)
 * - Block rename (path + label)
 *
 * Design notes:
 * - Each dialog has its own open/close pair so callers are explicit.
 * - `RenameTarget` (path + label) is the shared DTO for both section and block
 *   renames, matching the app shell contract.
 * - The note rename only needs a path; the dialog resolves the display label.
 */
import { useCallback, useState } from 'react'

export interface RenameTarget {
  path: string
  label: string
}

interface RenameDialogState {
  /** Note rename dialog */
  noteRenameOpen: boolean
  noteRenamePath: string | null
  /** Tag rename dialog */
  tagRenameTag: string | null
  /** Section rename dialog */
  sectionRenameTarget: RenameTarget | null
  /** Block rename dialog */
  blockRenameTarget: RenameTarget | null
}

function makeInitialState(): RenameDialogState {
  return {
    noteRenameOpen: false,
    noteRenamePath: null,
    tagRenameTag: null,
    sectionRenameTarget: null,
    blockRenameTarget: null,
  }
}

export function useRenameDialogStore() {
  const [state, setState] = useState<RenameDialogState>(makeInitialState)

  // ── Note rename ──────────────────────────────────────────────────────────

  const openNoteRename = useCallback((path: string) => {
    setState((prev) => ({ ...prev, noteRenameOpen: true, noteRenamePath: path }))
  }, [])

  const closeNoteRename = useCallback(() => {
    setState((prev) => ({ ...prev, noteRenameOpen: false, noteRenamePath: null }))
  }, [])

  // ── Tag rename ───────────────────────────────────────────────────────────

  const openTagRename = useCallback((tag: string) => {
    setState((prev) => ({ ...prev, tagRenameTag: tag }))
  }, [])

  const closeTagRename = useCallback(() => {
    setState((prev) => ({ ...prev, tagRenameTag: null }))
  }, [])

  // ── Section rename ───────────────────────────────────────────────────────

  const openSectionRename = useCallback((target: RenameTarget) => {
    setState((prev) => ({ ...prev, sectionRenameTarget: target }))
  }, [])

  const closeSectionRename = useCallback(() => {
    setState((prev) => ({ ...prev, sectionRenameTarget: null }))
  }, [])

  // ── Block rename ─────────────────────────────────────────────────────────

  const openBlockRename = useCallback((target: RenameTarget) => {
    setState((prev) => ({ ...prev, blockRenameTarget: target }))
  }, [])

  const closeBlockRename = useCallback(() => {
    setState((prev) => ({ ...prev, blockRenameTarget: null }))
  }, [])

  return {
    // state
    noteRenameOpen: state.noteRenameOpen,
    noteRenamePath: state.noteRenamePath,
    tagRenameTag: state.tagRenameTag,
    sectionRenameTarget: state.sectionRenameTarget,
    blockRenameTarget: state.blockRenameTarget,
    // actions
    openNoteRename,
    closeNoteRename,
    openTagRename,
    closeTagRename,
    openSectionRename,
    closeSectionRename,
    openBlockRename,
    closeBlockRename,
  }
}
