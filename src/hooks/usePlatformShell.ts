import { useEffect, useRef } from 'react'

interface PlatformShellHandlers {
  onQuickCapture?: () => void
  onDeepLink?: (url: string) => void
}

interface DeepLinkTarget {
  kind: 'vault' | 'note'
  path: string
}

const MAX_DEEP_LINK_PATH_LENGTH = 4096
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/

function parseDeepLink(url: string): DeepLinkTarget | null {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'scriptor:') return null
    if (parsed.host !== 'vault' && parsed.host !== 'note') return null

    const path = (parsed.searchParams.get('path') ?? parsed.pathname.replace(/^\//, '')).trim()
    if (!path || path.length > MAX_DEEP_LINK_PATH_LENGTH || CONTROL_CHARACTERS.test(path)) return null

    if (parsed.host === 'note') {
      const normalized = path.replaceAll('\\', '/')
      if (normalized.startsWith('/') || /^[A-Za-z]:\//.test(normalized)) return null
      const components = normalized.split('/')
      if (components.some((component) => component === '' || component === '.' || component === '..')) {
        return null
      }
      return { kind: 'note', path: normalized }
    }

    return { kind: 'vault', path }
  } catch {
    return null
  }
}

function confirmDeepLink(target: DeepLinkTarget): boolean {
  const resource = target.kind === 'vault' ? 'vault' : 'note'
  return window.confirm(`Open this ${resource} from an external link?\n\n${target.path}`)
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

    const register = async () => {
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
            if (!url) return
            const target = parseDeepLink(url)
            if (!target || !confirmDeepLink(target)) return
            handlersRef.current.onDeepLink?.(url)
          },
        )
        if (!active) {
          disposeDeepLink()
          return
        }
        unlistenDeepLink = disposeDeepLink
      } catch {
        // Browser dev mode without Tauri shell.
      }
    }

    void register()

    return () => {
      active = false
      unlistenAction?.()
      unlistenDeepLink?.()
    }
  }, [])
}

export { parseDeepLink }
