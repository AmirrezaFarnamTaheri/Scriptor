/**
 * useGoogleCalendarSync
 * ----------------------
 * Google Calendar & Tasks integration for Scriptor.
 *
 * Design adopted from google_workspace_mcp patterns:
 *  - OAuth2 PKCE flow (no client secret stored on device)
 *  - Scoped token: calendar.readonly + tasks (configurable)
 *  - Events pulled into CalendarEvent[], push vault tasks to Google Tasks
 *  - Conforms to Google Calendar API v3 shape (from gws_mcp analysis)
 *
 * Auth flow:
 *  1. `startAuth()` → Tauri opens system browser with OAuth2 URL
 *  2. Localhost redirect captures `code` → exchanged for tokens via Tauri
 *  3. Tokens stored in OS keychain via `tauri-plugin-keyring`
 *  4. Refresh handled transparently before each API call
 *
 * Usage:
 *  ```tsx
 *  const { events, tasks, status, startAuth, disconnect, refresh,
 *          pushTask, completeTask, deleteTask } =
 *    useGoogleCalendarSync({ config: vaultConfig?.calendar_sync, vaultNotes })
 *  ```
 */

import { useState, useCallback, useEffect, useRef } from 'react'

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

// ---------------------------------------------------------------------------
// Types (aligned with Google Calendar API v3 + Tasks API v1 shapes)
// ---------------------------------------------------------------------------

export type CalendarSyncStatus =
  | 'disconnected'
  | 'authorizing'
  | 'syncing'
  | 'synced'
  | 'error'

export type { CalendarEvent, GoogleTask }

