/**
 * TaskPanel.tsx — W4-5 Task list + quick-edit panel.
 *
 * Architecture:
 *  - All state lives in `useTaskStore`.  The panel only maps store state
 *    to rendered elements — no local state for data (only ephemeral UI state
 *    like expanded task id and edit form visibility).
 *  - Status changes are dispatched back to the store via `patchStatus`; the
 *    store round-trips to the indexer and reloads.
 *  - `patchDue` patches the due date in-place (optimistic update + re-fetch).
 *  - The "embedded" prop allows this to be rendered inside a knowledge
 *    workbench layout without the modal chrome.
 */

import { useRef, useState } from 'react'
import { formatLocalDate } from '@scriptor/core/date'
import {
  Calendar,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Filter,
  RefreshCw,
} from 'lucide-react'

import {
  useTaskStore,
  type RunSourceNoteMutation,
  type TaskFilter,
  type TaskRow,
  type TaskSortKey,
} from '../hooks/useTaskStore'
import { UnifiedPanelShell } from './chrome/UnifiedPanelShell'
import { TaskStatusGlyph } from './taskStatusGlyph'
import { getStatusMeta, STATUS_ORDER } from '@scriptor/core/task'

// ── Status cycle helper ────────────────────────────────────────────────────────

/** Advance through the canonical status order: open → in-progress → done → open */
function cycleStatus(current: string): string {
  const idx = STATUS_ORDER.indexOf(current)
  if (idx === -1) return 'open'
  return STATUS_ORDER[(idx + 1) % STATUS_ORDER.length]
}

// ── Task row ──────────────────────────────────────────────────────────────────

interface TaskRowItemProps {
  task: TaskRow
  expanded: boolean
  isPending: boolean
  onToggleExpand: () => void
  onPatchStatus: (taskId: string, status: string) => void
  onPatchDue: (taskId: string, dueAt: string | null) => void
  onOpenNote: (path: string) => void
}

function TaskRowItem({
  task,
  expanded,
  isPending,
  onToggleExpand,
  onPatchStatus,
  onPatchDue,
  onOpenNote,
}: TaskRowItemProps) {
  const isOverdue =
    task.dueAt != null &&
    task.status !== 'done' &&
    task.status !== 'cancelled' &&
    task.dueAt < formatLocalDate()

  // Inline due-date edit state
  const [editingDue, setEditingDue] = useState(false)
  const [dueValue, setDueValue] = useState(task.dueAt ?? '')
  const dueDateRef = useRef<HTMLInputElement>(null)

  const handleDueSave = () => {
    setEditingDue(false)
    const trimmed = dueValue.trim()
    onPatchDue(task.id, trimmed || null)
  }

  const handleDueKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleDueSave()
    if (e.key === 'Escape') {
      setDueValue(task.dueAt ?? '')
      setEditingDue(false)
    }
  }

  return (
    <li className={`task-row ${isOverdue ? 'task-row--overdue' : ''}`}>
      <div className="task-row__summary">
        {/* Status cycle button */}
        <button
          type="button"
          className="task-row__checkbox"
          aria-label={`Status: ${task.status}. Click to advance.`}
          title={`Status: ${task.status}`}
          disabled={isPending}
          onClick={() => onPatchStatus(task.id, cycleStatus(task.status))}
        >
          <TaskStatusGlyph status={task.status} />
        </button>

        {/* Title / expand toggle */}
        <button
          type="button"
          className="task-row__title"
          onClick={onToggleExpand}
          aria-expanded={expanded}
        >
          <span>{task.title}</span>
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>

        {/* Due date badge — click to edit inline */}
        {editingDue ? (
          <input
            ref={dueDateRef}
            type="date"
            className="task-row__due-input"
            value={dueValue}
            autoFocus
            disabled={isPending}
            onChange={(e) => setDueValue(e.target.value)}
            onBlur={handleDueSave}
            onKeyDown={handleDueKeyDown}
            aria-label="Edit due date"
          />
        ) : (
          <button
            type="button"
            className={`task-row__due ${isOverdue ? 'task-row__due--overdue' : ''}`}
            title={task.dueAt ? `Due ${task.dueAt} — click to edit` : 'Set due date'}
            aria-label={task.dueAt ? `Due date: ${task.dueAt}` : 'Add due date'}
            disabled={isPending}
            onClick={(e) => {
              e.stopPropagation()
              setDueValue(task.dueAt ?? '')
              setEditingDue(true)
            }}
          >
            {task.dueAt ? (
              <time dateTime={task.dueAt}>{task.dueAt}</time>
            ) : (
              <Calendar size={12} aria-hidden />
            )}
          </button>
        )}
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="task-row__detail">
          {/* Status dropdown for non-standard statuses */}
          <label className="task-row__detail-label">
            Status
            <select
              value={task.status}
              onChange={(e) => onPatchStatus(task.id, e.target.value)}
              className="task-row__status-select"
              disabled={isPending}
            >
              {STATUS_ORDER.map((s) => {
                const m = getStatusMeta(s)
                return (
                  <option key={s} value={s}>
                    {m.label}
                  </option>
                )
              })}
            </select>
          </label>

          {task.tags.length > 0 && (
            <div className="task-row__tags">
              {task.tags.map((t) => (
                <span key={t} className="tag-badge">
                  #{t}
                </span>
              ))}
            </div>
          )}
          {task.scheduledAt && (
            <p className="task-row__meta">
              <strong>Scheduled:</strong> {task.scheduledAt}
            </p>
          )}
          {task.rrule && (
            <p className="task-row__meta">
              <strong>Recurrence:</strong> {task.rrule}
            </p>
          )}
          {task.priority !== 0 && (
            <p className="task-row__meta">
              <strong>Priority:</strong> {task.priority > 0 ? `+${task.priority}` : task.priority}
            </p>
          )}
          {task.sourceNoteId && (
            <button
              type="button"
              className="task-row__open-note"
              disabled={isPending}
              onClick={() => onOpenNote(task.sourceNoteId!)}
            >
              Open source note ↗
            </button>
          )}
          {isPending && (
            <p className="task-row__meta">
              <strong>Saving…</strong>
            </p>
          )}
        </div>
      )}
    </li>
  )
}

