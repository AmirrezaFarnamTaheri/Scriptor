/** Serializes writes and drops queued work once its vault is no longer active. */
export function createVaultBoundSessionWrites() {
  let generation = 0
  let activeVaultId: string | null = null
  let writeTail: Promise<void> = Promise.resolve()

  return {
    beginVault: (vaultId: string | null) => {
      generation += 1
      activeVaultId = vaultId
      return generation
    },
    generation: () => generation,
    isCurrent: (vaultId: string, candidateGeneration: number) =>
      activeVaultId === vaultId && generation === candidateGeneration,
    enqueue: (vaultId: string, candidateGeneration: number, write: () => Promise<void>) => {
      const task = writeTail.then(async () => {
        if (activeVaultId !== vaultId || generation !== candidateGeneration) return
        await write()
      })
      // A failed write must not block a later, newer session update.
      writeTail = task.catch(() => undefined)
      return task
    },
  }
}
