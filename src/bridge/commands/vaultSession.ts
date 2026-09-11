import type { OpenVaultOutput } from '../../types/vault'
import { withVaultSessionSwitch } from '../../lib/vaultSessionLock'
import { vaultOpen as openVaultUncoordinated } from './vault'

/**
 * Open a vault only after active-session-sensitive mutations have completed.
 * New config mutations queue behind this switch until the native session is
 * fully replaced. A successful open advances the shared session generation so
 * stale in-flight reads can retry against the new vault.
 */
export function vaultOpen(rootPath: string): Promise<OpenVaultOutput> {
  return withVaultSessionSwitch(() => openVaultUncoordinated(rootPath))
}
