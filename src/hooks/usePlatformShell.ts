import { useEffect, useRef } from 'react'

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

export function usePlatformShell(handlers: PlatformShellHandlers) {
  const handlersRef = useRef(handlers)

  useEffect(() => {
    handlersRef.current = handlers
  }, [handlers])

  useEffect(() => {
    if (import.meta.env.VITE_E2E_MODE === 'true' || import.meta.env.VITE_SCREENSHOT_MODE === 'true') {
      return
    }

    let active = true
    let unlistenAction: (() => void) | undefined
    let unlistenDeepLink: (() => void) | undefined

    void (async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event')
        const disposeAction = await listen<{ action: string; payload?: string | null }>(
          'platform:action',
          (event) => {
            if (event.payload.action === 'quick-capture') {
              handlersRef.current.onQuickCapture?.()
            }
          },
        )
        if (!active) {
          disposeAction()
          return
        }
        unlistenAction = disposeAction
        const disposeDeepLink = await listen<{ action: string; payload?: string | null }>(
          'platform:deep-link',
          (event) => {
            const url = event.payload.payload
            if (url) {
              handlersRef.current.onDeepLink?.(url)
            }
          },
        )
        if (!active) {
          disposeDeepLink()
          return
        }
        unlistenDeepLink = disposeDeepLink
      } catch {
        // Browser dev mode without Tauri shell
      }
    })()

    return () => {
      active = false
      unlistenAction?.()
      unlistenDeepLink?.()
    }
  }, [])
}

export { parseDeepLink }
