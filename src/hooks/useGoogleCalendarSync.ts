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
  googleCalendarApplyTaskSync,
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
  type GoogleTaskSyncMutation,
} from '../bridge/commands/google_calendar.ts'
import { safeExternalUrl } from '../lib/safeExternalUrl.ts'
import { googleAuthErrorMessage, isGoogleAuthRequiredError } from '../lib/googleAuthErrors.ts'

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
  updated: number
  skipped: number
  failed: number
  /** Mutations intentionally deferred to a later user-approved sync batch. */
  pending: number
}

export interface GoogleCalendarSyncOptions {
  config: CalendarSyncConfig | undefined
  /** Indexed vault notes with task items for push-to-Tasks. */
  vaultNotes?: VaultTaskNote[]
  /** True only after an authoritative all-task query has completed successfully. */
  vaultTasksComplete?: boolean
  /** Auto-refresh interval in seconds (0 = disabled). Default: 300. */
  refreshIntervalSeconds?: number
}

export interface GoogleCalendarSyncResult {
  status: CalendarSyncStatus
  events: CalendarEvent[]
  tasks: GoogleTask[]
  error: string | null
  authedEmail: string | null
  startAuth: () => Promise<boolean>
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
const MAX_TASK_SYNC_MUTATIONS_PER_APPROVAL = 1000
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

function taskDueKey(value: string | null | undefined): string | null {
  if (!value) return null
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value)
  return match?.[1] ?? null
}

function reconciledTaskNotes(remoteNotes: string | null, marker: string): string {
  const preserved = (remoteNotes ?? '')
    .split('\n')
    .filter((line) => !line.startsWith(SOURCE_MARKER_PREFIX) && line.trim().length > 0)
  return [...preserved, marker].join('\n')
}

function hasScriptorSourceMarker(task: GoogleTask): boolean {
  return (task.notes ?? '')
    .split('\n')
    .some((line) => line.startsWith(SOURCE_MARKER_PREFIX))
}

