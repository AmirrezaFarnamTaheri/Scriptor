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
  canvasTemplateDryRun,
} from '../bridge/commands'
import { isNativeBridgeAvailable } from '../bridge/platform'

export interface CanvasBoardSummary {
  id: string
  title: string
  updatedAt: string
  blockCount: number
  path: string
}

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
  const historyRef = useRef<{ past: CanvasDocument[]; future: CanvasDocument[] }>({ past: [], future: [] })
  const persistRef = useRef<(next: CanvasDocument) => void>(() => {})

  const syncHistoryFlags = useCallback(() => {
    const history = historyRef.current
    setCanUndo(history.past.length > 1)
    setCanRedo(history.future.length > 0)
  }, [])

  const resetHistory = useCallback(
    (snapshot: CanvasDocument) => {
      historyRef.current = { past: [structuredClone(snapshot)], future: [] }
      syncHistoryFlags()
    },
    [syncHistoryFlags],
  )

  useEffect(() => {
    crdtRef.current?.dispose()
    const sync = new CanvasCrdtSync(crdtEnabled, document.id)
    crdtRef.current = sync
    return sync.subscribe((remote) => {
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

  const refreshBoardList = useCallback(async () => {
    if (!isNativeBridgeAvailable() || !vaultOpen) {
      setBoards([])
      return []
    }
    const summaries = await canvasListDocuments()
    setBoards(summaries)
    return summaries
  }, [vaultOpen])

  const loadBoard = useCallback(
    async (boardId: string) => {
      if (!isNativeBridgeAvailable() || !vaultOpen) return
      const json = await canvasLoadDocument(boardId)
      const loaded = JSON.parse(json) as CanvasDocument
      setDocument(loaded)
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
    void (async () => {
      try {
        if (!isNativeBridgeAvailable()) {
          const preview = createEmptyDocument(vaultId, 'Research board')
          setDocument(preview)
          resetHistory(preview)
          setBoards([])
          setActiveBoardId(preview.id)
          setStatus('In-memory board (browser preview).')
          return
        }

        const summaries = await refreshBoardList()
        if (cancelled) return

        if (summaries.length > 0) {
          await loadBoard(summaries[0]!.id)
        } else {
          const created = createEmptyDocument(vaultId, 'Research board')
          setDocument(created)
          resetHistory(created)
          setActiveBoardId(created.id)
          setStatus('New board ready.')
        }
      } catch (error) {
        if (!cancelled) {
          const fallback = createEmptyDocument(vaultId, 'Research board')
          setDocument(fallback)
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
      const crdt = crdtRef.current
      if (crdt) {
        crdt.markLocalEdit()
        const payload = crdt.snapshot(next)
        crdt.flush()
        if (saveTimer.current) window.clearTimeout(saveTimer.current)
        saveTimer.current = window.setTimeout(() => {
          void canvasSaveDocument(JSON.stringify(payload))
            .then(async (path) => {
              setStatus(`Saved to ${path}`)
              setActiveBoardId(next.id)
              await refreshBoardList()
            })
            .catch((error) => setStatus(error instanceof Error ? error.message : 'Save failed'))
        }, 400)
        return
      }
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
      saveTimer.current = window.setTimeout(() => {
        void canvasSaveDocument(JSON.stringify(next))
          .then(async (path) => {
            setStatus(`Saved to ${path}`)
            setActiveBoardId(next.id)
            await refreshBoardList()
          })
          .catch((error) => setStatus(error instanceof Error ? error.message : 'Save failed'))
      }, 400)
    },
    [refreshBoardList, vaultOpen],
  )

  persistRef.current = persist

  const commitDocument = useCallback((next: CanvasDocument) => {
    const history = historyRef.current
    const current = history.past[history.past.length - 1]
    if (current && JSON.stringify(current) === JSON.stringify(next)) {
      return next
    }
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
      try {
        await loadBoard(boardId)
      } catch (error) {
        setStatus(error instanceof Error ? error.message : 'Could not switch board.')
      }
    },
    [activeBoardId, loadBoard],
  )

  const createBoard = useCallback(
    async (title = 'Untitled board') => {
      if (!vaultId) return
      const created = createEmptyDocument(vaultId, title)
      setDocument(created)
      resetHistory(created)
      setActiveBoardId(created.id)
      if (isNativeBridgeAvailable() && vaultOpen) {
        try {
          const path = await canvasSaveDocument(JSON.stringify(created))
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
    [refreshBoardList, resetHistory, vaultId, vaultOpen],
  )

  const applyTemplate = useCallback(
    async (templateId: string) => {
      const template = canvasTemplateCatalog.find((entry) => entry.id === templateId)
      const templateLabel = template?.name ?? templateId

      if (isNativeBridgeAvailable() && vaultOpen) {
        try {
          const output = await canvasApplyTemplate(JSON.stringify(document), templateId)
          const next = output.document as CanvasDocument
          setDocument(next)
          commitDocument(next)
          setStatus(`Inserted ${output.blocksAdded} blocks from ${templateLabel}.`)
          return
        } catch {
          // Fall through to local template blocks.
        }
      }

      let added = blocksForTemplate(templateId)
      if (isNativeBridgeAvailable()) {
        try {
          const preview = await canvasTemplateDryRun(JSON.stringify(document), templateId)
          added = preview.blocksAdded.map((block) => ({
            id: block.id,
            kind: block.kind as CanvasDocument['blocks'][number]['kind'],
            layerId: block.layerId,
            bounds: block.bounds,
            zIndex: block.zIndex,
            contentRef: block.contentRef,
          }))
        } catch {
          // Fall back to local template blocks.
        }
      }

      setDocument((current) => {
        const next = {
          ...current,
          title: templateLabel,
          blocks: [...current.blocks, ...added],
          updatedAt: new Date().toISOString(),
        }
        commitDocument(next)
        return next
      })
      setStatus(`Inserted ${added.length} blocks from ${templateLabel}.`)
    },
    [commitDocument, document, vaultOpen],
  )

  const updateDocument = useCallback(
    (updater: (current: CanvasDocument) => CanvasDocument) => {
      setDocument((current) => {
        const next = updater(current)
        commitDocument(next)
        return next
      })
    },
    [commitDocument],
  )

  const undo = useCallback(() => {
    const history = historyRef.current
    if (history.past.length <= 1) return
    const current = history.past.pop()!
    history.future.unshift(current)
    const previous = history.past[history.past.length - 1]!
    setDocument(structuredClone(previous))
    persistRef.current(previous)
    syncHistoryFlags()
    setStatus('Undid last change.')
  }, [syncHistoryFlags])

  const redo = useCallback(() => {
    const history = historyRef.current
    if (history.future.length === 0) return
    const next = history.future.shift()!
    history.past.push(next)
    setDocument(structuredClone(next))
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
  }
}
