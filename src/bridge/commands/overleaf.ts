import { invoke } from '@tauri-apps/api/core'
import { requireNative } from '../native'
import { authorizeSensitiveOperation } from './authorization'
import { overleafProjectId, overleafFilePath, parseOverleafSnapshot, type OverleafSnapshot } from '../../lib/overleaf'
export async function overleafRead(vaultId: string, project: string, path: string): Promise<OverleafSnapshot> {
  requireNative()
  const projectId = overleafProjectId(project); overleafFilePath(path)
  const authorizationToken = await authorizeSensitiveOperation('git_pull', `overleaf:read:${projectId}:${path}`)
  return parseOverleafSnapshot(await invoke('overleaf_read', { projectId, path, expectedVaultId: vaultId, authorizationToken }))
}
export async function overleafPush(vaultId: string, project: string, path: string, content: string, snapshot: OverleafSnapshot): Promise<OverleafSnapshot> {
  requireNative()
  const projectId = overleafProjectId(project); overleafFilePath(path); parseOverleafSnapshot(snapshot)
  if (new TextEncoder().encode(content).length > 2 * 1024 * 1024 || content.includes('\0')) throw new Error('Source exceeds 2 MiB or contains binary data')
  const authorizationToken = await authorizeSensitiveOperation('git_push', `overleaf:push:${projectId}:${path}:${snapshot.head}`)
  return parseOverleafSnapshot(await invoke('overleaf_push', { projectId, path, content, expectedHead: snapshot.head, expectedRemoteHash: snapshot.content_hash, expectedVaultId: vaultId, authorizationToken }))
}
