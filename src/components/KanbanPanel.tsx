/**
 * KanbanPanel.tsx — W4-7 Kanban board viewer with drag-and-drop card moves.
 *
 * ## Architecture
 * - State: `useKanbanStore` — owns loading state, pending move state, and
 *   authoritative board reloads after each mutation.
 * - Drag-and-drop: HTML5 native API (no library dependency).
 *   - Drag data: JSON payload `{ sourcePath, cardLine, cardStatus, fromColumn }`.
 *   - Drop target: column drop-zone.
 *   - Keyboard alternative: per-card move-left / move-right buttons.
 * - Write-back: `indexerKanbanMoveCard(notePath, line, toColumn, newStatus)`
 *   relocates the full card under the destination heading through the vault
 *   write path, then the board reloads from source.
 * - Column-to-status mapping: each column has a canonical status derived from
 *   its name via `columnNameToStatus()`.
 */

import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Columns, RefreshCw } from 'lucide-react'

import {
  indexerKanbanBoard,
  indexerKanbanMoveCard,
  type KanbanBoardRow,
  type KanbanCardRow,
  type KanbanColumnRow,
} from '../bridge/commands/indexer'
import { isNativeBridgeAvailable } from '../bridge/platform'
import { UnifiedPanelShell } from './chrome/UnifiedPanelShell'
import { TaskStatusGlyph } from './taskStatusGlyph'

// ── Column → status character mapping ────────────────────────────────────────

/**
 * Derive a task-status character from a column name.
 *
 * Convention (mirrors obsidian-tasks):
 *   blank/todo → ' '
 *   in progress / doing → '/'
 *   done / complete → 'x'
 *   cancelled → '-'
 *   deferred / waiting → '>'
 *
 * Falls back to ' ' for unknown column names.
 */
function columnNameToStatus(name: string): string {
  const lower = name.toLowerCase()
  if (lower === 'done' || lower === 'complete' || lower === 'completed') return 'x'
  if (lower === 'cancelled' || lower === 'canceled') return '-'
  if (lower === 'in progress' || lower === 'doing' || lower === 'wip') return '/'
  if (lower === 'deferred' || lower === 'waiting' || lower === 'on hold') return '>'
  return ' '
}

// ── Drag payload ──────────────────────────────────────────────────────────────

interface DragPayload {
  sourcePath: string
  cardLine: number
  cardStatus: string
  fromColumn: string
}

const DRAG_MIME = 'application/x-scriptor-kanban-card'

// ── useKanbanStore ─────────────────────────────────────────────────────────────

interface UseKanbanStore {
  board: KanbanBoardRow | null
  isLoading: boolean
  error: string | null
  pendingCardLine: number | null
  load: (notePath: string) => void
  moveCard: (cardLine: number, fromColumn: string, toColumn: string) => void
}

interface KanbanState {
  board: KanbanBoardRow | null
  isLoading: boolean
  error: string | null
  pendingCardLine: number | null
}

type KanbanAction =
  | { type: 'idle' }
  | { type: 'loading' }
  | { type: 'success'; board: KanbanBoardRow | null }
  | { type: 'error'; message: string }
  | { type: 'move-start'; cardLine: number }
  | { type: 'move-finish' }

function kanbanReducer(state: KanbanState, action: KanbanAction): KanbanState {
  switch (action.type) {
    case 'idle':
      return { board: null, isLoading: false, error: null, pendingCardLine: null }
    case 'loading':
      return { ...state, isLoading: true, error: null }
    case 'success':
      return { board: action.board, isLoading: false, error: null, pendingCardLine: null }
    case 'error':
      return { ...state, isLoading: false, error: action.message, pendingCardLine: null }
    case 'move-start':
      return { ...state, error: null, pendingCardLine: action.cardLine }
    case 'move-finish':
      return { ...state, pendingCardLine: null }
  }
}

