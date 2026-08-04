import type { MutableRefObject } from 'react'
import { useEffect, useRef } from 'react'

import { isNativeBridgeAvailable } from '../bridge/platform'
import { subscribeVaultEvents } from '../bridge/vaultEvents'
import type { VaultDescriptor } from '../types/vault'

interface UseWorkspaceFilesystemSyncOptions {
  vault: VaultDescriptor | null
  activePathRef: MutableRefObject<string | null>
  checkExternalChangesRef: MutableRefObject<() => Promise<void>>
  applyFilesystemChangesRef: MutableRefObject<(paths: string[]) => Promise<void>>
  refreshGit: () => Promise<void>
  rebuildIndex: () => Promise<void>
  vaultRefreshTimer: MutableRefObject<number | null>
  hibernated?: boolean
  hibernateGit?: boolean
}

export function useWorkspaceFilesystemSync({
  vault,
  activePathRef,
  checkExternalChangesRef,
  applyFilesystemChangesRef,
  refreshGit,
  rebuildIndex,
  vaultRefreshTimer,
  hibernated = false,
  hibernateGit = false,
}: UseWorkspaceFilesystemSyncOptions) {
  const pendingPathsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!vault || !isNativeBridgeAvailable() || hibernated) {
      return
    }

    const onFocus = () => {
      void checkExternalChangesRef.current()
      if (!hibernateGit) {
        void refreshGit()
      }
    }

    window.addEventListener('focus', onFocus)
    void checkExternalChangesRef.current()

    return () => {
      window.removeEventListener('focus', onFocus)
    }
  }, [checkExternalChangesRef, refreshGit, vault, hibernated, hibernateGit])

  useEffect(() => {
    if (!vault || !isNativeBridgeAvailable() || hibernated) {
      return
    }

    let active = true
    let unlisten: (() => void) | undefined
    const pendingPaths = pendingPathsRef.current

    void subscribeVaultEvents({
      onFilesystemChanged: (payload) => {
        if (!active) {
          return
        }
        if (payload.rescan_required) {
          pendingPaths.clear()
          void rebuildIndex()
          return
        }
        if (payload.events.length === 0) {
          return
        }

        const activePath = activePathRef.current
        if (activePath && payload.events.some((event) => event.path === activePath)) {
          void checkExternalChangesRef.current()
        }

        for (const event of payload.events) {
          pendingPaths.add(event.path)
        }

        if (vaultRefreshTimer.current) {
          window.clearTimeout(vaultRefreshTimer.current)
        }
        vaultRefreshTimer.current = window.setTimeout(() => {
          const paths = Array.from(pendingPaths)
          pendingPaths.clear()
          if (paths.length > 0) {
            void applyFilesystemChangesRef.current(paths)
          }
        }, 500)
      },
    }).then((dispose) => {
      if (!active) {
        dispose()
        return
      }
      unlisten = dispose
    })

    return () => {
      active = false
      unlisten?.()
      if (vaultRefreshTimer.current) {
        window.clearTimeout(vaultRefreshTimer.current)
      }
      pendingPaths.clear()
    }
  }, [
    activePathRef,
    applyFilesystemChangesRef,
    checkExternalChangesRef,
    rebuildIndex,
    vault,
    vaultRefreshTimer,
    hibernated,
  ])
}
