import { useCallback, useMemo, useState } from 'react'

import { vaultDeleteNote } from '../bridge/commands'
import {
  createDeleteNoteController,
  type DeleteNoteOutcome,
} from '../controllers/deleteNoteController'

interface UseDeleteNoteControllerOptions {
  enabled: boolean
  closeTab: (path: string) => void
  rebuildIndex: () => Promise<unknown>
  refreshVault: () => Promise<unknown>
  showToast: (message: string) => void
}

export function useDeleteNoteController({
  enabled,
  closeTab,
  rebuildIndex,
  refreshVault,
  showToast,
}: UseDeleteNoteControllerOptions) {
  const [deletingPath, setDeletingPath] = useState<string | null>(null)
  const [lastOutcome, setLastOutcome] = useState<DeleteNoteOutcome | null>(null)
  const controller = useMemo(
    () =>
      createDeleteNoteController({
        deleteNote: vaultDeleteNote,
        closeTab,
        rebuildIndex,
        refreshVault,
      }),
    [closeTab, rebuildIndex, refreshVault],
  )

  const deleteNote = useCallback(
    async (path: string) => {
      if (!enabled) {
        const outcome: DeleteNoteOutcome = {
          ok: false,
          path,
          stage: 'delete',
          reason: 'Note deletion requires the desktop app.',
        }
        setLastOutcome(outcome)
        showToast(outcome.reason)
        return outcome
      }
      if (deletingPath !== null || controller.isDeleting()) {
        const outcome: DeleteNoteOutcome = {
          ok: false,
          path,
          stage: 'busy',
          reason: 'Deletion is already in progress.',
        }
        setLastOutcome(outcome)
        return outcome
      }

      setDeletingPath(path)
      try {
        const outcome = await controller.deleteNote(path)
        setLastOutcome(outcome)
        showToast(
          outcome.ok
            ? `Deleted ${path}`
            : `Could not delete ${path} during ${outcome.stage}: ${outcome.reason}`,
        )
        return outcome
      } finally {
        setDeletingPath(null)
      }
    },
    [controller, deletingPath, enabled, showToast],
  )

  return {
    deleteNote,
    deletingPath,
    isDeleting: deletingPath !== null,
    lastOutcome,
  }
}
