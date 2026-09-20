import { useCallback, useEffect, useRef, useState } from 'react'
import type { CanvasDocument } from '@scriptor/core/contracts/canvas'
import {
  blocksForTemplate,
  canvasTemplateCatalog,
  CanvasCrdtSync,
  createEmptyDocument,
} from '@scriptor/canvas'

import {
  canvasLoadDocument,
  canvasListDocuments,
  canvasApplyTemplate,
  canvasSaveDocument,
  canvasSnapshot,
} from '../bridge/commands'
import { isNativeBridgeAvailable } from '../bridge/platform'
import { OperationGuard } from './operation-guard'

export interface CanvasBoardSummary {
  id: string
  title: string
  updatedAt: string
  blockCount: number
  path: string
}

interface CanvasSavePayload {
  sequence: number
  document: CanvasDocument
  vaultId: string | null
}

/** Manages canvas loading, history, CRDT state, and serialized durable saves. */
export function useCanvasBoard(vaultId: string | null, vaultOpen: boolean, crdtEnabled = false) {
  const crdtRef = useRef<CanvasCrdtSync | null>(null)
  const [document, setDocument] = useState<CanvasDocument>(() =>
    createEmptyDocument(vaultId ?? 'vault-demo', 'Research board'),
  )
  const [boards, setBoards] = useState<CanvasBoardSummary[]>([])
  const [activeBoardId, setActiveBoardId] = useState<string | null>(null)
  const [status, setStatus] = useState('Loading board…')
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const saveTimer = useRef<number | null>(null)
  const pendingSavePayloadRef = useRef<CanvasSavePayload | null>(null)
  const historyRef = useRef<{ past: CanvasDocument[]; future: CanvasDocument[] }>({ past: [], future: [] })
  const lastCommittedSerializedRef = useRef('')
  const persistRef = useRef<(next: CanvasDocument) => void>(() => {})
  const documentRef = useRef(document)
  const lifecycleGuardRef = useRef(new OperationGuard())
  const loadGuardRef = useRef(new OperationGuard())
  const saveGuardRef = useRef(new OperationGuard())
  const templateGuardRef = useRef(new OperationGuard())
  const saveTailRef = useRef<Promise<boolean>>(Promise.resolve(true))
  const latestSaveSequenceRef = useRef(0)
  const mountedRef = useRef(true)

  useEffect(() => {
    documentRef.current = document
  }, [document])

  useEffect(() => {
    lifecycleGuardRef.current.invalidate()
    loadGuardRef.current.invalidate()
    saveGuardRef.current.invalidate()
    templateGuardRef.current.invalidate()
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current)
      saveTimer.current = null
    }
  }, [vaultId, vaultOpen])

  const syncHistoryFlags = useCallback(() => {
    const history = historyRef.current
    setCanUndo(history.past.length > 1)
    setCanRedo(history.future.length > 0)
  }, [])

  const resetHistory = useCallback(
    (snapshot: CanvasDocument) => {
      historyRef.current = { past: [structuredClone(snapshot)], future: [] }
      lastCommittedSerializedRef.current = JSON.stringify(snapshot)
      syncHistoryFlags()
    },
    [syncHistoryFlags],
  )

  useEffect(() => {
    crdtRef.current?.dispose()
    const sync = new CanvasCrdtSync(crdtEnabled, document.id)
    crdtRef.current = sync
    return sync.subscribe((remote) => {
      templateGuardRef.current.invalidate()
      setDocument((current) => ({
        ...remote,
        vaultId: current.vaultId,
        title: current.title,
        layers: current.layers.length > 0 ? current.layers : remote.layers,
      }))
    })
  }, [crdtEnabled, document.id])

  useEffect(() => {
    return () => crdtRef.current?.dispose()
  }, [])

  const displayStatus =
    !vaultOpen || !vaultId ? 'Open a vault to edit canvas boards.' : status

  const refreshBoardList = useCallback(async (isCurrent: () => boolean = () => true) => {
    if (!isNativeBridgeAvailable() || !vaultOpen) {
      if (isCurrent()) setBoards([])
      return []
    }
    const summaries = await canvasListDocuments()
    if (isCurrent()) setBoards(summaries)
    return summaries
  }, [vaultOpen])

  const enqueueSave = useCallback(
    (
      payload: CanvasSavePayload,
      isCurrent: () => boolean = () => true,
      updateUi = true,
    ): Promise<boolean> => {
      const task = saveTailRef.current.then(async () => {
        try {
          const path = await canvasSaveDocument(JSON.stringify(payload.document), payload.vaultId)
          if (updateUi && mountedRef.current && isCurrent()) {
            setStatus(`Saved to ${path}`)
            setActiveBoardId(payload.document.id)
            await refreshBoardList(isCurrent)
          }
          return true
        } catch (error) {
          // Only the newest full-document payload is worth retrying. An older
          // failed payload is superseded by a newer queued document snapshot.
          if (payload.sequence === latestSaveSequenceRef.current) {
            const pending = pendingSavePayloadRef.current
            if (!pending || pending.sequence <= payload.sequence) {
              pendingSavePayloadRef.current = payload
            }
          }
          if (updateUi && mountedRef.current && isCurrent()) {
            setStatus(error instanceof Error ? error.message : 'Save failed')
          }
          return false
        }
      })
      saveTailRef.current = task
      return task
    },
    [refreshBoardList],
  )

  useEffect(() => {
    const templateGuard = templateGuardRef.current
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      templateGuard.invalidate()
      if (saveTimer.current) {
        window.clearTimeout(saveTimer.current)
        saveTimer.current = null
      }
      const pending = pendingSavePayloadRef.current
      if (pending && isNativeBridgeAvailable()) {
        pendingSavePayloadRef.current = null
        // Keep teardown writes on the same serialization tail as ordinary
        // persistence. React cannot await cleanup, but it must never start a
        // newer write in parallel with an older queued write.
        void enqueueSave(pending, () => false, false)
      }
    }
  }, [enqueueSave])

  const loadBoard = useCallback(
    async (boardId: string) => {
      if (!isNativeBridgeAvailable() || !vaultOpen) return
      templateGuardRef.current.invalidate()
      const lifecycle = lifecycleGuardRef.current.snapshot()
      const request = loadGuardRef.current.issue()
      const json = await canvasLoadDocument(boardId)
      if (!lifecycleGuardRef.current.isCurrent(lifecycle) || !loadGuardRef.current.isCurrent(request)) return
      const parsed: unknown = JSON.parse(json)
      const candidate = parsed as Partial<CanvasDocument> | null
      if (
        typeof candidate !== 'object' ||
        candidate === null ||
        typeof candidate.id !== 'string' ||
        typeof candidate.title !== 'string' ||
        !Array.isArray(candidate.layers) ||
        !Array.isArray(candidate.blocks)
      ) {
        setStatus('The board file is not a canvas document; the current board was kept.')
        return
      }

      const loaded = candidate as CanvasDocument
      setDocument(loaded)
      documentRef.current = loaded
      resetHistory(loaded)
      setActiveBoardId(boardId)
      setStatus(`Loaded ${loaded.title}.`)
    },
    [resetHistory, vaultOpen],
  )

  useEffect(() => {
    if (!vaultOpen || !vaultId) {
      return
    }

    let cancelled = false
    const lifecycle = lifecycleGuardRef.current.snapshot()
    const isCurrent = () => !cancelled && lifecycleGuardRef.current.isCurrent(lifecycle)
    void (async () => {
      try {
        if (!isNativeBridgeAvailable()) {
          const preview = createEmptyDocument(vaultId, 'Research board')
          setDocument(preview)
          documentRef.current = preview
          resetHistory(preview)
          setBoards([])
          setActiveBoardId(preview.id)
          setStatus('In-memory board (browser preview).')
          return
        }

        const summaries = await refreshBoardList(isCurrent)
        if (!isCurrent()) return

        if (summaries.length > 0) {
          await loadBoard(summaries[0]!.id)
          if (!isCurrent()) return
        } else {
          const created = createEmptyDocument(vaultId, 'Research board')
          setDocument(created)
          documentRef.current = created
          resetHistory(created)
          setActiveBoardId(created.id)
          setStatus('New board ready.')
        }
      } catch (error) {
        if (isCurrent()) {
          const fallback = createEmptyDocument(vaultId, 'Research board')
          setDocument(fallback)
          documentRef.current = fallback
          resetHistory(fallback)
          setActiveBoardId(fallback.id)
          setStatus(error instanceof Error ? error.message : 'Could not load board.')
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [loadBoard, refreshBoardList, resetHistory, vaultId, vaultOpen])

  const persist = useCallback(
    (next: CanvasDocument) => {
      if (!isNativeBridgeAvailable() || !vaultOpen) return
      const lifecycle = lifecycleGuardRef.current.snapshot()
      const save = saveGuardRef.current.issue()
      const isCurrent = () =>
        lifecycleGuardRef.current.isCurrent(lifecycle) &&
        saveGuardRef.current.isCurrent(save) &&
        documentRef.current.id === next.id
      const queuePayload = (documentToSave: CanvasDocument) => {
        const payload: CanvasSavePayload = {
          sequence: ++latestSaveSequenceRef.current,
          document: documentToSave,
          vaultId,
        }
        pendingSavePayloadRef.current = payload
        if (saveTimer.current) window.clearTimeout(saveTimer.current)
        saveTimer.current = window.setTimeout(() => {
          saveTimer.current = null
          if (pendingSavePayloadRef.current?.sequence === payload.sequence) {
            pendingSavePayloadRef.current = null
          }
          void enqueueSave(payload, isCurrent)
        }, 400)
      }

      const crdt = crdtRef.current
      if (crdt) {
        crdt.markLocalEdit()
        const payload = crdt.snapshot(next)
        crdt.flush()
        queuePayload(payload)
        return
      }
      queuePayload(next)
    },
    [enqueueSave, vaultId, vaultOpen],
  )

  const flushPendingSave = useCallback(async (): Promise<boolean> => {
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current)
      saveTimer.current = null
    }

    const pending = pendingSavePayloadRef.current
    if (pending && isNativeBridgeAvailable() && vaultOpen) {
      pendingSavePayloadRef.current = null
      const ok = await enqueueSave(pending, () => true)
      if (!ok) return false
    } else {
      const inFlightOk = await saveTailRef.current
      if (!inFlightOk) {
        // A debounced payload may already have moved into the in-flight tail and
        // failed while this flush was waiting. enqueueSave re-inserts the newest
        // failed payload so the explicit flush gets one deterministic retry.
        const retry = pendingSavePayloadRef.current
        if (!retry || !isNativeBridgeAvailable() || !vaultOpen) return false
        pendingSavePayloadRef.current = null
        return enqueueSave(retry, () => true)
      }
    }

    const retry = pendingSavePayloadRef.current
    if (retry && isNativeBridgeAvailable() && vaultOpen) {
      pendingSavePayloadRef.current = null
      return enqueueSave(retry, () => true)
    }
    return saveTailRef.current
  }, [enqueueSave, vaultOpen])

  useEffect(() => {
    persistRef.current = persist
  }, [persist])

  const commitDocument = useCallback((next: CanvasDocument) => {
    const history = historyRef.current
    const serialized = JSON.stringify(next)
    if (history.past.length > 0 && serialized === lastCommittedSerializedRef.current) {
      return next
    }
    lastCommittedSerializedRef.current = serialized
    history.past.push(structuredClone(next))
    if (history.past.length > 50) {
      history.past.shift()
    }
    history.future = []
    persistRef.current(next)
    syncHistoryFlags()
    return next
  }, [syncHistoryFlags])

  const switchBoard = useCallback(
    async (boardId: string) => {
      if (boardId === activeBoardId) return
      templateGuardRef.current.invalidate()
      if (!(await flushPendingSave())) {
        setStatus('Could not switch boards because the current board has unsaved changes.')
        return
      }
      try {
        await loadBoard(boardId)
      } catch (error) {
        setStatus(error instanceof Error ? error.message : 'Could not switch board.')
      }
    },
    [activeBoardId, flushPendingSave, loadBoard],
  )

  const createBoard = useCallback(
    async (title = 'Untitled board') => {
      if (!vaultId) return
      templateGuardRef.current.invalidate()
      if (!(await flushPendingSave())) {
        setStatus('Could not create a board because the current board has unsaved changes.')
        return
      }
      const created = createEmptyDocument(vaultId, title)
      setDocument(created)
      documentRef.current = created
      resetHistory(created)
      setActiveBoardId(created.id)
      if (isNativeBridgeAvailable() && vaultOpen) {
        try {
          const path = await canvasSaveDocument(JSON.stringify(created), vaultId)
          setStatus(`Created ${title} at ${path}`)
          await refreshBoardList()
        } catch (error) {
          setStatus(error instanceof Error ? error.message : 'Could not create board.')
        }
      } else {
        setBoards((current) => [
          {
            id: created.id,
            title: created.title,
            updatedAt: created.updatedAt,
            blockCount: 0,
            path: '',
          },
          ...current,
        ])
        setStatus(`Created ${title} (preview).`)
      }
    },
    [flushPendingSave, refreshBoardList, resetHistory, vaultId, vaultOpen],
  )

  const applyTemplate = useCallback(
    async (templateId: string) => {
      const template = canvasTemplateCatalog.find((entry) => entry.id === templateId)
      const templateLabel = template?.name ?? templateId

      if (isNativeBridgeAvailable() && vaultOpen) {
        const lifecycle = lifecycleGuardRef.current.snapshot()
        const request = templateGuardRef.current.issue()
        const base = documentRef.current
        const isCurrent = () =>
          mountedRef.current &&
          lifecycleGuardRef.current.isCurrent(lifecycle) &&
          templateGuardRef.current.isCurrent(request) &&
          documentRef.current === base
        try {
          // Serialize the live document, not the render-captured state. A late
          // response cannot take ownership after an edit, board switch, vault
          // change, newer template request, or unmount.
          const output = await canvasApplyTemplate(JSON.stringify(base), templateId)
          if (!isCurrent()) return
          const next = output.document as CanvasDocument
          documentRef.current = next
          setDocument(next)
          commitDocument(next)
          setStatus(`Inserted ${output.blocksAdded} blocks from ${templateLabel}.`)
          return
        } catch (error) {
          if (isCurrent()) {
            setStatus(error instanceof Error ? error.message : `Could not apply ${templateLabel}.`)
          }
          return
        }
      }

      const added = blocksForTemplate(templateId)

      const base = documentRef.current
      const next = {
        ...base,
        title: templateLabel,
        blocks: [...base.blocks, ...added],
        updatedAt: new Date().toISOString(),
      }
      documentRef.current = next
      setDocument(next)
      commitDocument(next)
      setStatus(`Inserted ${added.length} blocks from ${templateLabel}.`)
    },
    [commitDocument, vaultOpen],
  )

  const updateDocument = useCallback(
    (updater: (current: CanvasDocument) => CanvasDocument) => {
      templateGuardRef.current.invalidate()
      const next = updater(documentRef.current)
      documentRef.current = next
      setDocument(next)
      commitDocument(next)
    },
    [commitDocument],
  )

  const undo = useCallback(() => {
    templateGuardRef.current.invalidate()
    const history = historyRef.current
    if (history.past.length <= 1) return
    const current = history.past.pop()!
    history.future.unshift(current)
    const previous = history.past[history.past.length - 1]!
    lastCommittedSerializedRef.current = JSON.stringify(previous)
    const restored = structuredClone(previous)
    documentRef.current = restored
    setDocument(restored)
    persistRef.current(previous)
    syncHistoryFlags()
    setStatus('Undid last change.')
  }, [syncHistoryFlags])

  const redo = useCallback(() => {
    templateGuardRef.current.invalidate()
    const history = historyRef.current
    if (history.future.length === 0) return
    const next = history.future.shift()!
    history.past.push(next)
    lastCommittedSerializedRef.current = JSON.stringify(next)
    const restored = structuredClone(next)
    documentRef.current = restored
    setDocument(restored)
    persistRef.current(next)
    syncHistoryFlags()
    setStatus('Redid change.')
  }, [syncHistoryFlags])

  const exportSnapshot = useCallback(
    async (format: 'png' | 'svg' | 'pdf') => {
      if (!isNativeBridgeAvailable() || !vaultOpen) {
        setStatus('Snapshots require the desktop shell with an open vault.')
        return
      }

      try {
        const outputPath = `.scriptor/exports/${document.id}.${format}`
        const result = await canvasSnapshot(JSON.stringify(document), format, outputPath, false)
        setStatus(`Exported ${format.toUpperCase()} to ${result.artifactPath}`)
      } catch (error) {
        setStatus(error instanceof Error ? error.message : 'Snapshot export failed')
      }
    },
    [document, vaultOpen],
  )

  return {
    document,
    boards,
    activeBoardId,
    status: displayStatus,
    setStatus,
    switchBoard,
    createBoard,
    applyTemplate,
    updateDocument,
    exportSnapshot,
    undo,
    redo,
    canUndo,
    canRedo,
    flushPendingSave,
  }
}
