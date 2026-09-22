import { useEffect, useRef } from 'react'

import { SCREENSHOT_VAULT_ROOT } from './fixture.ts'

export function useScreenshotAutoOpen(
  openVaultAt: (rootPath: string) => Promise<void>,
  status: 'idle' | 'opening' | 'indexing' | 'ready' | 'error',
) {
  const startedRef = useRef(false)

  useEffect(() => {
    if (import.meta.env.VITE_SCREENSHOT_MODE !== 'true' && import.meta.env.VITE_E2E_MODE !== 'true') return
    // Visual coverage occasionally needs the genuine pre-vault shell. Keep the
    // opt-out confined to screenshot/E2E builds so production startup remains unchanged.
    if (window.sessionStorage.getItem('e2e:no-auto-open') === '1') return
    if (startedRef.current || status !== 'idle') return
    startedRef.current = true
    void openVaultAt(SCREENSHOT_VAULT_ROOT)
  }, [openVaultAt, status])
}
