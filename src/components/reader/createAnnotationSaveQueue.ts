import type { ReaderAnnotationRecord } from '../../bridge/reader'

type SaveAnnotations = (
  relPath: string,
  annotations: ReaderAnnotationRecord[],
) => Promise<void>

interface CreateReaderAnnotationSaveQueueOptions {
  saveAnnotations: SaveAnnotations
  onPersisted?: (annotation: ReaderAnnotationRecord) => void
  onError?: (cause: unknown) => void
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
  reset: () => void
}

export function createReaderAnnotationSaveQueue({
  saveAnnotations,
  onPersisted,
  onError,
}: CreateReaderAnnotationSaveQueueOptions): ReaderAnnotationSaveQueue {
  let latestPendingSave: PendingSave | null = null
  let inFlight: Promise<void> | null = null
  const pendingAnnotations = new Map<string, ReaderAnnotationRecord>()

  const acknowledgePersisted = (annotations: ReaderAnnotationRecord[]) => {
    for (const annotation of annotations) {
      const pending = pendingAnnotations.get(annotation.id)
      if (!pending) continue
      pendingAnnotations.delete(annotation.id)
      onPersisted?.(pending)
    }
  }

  const drain = async () => {
    while (latestPendingSave) {
      const nextSave = latestPendingSave
      latestPendingSave = null

      try {
        await saveAnnotations(nextSave.relPath, nextSave.annotations)
        acknowledgePersisted(nextSave.annotations)
      } catch (cause) {
        if (!latestPendingSave) {
          onError?.(cause)
        }
      }
    }

    inFlight = null
  }

  return {
    enqueue(relPath, annotations, annotation) {
      latestPendingSave = {
        relPath,
        annotations: [...annotations],
      }
      if (annotation) {
        pendingAnnotations.set(annotation.id, annotation)
      }
      if (!inFlight) {
        inFlight = drain()
      }
    },

    reset() {
      latestPendingSave = null
      pendingAnnotations.clear()
    },
  }
}
