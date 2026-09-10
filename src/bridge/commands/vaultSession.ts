import type { OpenVaultOutput } from '../../types/vault'
import { withVaultSessionLock } from '../../lib/vaultSessionLock'
import { vaultOpen as openVaultUncoordinated } from './vault'

/**
 * Open a vault only after active-session-sensitive mutations have completed.
 * New config mutations queue behind this switch until the native session is
 * fully replaced.
 */
export function vaultOpen(rootPath: string): Promise<OpenVaultOutput> {
  return withVaultSessionLock(() => openVaultUncoordinated(rootPath))
}
