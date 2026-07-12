import { useEffect } from 'react'

interface PlatformShellHandlers {
  onQuickCapture?: () => void
  onDeepLink?: (url: string) => void
}

function parseDeepLink(url: string): { kind: 'vault' | 'note'; path: string } | null {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'scriptor:') return null
    const path = parsed.searchParams.get('path') ?? parsed.pathname.replace(/^\//, '')
    if (!path) return null
    if (parsed.host === 'note' || parsed.pathname.startsWith('/note')) {
      return { kind: 'note', path }
    }
    return { kind: 'vault', path }
  } catch {
    return null
  }
}

export function usePlatformShell({ onDeepLink, onQuickCapture }: PlatformShellHandlers) {
  useEffect(() => {
    if (import.meta.env.VITE_E2E_MODE === 'true' || import.meta.env.VITE_SCREENSHOT_MODE === 'true') {
      return
    }

    let disposed = false
    let unlistenAction: (() => void) | undefined
    let unlistenDeepLink: (() => void) | undefined

    const register = async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event')
        const actionCleanup = await listen<{ action: string; payload?: string | null }>(
          'platform:action',
          (event) => {
            if (event.payload.action === 'quick-capture') {
              onQuickCapture?.()
            }
          },
        )
        if (disposed) {
          actionCleanup()
          return
        }
        unlistenAction = actionCleanup

        const deepLinkCleanup = await listen<{ action: string; payload?: string | null }>(
          'platform:deep-link',
          (event) => {
            const url = event.payload.payload
            if (url) {
              onDeepLink?.(url)
            }
          },
        )
        if (disposed) {
          deepLinkCleanup()
          return
        }
        unlistenDeepLink = deepLinkCleanup
      } catch {
        // Browser dev mode without Tauri shell.
      }
    }

    void register()

    return () => {
      disposed = true
      unlistenAction?.()
      unlistenDeepLink?.()
    }
  }, [onDeepLink, onQuickCapture])
}

export { parseDeepLink }
