/**
 * Google Calendar & Tasks bridge
 * -------------------------------
 * Thin wrappers over the Rust `google_calendar_*` Tauri commands. Mutating and
 * network-connecting operations obtain an authorization grant token first.
 */

import { invoke } from '@tauri-apps/api/core'

import { requireNative } from '../native.ts'
import { authorizeSensitiveOperation } from './authorization.ts'
import { parseGoogleCalendars, parseGoogleTaskLists, validateGoogleClientId, validateGoogleResourceId } from '../../lib/googleResourceContracts.ts'
import type { GoogleCalendarResource, GoogleTaskListResource } from '../../lib/googleResourceContracts.ts'

export type { GoogleCalendarResource, GoogleTaskListResource } from '../../lib/googleResourceContracts.ts'

async function googleWriteDigest(parts: string[]): Promise<string> {
  const encoder = new TextEncoder()
  const payload = parts.map(part => `${encoder.encode(part).byteLength}:${part}`).join('')
  const hash = await crypto.subtle.digest('SHA-256', encoder.encode(payload))
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('')
}
async function taskWriteScope(kind: string, parts: string[]): Promise<string> {
  return `google-task-${kind}:${await googleWriteDigest(parts)}`
}

/** Complete, bounded discovery: a truncated provider list is an error. */
export async function googleCalendarListCalendars(): Promise<GoogleCalendarResource[]> {
  requireNative()
  return parseGoogleCalendars(await invoke<unknown>('google_calendar_list_calendars'))
}

export async function googleCalendarListTaskLists(): Promise<GoogleTaskListResource[]> {
  requireNative()
  return parseGoogleTaskLists(await invoke<unknown>('google_calendar_list_task_lists'))
}

export interface CalendarEvent {
  id: string
  etag?: string | null
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
  etag?: string | null
  title: string
  notes: string | null
  status: 'needsAction' | 'completed'
  due: string | null
  completed: string | null
  subtasks: GoogleTask[]
  fromVault: boolean
  sourcePath: string | null
}

export type GoogleTaskSyncMutation =
  | { kind: 'create'; title: string; notes?: string | null; due?: string | null }
  | { kind: 'update'; taskId: string; etag: string; title: string; notes: string; due?: string | null; status?: 'needsAction' | 'completed' }
  | { kind: 'complete'; taskId: string; etag: string }

export interface GoogleTaskSyncMutationResult {
  kind: GoogleTaskSyncMutation['kind']
  success: boolean
  error: string | null
}

/** Begin the OAuth2 PKCE flow. Returns the authenticated account email. */
export async function googleCalendarStartAuth(args: {
  clientId: string
  calendarId: string
  taskListId: string
}): Promise<string> {
  requireNative()
  validateGoogleClientId(args.clientId)
  validateGoogleResourceId(args.calendarId)
  validateGoogleResourceId(args.taskListId)
  const authorizationToken = await authorizeSensitiveOperation('google_calendar_auth', 'google-calendar-auth')
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
  const authorizationToken = await authorizeSensitiveOperation(
    'google_calendar_disconnect',
    'google-calendar-auth',
  )
  await invoke('google_calendar_disconnect', { authorizationToken })
}

export async function googleCalendarListEvents(
  calendarId: string,
  lookaheadDays: number,
): Promise<CalendarEvent[]> {
  requireNative()
  validateGoogleResourceId(calendarId)
  if (!Number.isInteger(lookaheadDays) || lookaheadDays < 1 || lookaheadDays > 365) throw new Error('Invalid Calendar lookahead')
  return invoke<CalendarEvent[]>('google_calendar_list_events', { calendarId, lookaheadDays })
}

export async function googleCalendarListTasks(taskListId: string): Promise<GoogleTask[]> {
  requireNative()
  validateGoogleResourceId(taskListId)
  return invoke<GoogleTask[]>('google_calendar_list_tasks', { taskListId })
}

export async function googleCalendarGetAuthedEmail(): Promise<string> {
  requireNative()
  return invoke<string>('google_calendar_get_authed_email')
}