function useKanbanStore(
  notePath: string | null,
  runSourceNoteMutation?: (sourcePath: string, runMutation: () => Promise<void>) => Promise<boolean>,
): UseKanbanStore {
  const [state, dispatch] = useReducer(kanbanReducer, {
    board: null,
    isLoading: false,
    error: null,
    pendingCardLine: null,
  })
  const requestIdRef = useRef(0)
  const activeNotePathRef = useRef(notePath)
  const previousNotePathRef = useRef<string | null>(null)

  const load = useCallback((path: string) => {
    if (!isNativeBridgeAvailable()) {
      dispatch({ type: 'error', message: 'Open a vault in the desktop app.' })
      return
    }
    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    dispatch({ type: 'loading' })
    void indexerKanbanBoard(path)
      .then((b) => {
        if (requestId !== requestIdRef.current || activeNotePathRef.current !== path) return
        dispatch({ type: 'success', board: b })
      })
      .catch((err: unknown) => {
        if (requestId !== requestIdRef.current || activeNotePathRef.current !== path) return
        dispatch({
          type: 'error',
          message: err instanceof Error ? err.message : 'Failed to load board',
        })
      })
  }, [])

  useEffect(() => {
    activeNotePathRef.current = notePath
    if (!notePath) {
      previousNotePathRef.current = null
      requestIdRef.current += 1
      dispatch({ type: 'idle' })
      return
    }
    if (previousNotePathRef.current !== notePath) {
      dispatch({ type: 'idle' })
    }
    previousNotePathRef.current = notePath
    load(notePath)
  }, [notePath, load])

  useEffect(() => () => {
    requestIdRef.current += 1
  }, [])

  /**
   * Move a card through the native write path, then reload so line numbers and
   * task/index state stay aligned with the source file.
   */
  const moveCard = useCallback(
    (cardLine: number, fromColumn: string, toColumn: string) => {
      const board = state.board
      if (!board || fromColumn === toColumn || state.pendingCardLine !== null) return
      const sourcePath = board.sourcePath
      const newStatus = columnNameToStatus(toColumn)
      dispatch({ type: 'move-start', cardLine })
      const mutation = () => indexerKanbanMoveCard(sourcePath, cardLine, toColumn, newStatus)
      const run = runSourceNoteMutation
        ? runSourceNoteMutation(sourcePath, mutation).then((didMutate) => {
            if (!didMutate) {
              throw new Error('Save the unsaved source note before moving its card.')
            }
          })
        : mutation()
      void run
        .then(() => {
          if (activeNotePathRef.current === sourcePath) {
            load(sourcePath)
          }
        })
        .catch((err: unknown) => {
          if (activeNotePathRef.current !== sourcePath) return
          dispatch({
            type: 'error',
            message: err instanceof Error ? err.message : 'Failed to move card',
          })
        })
        .finally(() => {
          if (activeNotePathRef.current === sourcePath) {
            dispatch({ type: 'move-finish' })
          }
        })
    },
    [state.board, state.pendingCardLine, load, runSourceNoteMutation],
  )

  return {
    board: state.board,
    isLoading: state.isLoading,
    error: state.error,
    pendingCardLine: state.pendingCardLine,
    load,
    moveCard,
  }
}

// ── KanbanCard ────────────────────────────────────────────────────────────────

interface KanbanCardProps {
  card: KanbanCardRow
  sourcePath: string
  columnName: string
  canMoveLeft: boolean
  canMoveRight: boolean
  isPending: boolean
  onMoveLeft: () => void
  onMoveRight: () => void
}

