import { useEffect, useRef } from 'react'

import { SCREENSHOT_VAULT_ROOT } from './fixture.ts'

export function useScreenshotAutoOpen(
  openVaultAt: (rootPath: string) => Promise<void>,
  status: 'idle' | 'opening' | 'indexing' | 'ready' | 'error',
) {
  const startedRef = useRef(false)

  useEffect(() => {
    if (import.meta.env.VITE_SCREENSHOT_MODE !== 'true') return
    if (startedRef.current || status !== 'idle') return
    startedRef.current = true
    void openVaultAt(SCREENSHOT_VAULT_ROOT)
  }, [openVaultAt, status])
}
