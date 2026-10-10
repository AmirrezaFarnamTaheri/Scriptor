import { invoke } from '@tauri-apps/api/core'
import { requireNative } from '../native.ts'
import { authorizeSensitiveOperation } from './authorization.ts'
import { parseSharedRevision, type SharedRevision } from '../../lib/collaboration.ts'
export type CollaborationTransport = 'drive_json' | 'google_docs'

async function driveWriteDigest(parts: string[]): Promise<string> {
  const encoder = new TextEncoder()
  const joined = parts.map(part => `${encoder.encode(part).byteLength}:${part}`).join('')
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(joined))
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}
async function revisionWriteDigest(record: SharedRevision): Promise<string> {
  return driveWriteDigest([
    record.schema, record.id, record.document, record.peer_id,
    record.base_markdown, record.markdown, record.created_at,
  ])
}

/** Reserve the file ID on Google's server before review/upload. */
export async function collaborationGenerateRevisionId(expectedVaultId: string, folderId: string): Promise<string> {
  requireNative()
  const authorizationToken = await authorizeSensitiveOperation('google_drive_read', `drive:revision-id:${folderId}`)
  const result: unknown = await invoke('collaboration_read', {
    request: { kind: 'generate_revision_id', folder_id: folderId },
    expectedVaultId, authorizationToken,
  })
  if (!result || typeof result !== 'object' || !('id' in result)
    || typeof result.id !== 'string' || !/^[A-Za-z0-9_-]{1,200}$/.test(result.id)) {
    throw new Error('Google Drive did not allocate a valid immutable revision ID')
  }
  return result.id
}

export async function collaborationGetAccount(): Promise<string | null> {
  requireNative()
  const result: unknown = await invoke('collaboration_get_account')
  if (result === null) return null
  if (typeof result !== 'string' || !result.trim() || result.length > 320 || /[\r\n\0]/.test(result)) throw new Error('Invalid saved Google account')
  return result
}

export async function collaborationListFolders(expectedVaultId: string, pageToken?: string) {
  requireNative()
  const authorizationToken = await authorizeSensitiveOperation('google_drive_read', 'drive:folders:list')
  return parseDriveListing(await invoke('collaboration_read', { request: { kind: 'list_folders', page_token: pageToken ?? null }, expectedVaultId, authorizationToken }))
}

export async function collaborationCreateFolder(expectedVaultId: string, name: string): Promise<{ id: string; name: string }> {
  requireNative()
  const authorizationToken = await authorizeSensitiveOperation('google_drive_write', `drive:folders:create:${await driveWriteDigest([name])}`)
  return parseCreatedResource(await invoke('collaboration_write', { request: { kind: 'create_folder', name }, expectedVaultId, authorizationToken }))
}

export async function collaborationListDocs(expectedVaultId: string, folderId: string, pageToken?: string) {
  requireNative()
  const authorizationToken = await authorizeSensitiveOperation('google_drive_read', `drive:docs:list:${folderId}`)
  return parseDriveListing(await invoke('collaboration_read', { request: { kind: 'list_docs', folder_id: folderId, page_token: pageToken ?? null }, expectedVaultId, authorizationToken }))
}