function KanbanCard({
  card,
  sourcePath,
  columnName,
  canMoveLeft,
  canMoveRight,
  isPending,
  onMoveLeft,
  onMoveRight,
}: KanbanCardProps) {
  const handleDragStart = (e: React.DragEvent) => {
    const payload: DragPayload = {
      sourcePath,
      cardLine: card.line,
      cardStatus: card.status,
      fromColumn: columnName,
    }
    e.dataTransfer.setData(DRAG_MIME, JSON.stringify(payload))
    e.dataTransfer.effectAllowed = 'move'
  }

  return (
    <div
      className={`kanban-card ${card.archived ? 'kanban-card--archived' : ''}`}
      draggable={!isPending}
      onDragStart={handleDragStart}
      role="listitem"
      aria-busy={isPending}
    >
      <TaskStatusGlyph status={card.status} className="kanban-card__status" />
      <span className="kanban-card__text">{card.text}</span>
      <div className="kanban-card__actions" aria-label="Move card">
        <button
          type="button"
          className="icon-button kanban-card__move"
          aria-label={`Move ${card.text} left`}
          disabled={!canMoveLeft || isPending}
          onClick={onMoveLeft}
        >
          <ChevronLeft aria-hidden="true" />
        </button>
        <button
          type="button"
          className="icon-button kanban-card__move"
          aria-label={`Move ${card.text} right`}
          disabled={!canMoveRight || isPending}
          onClick={onMoveRight}
        >
          <ChevronRight aria-hidden="true" />
        </button>
      </div>
      {isPending && <span className="health-subtitle">Moving…</span>}
    </div>
  )
}

// ── KanbanColumn ──────────────────────────────────────────────────────────────

interface KanbanColumnProps {
  column: KanbanColumnRow
  sourcePath: string
  columns: readonly KanbanColumnRow[]
  pendingCardLine: number | null
  onDrop: (cardLine: number, fromColumn: string, toColumn: string) => void
}

