import type { ReaderAnnotationRecord } from '../../bridge/reader'

type SaveAnnotations = (
  relPath: string,
  annotations: ReaderAnnotationRecord[],
) => Promise<void>

interface CreateReaderAnnotationSaveQueueOptions {
  saveAnnotations: SaveAnnotations
  onPersisted?: (annotation: ReaderAnnotationRecord) => void
  onError?: (cause: unknown) => void
  onPendingChange?: (pending: boolean) => void
}

interface PendingSave {
  relPath: string
  annotations: ReaderAnnotationRecord[]
}

export interface ReaderAnnotationSaveQueue {
  enqueue: (
    relPath: string,
    annotations: ReaderAnnotationRecord[],
    annotation?: ReaderAnnotationRecord,
  ) => void
  retry: () => boolean
  hasPending: () => boolean
  reset: () => void
}

export function createReaderAnnotationSaveQueue({
  saveAnnotations,
  onPersisted,
  onError,
  onPendingChange,
}: CreateReaderAnnotationSaveQueueOptions): ReaderAnnotationSaveQueue {
  let inFlightRelPath: string | null = null
  let inFlight: Promise<void> | null = null
  const queuedSaves = new Map<string, PendingSave>()
  const failedSaves = new Map<string, PendingSave>()
  const queueOrder: string[] = []
  const pendingAnnotations = new Map<string, ReaderAnnotationRecord>()

  const acknowledgePersisted = (annotations: ReaderAnnotationRecord[]) => {
    for (const annotation of annotations) {
      const pending = pendingAnnotations.get(annotation.id)
      if (!pending) continue
      pendingAnnotations.delete(annotation.id)
      onPersisted?.(pending)
    }
  }

  const hasOutstandingWork = () =>
    Boolean(inFlightRelPath || queueOrder.length || failedSaves.size || pendingAnnotations.size)

  const queueSave = (save: PendingSave) => {
    queuedSaves.set(save.relPath, save)
    if (!queueOrder.includes(save.relPath)) {
      queueOrder.push(save.relPath)
    }
  }

  const drain = async () => {
    while (queueOrder.length) {
      const nextRelPath = queueOrder.shift()
      if (!nextRelPath) continue
      const nextSave = queuedSaves.get(nextRelPath)
      if (!nextSave) continue
      queuedSaves.delete(nextRelPath)
      inFlightRelPath = nextRelPath

      try {
        await saveAnnotations(nextSave.relPath, nextSave.annotations)
        acknowledgePersisted(nextSave.annotations)
      } catch (cause) {
        if (queuedSaves.has(nextSave.relPath)) {
          continue
        }
        if (!failedSaves.has(nextSave.relPath)) {
          failedSaves.set(nextSave.relPath, nextSave)
          onError?.(cause)
        }
      } finally {
        inFlightRelPath = null
      }
    }

    inFlight = null
    if (!hasOutstandingWork()) onPendingChange?.(false)
  }

  return {
    enqueue(relPath, annotations, annotation) {
      queueSave({
        relPath,
        annotations: [...annotations],
      })
      failedSaves.delete(relPath)
      if (annotation) {
        pendingAnnotations.set(annotation.id, annotation)
      }
      if (!inFlight) {
        inFlight = drain()
      }
      onPendingChange?.(true)
    },

    retry() {
      if (!failedSaves.size || inFlight) return false
      for (const save of failedSaves.values()) {
        queueSave(save)
      }
      failedSaves.clear()
      inFlight = drain()
      onPendingChange?.(true)
      return true
    },

    hasPending() {
      return hasOutstandingWork()
    },

    reset() {
      inFlightRelPath = null
      queuedSaves.clear()
      failedSaves.clear()
      queueOrder.length = 0
      pendingAnnotations.clear()
      onPendingChange?.(false)
    },
  }
}
