import { overleafFilePath, overleafProjectId } from './overleaf.ts'

export interface OverleafBinding { projectId: string; remotePath: string }
const SCHEMA = 'scriptor.overleaf.binding.v1'

/** A binding stores only project coordinates, never a Git token or credentials. */
export function overleafBindingKey(vaultId: string, localPath: string): string {
  if (!vaultId.trim() || vaultId.length > 320 || /[\r\n\0]/.test(vaultId)) throw new Error('Select a vault')
  overleafFilePath(localPath)
  return `scriptor:overleaf:binding:v1:${JSON.stringify([vaultId, localPath])}`
}
export function readOverleafBinding(storage: Pick<Storage, 'getItem'>, key: string): OverleafBinding | null {
  try {
    const raw = storage.getItem(key)
    if (raw === null) return null
    if (raw.length > 2500) return null
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    const item = value as Record<string, unknown>
    if (Object.keys(item).length !== 3 || item.schema !== SCHEMA || typeof item.projectId !== 'string' || typeof item.remotePath !== 'string') return null
    const projectId = overleafProjectId(item.projectId)
    if (projectId !== item.projectId) return null
    return { projectId, remotePath: overleafFilePath(item.remotePath) }
  } catch { return null }
}
export function saveOverleafBinding(storage: Pick<Storage, 'setItem'>, key: string, project: string, path: string): void {
  const projectId = overleafProjectId(project)
  const remotePath = overleafFilePath(path)
  storage.setItem(key, JSON.stringify({ schema: SCHEMA, projectId, remotePath }))
}
export function forgetOverleafBinding(storage: Pick<Storage, 'removeItem'>, key: string): void {
  storage.removeItem(key)
}