function KanbanColumn({ column, sourcePath, columns, pendingCardLine, onDrop }: KanbanColumnProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const dragCounter = useRef(0)
  const columnIndex = columns.findIndex((candidate) => candidate.name === column.name)

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current += 1
    if (e.dataTransfer.types.includes(DRAG_MIME)) {
      setIsDragOver(true)
    }
  }

  const handleDragLeave = () => {
    dragCounter.current -= 1
    if (dragCounter.current <= 0) {
      dragCounter.current = 0
      setIsDragOver(false)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current = 0
    setIsDragOver(false)
    const raw = e.dataTransfer.getData(DRAG_MIME)
    if (!raw) return
    try {
      const payload = JSON.parse(raw) as DragPayload
      if (payload.fromColumn !== column.name) {
        onDrop(payload.cardLine, payload.fromColumn, column.name)
      }
    } catch {
      // Malformed payload — ignore.
    }
  }

  return (
    <div
      className={`kanban-column ${isDragOver ? 'kanban-column--drag-over' : ''}`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      role="list"
      aria-label={`${column.name} column`}
    >
      <header className="kanban-column__header">
        <h3>{column.name}</h3>
        <span className="kanban-column__count">{column.cards.length}</span>
      </header>
      <div className="kanban-column__cards">
        {column.cards.length === 0 ? (
          <p className="kanban-column__empty">No cards</p>
        ) : (
          column.cards.map((card) => (
            <KanbanCard
              key={`${card.line}-${card.text}`}
              card={card}
              sourcePath={sourcePath}
              columnName={column.name}
              canMoveLeft={columnIndex > 0}
              canMoveRight={columnIndex >= 0 && columnIndex < columns.length - 1}
              isPending={pendingCardLine === card.line}
              onMoveLeft={() => {
                if (columnIndex > 0) {
                  onDrop(card.line, column.name, columns[columnIndex - 1].name)
                }
              }}
              onMoveRight={() => {
                if (columnIndex >= 0 && columnIndex < columns.length - 1) {
                  onDrop(card.line, column.name, columns[columnIndex + 1].name)
                }
              }}
            />
          ))
        )}
      </div>
    </div>
  )
}

// ── Panel ─────────────────────────────────────────────────────────────────────

export interface KanbanPanelProps {
  /** Vault-relative path of the kanban note, or null if none active. */
  notePath: string | null
  onClose: () => void
  runSourceNoteMutation?: (sourcePath: string, runMutation: () => Promise<void>) => Promise<boolean>
}

export function KanbanPanel({ notePath, onClose, runSourceNoteMutation }: KanbanPanelProps) {
  const store = useKanbanStore(notePath, runSourceNoteMutation)
  const board = store.board
  const [isCompactLayout, setIsCompactLayout] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 820px)').matches,
  )
  const [visibleColumnIndex, setVisibleColumnIndex] = useState(0)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const media = window.matchMedia('(max-width: 820px)')
    const sync = (matches: boolean) => setIsCompactLayout(matches)
    sync(media.matches)
    const handleChange = (event: MediaQueryListEvent) => sync(event.matches)
    media.addEventListener('change', handleChange)
    return () => media.removeEventListener('change', handleChange)
  }, [])

  const isNotKanban =
    !store.isLoading && !store.error && board === null && notePath
  const safeVisibleColumnIndex = board
    ? Math.min(visibleColumnIndex, Math.max(board.columns.length - 1, 0))
    : 0
  const compactColumn = board?.columns[safeVisibleColumnIndex] ?? board?.columns[0] ?? null
  const visibleColumns = board
    ? (isCompactLayout
        ? (compactColumn ? [compactColumn] : [])
        : board.columns)
    : []

  return (
    <UnifiedPanelShell
      title={board ? board.sourcePath.split('/').pop()?.replace(/\.md$/, '') ?? 'Kanban' : 'Kanban'}
      subtitle={board ? `${board.columns.length} column${board.columns.length !== 1 ? 's' : ''}` : 'Board view'}
      icon={<Columns size={18} />}
      ariaLabel="Kanban board"
      onClose={onClose}
      className="kanban-panel"
      wide
      headerActions={
        notePath ? (
          <button
            type="button"
            className="toolbar-button"
            aria-label="Refresh kanban board"
            onClick={() => store.load(notePath)}
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        ) : undefined
      }
    >
      {!notePath && (
        <p className="empty-state">Open a kanban note to view the board.</p>
      )}
      {store.isLoading && <p className="health-subtitle">Loading board…</p>}
      {store.error && <p className="error-state">{store.error}</p>}
      {store.pendingCardLine !== null && (
        <p className="health-subtitle">Moving card and refreshing board…</p>
      )}
      {isNotKanban && (
        <p className="empty-state">
          This note is not a kanban file. Add{' '}
          <code>kanban-plugin: basic</code> to the frontmatter.
        </p>
      )}

      {board && isCompactLayout && board.columns.length > 1 ? (
        <div className="kanban-board__pager" aria-label="Kanban column pages">
          <button
            type="button"
            className="toolbar-button kanban-board__pager-button"
            aria-label="Show previous kanban column"
            disabled={safeVisibleColumnIndex === 0}
            onClick={() => setVisibleColumnIndex((index) => Math.max(index - 1, 0))}
          >
            <ChevronLeft aria-hidden="true" />
            Previous
          </button>
          <p className="kanban-board__pager-status" aria-live="polite">
            {compactColumn?.name ?? 'Column'} · {safeVisibleColumnIndex + 1} of {board.columns.length}
          </p>
          <button
            type="button"
            className="toolbar-button kanban-board__pager-button"
            aria-label="Show next kanban column"
            disabled={safeVisibleColumnIndex >= board.columns.length - 1}
            onClick={() => setVisibleColumnIndex((index) => Math.min(index + 1, board.columns.length - 1))}
          >
            Next
            <ChevronRight aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {board && (
        <div className={`kanban-board${isCompactLayout ? ' kanban-board--paged' : ''}`}>
          {visibleColumns.map((col) => (
            <KanbanColumn
              key={col.name}
              column={col}
              sourcePath={board.sourcePath}
              columns={board.columns}
              pendingCardLine={store.pendingCardLine}
              onDrop={store.moveCard}
            />
          ))}
        </div>
      )}
    </UnifiedPanelShell>
  )
}
