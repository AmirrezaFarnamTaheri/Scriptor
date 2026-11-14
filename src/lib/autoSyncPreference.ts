/** Default-on automatic sync is scoped to a confirmed account/project and one file.
 * Corrupt preferences fail closed so a malformed cache never starts network traffic. */
export type AutoSyncService = 'google_drive' | 'overleaf'
type SettingsStorage = Pick<Storage, 'getItem' | 'setItem'>

export function autoSyncPreferenceKey(service: AutoSyncService, vaultId: string, owner: string, target: string, path?: string): string {
  if (service !== 'google_drive' && service !== 'overleaf') throw new Error('Unsupported auto-sync service')
  if (!vaultId.trim() || vaultId.length > 320 || /[\r\n\0]/.test(vaultId)) throw new Error('Open a valid vault before configuring auto-sync')
  if (!owner.trim() || owner.length > 320 || /[\r\n\0]/.test(owner)) throw new Error('Select a confirmed account or project before configuring auto-sync')
  const file = path === undefined ? target : path
  if (!file || file.length > 1024 || /[\\:\0-\x1f]/.test(file)
    || file.split('/').some(part => !part || part === '.' || part === '..')) {
    throw new Error('Select a safe source path before configuring auto-sync')
  }
  if (path !== undefined && (!target || target.length > 200 || /[\r\n\0]/.test(target))) throw new Error('Select a valid shared folder')
  return `scriptor:auto-sync:v1:${JSON.stringify([service, vaultId, service === 'google_drive' ? owner.trim().toLowerCase() : owner.trim(), target, path ?? ''])}`
}

export function readAutoSyncEnabled(storage: Pick<SettingsStorage, 'getItem'>, key: string): boolean {
  try {
    const saved = storage.getItem(key)
    return saved === null || saved === 'enabled'
  } catch {
    return false
  }
}

/** The explicit Off choice persists until the user enables this scope again. */
export function writeAutoSyncEnabled(storage: Pick<SettingsStorage, 'setItem'>, key: string, enabled: boolean): void {
  storage.setItem(key, enabled ? 'enabled' : 'disabled')
}

export type AutoSyncDecision = 'equal' | 'pull' | 'push' | 'review'
/** Never overwrite unknown, missing or concurrently changed copies automatically. */
export function decideAutoSync(base: string | null, local: string, remote: string | null): AutoSyncDecision {
  if (remote === local) return 'equal'
  if (remote === null || base === null) return 'review'
  if (local === base) return 'pull'
  if (remote === base) return 'push'
  return 'review'
}
