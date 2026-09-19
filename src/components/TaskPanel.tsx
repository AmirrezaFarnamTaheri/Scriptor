/**
 * TaskPanel.tsx — W4-5 Task list + quick-edit panel.
 *
 * The native index remains authoritative for vault tasks. When Calendar sync is
 * enabled this panel is also the application-level Google Calendar/Tasks
 * surface, so provider data is useful outside Settings and vault-task mirroring
 * is wired to the complete indexed task set rather than a settings-only hook.
 */

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import {
  useGoogleCalendarSync,
  type CalendarSyncConfig,
  type VaultTaskNote,
} from '../hooks/useGoogleCalendarSync'
import { indexerQueryTasks } from '../bridge/commands/indexer'
import { UnifiedPanelShell } from './chrome/UnifiedPanelShell'
import { TaskStatusGlyph } from './taskStatusGlyph'
import { STATUS_ORDER } from '@scriptor/core/task'
import { useI18n } from '../lib/i18n'

function cycleStatus(current: string): string {
  const idx = STATUS_ORDER.indexOf(current)
  if (idx === -1) return 'open'
  return STATUS_ORDER[(idx + 1) % STATUS_ORDER.length]
}

interface TaskRowItemProps {
  task: TaskRow
  expanded: boolean
  isPending: boolean
  onToggleExpand: () => void
  onPatchStatus: (taskId: string, status: string) => void
  onPatchDue: (taskId: string, dueAt: string | null) => void
  onOpenNote: (path: string) => void
}

/** Renders one expandable vault task with status and due-date editing. */
const TaskRowItem = memo(function TaskRowItem({
  task,
  expanded,
  isPending,
  onToggleExpand,
  onPatchStatus,
  onPatchDue,
  onOpenNote,
}: TaskRowItemProps) {
  const { t } = useI18n()
  const statusLabel = t(`tasks.statuses.${task.status}`)
  const isOverdue =
    task.dueAt != null &&
    task.status !== 'done' &&
    task.status !== 'cancelled' &&
    task.dueAt < formatLocalDate()

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
        <button
          type="button"
          className="task-row__checkbox"
          aria-label={t('tasks.statusAdvance', { status: statusLabel })}
          title={t('tasks.statusTitle', { status: statusLabel })}
          disabled={isPending}
          onClick={() => onPatchStatus(task.id, cycleStatus(task.status))}
        >
          <TaskStatusGlyph status={task.status} />
        </button>

        <button
          type="button"
          className="task-row__title"
          onClick={onToggleExpand}
          aria-expanded={expanded}
        >
          <span>{task.title}</span>
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>

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
            aria-label={t('tasks.editDueDate')}
          />
        ) : (
          <button
            type="button"
            className={`task-row__due ${isOverdue ? 'task-row__due--overdue' : ''}`}
            title={task.dueAt ? t('tasks.dueTitle', { date: task.dueAt }) : t('tasks.setDueDate')}
            aria-label={task.dueAt ? t('tasks.dueDate', { date: task.dueAt }) : t('tasks.addDueDate')}
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

      {expanded && (
        <div className="task-row__detail">
          <label className="task-row__detail-label">
            {t('tasks.status')}
            <select
              value={task.status}
              onChange={(e) => onPatchStatus(task.id, e.target.value)}
              className="task-row__status-select"
              disabled={isPending}
            >
              {STATUS_ORDER.map((status) => {
                return (
                  <option key={status} value={status}>
                    {t(`tasks.statuses.${status}`)}
                  </option>
                )
              })}
            </select>
          </label>

          {task.tags.length > 0 && (
            <div className="task-row__tags">
              {task.tags.map((tag) => (
                <span key={tag} className="tag-badge">#{tag}</span>
              ))}
            </div>
          )}
          {task.scheduledAt && <p className="task-row__meta"><strong>{t('tasks.scheduled')}:</strong> {task.scheduledAt}</p>}
          {task.rrule && <p className="task-row__meta"><strong>{t('tasks.recurrence')}:</strong> {task.rrule}</p>}
          {task.priority !== 0 && (
            <p className="task-row__meta"><strong>{t('tasks.priority')}:</strong> {task.priority > 0 ? `+${task.priority}` : task.priority}</p>
          )}
          {task.sourceNotePath && (
            <button
              type="button"
              className="task-row__open-note"
              disabled={isPending}
              onClick={() => onOpenNote(task.sourceNotePath!)}
            >
              {t('tasks.openSourceNote')}
            </button>
          )}
          {isPending && <p className="task-row__meta"><strong>{t('tasks.saving')}</strong></p>}
        </div>
      )}
    </li>
  )
})

const ALL_TASKS_LIMIT = 0xFFFF_FFFF
const BUILT_IN_STATUSES = STATUS_ORDER
const SORT_OPTIONS: TaskSortKey[] = ['due', 'status', 'priority', 'created']