/** Coordinates Google authorization, refresh, task mutations, and vault-task mirroring. */
export function useGoogleCalendarSync({
  config,
  vaultNotes = [],
  vaultTasksComplete = false,
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

  const startAuth = useCallback(async (): Promise<boolean> => {
    if (!clientId) {
      setError('Google OAuth client ID not configured. Set it in Settings → Integrations.')
      return false
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
      ) return false
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
      ) return false
      setEvents(evtsRaw)
      setTasks(tasksRaw)
      setAuthedEmail(confirmedEmail || email)
      setStatus('synced')
      return true
    } catch (err) {
      if (
        currentLifecycle !== lifecycleGenerationRef.current ||
        currentRefreshGen !== refreshGenerationRef.current
      ) return false
      setError(googleAuthErrorMessage(err))
      setStatus('error')
      return false
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
      setError(googleAuthErrorMessage(caught))
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
      if (isGoogleAuthRequiredError(err)) {
        setStatus('disconnected')
        setError(googleAuthErrorMessage(err))
      } else {
        setError(googleAuthErrorMessage(err))
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
          setError(googleAuthErrorMessage(caught))
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
          setError(googleAuthErrorMessage(caught))
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
          setError(googleAuthErrorMessage(caught))
        }
      }
    },
    [taskListId],
  )

  const syncVaultTasks = useCallback(async (): Promise<VaultTaskSyncResult> => {
    if (!enabled || !vaultTasksComplete || status !== 'synced' || vaultSyncRunningRef.current) {
      return { created: 0, updated: 0, skipped: 0, failed: 0, pending: 0 }
    }

    vaultSyncRunningRef.current = true
    const currentLifecycle = lifecycleGenerationRef.current
    const matchedRemoteIds = new Set<string>()
    const mutations: GoogleTaskSyncMutation[] = []
    let skipped = 0

    try {
      for (const note of vaultNotes) {
        for (const task of note.tasks) {
          const marker = sourceMarker(task.id)
          const legacyMarker = legacySourceMarker(note.path, task.line)

          let matchingRemote = tasks.find((remoteTask) => {
            if (matchedRemoteIds.has(remoteTask.id)) return false
            const markerLines = (remoteTask.notes ?? '').split('\n')
            return markerLines.includes(marker) || markerLines.includes(legacyMarker)
          })

          // A note move can legitimately change native task identity. Rebind a
          // single unambiguous Scriptor-authored task by title; duplicate titles
          // remain conservative rather than guessing.
          if (!matchingRemote) {
            const titleMatches = tasks.filter((remoteTask) =>
              !matchedRemoteIds.has(remoteTask.id)
              && remoteTask.title === task.text
              && hasScriptorSourceMarker(remoteTask),
            )
            if (titleMatches.length === 1) matchingRemote = titleMatches[0]
          }

          if (task.checked) {
            if (!matchingRemote || matchingRemote.status === 'completed') {
              skipped += 1
            } else {
              matchedRemoteIds.add(matchingRemote.id)
              mutations.push({ kind: 'complete', taskId: matchingRemote.id })
            }
            continue
          }

          if (matchingRemote) {
            matchedRemoteIds.add(matchingRemote.id)
            const desiredDue = normalizeTaskDue(task.dueDate)
            const desiredNotes = reconciledTaskNotes(matchingRemote.notes, marker)
            const needsUpdate =
              matchingRemote.status === 'completed'
              || matchingRemote.title !== task.text
              || taskDueKey(matchingRemote.due) !== taskDueKey(desiredDue)
              || desiredNotes !== (matchingRemote.notes ?? '')

            if (!needsUpdate) {
              skipped += 1
              continue
            }

            mutations.push({
              kind: 'update',
              taskId: matchingRemote.id,
              title: task.text,
              notes: desiredNotes,
              due: desiredDue,
              status: matchingRemote.status === 'completed' ? 'needsAction' : undefined,
            })
            continue
          }

          mutations.push({
            kind: 'create',
            title: task.text,
            notes: marker,
            due: normalizeTaskDue(task.dueDate),
          })
        }
      }

      // Any still-open remote task carrying a Scriptor marker but not matched
      // above represents a local task that was removed. Completing rather than
      // deleting preserves Google history while making the open-task mirror exact.
      for (const remoteTask of tasks) {
        if (
          matchedRemoteIds.has(remoteTask.id)
          || remoteTask.status === 'completed'
          || !hasScriptorSourceMarker(remoteTask)
        ) {
          continue
        }
        matchedRemoteIds.add(remoteTask.id)
        mutations.push({ kind: 'complete', taskId: remoteTask.id })
      }

      if (mutations.length === 0) {
        return { created: 0, updated: 0, skipped, failed: 0, pending: 0 }
      }

      // One explicit user approval authorizes one bounded provider mutation
      // batch. Large vaults advance deterministically across repeated presses
      // instead of failing the whole sync above the native 1000-item guard or
      // surprising the user with a chain of authorization dialogs.
      const batch = mutations.slice(0, MAX_TASK_SYNC_MUTATIONS_PER_APPROVAL)
      const pending = mutations.length - batch.length
      const results = await googleCalendarApplyTaskSync(taskListId, batch)
      if (currentLifecycle !== lifecycleGenerationRef.current) {
        return { created: 0, updated: 0, skipped, failed: 0 }
      }

      let created = 0
      let updated = 0
      let failed = 0
      const errors: string[] = []
      for (const result of results) {
        if (!result.success) {
          failed += 1
          if (result.error) errors.push(result.error)
          continue
        }
        if (result.kind === 'create') created += 1
        else updated += 1
      }

      const successful = created + updated
      if (successful > 0) {
        taskMutationRevisionRef.current += successful
        try {
          const refreshedTasks = await googleCalendarListTasks(taskListId)
          if (currentLifecycle === lifecycleGenerationRef.current) {
            setTasks(refreshedTasks)
          }
        } catch (caught) {
          errors.push(googleAuthErrorMessage(caught))
        }
      }

      if (errors.length > 0 && currentLifecycle === lifecycleGenerationRef.current) {
        setError(
          failed > 0
            ? `${failed} Google Task change${failed === 1 ? '' : 's'} failed. ${errors[0]}`
            : errors[0]!,
        )
      } else if (currentLifecycle === lifecycleGenerationRef.current) {
        setError(null)
      }

      return { created, updated, skipped, failed, pending }
    } catch (caught) {
      if (currentLifecycle === lifecycleGenerationRef.current) {
        setError(googleAuthErrorMessage(caught))
      }
      const attempted = Math.min(mutations.length, MAX_TASK_SYNC_MUTATIONS_PER_APPROVAL)
      return {
        created: 0,
        updated: 0,
        skipped,
        failed: attempted,
        pending: Math.max(0, mutations.length - attempted),
      }
    } finally {
      vaultSyncRunningRef.current = false
    }
  }, [enabled, status, taskListId, tasks, vaultNotes, vaultTasksComplete])


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