function parseCreatedResource(value: unknown): { id: string; name: string } {
  const listing = parseDriveListing({ files: [value] })
  const resource = listing.files[0]
  if (!resource) throw new Error('Invalid created Google resource')
  return resource
}

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
export async function collaborationList(expectedVaultId: string, folderId: string, pageToken?: string, transport: CollaborationTransport = 'drive_json'): Promise<{ files: Array<{ id: string; name: string }>; nextPageToken?: string }> {
  requireNative()
  const authorizationToken = await authorizeSensitiveOperation('google_drive_read', transport === 'google_docs' ? `drive:docs-records:list:${folderId}` : `drive:list:${folderId}`)
  const value = await invoke<unknown>('collaboration_read', { request: { kind: 'list', folder_id: folderId, page_token: pageToken ?? null, transport }, expectedVaultId, authorizationToken })
  return parseDriveListing(value)
}
export function parseDriveListing(value: unknown): { files: Array<{ id: string; name: string }>; nextPageToken?: string } {
  if (!value || typeof value !== 'object') throw new Error('Invalid Drive listing')
  const result = value as Record<string, unknown>
  if (result.incompleteSearch === true) throw new Error('Google Drive returned an incomplete search. Retry before selecting resources.')
  if (!Array.isArray(result.files) || result.files.length > 100 || (result.nextPageToken !== undefined && (typeof result.nextPageToken !== 'string' || !result.nextPageToken || result.nextPageToken.length > 2048 || /[\u0000-\u001f\u007f]/.test(result.nextPageToken)))) throw new Error('Invalid Drive listing')
  const files = result.files.map((file: unknown) => {
    if (!file || typeof file !== 'object') throw new Error('Invalid Drive file')
    const item = file as Record<string, unknown>
    if (typeof item.id !== 'string' || typeof item.name !== 'string' || item.name.length > 1024 || !/^[A-Za-z0-9_-]{1,200}$/.test(item.id)) throw new Error('Invalid Drive file')
    return { id: item.id, name: item.name }
  })
  return { files, nextPageToken: result.nextPageToken as string | undefined }
}
export interface CollaborationPollSession { lease_id: string; expires_at: string; remaining_requests: number }
export async function collaborationPollStart(folderId: string, expectedVaultId: string, transport: CollaborationTransport = 'drive_json'): Promise<CollaborationPollSession> {
  requireNative()
  const authorizationToken = await authorizeSensitiveOperation('google_drive_read', transport === 'google_docs' ? `drive:docs-records:poll:${folderId}` : `drive:poll:${folderId}`)
  const session = await invoke<CollaborationPollSession>('collaboration_poll_start', { folderId, expectedVaultId, authorizationToken, transport })
  if (!session || !/^[A-Za-z0-9_-]{1,200}$/.test(session.lease_id) || !Number.isFinite(Date.parse(session.expires_at)) || session.remaining_requests !== 30) throw new Error('Invalid polling session')
  return session
}
export async function collaborationPollRead(leaseId: string, expectedVaultId: string) {
  requireNative()
  return parseDriveListing(await invoke('collaboration_poll_read', { leaseId, expectedVaultId }))
}
export async function collaborationPollStop(leaseId: string, expectedVaultId: string): Promise<void> {
  requireNative()
  await invoke('collaboration_poll_stop', { leaseId, expectedVaultId })
}
export async function collaborationReadDocs(expectedVaultId: string, folderId: string, fileId: string): Promise<unknown> {
  requireNative()
  const authorizationToken = await authorizeSensitiveOperation('google_drive_read', `drive:docs:read:${folderId}:${fileId}`)
  return invoke('collaboration_read', { request: { kind: 'read_docs', folder_id: folderId, file_id: fileId }, expectedVaultId, authorizationToken })
}
export async function collaborationCreateDocs(expectedVaultId: string, folderId: string, title: string, text: string): Promise<{ id: string; name: string }> {
  requireNative()
  const authorizationToken = await authorizeSensitiveOperation('google_drive_write', `drive:docs:create:${folderId}:${await driveWriteDigest([title, text])}`)
  const result = await invoke<{ id: string; name: string }>('collaboration_write', { request: { kind: 'append_docs', folder_id: folderId, title, text }, expectedVaultId, authorizationToken })
  if (!result || !/^[A-Za-z0-9_-]{1,200}$/.test(result.id) || typeof result.name !== 'string' || result.name.length > 1024) throw new Error('Invalid created Google document')
  return result
}
export async function collaborationRead(expectedVaultId: string, folderId: string, fileId: string, transport: CollaborationTransport = 'drive_json'): Promise<SharedRevision> {
  requireNative()
  const authorizationToken = await authorizeSensitiveOperation('google_drive_read', transport === 'google_docs' ? `drive:docs-record:read:${folderId}:${fileId}` : `drive:read:${folderId}:${fileId}`)
  return parseSharedRevision(await invoke('collaboration_read', { request: { kind: transport === 'google_docs' ? 'read_docs_record' : 'read', folder_id: folderId, file_id: fileId }, expectedVaultId, authorizationToken }))
}
export async function collaborationAppend(expectedVaultId: string, folderId: string, record: SharedRevision, transport: CollaborationTransport = 'drive_json'): Promise<void> {
  requireNative()
  if (transport === 'google_docs') throw new Error('Legacy Google Docs revisions are read-only. Select Drive JSON for atomic sharing.')
  const validated = parseSharedRevision(record)
  const name = `${validated.id}.json`
  const revisionDigest = await revisionWriteDigest(validated)
  const authorizationToken = await authorizeSensitiveOperation('google_drive_write',
    `drive:append:${folderId}:${name}:${revisionDigest}`)
  await invoke('collaboration_write', { request: { kind: 'append', folder_id: folderId, name, record: validated }, expectedVaultId, authorizationToken })
}
