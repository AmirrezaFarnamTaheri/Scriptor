import type { MutableRefObject } from 'react'
import { useEffect } from 'react'

import { isNativeBridgeAvailable } from '../bridge/platform'
import { subscribeVaultEvents } from '../bridge/vaultEvents'
import type { VaultDescriptor } from '../types/vault'

interface UseWorkspaceFilesystemSyncOptions {
  vault: VaultDescriptor | null
  activePathRef: MutableRefObject<string | null>
  checkExternalChangesRef: MutableRefObject<() => Promise<void>>
  applyFilesystemChangesRef: MutableRefObject<(paths: string[]) => Promise<void>>
  refreshGit: () => Promise<void>
  vaultRefreshTimer: MutableRefObject<number | null>
}

export function useWorkspaceFilesystemSync({
  vault,
  activePathRef,
  checkExternalChangesRef,
  applyFilesystemChangesRef,
  refreshGit,
  vaultRefreshTimer,
}: UseWorkspaceFilesystemSyncOptions) {
  useEffect(() => {
    if (!vault || !isNativeBridgeAvailable()) {
      return
    }

    const onFocus = () => {
      void checkExternalChangesRef.current()
      void refreshGit()
    }

    window.addEventListener('focus', onFocus)
    void checkExternalChangesRef.current()

    return () => {
      window.removeEventListener('focus', onFocus)
    }
  }, [checkExternalChangesRef, refreshGit, vault])

  useEffect(() => {
    if (!vault || !isNativeBridgeAvailable()) {
      return
    }

    let active = true
    let unlisten: (() => void) | undefined

    void subscribeVaultEvents({
      onFilesystemChanged: (payload) => {
        if (!active || payload.events.length === 0) {
          return
        }

        const activePath = activePathRef.current
        if (activePath && payload.events.some((event) => event.path === activePath)) {
          void checkExternalChangesRef.current()
        }

        if (vaultRefreshTimer.current) {
          window.clearTimeout(vaultRefreshTimer.current)
        }
        vaultRefreshTimer.current = window.setTimeout(() => {
          void applyFilesystemChangesRef.current(payload.events.map((event) => event.path))
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
    }
  }, [
    activePathRef,
    applyFilesystemChangesRef,
    checkExternalChangesRef,
    vault,
    vaultRefreshTimer,
  ])
}