// ── Filter bar ────────────────────────────────────────────────────────────────

const BUILT_IN_STATUSES = STATUS_ORDER
const SORT_OPTIONS: { value: TaskSortKey; label: string }[] = [
  { value: 'due', label: 'Due date' },
  { value: 'status', label: 'Status' },
  { value: 'priority', label: 'Priority' },
  { value: 'created', label: 'Created' },
]

interface FilterBarProps {
  filter: TaskFilter
  sortKey: TaskSortKey
  onSetFilter: (p: Partial<TaskFilter>) => void
  onClearFilter: () => void
  onSetSort: (k: TaskSortKey) => void
}

function FilterBar({
  filter,
  sortKey,
  onSetFilter,
  onClearFilter,
  onSetSort,
}: FilterBarProps) {
  const hasActiveFilter = !!(filter.status ?? filter.tag ?? filter.dueBefore)
  return (
    <div className="task-filter-bar">
      <Filter size={13} aria-hidden className="task-filter-bar__icon" />

      {/* Status filter */}
      <label className="task-filter-bar__label">
        Status
        <select
          value={filter.status ?? ''}
          onChange={(e) =>
            onSetFilter({ status: e.target.value || undefined })
          }
        >
          <option value="">All</option>
          {BUILT_IN_STATUSES.map((s) => {
            const m = getStatusMeta(s)
            return (
              <option key={s} value={s}>
                {m.label}
              </option>
            )
          })}
        </select>
      </label>

      {/* Due-before date filter */}
      <label className="task-filter-bar__label">
        Due before
        <input
          type="date"
          value={filter.dueBefore ?? ''}
          onChange={(e) =>
            onSetFilter({ dueBefore: e.target.value || undefined })
          }
        />
      </label>

      {/* Sort */}
      <label className="task-filter-bar__label">
        Sort
        <select
          value={sortKey}
          onChange={(e) => onSetSort(e.target.value as TaskSortKey)}
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      {/* Clear */}
      {hasActiveFilter && (
        <button
          type="button"
          className="toolbar-button"
          onClick={onClearFilter}
          title="Clear all filters"
        >
          Clear
        </button>
      )}
    </div>
  )
}

// ── Panel ─────────────────────────────────────────────────────────────────────

export interface TaskPanelProps {
  embedded?: boolean
  vaultOpen: boolean
  onClose: () => void
  onOpenNote: (path: string) => void
  runSourceNoteMutation?: RunSourceNoteMutation
}

export function TaskPanel({
  embedded = false,
  vaultOpen,
  onClose,
  onOpenNote,
  runSourceNoteMutation,
}: TaskPanelProps) {
  const store = useTaskStore(runSourceNoteMutation)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const handlePatchStatus = (taskId: string, status: string) => {
    // The store publishes mutationError for this surface. Consume the rejected
    // promise as well so a failed native mutation never escapes React's event
    // handler as an unhandled rejection.
    void store.patchStatus(taskId, status).catch(() => undefined)
  }

  const handlePatchDue = (taskId: string, dueAt: string | null) => {
    void store.patchDue(taskId, dueAt).catch(() => undefined)
  }

  const handleToggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  if (!vaultOpen) {
    return embedded ? (
      <p className="empty-state">Open a vault to view tasks.</p>
    ) : null
  }

  const body = (
    <>
      {/* Filter bar */}
      <FilterBar
        filter={store.filter}
        sortKey={store.sortKey}
        onSetFilter={store.setFilter}
        onClearFilter={store.clearFilter}
        onSetSort={store.setSortKey}
      />

      {/* Status/error */}
      {store.isLoading && (
        <p className="health-subtitle">Loading tasks…</p>
      )}
      {store.error && (
        <p className="error-state">{store.error}</p>
      )}
      {store.mutationError && (
        <p className="error-state">{store.mutationError}</p>
      )}

      {/* Task list */}
      {!store.isLoading && !store.error && (
        <ul className="task-list">
          {store.tasks.length === 0 ? (
            <li className="empty-state">No tasks match the current filter.</li>
          ) : (
            store.tasks.map((task) => (
              <TaskRowItem
                key={task.id}
                task={task}
                expanded={expandedId === task.id}
                isPending={store.pendingTaskIds.has(task.id)}
                onToggleExpand={() => handleToggleExpand(task.id)}
                onPatchStatus={handlePatchStatus}
                onPatchDue={handlePatchDue}
                onOpenNote={onOpenNote}
              />
            ))
          )}
        </ul>
      )}
    </>
  )

  if (embedded) {
    return <div className="knowledge-workbench-embed">{body}</div>
  }

  return (
    <UnifiedPanelShell
      title="Tasks"
      subtitle={`${store.tasks.length} task${store.tasks.length !== 1 ? 's' : ''}${store.filter.status ? ` · ${store.filter.status}` : ''}`}
      icon={<CheckSquare size={18} />}
      ariaLabel="Task list"
      onClose={onClose}
      className="task-panel"
      headerActions={(
        <button
          type="button"
          className="toolbar-button"
          aria-label="Refresh task list"
          onClick={store.load}
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      )}
    >
      {body}
    </UnifiedPanelShell>
  )
}