interface FilterBarProps {
  filter: TaskFilter
  sortKey: TaskSortKey
  onSetFilter: (p: Partial<TaskFilter>) => void
  onClearFilter: () => void
  onSetSort: (k: TaskSortKey) => void
}

/** Renders task filtering and sorting controls. */
const FilterBar = memo(function FilterBar({ filter, sortKey, onSetFilter, onClearFilter, onSetSort }: FilterBarProps) {
  const { t } = useI18n()
  const hasActiveFilter = !!(filter.status ?? filter.tag ?? filter.dueBefore)
  return (
    <div className="task-filter-bar">
      <Filter size={13} aria-hidden className="task-filter-bar__icon" />
      <label className="task-filter-bar__label">
        {t('tasks.status')}
        <select value={filter.status ?? ''} onChange={(e) => onSetFilter({ status: e.target.value || undefined })}>
          <option value="">{t('tasks.all')}</option>
          {BUILT_IN_STATUSES.map((status) => {
            return <option key={status} value={status}>{t(`tasks.statuses.${status}`)}</option>
          })}
        </select>
      </label>
      <label className="task-filter-bar__label">
        {t('tasks.dueBefore')}
        <input type="date" value={filter.dueBefore ?? ''} onChange={(e) => onSetFilter({ dueBefore: e.target.value || undefined })} />
      </label>
      <label className="task-filter-bar__label">
        {t('tasks.sort')}
        <select value={sortKey} onChange={(e) => onSetSort(e.target.value as TaskSortKey)}>
          {SORT_OPTIONS.map((option) => <option key={option} value={option}>{t(`tasks.sortOptions.${option}`)}</option>)}
        </select>
      </label>
      {hasActiveFilter && <button type="button" className="toolbar-button" onClick={onClearFilter} title={t('tasks.clearFilters')}>{t('tasks.clear')}</button>}
    </div>
  )
})

/** Groups indexed task rows into the note-shaped payload used for Google Tasks sync. */
function groupVaultTasks(rows: TaskRow[]): VaultTaskNote[] {
  const notes = new Map<string, VaultTaskNote>()
  for (const task of rows) {
    if (!task.sourceNotePath) continue
    const note = notes.get(task.sourceNotePath) ?? { path: task.sourceNotePath, tasks: [] }
    note.tasks.push({
      id: task.id,
      text: task.title,
      checked: task.status === 'done' || task.status === 'cancelled',
      line: task.line,
      dueDate: task.dueAt,
    })
    notes.set(task.sourceNotePath, note)
  }
  return [...notes.values()]
}

export interface TaskPanelProps {
  embedded?: boolean
  vaultOpen: boolean
  onClose: () => void
  onOpenNote: (path: string) => void
  runSourceNoteMutation?: RunSourceNoteMutation
  calendarConfig?: CalendarSyncConfig
}