export interface VaultTaskNote {
  path: string
  tasks: Array<{
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
  /** Auth error or sync error message */
  error: string | null
  /** Authed user email */
  authedEmail: string | null
  /** Start the OAuth2 PKCE auth flow */
  startAuth: () => Promise<void>
  /** Revoke tokens and clear keychain */
  disconnect: () => Promise<void>
  /** Manually refresh events + tasks */
  refresh: () => Promise<void>
  /** Push a new task to Google Tasks */
  pushTask: (task: { title: string; notes?: string; due?: string }) => Promise<GoogleTask | null>
  /** Mark a Google Task as completed */
  completeTask: (taskId: string) => Promise<void>
  /** Delete a Google Task */
  deleteTask: (taskId: string) => Promise<void>
  /** Pull today's events as a formatted block for quick-capture */
  todayAgendaMarkdown: () => string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Lookahead window applied when no calendar config is present yet. */
const DEFAULT_LOOKAHEAD_DAYS = 7

function eventsToday(events: CalendarEvent[]): CalendarEvent[] {
  const today = new Date().toISOString().slice(0, 10)
  return events.filter((e) => e.start.startsWith(today))
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useGoogleCalendarSync({
  config,
  vaultNotes: _vaultNotes = [],
  refreshIntervalSeconds = 300,
}: GoogleCalendarSyncOptions): GoogleCalendarSyncResult {
  const [status, setStatus] = useState<CalendarSyncStatus>('disconnected')
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [tasks, setTasks] = useState<GoogleTask[]>([])
  const [error, setError] = useState<string | null>(null)
  const [authedEmail, setAuthedEmail] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // `config` is typically rebuilt on every parent render, so every callback and
  // effect below keys off its primitive fields instead. Depending on the object
  // identity would tear down and re-create the refresh interval on each render.
  const enabled = config?.enabled ?? false
  const clientId = config?.google_client_id ?? null
  const calendarId = config?.google_calendar_id ?? 'primary'
  const taskListId = config?.google_task_list_id ?? '@default'
  const lookaheadDays = config?.lookahead_days ?? DEFAULT_LOOKAHEAD_DAYS

  // ---------------------------------------------------------------------------
  // Auth
  // ---------------------------------------------------------------------------

  const startAuth = useCallback(async () => {
    if (!clientId) {
      setError('Google OAuth client ID not configured. Set it in Settings → Calendar.')
      return
    }
    setStatus('authorizing')
    setError(null)
    try {
      const email = await googleCalendarStartAuth({
        clientId,
        calendarId,
        taskListId,
      })
      setAuthedEmail(email)
      setStatus('synced')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setStatus('error')
    }
  }, [clientId, calendarId, taskListId])

  const disconnect = useCallback(async () => {
    try {
      await googleCalendarDisconnect()
    } catch {
      // best-effort
    }
    setStatus('disconnected')
    setAuthedEmail(null)
    setEvents([])
    setTasks([])
    setError(null)
  }, [])

  // ---------------------------------------------------------------------------
  // Sync
  // ---------------------------------------------------------------------------

  const refresh = useCallback(async () => {
    if (!enabled) return
    setStatus('syncing')
    setError(null)
    try {
      const [evtsRaw, tasksRaw, email] = await Promise.all([
        googleCalendarListEvents(calendarId, lookaheadDays),
        googleCalendarListTasks(taskListId),
        googleCalendarGetAuthedEmail(),
      ])
      setEvents(evtsRaw)
      setTasks(tasksRaw)
      setAuthedEmail(email)
      setStatus('synced')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      // Disconnected / no token → show disconnected rather than error
      if (msg.toLowerCase().includes('not authenticated') || msg.toLowerCase().includes('no token')) {
        setStatus('disconnected')
      } else {
        setError(msg)
        setStatus('error')
      }
    }
  }, [enabled, calendarId, taskListId, lookaheadDays])

  // Initial sync + interval refresh
  useEffect(() => {
    if (!enabled) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial sync kick-off; refresh() transitions status as an external-system sync
    void refresh()
    if (refreshIntervalSeconds > 0) {
      intervalRef.current = setInterval(() => void refresh(), refreshIntervalSeconds * 1000)
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [enabled, refresh, refreshIntervalSeconds])

  // ---------------------------------------------------------------------------
  // Task mutations
  // ---------------------------------------------------------------------------

  const pushTask = useCallback(
    async (task: { title: string; notes?: string; due?: string }): Promise<GoogleTask | null> => {
      try {
        const created = await googleCalendarCreateTask({
          taskListId,
          title: task.title,
          notes: task.notes ?? null,
          due: task.due ?? null,
        })
        setTasks((prev) => [...prev, created])
        return created
      } catch {
        return null
      }
    },
    [taskListId],
  )

  const completeTask = useCallback(
    async (taskId: string) => {
      try {
        await googleCalendarCompleteTask(taskListId, taskId)
        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? { ...t, status: 'completed' as const, completed: new Date().toISOString() }
              : t,
          ),
        )
      } catch {
        // ignore; UI will re-sync on next refresh
      }
    },
    [taskListId],
  )

  const deleteTask = useCallback(
    async (taskId: string) => {
      try {
        await googleCalendarDeleteTask(taskListId, taskId)
        setTasks((prev) => prev.filter((t) => t.id !== taskId))
      } catch {
        // ignore
      }
    },
    [taskListId],
  )

  // ---------------------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------------------

  const todayAgendaMarkdown = useCallback((): string => {
    const today = eventsToday(events)
    if (today.length === 0) return '> No events today.\n'
    const lines = [`## Today, ${new Date().toLocaleDateString()}\n`]
    for (const evt of today) {
      const time = evt.allDay ? 'All day' : `${formatTime(evt.start)} – ${formatTime(evt.end)}`
      // Provider-supplied link: only https/http survives, so a `javascript:` or
      // `data:` payload can never reach the rendered Markdown.
      const joinUrl = safeExternalUrl(evt.meetingLink)
      lines.push(`- **${evt.summary}** — ${time}${evt.location ? ` @ ${evt.location}` : ''}${joinUrl ? ` [Join](${joinUrl})` : ''}`)
    }
    return lines.join('\n')
  }, [events])

  return {
    status,
    events,
    tasks,
    error,
    authedEmail,
    startAuth,
    disconnect,
    refresh,
    pushTask,
    completeTask,
    deleteTask,
    todayAgendaMarkdown,
  }
}
