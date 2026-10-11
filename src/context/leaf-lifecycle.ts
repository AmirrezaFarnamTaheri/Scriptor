export type WorkspaceLeafCloseGuard = () => Promise<boolean>
export interface WorkspaceLeafLifecycle {
  registerGuard(leafId: string, guard: WorkspaceLeafCloseGuard): () => void
  requestClose(leafId: string): Promise<boolean>
}

/** Each mounted owner participates only in its own leaf's close decision. */
export function createWorkspaceLeafLifecycle(): WorkspaceLeafLifecycle {
  const owners = new Map<string, Map<symbol, WorkspaceLeafCloseGuard>>()
  const pending = new Map<string, Promise<boolean>>()
  return {
    registerGuard(leafId, guard) {
      const token = Symbol(leafId)
      const guards = owners.get(leafId) ?? new Map<symbol, WorkspaceLeafCloseGuard>()
      guards.set(token, guard); owners.set(leafId, guards)
      return () => {
        guards.delete(token)
        if (guards.size === 0 && owners.get(leafId) === guards) owners.delete(leafId)
      }
    },
    requestClose(leafId) {
      const existing = pending.get(leafId)
      if (existing) return existing
      const snapshot = Array.from(owners.get(leafId)?.entries() ?? [])
      if (snapshot.length === 0) return Promise.resolve(true)
      const operation = (async () => {
        try {
          for (const [, guard] of snapshot) if ((await guard()) !== true) return false
          const current = owners.get(leafId)
          return current?.size === snapshot.length && snapshot.every(([token, guard]) => current.get(token) === guard)
        } catch { return false }
      })()
      pending.set(leafId, operation)
      void operation.finally(() => { if (pending.get(leafId) === operation) pending.delete(leafId) })
      return operation
    },
  }
}
