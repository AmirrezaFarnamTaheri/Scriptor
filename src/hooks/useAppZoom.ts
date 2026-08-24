import { useEffect } from 'react'

const ZOOM_STORAGE_KEY = 'scriptor:ui-zoom'
const ZOOM_MIN = 0.5
const ZOOM_MAX = 2.5
/** Content min-width the top bar is designed against; below this we zoom out to fit. */
const FIT_REFERENCE_WIDTH = 1180

function clampZoom(value: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(value * 100) / 100))
}

function readStoredZoom(): number | null {
  try {
    const raw = window.localStorage.getItem(ZOOM_STORAGE_KEY)
    if (!raw) return null
    const parsed = Number.parseFloat(raw)
    return Number.isFinite(parsed) ? clampZoom(parsed) : null
  } catch {
    return null
  }
}

function defaultFitZoom(): number {
  if (window.innerWidth >= FIT_REFERENCE_WIDTH) return 1
  return clampZoom(window.innerWidth / FIT_REFERENCE_WIDTH)
}

async function applyZoom(factor: number): Promise<void> {
  try {
    const { getCurrentWebview } = await import('@tauri-apps/api/webview')
    await getCurrentWebview().setZoom(factor)
    return
  } catch {
    // Web shell or older runtime: fall back to CSS zoom.
    document.body.style.zoom = String(factor)
  }
}

/**
 * Whole-app zoom: Ctrl+wheel, Ctrl+=/Ctrl+- step, Ctrl+0 reset. The factor is
 * persisted and restored on launch; the default zooms out just enough to fit
 * the designed content width on narrow windows.
 */
export function useAppZoom(): void {
  useEffect(() => {
    let factor = readStoredZoom() ?? defaultFitZoom()
    let applyScheduled = false

    const apply = () => {
      if (applyScheduled) return
      applyScheduled = true
      window.setTimeout(() => {
        applyScheduled = false
        void applyZoom(factor)
      }, 60)
    }

    const setZoom = (next: number) => {
      const clamped = clampZoom(next)
      if (clamped === factor) return
      factor = clamped
      try {
        window.localStorage.setItem(ZOOM_STORAGE_KEY, String(factor))
      } catch {
        // storage may be unavailable; zoom still applies for this session
      }
      apply()
    }

    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return
      const target = event.target as HTMLElement | null
      if (target?.closest?.('.canvas-stage')) return // canvas owns its own zoom
      event.preventDefault()
      setZoom(factor * (event.deltaY < 0 ? 1.1 : 0.9))
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return
      const key = event.key
      if (key === '=' || key === '+') {
        event.preventDefault()
        setZoom(factor * 1.1)
      } else if (key === '-') {
        event.preventDefault()
        setZoom(factor * 0.9)
      } else if (key === '0') {
        event.preventDefault()
        setZoom(1)
      }
    }

    const onResize = () => {
      // Re-fit only while the user has not chosen an explicit zoom.
      if (readStoredZoom() === null) {
        factor = defaultFitZoom()
        apply()
      }
    }

    window.addEventListener('wheel', onWheel, { passive: false, capture: true })
    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('resize', onResize)
    apply()

    return () => {
      window.removeEventListener('wheel', onWheel, true)
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('resize', onResize)
    }
  }, [])
}
