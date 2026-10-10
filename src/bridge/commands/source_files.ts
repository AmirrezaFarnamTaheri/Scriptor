import { invoke } from '@tauri-apps/api/core'
import { requireNative } from '../native'
import { parseSourceDocument, type SourceDocument, SOURCE_FILE_LIMIT } from '../../lib/sourceFile'
export async function sourceFileRead(vaultId: string, path: string): Promise<SourceDocument> {
  requireNative()
  return parseSourceDocument(await invoke('source_file_read', { expectedVaultId: vaultId, path }), vaultId, path)
}
export async function sourceFileCreate(vaultId: string, path: string, content: string): Promise<SourceDocument> {
  requireNative()
  if (new TextEncoder().encode(content).length > SOURCE_FILE_LIMIT || content.includes('\0')) throw new Error('Source exceeds the 2 MiB text limit')
  return parseSourceDocument(await invoke('source_file_create', { expectedVaultId: vaultId, path, content }), vaultId, path)
}
export async function sourceFileSave(document: SourceDocument, content: string): Promise<SourceDocument> {
  requireNative()
  parseSourceDocument(document, document.vault_id, document.path)
  if (new TextEncoder().encode(content).length > SOURCE_FILE_LIMIT || content.includes('\0')) throw new Error('Source exceeds the 2 MiB text limit')
  return parseSourceDocument(await invoke('source_file_save', { expectedVaultId: document.vault_id, path: document.path, content, expectedContentHash: document.content_hash }), document.vault_id, document.path)
}
