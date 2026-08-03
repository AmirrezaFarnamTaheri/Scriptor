export type DeleteNoteStage = 'busy' | 'delete' | 'close' | 'rebuild' | 'refresh'

export type DeleteNoteOutcome =
  | { ok: true; path: string }
  | { ok: false; path: string; stage: DeleteNoteStage; reason: string }

export interface DeleteNoteDependencies {
  deleteNote: (path: string) => Promise<{ path: string; deleted: boolean }>
  closeTab: (path: string) => void
  rebuildIndex: () => Promise<unknown>
  refreshVault: () => Promise<unknown>
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function createDeleteNoteController(dependencies: DeleteNoteDependencies) {
  const inFlight = new Set<string>()

  return {
    isDeleting(path?: string): boolean {
      return path ? inFlight.has(path) : inFlight.size > 0
    },

    async deleteNote(path: string): Promise<DeleteNoteOutcome> {
      if (inFlight.size > 0) {
        return { ok: false, path, stage: 'busy', reason: 'Deletion is already in progress.' }
      }
      inFlight.add(path)
      try {
        let deleted: { path: string; deleted: boolean }
        try {
          deleted = await dependencies.deleteNote(path)
        } catch (error) {
          return { ok: false, path, stage: 'delete', reason: message(error) }
        }
        if (!deleted.deleted) {
          return { ok: false, path, stage: 'delete', reason: 'The note was not deleted.' }
        }

        const failures: Array<{ stage: Exclude<DeleteNoteStage, 'busy' | 'delete'>; reason: string }> = []
        try {
          dependencies.closeTab(path)
        } catch (error) {
          failures.push({ stage: 'close', reason: message(error) })
        }
        try {
          await dependencies.rebuildIndex()
        } catch (error) {
          failures.push({ stage: 'rebuild', reason: message(error) })
        }
        try {
          await dependencies.refreshVault()
        } catch (error) {
          failures.push({ stage: 'refresh', reason: message(error) })
        }

        if (failures.length > 0) {
          const [first] = failures
          return {
            ok: false,
            path,
            stage: first.stage,
            reason: failures.map((failure) => `${failure.stage}: ${failure.reason}`).join('; '),
          }
        }
        return { ok: true, path }
      } finally {
        inFlight.delete(path)
      }
    },
  }
}
