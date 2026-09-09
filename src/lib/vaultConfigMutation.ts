import { vaultLoadConfig, vaultSaveConfig } from '../bridge/commands'
import type { VaultConfig } from '../types/vault'

export type VaultConfigMutator = (current: VaultConfig) => VaultConfig

type LoadConfig = () => Promise<VaultConfig>
type SaveConfig = (config: VaultConfig) => Promise<void>

/**
 * Builds a serialized read-modify-write queue for `.scriptor/config.json`.
 *
 * Every mutation reloads the latest durable config inside the queue before
 * applying its narrow update. This prevents unrelated UI surfaces (MCP,
 * writing targets, Settings) from racing whole-object snapshots and silently
 * restoring stale fields.
 */
export function createVaultConfigMutationQueue(load: LoadConfig, save: SaveConfig) {
  let tail: Promise<void> = Promise.resolve()

  const mutate = (mutator: VaultConfigMutator): Promise<VaultConfig> => {
    let resolveResult!: (value: VaultConfig) => void
    let rejectResult!: (reason?: unknown) => void
    const result = new Promise<VaultConfig>((resolve, reject) => {
      resolveResult = resolve
      rejectResult = reject
    })

    tail = tail
      .catch(() => undefined)
      .then(async () => {
        try {
          const current = await load()
          const next = mutator(current)
          await save(next)
          resolveResult(next)
        } catch (error) {
          rejectResult(error)
        }
      })

    return result
  }

  return { mutate }
}

const sharedQueue = createVaultConfigMutationQueue(vaultLoadConfig, vaultSaveConfig)

/** Serialize all frontend config mutations through one durable RMW boundary. */
export function mutateVaultConfig(mutator: VaultConfigMutator): Promise<VaultConfig> {
  return sharedQueue.mutate(mutator)
}