export async function googleCalendarApplyTaskSync(
  taskListId: string,
  mutations: GoogleTaskSyncMutation[],
): Promise<GoogleTaskSyncMutationResult[]> {
  requireNative()
  if (mutations.length === 0) return []
  if (mutations.length > 1000) {
    throw new Error('Google Task sync exceeds the supported 1000-mutation bound')
  }
  const digestParts = [taskListId, String(mutations.length)]
  for (const mutation of mutations) {
    digestParts.push(
      mutation.kind,
      'taskId' in mutation ? mutation.taskId : '',
      'title' in mutation ? mutation.title : '',
      'notes' in mutation ? (mutation.notes ?? '') : '',
      'due' in mutation ? (mutation.due ?? '') : '',
      'status' in mutation ? (mutation.status ?? '') : '',
      'etag' in mutation ? mutation.etag : '',
    )
  }
  const digest = await googleWriteDigest(digestParts)
  const authorizationToken = await authorizeSensitiveOperation(
    'google_task_write',
    `Sync ${mutations.length} vault task changes:${digest}`,
  )
  return invoke<GoogleTaskSyncMutationResult[]>('google_calendar_apply_task_sync', {
    taskListId,
    mutations,
    authorizationToken,
  })
}

export async function googleCalendarCreateTask(args: {
  taskListId: string
  title: string
  notes?: string | null
  due?: string | null
}): Promise<GoogleTask> {
  requireNative()
  const authorizationToken = await authorizeSensitiveOperation('google_task_write',
    await taskWriteScope('create', [args.taskListId, args.title, args.notes ?? '', args.due ?? '']))
  return invoke<GoogleTask>('google_calendar_create_task', {
    taskListId: args.taskListId,
    title: args.title,
    notes: args.notes ?? null,
    due: args.due ?? null,
    authorizationToken,
  })
}

export async function googleCalendarUpdateTask(args: {
  taskListId: string
  taskId: string
  title: string
  notes: string
  due?: string | null
  status?: 'needsAction' | 'completed'
  etag: string
}): Promise<GoogleTask> {
  requireNative()
  const authorizationToken = await authorizeSensitiveOperation('google_task_write',
    await taskWriteScope('update', [args.taskListId, args.taskId, args.title, args.notes, args.due ?? '', args.status ?? '', args.etag]))
  return invoke<GoogleTask>('google_calendar_update_task', {
    taskListId: args.taskListId,
    taskId: args.taskId,
    title: args.title,
    notes: args.notes,
    due: args.due ?? null,
    status: args.status ?? null,
    etag: args.etag,
    authorizationToken,
  })
}

export async function googleCalendarCompleteTask(
  taskListId: string,
  taskId: string,
  etag: string,
): Promise<void> {
  requireNative()
  const authorizationToken = await authorizeSensitiveOperation('google_task_write',
    await taskWriteScope('complete', [taskListId, taskId, etag]))
  await invoke('google_calendar_complete_task', { taskListId, taskId, etag, authorizationToken })
}

export async function googleCalendarDeleteTask(taskListId: string, taskId: string, etag: string): Promise<void> {
  requireNative()
  const authorizationToken = await authorizeSensitiveOperation('google_task_write',
    await taskWriteScope('delete', [taskListId, taskId, etag]))
  await invoke('google_calendar_delete_task', { taskListId, taskId, etag, authorizationToken })
}

export type PlannerWrite =
  | { kind: 'event'; calendarId: string; eventId: string; etag: string | null; title: string; start: string; end: string; create: boolean }
  | { kind: 'task'; taskListId: string; taskId: string; etag: string; title: string; due: string | null; done: boolean }

export async function googlePlannerWrite(request: PlannerWrite): Promise<{ id: string; etag: string | null }> {
  requireNative()
  const scope = request.kind === 'event'
    ? `Google Calendar event ${request.calendarId}:${request.eventId}:${await googleWriteDigest([
      request.calendarId, request.eventId, request.etag ?? '', request.title,
      request.start, request.end, String(request.create),
    ])}`
    : `Google Task ${request.taskListId}:${request.taskId}:${await googleWriteDigest([
      request.taskListId, request.taskId, request.etag, request.title,
      request.due ?? '', String(request.done),
    ])}`
  const authorizationToken = request.kind === 'event'
    ? await authorizeSensitiveOperation('google_calendar_write', scope)
    : await authorizeSensitiveOperation('google_task_write', scope)
  const result: unknown = await invoke(request.kind === 'event' ? 'google_planner_write_event' : 'google_planner_write_task', {request, authorizationToken})
  if (!result || typeof result !== 'object' || !('id' in result) || typeof result.id !== 'string') throw new Error('Invalid planner provider result')
  return {id:result.id,etag:'etag' in result && typeof result.etag === 'string' ? result.etag : null}
}
