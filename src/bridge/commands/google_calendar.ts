/**
 * Google Calendar & Tasks bridge
 * -------------------------------
 * Thin wrappers over the Rust `google_calendar_*` Tauri commands. Mutating and
 * network-connecting operations obtain an authorization grant token first.
 */

import { invoke } from '@tauri-apps/api/core'

import { requireNative } from '../native.ts'
import { authorizeSensitiveOperation } from './authorization.ts'

export interface CalendarEvent {
  id: string
  summary: string
  description: string | null
  start: string
  end: string
  allDay: boolean
  location: string | null
  meetingLink: string | null
  calendarId: string
  status: 'confirmed' | 'tentative' | 'cancelled'
  attendees: string[]
  reminders: Array<{ method: 'popup' | 'email'; minutesBefore: number }>
  linkedNotePath: string | null
}

export interface GoogleTask {
  id: string
  title: string
  notes: string | null
  status: 'needsAction' | 'completed'
  due: string | null
  completed: string | null
  subtasks: GoogleTask[]
  fromVault: boolean
  sourcePath: string | null
}

/** Begin the OAuth2 PKCE flow. Returns the authenticated account email. */
export async function googleCalendarStartAuth(args: {
  clientId: string
  calendarId: string
  taskListId: string
}): Promise<string> {
  requireNative()
  const authorizationToken = await authorizeSensitiveOperation('google_calendar_auth', args.clientId)
  return invoke<string>('google_calendar_start_auth', {
    clientId: args.clientId,
    calendarId: args.calendarId,
    taskListId: args.taskListId,
    authorizationToken,
  })
}

/** Revoke and clear stored tokens. */
export async function googleCalendarDisconnect(): Promise<void> {
  requireNative()
  await invoke('google_calendar_disconnect')
}

export async function googleCalendarListEvents(
  calendarId: string,
  lookaheadDays: number,
): Promise<CalendarEvent[]> {
  requireNative()
  return invoke<CalendarEvent[]>('google_calendar_list_events', { calendarId, lookaheadDays })
}

export async function googleCalendarListTasks(taskListId: string): Promise<GoogleTask[]> {
  requireNative()
  return invoke<GoogleTask[]>('google_calendar_list_tasks', { taskListId })
}

export async function googleCalendarGetAuthedEmail(): Promise<string> {
  requireNative()
  return invoke<string>('google_calendar_get_authed_email')
}

export async function googleCalendarCreateTask(args: {
  taskListId: string
  title: string
  notes?: string | null
  due?: string | null
}): Promise<GoogleTask> {
  requireNative()
  const authorizationToken = await authorizeSensitiveOperation('google_task_write', args.title)
  return invoke<GoogleTask>('google_calendar_create_task', {
    taskListId: args.taskListId,
    title: args.title,
    notes: args.notes ?? null,
    due: args.due ?? null,
    authorizationToken,
  })
}

export async function googleCalendarCompleteTask(
  taskListId: string,
  taskId: string,
): Promise<void> {
  requireNative()
  const authorizationToken = await authorizeSensitiveOperation('google_task_write', taskId)
  await invoke('google_calendar_complete_task', { taskListId, taskId, authorizationToken })
}

export async function googleCalendarDeleteTask(taskListId: string, taskId: string): Promise<void> {
  requireNative()
  const authorizationToken = await authorizeSensitiveOperation('google_task_write', taskId)
  await invoke('google_calendar_delete_task', { taskListId, taskId, authorizationToken })
}
