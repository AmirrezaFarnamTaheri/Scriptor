/**
 * useGoogleCalendarSync
 * ----------------------
 * Google Calendar & Tasks integration for Scriptor.
 *
 * Authentication uses OAuth2 PKCE, tokens live in the OS keychain, and this
 * hook exposes both provider state and the vault-task bridge used by the Tasks
 * workspace. Vault task pushes carry a stable source marker so repeated syncs
 * are idempotent from the user's perspective.
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { formatLocalDate } from '@scriptor/core/date'

import {
  googleCalendarCompleteTask,
  googleCalendarCreateTask,
  googleCalendarDeleteTask,
  googleCalendarDisconnect,
  googleCalendarGetAuthedEmail,
  googleCalendarListEvents,
  googleCalendarListTasks,
  googleCalendarStartAuth,
  type CalendarEvent,
  type GoogleTask,
} from '../bridge/commands/google_calendar.ts'
import { safeExternalUrl } from '../lib/safeExternalUrl.ts'

export type CalendarSyncStatus =
  | 'disconnected'
  | 'authorizing'
  | 'syncing'
  | 'synced'
  | 'error'

export type { CalendarEvent, GoogleTask }

const EMPTY_EVENTS: CalendarEvent[] = []
const EMPTY_TASKS: GoogleTask[] = []

export interface VaultTaskNote {
  path: string
  tasks: Array<{
    id: string
    text: string
    checked: boolean
    line: number
    dueDate: string | null
  }>
}

export interface CalendarSyncConfig {
  enabled: boolean
  google_client_id: string | null
  google_calendar_id: string | null
  google_task_list_id: string | null
  lookahead_days: number
  show_events_in_tasks: boolean
  push_vault_tasks: boolean
  capture_note_path: string | null
}

export interface VaultTaskSyncResult {
  created: number
  skipped: number
  failed: number
}

export interface GoogleCalendarSyncOptions {
  config: CalendarSyncConfig | undefined
  /** Indexed vault notes with task items for push-to-Tasks. */
  vaultNotes?: VaultTaskNote[]
  /** Auto-refresh interval in seconds (0 = disabled). Default: 300. */
  refreshIntervalSeconds?: number
}

export interface GoogleCalendarSyncResult {
  status: CalendarSyncStatus
  events: CalendarEvent[]
  tasks: GoogleTask[]
  error: string | null
  authedEmail: string | null
  startAuth: () => Promise<void>
  disconnect: () => Promise<void>
  refresh: () => Promise<void>
  pushTask: (task: { title: string; notes?: string; due?: string }) => Promise<GoogleTask | null>
  completeTask: (taskId: string) => Promise<void>
  deleteTask: (taskId: string) => Promise<void>
  /** Push unchecked vault tasks that have not already been mirrored. */
  syncVaultTasks: () => Promise<VaultTaskSyncResult>
  todayAgendaMarkdown: () => string
}

const DEFAULT_LOOKAHEAD_DAYS = 7
const SOURCE_MARKER_PREFIX = 'Scriptor source:'

/** Selects events whose start date matches the user's local date. */
function eventsToday(events: CalendarEvent[]): CalendarEvent[] {
  const today = formatLocalDate()
  return events.filter((event) => {
    if (event.allDay && /^\d{4}-\d{2}-\d{2}$/.test(event.start)) {
      return event.start === today
    }
    const parsed = new Date(event.start)
    return !Number.isNaN(parsed.getTime()) && formatLocalDate(parsed) === today
  })
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}

/** Builds the stable source marker used to deduplicate mirrored vault tasks. */
function sourceMarker(taskId: string): string {
  return `${SOURCE_MARKER_PREFIX} ${taskId}`
}

/** Legacy marker retained only for one-way migration/deduplication. */
function legacySourceMarker(path: string, line: number): string {
  return `${SOURCE_MARKER_PREFIX} ${path}#L${line + 1}`
}

/** Converts a task due value to the RFC 3339 form expected by Google Tasks. */
function normalizeTaskDue(dueDate: string | null): string | undefined {
  if (!dueDate) return undefined
  if (/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    return `${dueDate}T00:00:00.000Z`
  }
  const parsed = new Date(dueDate)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString()
}

