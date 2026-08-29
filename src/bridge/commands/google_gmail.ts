import { invoke } from '@tauri-apps/api/core'

import { requireNative } from '../native.ts'
import { authorizeSensitiveOperation } from './authorization.ts'

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
  const authorizationToken = await authorizeSensitiveOperation('google_gmail_auth', 'google-gmail-auth')
  return invoke<string>('google_gmail_start_auth', { clientId, authorizationToken })
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

export async function googleGmailGetMessage(id: string): Promise<GmailMessageContent> {
  requireNative()
  return invoke<GmailMessageContent>('google_gmail_get_message', { id })
}

export async function googleGmailModifyMessage(
  id: string,
  addLabelIds: string[] = [],
  removeLabelIds: string[] = [],
): Promise<void> {
  requireNative()
  const authorizationToken = await authorizeSensitiveOperation('google_gmail_write', id)
  await invoke('google_gmail_modify_message', { id, addLabelIds, removeLabelIds, authorizationToken })
}

export async function googleGmailTrashMessage(id: string): Promise<void> {
  requireNative()
  const authorizationToken = await authorizeSensitiveOperation('google_gmail_write', id)
  await invoke('google_gmail_trash_message', { id, authorizationToken })
}

export async function googleGmailSendMessage(rawMessage: string): Promise<void> {
  requireNative()
  const authorizationToken = await authorizeSensitiveOperation('google_gmail_send', 'gmail-send')
  await invoke('google_gmail_send_message', { rawMessage, authorizationToken })
}