/** Renders indexed vault tasks together with optional Google Calendar and Tasks data. */
export const TaskPanel = memo(function TaskPanel({
  embedded = false,
  vaultOpen,
  onClose,
  onOpenNote,
  runSourceNoteMutation,
  calendarConfig,
}: TaskPanelProps) {
  const { t } = useI18n()
  const store = useTaskStore(runSourceNoteMutation)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [allVaultTasks, setAllVaultTasks] = useState<TaskRow[]>([])
  const [vaultTasksComplete, setVaultTasksComplete] = useState(false)
  const [pushingVaultTasks, setPushingVaultTasks] = useState(false)
  const [vaultSyncSummary, setVaultSyncSummary] = useState<string | null>(null)
  const taskRevision = store.tasks
    .map((task) => `${task.id}:${task.updatedAt}:${task.status}:${task.dueAt ?? ''}`)
    .sort()
    .join('|')

  // Calendar mirroring must use the complete vault task set, not whatever
  // filter happens to be active in the local task list. The primitive revision
  // key avoids a fetch loop caused by the store's freshly sorted array identity.
  useEffect(() => {
    if (!vaultOpen || !calendarConfig?.enabled) {
      setAllVaultTasks([])
      setVaultTasksComplete(false)
      return
    }
    let cancelled = false
    setVaultTasksComplete(false)
    void indexerQueryTasks({}, ALL_TASKS_LIMIT)
      .then((rows) => {
        if (!cancelled) {
          setAllVaultTasks(rows)
          setVaultTasksComplete(true)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAllVaultTasks([])
          setVaultTasksComplete(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [calendarConfig?.enabled, vaultOpen, taskRevision])

  const vaultTaskNotes = useMemo(() => groupVaultTasks(allVaultTasks), [allVaultTasks])
  const calendarSync = useGoogleCalendarSync({
    config: calendarConfig,
    vaultNotes: vaultTaskNotes,
    vaultTasksComplete,
  })

  const handlePatchStatus = useCallback((taskId: string, status: string) => {
    void store.patchStatus(taskId, status).catch(() => undefined)
  }, [store])
  const handlePatchDue = useCallback((taskId: string, dueAt: string | null) => {
    void store.patchDue(taskId, dueAt).catch(() => undefined)
  }, [store])
  const handleToggleExpand = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }, [])

  const handlePushVaultTasks = async () => {
    if (pushingVaultTasks || !vaultTasksComplete || calendarSync.status !== 'synced') return
    setPushingVaultTasks(true)
    setVaultSyncSummary(null)
    try {
      const result = await calendarSync.syncVaultTasks()
      setVaultSyncSummary(t('tasks.google.pushResult', {
        created: result.created,
        updated: result.updated,
        skipped: result.skipped,
        failed: result.failed,
        pending: result.pending,
      }))
    } finally {
      setPushingVaultTasks(false)
    }
  }

  if (!vaultOpen) {
    return embedded ? <p className="empty-state">{t('tasks.openVault')}</p> : null
  }

  const body = (
    <>
      {calendarConfig?.enabled ? (
        <section className="settings-section" aria-label={t('tasks.google.ariaLabel')}>
          <div className="section-heading-row">
            <div>
              <h3>{t('tasks.google.title')}</h3>
              <p className="health-subtitle">
                {calendarSync.authedEmail ? `${t(`integrations.google.status.${calendarSync.status}`)} · ${calendarSync.authedEmail}` : t(`integrations.google.status.${calendarSync.status}`)}
              </p>
            </div>
            <div className="calendar-sync-actions">
              <button
                type="button"
                className="toolbar-button"
                onClick={() => void calendarSync.refresh()}
                disabled={calendarSync.status === 'syncing' || calendarSync.status === 'authorizing'}
              >
                <RefreshCw size={14} /> {t('tasks.google.sync')}
              </button>
              {calendarConfig.push_vault_tasks ? (
                <button
                  type="button"
                  className="toolbar-button"
                  onClick={() => void handlePushVaultTasks()}
                  disabled={calendarSync.status !== 'synced' || pushingVaultTasks || !vaultTasksComplete}
                >
                  {pushingVaultTasks ? t('tasks.google.pushingVaultTasks') : t('tasks.google.pushVaultTasks')}
                </button>
              ) : null}
            </div>
          </div>
          {calendarSync.error ? <p className="error-state" role="alert">{calendarSync.error}</p> : null}
          {vaultSyncSummary ? <p className="health-subtitle" role="status">{vaultSyncSummary}</p> : null}

          {calendarConfig.show_events_in_tasks ? (
            <div>
              <h4>{t('tasks.google.upcomingEvents')}</h4>
              {calendarSync.events.length === 0 ? (
                <p className="health-subtitle">{t('tasks.google.noEvents')}</p>
              ) : (
                <ul className="compact-list">
                  {calendarSync.events.slice(0, 8).map((event) => (
                    <li key={event.id}>
                      <strong>{event.summary || t('tasks.google.untitledEvent')}</strong>{' '}
                      <time dateTime={event.start}>{event.start}</time>
                      {event.location ? <span> · {event.location}</span> : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}

          <div>
            <h4>{t('tasks.google.tasks')}</h4>
            {calendarSync.tasks.length === 0 ? (
              <p className="health-subtitle">{t('tasks.google.noTasks')}</p>
            ) : (
              <ul className="compact-list">
                {calendarSync.tasks.slice(0, 12).map((task) => (
                  <li key={task.id}>
                    <span>{task.title}</span>
                    {task.due ? <time dateTime={task.due}> · {task.due}</time> : null}
                    {task.status !== 'completed' ? (
                      <button type="button" className="toolbar-button" onClick={() => void calendarSync.completeTask(task.id)}>
                        {t('tasks.google.complete')}
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      ) : null}

      <FilterBar
        filter={store.filter}
        sortKey={store.sortKey}
        onSetFilter={store.setFilter}
        onClearFilter={store.clearFilter}
        onSetSort={store.setSortKey}
      />

      {store.isLoading && <p className="health-subtitle">{t('tasks.loading')}</p>}
      {store.error && <p className="error-state">{store.error}</p>}
      {store.mutationError && <p className="error-state">{store.mutationError}</p>}

      {!store.isLoading && !store.error && (
        <ul className="task-list">
          {store.tasks.length === 0 ? (
            <li className="empty-state">{t('tasks.noMatches')}</li>
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

  if (embedded) return <div className="knowledge-workbench-embed">{body}</div>

  return (
    <UnifiedPanelShell
      title={t('tasks.title')}
      subtitle={`${store.tasks.length} ${store.tasks.length === 1 ? t('tasks.taskSingular') : t('tasks.taskPlural')}${store.filter.status ? ` · ${t(`tasks.statuses.${store.filter.status}`)}` : ''}`}
      icon={<CheckSquare size={18} />}
      ariaLabel={t('tasks.ariaLabel')}
      onClose={onClose}
      className="task-panel"
      headerActions={(
        <button type="button" className="toolbar-button" aria-label={t('tasks.refreshAria')} onClick={store.load}>
          <RefreshCw size={14} /> {t('tasks.refresh')}
        </button>
      )}
    >
      {body}
    </UnifiedPanelShell>
  )
})
