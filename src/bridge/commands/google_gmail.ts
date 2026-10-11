import { invoke } from '@tauri-apps/api/core'

import { requireNative } from '../native.ts'
import { authorizeSensitiveOperation } from './authorization.ts'
import { parseGmailMessageContent, parseGmailMessagePage, validateGmailListRequest, validateGmailMessageId, validateGoogleClientId } from '../../lib/googleResourceContracts.ts'
import type { GmailMessagePage } from '../../lib/googleResourceContracts.ts'

export type { GmailMessagePage } from '../../lib/googleResourceContracts.ts'

function writeParts(parts: string[]): string {
  const encoder = new TextEncoder()
  return parts.map(part => `${encoder.encode(part).byteLength}:${part}`).join('')
}
async function contentDigest(parts: string[]): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(writeParts(parts)))
  return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('')
}

export interface GmailMessagePreview {
  id: string
  threadId: string
  subject: string
  from: string
  date: string
  snippet: string
}

export interface GmailMessageContent extends GmailMessagePreview {
  plainText: string
}

export async function googleGmailStartAuth(clientId: string): Promise<string> {
  requireNative()
  validateGoogleClientId(clientId)
  const authorizationToken = await authorizeSensitiveOperation('google_gmail_auth', 'google-gmail-auth')
  return invoke<string>('google_gmail_start_auth', { clientId, authorizationToken })
}

export async function googleGmailGetAuthedEmail(): Promise<string> {
  requireNative()
  return invoke<string>('google_gmail_get_authed_email')
}

export async function googleGmailDisconnect(): Promise<void> {
  requireNative()
  const authorizationToken = await authorizeSensitiveOperation('google_gmail_disconnect', 'google-gmail-auth')
  await invoke('google_gmail_disconnect', { authorizationToken })
}

export async function googleGmailListMessages(query: string, maxResults = 25): Promise<GmailMessagePreview[]> {
  requireNative()
  return invoke<GmailMessagePreview[]>('google_gmail_list_messages', { query, maxResults })
}

export async function googleGmailListMessagesPage(query: string, maxResults = 25, pageToken: string | null = null): Promise<GmailMessagePage> {
  requireNative()
  validateGmailListRequest(query, maxResults, pageToken)
  return parseGmailMessagePage(await invoke<unknown>('google_gmail_list_messages_page', { query, maxResults, pageToken }), pageToken, maxResults)
}

export async function googleGmailGetMessage(id: string): Promise<GmailMessageContent> {
  requireNative()
  validateGmailMessageId(id)
  return parseGmailMessageContent(await invoke<unknown>('google_gmail_get_message', { id }), id)
}

export async function googleGmailModifyMessage(
  id: string,
  addLabelIds: string[] = [],
  removeLabelIds: string[] = [],
): Promise<void> {
  requireNative()
  validateGmailMessageId(id)
  if ([...addLabelIds, ...removeLabelIds].some(label => !label || label.length > 256 || /[\u0000-\u001f\u007f]/.test(label))) throw new Error('Invalid Gmail label identifier')
  const digest = await contentDigest([id, String(addLabelIds.length), ...addLabelIds, String(removeLabelIds.length), ...removeLabelIds])
  const authorizationToken = await authorizeSensitiveOperation('google_gmail_write', `gmail-modify:${id}:${digest}`)
  await invoke('google_gmail_modify_message', { id, addLabelIds, removeLabelIds, authorizationToken })
}

export async function googleGmailTrashMessage(id: string): Promise<void> {
  requireNative()
  validateGmailMessageId(id)
  const authorizationToken = await authorizeSensitiveOperation('google_gmail_write', `gmail-trash:${id}`)
  await invoke('google_gmail_trash_message', { id, authorizationToken })
}

export async function googleGmailSendMessage(rawMessage: string): Promise<void> {
  requireNative()
  const digest = await contentDigest([rawMessage])
  const authorizationToken = await authorizeSensitiveOperation('google_gmail_send', `gmail-send:${digest}`)
  await invoke('google_gmail_send_message', { rawMessage, authorizationToken })
}
