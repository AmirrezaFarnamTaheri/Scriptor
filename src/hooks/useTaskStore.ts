/**
 * useTaskStore.ts — W4-5 centralised task state store.
 *
 * ## Responsibilities
 * - Own the in-memory list of `TaskRow` objects loaded from the indexer.
 * - Expose filter state (`status`, `tag`, `dueBefore`, `dueAfter`) and the
 *   derived filtered + sorted view.
 * - Provide `load()`, `setFilter()`, `patchStatus()` — all async operations
 *   return immediately and set `isLoading` / `error` accordingly.
 *
 * ## Single-definition (I-5)
 * Markdown remains authoritative on disk. All mutations go through the native
 * bridge, which rewrites the source note, refreshes the index, and then
 * re-loads the task list. Never mutate local task rows without a round-trip.
 */

import { useCallback, useEffect, useReducer, useRef, useState } from 'react'

import {
  indexerQueryTasks,
  indexerUpdateTask,
  type TaskQueryFilter,
  type TaskRow,
} from '../bridge/commands/indexer'
import { isNativeBridgeAvailable } from '../bridge/platform'

// ── Public types ──────────────────────────────────────────────────────────────

export type { TaskRow }

export interface TaskFilter {
  status?: string
  tag?: string
  dueBefore?: string
  dueAfter?: string
}

export type TaskSortKey = 'due' | 'status' | 'priority' | 'created'

export interface UseTaskStore {
  tasks: TaskRow[]
  isLoading: boolean
  error: string | null
  mutationError: string | null
  pendingTaskIds: ReadonlySet<string>
  filter: TaskFilter
  sortKey: TaskSortKey
  setFilter: (partial: Partial<TaskFilter>) => void
  clearFilter: () => void
  setSortKey: (key: TaskSortKey) => void
  load: () => void
  patchStatus: (taskId: string, newStatus: string) => Promise<void>
  patchDue: (taskId: string, dueAt: string | null) => Promise<void>
}

export type RunSourceNoteMutation = (
  sourcePath: string,
  runMutation: () => Promise<void>,
) => Promise<boolean>

interface TaskLoadState {
  tasks: TaskRow[]
  isLoading: boolean
  error: string | null
}

type TaskLoadAction =
  | { type: 'load-start' }
  | { type: 'load-success'; tasks: TaskRow[] }
  | { type: 'load-error'; message: string }

function taskLoadReducer(state: TaskLoadState, action: TaskLoadAction): TaskLoadState {
  switch (action.type) {
    case 'load-start':
      return { ...state, isLoading: true, error: null }
    case 'load-success':
      return { tasks: action.tasks, isLoading: false, error: null }
    case 'load-error':
      return { ...state, isLoading: false, error: action.message }
  }
}

// ── Sort helpers ─────────────────────────────────────────────────────────────

const STATUS_ORDER: Record<string, number> = {
  'in-progress': 0,
  open: 1,
  forwarded: 2,
  cancelled: 3,
  done: 4,
}

function sortTasks(tasks: TaskRow[], key: TaskSortKey): TaskRow[] {
  const copy = [...tasks]
  switch (key) {
    case 'due':
      return copy.sort((a, b) => {
        if (!a.dueAt && !b.dueAt) return 0
        if (!a.dueAt) return 1
        if (!b.dueAt) return -1
        return a.dueAt.localeCompare(b.dueAt)
      })
    case 'status':
      return copy.sort(
        (a, b) =>
          (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99),
      )
    case 'priority':
      return copy.sort((a, b) => a.priority - b.priority)
    case 'created':
      return copy.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    default:
      return copy
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useTaskStore(runSourceNoteMutation?: RunSourceNoteMutation): UseTaskStore {
  const [loadState, dispatch] = useReducer(taskLoadReducer, {
    tasks: [],
    isLoading: false,
    error: null,
  })
  const [filter, setFilterState] = useState<TaskFilter>({})
  const [sortKey, setSortKey] = useState<TaskSortKey>('due')
  const [pendingTaskIds, setPendingTaskIds] = useState<Set<string>>(new Set())
  const [mutationError, setMutationError] = useState<string | null>(null)

  const requestIdRef = useRef(0)

  const load = useCallback(() => {
    if (!isNativeBridgeAvailable()) {
      dispatch({ type: 'load-error', message: 'Open a vault in the desktop app to load tasks.' })
      return
    }

    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    dispatch({ type: 'load-start' })

    const queryFilter: TaskQueryFilter = {
      status: filter.status,
      tag: filter.tag,
      dueBefore: filter.dueBefore,
      dueAfter: filter.dueAfter,
    }

    void indexerQueryTasks(queryFilter, 500)
      .then((rows) => {
        if (requestId !== requestIdRef.current) return
        dispatch({ type: 'load-success', tasks: rows })
      })
      .catch((err: unknown) => {
        if (requestId !== requestIdRef.current) return
        dispatch({
          type: 'load-error',
          message: err instanceof Error ? err.message : 'Failed to load tasks',
        })
      })
  }, [filter])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => () => {
    requestIdRef.current += 1
  }, [])

  const setFilter = useCallback((partial: Partial<TaskFilter>) => {
    setFilterState((prev) => ({ ...prev, ...partial }))
  }, [])

  const clearFilter = useCallback(() => {
    setFilterState({})
  }, [])

  const patchStatus = useCallback(
    async (taskId: string, newStatus: string) => {
      setMutationError(null)
      setPendingTaskIds((prev) => new Set(prev).add(taskId))
      try {
        const sourcePath = loadState.tasks.find((task) => task.id === taskId)?.sourceNotePath
        const didMutate = sourcePath && runSourceNoteMutation
          ? await runSourceNoteMutation(sourcePath, () => indexerUpdateTask(taskId, { status: newStatus }))
          : (await indexerUpdateTask(taskId, { status: newStatus }), true)
        if (!didMutate) {
          throw new Error('Save the unsaved source note before updating its task.')
        }
        load()
      } catch (error) {
        setMutationError(error instanceof Error ? error.message : 'Failed to update task status')
        throw error
      } finally {
        setPendingTaskIds((prev) => {
          const next = new Set(prev)
          next.delete(taskId)
          return next
        })
      }
    },
    [load, loadState.tasks, runSourceNoteMutation],
  )

  const patchDue = useCallback(
    async (taskId: string, dueAt: string | null) => {
      setMutationError(null)
      setPendingTaskIds((prev) => new Set(prev).add(taskId))
      try {
        const sourcePath = loadState.tasks.find((task) => task.id === taskId)?.sourceNotePath
        const didMutate = sourcePath && runSourceNoteMutation
          ? await runSourceNoteMutation(sourcePath, () => indexerUpdateTask(taskId, { dueAt }))
          : (await indexerUpdateTask(taskId, { dueAt }), true)
        if (!didMutate) {
          throw new Error('Save the unsaved source note before updating its task.')
        }
        load()
      } catch (error) {
        setMutationError(error instanceof Error ? error.message : 'Failed to update task due date')
        throw error
      } finally {
        setPendingTaskIds((prev) => {
          const next = new Set(prev)
          next.delete(taskId)
          return next
        })
      }
    },
    [load, loadState.tasks, runSourceNoteMutation],
  )

  const sortedTasks = sortTasks(loadState.tasks, sortKey)

  return {
    tasks: sortedTasks,
    isLoading: loadState.isLoading,
    error: loadState.error,
    mutationError,
    pendingTaskIds,
    filter,
    sortKey,
    setFilter,
    clearFilter,
    setSortKey,
    load,
    patchStatus,
    patchDue,
  }
}
