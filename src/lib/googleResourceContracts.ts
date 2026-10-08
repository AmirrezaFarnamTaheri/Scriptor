/** Validates provider DTOs independently of the native bridge/runtime. */
export interface GoogleCalendarResource {
  id: string
  summary: string
  accessRole: 'owner' | 'writer' | 'reader' | 'freeBusyReader'
  primary: boolean
  writable: boolean
}
export interface GoogleTaskListResource { id: string; title: string }
export interface GmailPreview {
  id: string; threadId: string; subject: string; from: string; date: string; snippet: string
}
export interface GmailMessagePage { messages: GmailPreview[]; nextPageToken: string | null }
export interface GmailContent extends GmailPreview { plainText: string }

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid Google provider response')
  return value as Record<string, unknown>
}
function text(value: unknown, maximum: number, allowEmpty = false): string {
  if (typeof value !== 'string' || (!allowEmpty && !value.trim()) || new TextEncoder().encode(value).length > maximum || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)) {
    throw new Error('Invalid Google provider text')
  }
  return value
}
function resourceId(value: unknown): string {
  const id = text(value, 255)
  if (!/^[\x21-\x7e]+$/u.test(id)) throw new Error('Invalid Google resource ID')
  return id
}
export function validateGoogleResourceId(value: string): void { resourceId(value) }
export function validateGmailMessageId(value: string): void { messageId(value) }
export function validateGoogleClientId(value: string): void {
  if (!/^[A-Za-z0-9_.-]{1,512}$/u.test(value.trim())) throw new Error('Invalid Google OAuth client ID')
}
function resourceTitle(value: unknown): string {
  const title = text(value, 1024)
  if (/[\u0000-\u001f\u007f-\u009f]/u.test(title)) throw new Error('Invalid Google resource name')
  return title
}
function messageId(value: unknown): string {
  const id = text(value, 256)
  if (!/^[A-Za-z0-9_-]+$/u.test(id)) throw new Error('Invalid Gmail message ID')
  return id
}
function pageToken(value: unknown): string | null {
  if (value === null) return null
  const token = text(value, 2048)
  if (/\s|[\u0000-\u001f\u007f]/u.test(token)) throw new Error('Invalid Google pagination token')
  return token
}
function uniqueList<T extends { id: string }>(value: unknown, parse: (item: unknown) => T, maximum: number): T[] {
  if (!Array.isArray(value) || value.length > maximum) throw new Error('Google result exceeds the supported listing bound')
  const seen = new Set<string>()
  return value.map(item => {
    const result = parse(item)
    if (seen.has(result.id)) throw new Error('Google returned a duplicate resource')
    seen.add(result.id)
    return result
  })
}
export function parseGoogleCalendars(value: unknown): GoogleCalendarResource[] {
  return uniqueList(value, item => {
    const resource = record(item)
    const role = resource.accessRole
    if (role !== 'owner' && role !== 'writer' && role !== 'reader' && role !== 'freeBusyReader') throw new Error('Invalid Google Calendar access role')
    if (typeof resource.primary !== 'boolean' || resource.writable !== (role === 'owner' || role === 'writer')) throw new Error('Invalid Google Calendar write capability')
    return { id: resourceId(resource.id), summary: resourceTitle(resource.summary), accessRole: role, primary: resource.primary, writable: resource.writable }
  }, 1000)
}
export function parseGoogleTaskLists(value: unknown): GoogleTaskListResource[] {
  return uniqueList(value, item => {
    const resource = record(item)
    return { id: resourceId(resource.id), title: resourceTitle(resource.title) }
  }, 1000)
}
export function validateGmailListRequest(query: string, maxResults: number, token: string | null): void {
  if (typeof query !== 'string' || new TextEncoder().encode(query).length > 512 || /[\u0000-\u001f\u007f]/u.test(query)) throw new Error('Invalid Gmail search query')
  if (!Number.isInteger(maxResults) || maxResults < 1 || maxResults > 50) throw new Error('Gmail page size must be between 1 and 50')
  pageToken(token)
}
export function parseGmailMessagePage(value: unknown, previousToken: string | null = null, maxResults = 50): GmailMessagePage {
  if (!Number.isInteger(maxResults) || maxResults < 1 || maxResults > 50) throw new Error('Invalid Gmail page bound')
  const page = record(value)
  const nextPageToken = pageToken(page.nextPageToken)
  if (nextPageToken !== null && nextPageToken === previousToken) throw new Error('Gmail returned a repeated pagination token')
  const messages = uniqueList(page.messages, item => {
    const message = record(item)
    return {
      id: messageId(message.id), threadId: messageId(message.threadId), subject: text(message.subject, 16 * 1024, true),
      from: text(message.from, 16 * 1024, true), date: text(message.date, 1024, true), snippet: text(message.snippet, 16 * 1024, true),
    }
  }, maxResults)
  return { messages, nextPageToken }
}

export function parseGmailMessageContent(value: unknown, expectedId: string): GmailContent {
  const content = record(value)
  const [preview] = parseGmailMessagePage({ messages: [content], nextPageToken: null }).messages
  if (!preview || preview.id !== expectedId) throw new Error('Gmail detail did not match the requested message')
  return { ...preview, plainText: text(content.plainText, 5 * 1024 * 1024, true) }
}