/** Coordinates Google authorization, refresh, task mutations, and vault-task mirroring. */
export function useGoogleCalendarSync({
  config,
  vaultNotes = [],
  refreshIntervalSeconds = 300,
}: GoogleCalendarSyncOptions): GoogleCalendarSyncResult {
  const [status, setStatus] = useState<CalendarSyncStatus>('disconnected')
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [tasks, setTasks] = useState<GoogleTask[]>([])
  const [error, setError] = useState<string | null>(null)
  const [authedEmail, setAuthedEmail] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lifecycleGenerationRef = useRef(0)
  const refreshGenerationRef = useRef(0)
  const taskMutationRevisionRef = useRef(0)
  const vaultSyncRunningRef = useRef(false)

  const enabled = config?.enabled ?? false
  const clientId = config?.google_client_id ?? null
  const calendarId = config?.google_calendar_id ?? 'primary'
  const taskListId = config?.google_task_list_id ?? '@default'
  const lookaheadDays = config?.lookahead_days ?? DEFAULT_LOOKAHEAD_DAYS
  const pushVaultTasksEnabled = config?.push_vault_tasks ?? false

  const startAuth = useCallback(async () => {
    if (!clientId) {
      setError('Google OAuth client ID not configured. Set it in Settings → Calendar.')
      return
    }
    const currentLifecycle = lifecycleGenerationRef.current
    const currentRefreshGen = ++refreshGenerationRef.current
    setStatus('authorizing')
    setError(null)
    try {
      const email = await googleCalendarStartAuth({
        clientId,
        calendarId,
        taskListId,
      })
      if (
        currentLifecycle !== lifecycleGenerationRef.current ||
        currentRefreshGen !== refreshGenerationRef.current
      ) return
      // OAuth success is not sync success. Load the remote state immediately
      // so automatic vault-task mirroring cannot run against a stale empty list.
      const [evtsRaw, tasksRaw, confirmedEmail] = await Promise.all([
        googleCalendarListEvents(calendarId, lookaheadDays),
        googleCalendarListTasks(taskListId),
        googleCalendarGetAuthedEmail(),
      ])
      if (
        currentLifecycle !== lifecycleGenerationRef.current ||
        currentRefreshGen !== refreshGenerationRef.current
      ) return
      setEvents(evtsRaw)
      setTasks(tasksRaw)
      setAuthedEmail(confirmedEmail || email)
      setStatus('synced')
    } catch (err) {
      if (
        currentLifecycle !== lifecycleGenerationRef.current ||
        currentRefreshGen !== refreshGenerationRef.current
      ) return
      setError(err instanceof Error ? err.message : String(err))
      setStatus('error')
    }
  }, [clientId, calendarId, taskListId, lookaheadDays])

  const disconnect = useCallback(async () => {
    lifecycleGenerationRef.current += 1
    refreshGenerationRef.current += 1
    taskMutationRevisionRef.current += 1
    try {
      await googleCalendarDisconnect()
      setStatus('disconnected')
      setAuthedEmail(null)
      setEvents([])
      setTasks([])
      setError(null)
    } catch (caught) {
      setStatus('error')
      setError(caught instanceof Error ? caught.message : String(caught))
    }
  }, [])

  const refresh = useCallback(async () => {
    if (!enabled) return
    const currentLifecycle = lifecycleGenerationRef.current
    const currentRefreshGen = ++refreshGenerationRef.current
    const capturedMutationRev = taskMutationRevisionRef.current
    setStatus('syncing')
    setError(null)
    try {
      const [evtsRaw, tasksRaw, email] = await Promise.all([
        googleCalendarListEvents(calendarId, lookaheadDays),
        googleCalendarListTasks(taskListId),
        googleCalendarGetAuthedEmail(),
      ])
      if (
        currentLifecycle !== lifecycleGenerationRef.current ||
        currentRefreshGen !== refreshGenerationRef.current
      ) return
      setEvents(evtsRaw)
      if (capturedMutationRev === taskMutationRevisionRef.current) {
        setTasks(tasksRaw)
      }
      setAuthedEmail(email)
      setStatus('synced')
    } catch (err) {
      if (
        currentLifecycle !== lifecycleGenerationRef.current ||
        currentRefreshGen !== refreshGenerationRef.current
      ) return
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.toLowerCase().includes('not authenticated') || msg.toLowerCase().includes('no token')) {
        setStatus('disconnected')
      } else {
        setError(msg)
        setStatus('error')
      }
    }
  }, [enabled, calendarId, taskListId, lookaheadDays])

  useEffect(() => {
    if (!enabled) return
    lifecycleGenerationRef.current += 1
    const initialTimer = setTimeout(() => {
      void refresh()
    }, 0)
    if (refreshIntervalSeconds > 0) {
      intervalRef.current = setInterval(() => void refresh(), refreshIntervalSeconds * 1000)
    }
    return () => {
      clearTimeout(initialTimer)
      lifecycleGenerationRef.current += 1
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [enabled, refresh, refreshIntervalSeconds])

  const pushTask = useCallback(
    async (task: { title: string; notes?: string; due?: string }): Promise<GoogleTask | null> => {
      const currentLifecycle = lifecycleGenerationRef.current
      try {
        const created = await googleCalendarCreateTask({
          taskListId,
          title: task.title,
          notes: task.notes ?? null,
          due: task.due ?? null,
        })
        if (currentLifecycle === lifecycleGenerationRef.current) {
          taskMutationRevisionRef.current += 1
          setTasks((prev) => [...prev, created])
        }
        return created
      } catch (caught) {
        if (currentLifecycle === lifecycleGenerationRef.current) {
          setError(caught instanceof Error ? caught.message : String(caught))
        }
        return null
      }
    },
    [taskListId],
  )

  const completeTask = useCallback(
    async (taskId: string) => {
      const currentLifecycle = lifecycleGenerationRef.current
      try {
        await googleCalendarCompleteTask(taskListId, taskId)
        if (currentLifecycle === lifecycleGenerationRef.current) {
          taskMutationRevisionRef.current += 1
          setTasks((prev) =>
            prev.map((task) =>
              task.id === taskId
                ? { ...task, status: 'completed' as const, completed: new Date().toISOString() }
                : task,
            ),
          )
        }
      } catch (caught) {
        if (currentLifecycle === lifecycleGenerationRef.current) {
          setError(caught instanceof Error ? caught.message : String(caught))
        }
      }
    },
    [taskListId],
  )

  const deleteTask = useCallback(
    async (taskId: string) => {
      const currentLifecycle = lifecycleGenerationRef.current
      try {
        await googleCalendarDeleteTask(taskListId, taskId)
        if (currentLifecycle === lifecycleGenerationRef.current) {
          taskMutationRevisionRef.current += 1
          setTasks((prev) => prev.filter((task) => task.id !== taskId))
        }
      } catch (caught) {
        if (currentLifecycle === lifecycleGenerationRef.current) {
          setError(caught instanceof Error ? caught.message : String(caught))
        }
      }
    },
    [taskListId],
  )

  const syncVaultTasks = useCallback(async (): Promise<VaultTaskSyncResult> => {
    if (!enabled || status === 'disconnected' || status === 'authorizing' || vaultSyncRunningRef.current) {
      return { created: 0, skipped: 0, failed: 0 }
    }
    vaultSyncRunningRef.current = true
    const existingMarkers = new Set(
      tasks.flatMap((task) =>
        (task.notes ?? '')
          .split('\n')
          .filter((line) => line.startsWith(SOURCE_MARKER_PREFIX)),
      ),
    )
    let created = 0
    let skipped = 0
    let failed = 0
    try {
      for (const note of vaultNotes) {
        for (const task of note.tasks) {
          if (task.checked) {
            skipped += 1
            continue
          }
          const marker = sourceMarker(task.id)
          const legacyMarker = legacySourceMarker(note.path, task.line)
          const sameNoteLegacyMatch = tasks.some((remoteTask) => {
            const notes = remoteTask.notes ?? ''
            return remoteTask.title === task.text && notes.includes(`${SOURCE_MARKER_PREFIX} ${note.path}#L`)
          })
          if (existingMarkers.has(marker) || existingMarkers.has(legacyMarker) || sameNoteLegacyMatch) {
            skipped += 1
            continue
          }
          const pushed = await pushTask({
            title: task.text,
            notes: marker,
            due: normalizeTaskDue(task.dueDate),
          })
          if (pushed) {
            existingMarkers.add(marker)
            created += 1
          } else {
            failed += 1
          }
        }
      }
      return { created, skipped, failed }
    } finally {
      vaultSyncRunningRef.current = false
    }
  }, [enabled, pushTask, status, tasks, vaultNotes])

  // The explicit vault setting is the user's opt-in for automatic mirroring.
  // Idempotent source markers make repeated refresh/re-open cycles safe.
  useEffect(() => {
    if (!pushVaultTasksEnabled || status !== 'synced' || vaultNotes.length === 0) return
    void syncVaultTasks()
  }, [pushVaultTasksEnabled, status, syncVaultTasks, vaultNotes.length])

  const todayAgendaMarkdown = useCallback((): string => {
    const today = eventsToday(events)
    if (today.length === 0) return '> No events today.\n'
    const lines = [`## Today, ${new Date().toLocaleDateString()}\n`]
    for (const event of today) {
      const time = event.allDay ? 'All day' : `${formatTime(event.start)} – ${formatTime(event.end)}`
      const joinUrl = safeExternalUrl(event.meetingLink)
      lines.push(`- **${event.summary}** — ${time}${event.location ? ` @ ${event.location}` : ''}${joinUrl ? ` [Join](${joinUrl})` : ''}`)
    }
    return lines.join('\n')
  }, [events])

  return {
    status: enabled ? status : 'disconnected',
    events: enabled ? events : EMPTY_EVENTS,
    tasks: enabled ? tasks : EMPTY_TASKS,
    error: enabled ? error : null,
    authedEmail: enabled ? authedEmail : null,
    startAuth,
    disconnect,
    refresh,
    pushTask,
    completeTask,
    deleteTask,
    syncVaultTasks,
    todayAgendaMarkdown,
  }
}
