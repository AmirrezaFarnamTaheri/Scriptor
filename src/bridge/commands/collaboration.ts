import { invoke } from '@tauri-apps/api/core'
import { requireNative } from '../native.ts'
import { authorizeSensitiveOperation } from './authorization.ts'
import { parseSharedRevision, type SharedRevision } from '../../lib/collaboration.ts'

export async function collaborationConnect(clientId: string): Promise<string> {
  requireNative()
  const authorizationToken = await authorizeSensitiveOperation('google_drive_auth', 'google-drive-collaboration')
  return invoke<string>('collaboration_connect', { clientId, authorizationToken })
}
export async function collaborationDisconnect(): Promise<void> {
  requireNative()
  const authorizationToken = await authorizeSensitiveOperation('keychain_delete', 'google.drive.collaboration.tokens')
  await invoke('collaboration_disconnect', { authorizationToken })
}
export async function collaborationList(folderId: string, pageToken?: string): Promise<{ files: Array<{ id: string; name: string }>; nextPageToken?: string }> {
  requireNative()
  const authorizationToken = await authorizeSensitiveOperation('google_drive_read', `drive:list:${folderId}`)
  const value = await invoke<unknown>('collaboration_read', { request: { kind: 'list', folder_id: folderId, page_token: pageToken ?? null }, authorizationToken })
  if (!value || typeof value !== 'object') throw new Error('Invalid Drive listing')
  const result = value as Record<string, unknown>
  if (!Array.isArray(result.files) || result.files.length > 100 || (result.nextPageToken !== undefined && typeof result.nextPageToken !== 'string')) throw new Error('Invalid Drive listing')
  const files = result.files.map((file: unknown) => {
    if (!file || typeof file !== 'object') throw new Error('Invalid Drive file')
    const item = file as Record<string, unknown>
    if (typeof item.id !== 'string' || typeof item.name !== 'string' || !/^[A-Za-z0-9_-]{1,200}$/.test(item.id)) throw new Error('Invalid Drive file')
    return { id: item.id, name: item.name }
  })
  return { files, nextPageToken: result.nextPageToken as string | undefined }
}
export async function collaborationRead(folderId: string, fileId: string): Promise<SharedRevision> {
  requireNative()
  const authorizationToken = await authorizeSensitiveOperation('google_drive_read', `drive:read:${folderId}:${fileId}`)
  return parseSharedRevision(await invoke('collaboration_read', { request: { kind: 'read', folder_id: folderId, file_id: fileId }, authorizationToken }))
}
export async function collaborationAppend(folderId: string, record: SharedRevision): Promise<void> {
  requireNative()
  const validated = parseSharedRevision(record)
  const name = `${validated.id}.json`
  const authorizationToken = await authorizeSensitiveOperation('google_drive_write', `drive:append:${folderId}:${name}`)
  await invoke('collaboration_write', { request: { kind: 'append', folder_id: folderId, name, record: validated }, authorizationToken })
}
