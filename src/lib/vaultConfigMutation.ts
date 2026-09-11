import { vaultLoadConfig, vaultSaveConfig } from '../bridge/commands'
import type { VaultConfig } from '../types/vault'
import { withVaultSessionLock } from './vaultSessionLock'

export type VaultConfigMutator = (current: VaultConfig) => VaultConfig

type LoadConfig = () => Promise<VaultConfig>
type SaveConfig = (config: VaultConfig) => Promise<void>

/**
 * Builds a serialized read-modify-write queue for `.scriptor/config.json`.
 *
 * Every mutation reserves the shared active-vault session barrier as soon as
 * it is enqueued, then reloads the latest durable config and performs its full
 * load/mutate/save sequence while holding that barrier. Reserving immediately
 * is important: a mutation requested for vault A must already be ahead of a
 * later vault switch even when another config mutation is still running.
 */
export function createVaultConfigMutationQueue(load: LoadConfig, save: SaveConfig) {
  const mutate = (mutator: VaultConfigMutator): Promise<VaultConfig> =>
    withVaultSessionLock(async () => {
      const current = await load()
      const next = mutator(current)
      await save(next)
      return next
    })

  return { mutate }
}

const sharedQueue = createVaultConfigMutationQueue(vaultLoadConfig, vaultSaveConfig)

/** Serialize all frontend config mutations through one durable RMW boundary. */
export function mutateVaultConfig(mutator: VaultConfigMutator): Promise<VaultConfig> {
  return sharedQueue.mutate(mutator)
}
