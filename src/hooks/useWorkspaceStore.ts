import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  createWorkspaceBundle,
  loadGlobalWorkspace,
  parseWorkspaceBundle,
  saveGlobalWorkspace,
  serializeWorkspaceBundle,
  type PortalItem,
  type PortalStore,
  type QuickCaptureStore,
  type WorkspaceBundle,
  VAULT_WORKSPACE_PATH,
} from '@scriptor/portal'

export interface UseWorkspaceStoreOptions {
  vaultOpen?: boolean
  /** A stable identity is required before vault-backed state can be read or written. */
  vaultId?: string | null
  readVaultText?: (path: string) => Promise<string | null>
  writeVaultText?: (path: string, text: string) => Promise<void>
}

type WorkspaceUpdate = WorkspaceBundle | ((current: WorkspaceBundle) => WorkspaceBundle)

/**
 * Keeps asynchronous vault persistence attached to the vault that scheduled it.
 *
 * This is deliberately framework-free so the ordering and stale-request guards
 * can be characterized without a browser hook harness.
 */
export function createVaultWorkspacePersistence(initialBundle: WorkspaceBundle) {
  let bundle = initialBundle
  let revision = 0
  let generation = 0
  let activeVaultId: string | null = null
  let writeTail: Promise<void> = Promise.resolve()

  const apply = (update: WorkspaceUpdate) => {
    bundle = typeof update === 'function' ? update(bundle) : update
    revision += 1
    return bundle
  }

  return {
    current: () => bundle,
    revision: () => revision,
    generation: () => generation,
    isCurrentGeneration: (candidateGeneration: number) => generation === candidateGeneration,
    beginVault: (vaultId: string | null) => {
      const changed = activeVaultId !== vaultId
      generation += 1
      activeVaultId = vaultId
      return { changed, generation, revision }
    },
    apply,
    replace: (next: WorkspaceBundle) => apply(next),
    canApplyHydration: (candidateGeneration: number, candidateRevision: number) =>
      generation === candidateGeneration && revision === candidateRevision,
    enqueueWrite: (
      vaultId: string,
      candidateGeneration: number,
      write: () => Promise<void>,
    ) => {
      const task = writeTail.then(async () => {
        if (generation !== candidateGeneration || activeVaultId !== vaultId) return
        await write()
      })
      // A failed local write must not prevent a later, newer state from being
      // attempted. The caller handles the individual failure as local-only.
      writeTail = task.catch(() => undefined)
      return task
    },
  }
}

export function useWorkspaceStore(options: UseWorkspaceStoreOptions = {}) {
  const { vaultOpen = false, vaultId = null, readVaultText, writeVaultText } = options
  const [bundle, setBundle] = useState<WorkspaceBundle>(() => loadGlobalWorkspace())
  const persistenceRef = useRef(createVaultWorkspacePersistence(bundle))
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const persistence = persistenceRef.current
    let cancelled = false
    const { changed, generation } = persistence.beginVault(vaultOpen ? vaultId : null)

    void (async () => {
      // Yield once so a vault switch is committed before replacing the visible
      // bundle with its local fallback.
      await Promise.resolve()
      if (cancelled || !persistence.isCurrentGeneration(generation)) return
      if (changed) {
        const fallback = persistence.replace(loadGlobalWorkspace())
        setBundle(fallback)
        setHydrated(false)
      }
      const hydrationRevision = persistence.revision()

      if (vaultOpen && vaultId && readVaultText) {
        try {
          const raw = await readVaultText(VAULT_WORKSPACE_PATH)
          if (!cancelled && raw && persistence.canApplyHydration(generation, hydrationRevision)) {
            const hydratedBundle = persistence.replace(parseWorkspaceBundle(raw))
            setBundle(hydratedBundle)
          }
        } catch {
          // use local bundle
        }
      }
      if (!cancelled && persistence.isCurrentGeneration(generation)) {
        setHydrated(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [readVaultText, vaultId, vaultOpen])

  const persist = useCallback(
    async (update: WorkspaceUpdate) => {
      const persistence = persistenceRef.current
      const next = persistence.apply(update)
      setBundle(next)
      saveGlobalWorkspace(next)
      if (vaultOpen && vaultId && writeVaultText) {
        const generation = persistence.generation()
        try {
          await persistence.enqueueWrite(vaultId, generation, () =>
            writeVaultText(VAULT_WORKSPACE_PATH, serializeWorkspaceBundle(next)),
          )
        } catch {
          // local only
        }
      }
    },
    [vaultId, vaultOpen, writeVaultText],
  )

  const updatePortal = useCallback(
    (updater: (current: PortalStore) => PortalStore) => {
      void persist((current) => ({ ...current, portal: updater(current.portal) }))
    },
    [persist],
  )

  const updateQuickCapture = useCallback(
    (updater: (current: QuickCaptureStore) => QuickCaptureStore) => {
      void persist((current) => ({ ...current, quickCapture: updater(current.quickCapture) }))
    },
    [persist],
  )

  const portalItemsByCategory = useMemo(() => {
    const map = new Map<string, PortalItem[]>()
    for (const item of bundle.portal.items) {
      const list = map.get(item.categoryId) ?? []
      list.push(item)
      map.set(item.categoryId, list)
    }
    for (const [, items] of map) {
      items.sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.title.localeCompare(b.title))
    }
    return map
  }, [bundle.portal.items])

  const resetWorkspace = useCallback(() => {
    void persist(createWorkspaceBundle())
  }, [persist])

  return {
    hydrated,
    bundle,
    portal: bundle.portal,
    quickCapture: bundle.quickCapture,
    portalItemsByCategory,
    updatePortal,
    updateQuickCapture,
    persist,
    resetWorkspace,
  }
}
