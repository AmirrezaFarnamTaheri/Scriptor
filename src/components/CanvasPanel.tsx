import { useEffect, useMemo, useState } from 'react'
import type { CanvasBlock } from '@scriptor/core/contracts/canvas'
import type { CanvasToolContribution, TemplatePackContribution } from '@scriptor/core/contracts/plugin'
import { sceneBounds } from '@scriptor/canvas'

import { useEscapeToClose } from '../hooks/useEscapeToClose'
import { useCanvasBoard } from '../hooks/useCanvasBoard'
import { CanvasStage } from './canvas/CanvasStage'

interface CanvasPanelProps {
  vaultId: string | null
  vaultOpen: boolean
  crdtEnabled?: boolean
  activePath?: string | null
  templatePacks: TemplatePackContribution[]
  canvasTools: CanvasToolContribution[]
  onClose: () => void
  onOpenNote?: (path: string) => void
}

export function CanvasPanel({
  vaultId,
  vaultOpen,
  crdtEnabled = false,
  activePath = null,
  templatePacks,
  canvasTools,
  onClose,
  onOpenNote,
}: CanvasPanelProps) {
  const {
    document,
    boards,
    activeBoardId,
    status,
    setStatus,
    switchBoard,
    createBoard,
    applyTemplate,
    exportSnapshot,
    updateDocument,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useCanvasBoard(vaultId, vaultOpen, crdtEnabled)
  const [selectedBlockIds, setSelectedBlockIds] = useState<string[]>([])
  const [activeTool, setActiveTool] = useState(canvasTools[0]?.id ?? 'select')

  useEscapeToClose(true, onClose)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return
      const key = event.key.toLowerCase()
      if (key === 'z' && !event.shiftKey) {
        event.preventDefault()
        undo()
      } else if (key === 'y' || (key === 'z' && event.shiftKey)) {
        event.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [redo, undo])

  const viewport = useMemo(() => sceneBounds(document), [document])
  const blocks = useMemo(
    () => [...document.blocks].sort((left, right) => left.zIndex - right.zIndex),
    [document.blocks],
  )
  const sceneJson = useMemo(() => JSON.stringify(document), [document])
  const defaultLayerId = document.layers[0]?.id ?? 'layer-default'

  const templates = templatePacks.length > 0 ? templatePacks : []

  const addBlock = (block: CanvasBlock) => {
    updateDocument((current) => ({
      ...current,
      blocks: [...current.blocks, block],
      updatedAt: new Date().toISOString(),
    }))
    setSelectedBlockIds([block.id])
    setStatus(
      block.kind === 'table'
        ? 'Placed spreadsheet table.'
        : block.shapeKind === 'freehand'
          ? 'Added ink stroke.'
          : `Added ${block.kind}.`,
    )
  }

  const updateBlock = (blockId: string, updater: (block: CanvasBlock) => CanvasBlock) => {
    updateDocument((current) => ({
      ...current,
      blocks: current.blocks.map((block) => (block.id === blockId ? updater(block) : block)),
      updatedAt: new Date().toISOString(),
    }))
  }

  const selectedBlock = useMemo(
    () => document.blocks.find((block) => block.id === selectedBlockIds[0]) ?? null,
    [document.blocks, selectedBlockIds],
  )

  const linkSelectedToActiveNote = () => {
    if (!activePath || selectedBlockIds.length === 0) return
    for (const blockId of selectedBlockIds) {
      updateBlock(blockId, (block) => ({
        ...block,
        sourceNoteId: activePath,
        contentRef: block.contentRef ?? activePath,
      }))
    }
    setStatus(`Linked ${selectedBlockIds.length} block(s) to ${activePath}`)
  }

  return (
    <div className="canvas-overlay" role="dialog" aria-label="Canvas board">
      <header className="canvas-header">
        <h2>{document.title}</h2>
        <div className="canvas-board-picker">
          <label>
            <span className="sr-only">Active board</span>
            <select
              value={activeBoardId ?? document.id}
              disabled={!vaultOpen || boards.length === 0}
              onChange={(event) => void switchBoard(event.target.value)}
            >
              {boards.length === 0 ? (
                <option value={document.id}>{document.title}</option>
              ) : (
                boards.map((board) => (
                  <option key={board.id} value={board.id}>
                    {board.title} ({board.blockCount})
                  </option>
                ))
              )}
            </select>
          </label>
          <button type="button" disabled={!vaultOpen} onClick={() => void createBoard()}>
            New board
          </button>
        </div>
        <span>{document.blocks.length} blocks</span>
        <div className="canvas-template-row" role="toolbar" aria-label="Canvas tools">
          <button type="button" className="toolbar-button" disabled={!canUndo} onClick={undo}>
            Undo
          </button>
          <button type="button" className="toolbar-button" disabled={!canRedo} onClick={redo}>
            Redo
          </button>
          {canvasTools.map((tool) => (
            <button
              key={tool.id}
              type="button"
              className={activeTool === tool.id ? 'toolbar-button active' : 'toolbar-button'}
              onClick={() => setActiveTool(tool.id)}
            >
              {tool.label}
            </button>
          ))}
          {templates.map((pack) => (
            <button key={pack.id} type="button" onClick={() => void applyTemplate(pack.id)}>
              {pack.label}
            </button>
          ))}
          <button type="button" disabled={!vaultOpen} onClick={() => void exportSnapshot('svg')}>
            Export SVG
          </button>
          <button type="button" disabled={!vaultOpen} onClick={() => void exportSnapshot('png')}>
            Export PNG
          </button>
          <button type="button" disabled={!vaultOpen} onClick={() => void exportSnapshot('pdf')}>
            Export PDF
          </button>
          {activePath ? (
            <button type="button" className="toolbar-button" disabled={selectedBlockIds.length === 0} onClick={linkSelectedToActiveNote}>
              Link to active note
            </button>
          ) : null}
          {selectedBlock?.sourceNoteId && onOpenNote ? (
            <button type="button" className="toolbar-button" onClick={() => onOpenNote(selectedBlock.sourceNoteId!)}>
              Open linked note
            </button>
          ) : null}
        </div>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Close canvas">
          ×
        </button>
      </header>

      <div className="canvas-stage">
        <CanvasStage
          sceneJson={sceneJson}
          blocks={blocks}
          sceneBounds={viewport}
          selectedBlockIds={selectedBlockIds}
          activeTool={activeTool}
          defaultLayerId={defaultLayerId}
          onSelectBlocks={(ids) => {
            setSelectedBlockIds(ids)
            setStatus(
              ids.length === 0
                ? 'Selection cleared'
                : `Selected ${ids.length} block${ids.length === 1 ? '' : 's'}`,
            )
          }}
          onAddBlock={addBlock}
          onUpdateBlock={updateBlock}
        />
      </div>

      <footer className="canvas-footer" role="status">
        <span>{status}</span>
        {selectedBlockIds.length > 0 ? <code>{selectedBlockIds.join(', ')}</code> : null}
        <small className="canvas-cli-hint">CLI: scriptor canvas list · scriptor canvas snapshot</small>
      </footer>
    </div>
  )
}
