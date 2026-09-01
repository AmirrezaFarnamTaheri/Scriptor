import { useEffect } from 'react'

const ZOOM_STORAGE_KEY = 'scriptor:ui-zoom'
const ZOOM_MIN = 0.5
const ZOOM_MAX = 2.5
/** Content min-width the top bar is designed against; below this we zoom out to fit. */
const FIT_REFERENCE_WIDTH = 1180
const MOBILE_REFLOW_WIDTH = 820
const STACKED_REFLOW_WIDTH = 1320

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

function updateZoomReflow(factor: number): void {
  const frameWidth = Math.max(window.innerWidth, window.outerWidth || 0)
  const effectiveWidth = factor > 1 ? frameWidth / factor : window.innerWidth
  document.documentElement.dataset.uiReflow =
    effectiveWidth <= MOBILE_REFLOW_WIDTH
      ? 'mobile'
      : effectiveWidth <= STACKED_REFLOW_WIDTH
        ? 'stacked'
        : 'desktop'
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
      updateZoomReflow(factor)
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

    // Resize events arrive in bursts during window drags; coalesce to one
    // update per frame. The reflow-attribute write forces a whole-document
    // invalidation, so running it per event thrashes layout while dragging.
    let resizeFrame = 0
    const onResize = () => {
      if (resizeFrame) return
      resizeFrame = window.requestAnimationFrame(() => {
        resizeFrame = 0
        // Re-fit only while the user has not chosen an explicit zoom.
        if (readStoredZoom() === null) {
          factor = defaultFitZoom()
          apply()
        } else {
          updateZoomReflow(factor)
        }
      })
    }

    // Tauri v2 webviews ship with native page zoom disabled (zoomHotkeysEnabled defaults
    // to false, i.e. WebView2 IsZoomControlEnabled=false), so ctrl+wheel reaches the page
    // as a plain wheel event whose default action is scrolling. This listener must stay
    // non-passive: preventDefault is what stops app zoom from also scrolling the page.
    // passive: true here would reintroduce scroll-during-zoom on every wheel gesture.
    window.addEventListener('wheel', onWheel, { passive: false, capture: true })
    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('resize', onResize)
    apply()

    return () => {
      if (resizeFrame) window.cancelAnimationFrame(resizeFrame)
      window.removeEventListener('wheel', onWheel, true)
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('resize', onResize)
      delete document.documentElement.dataset.uiReflow
    }
  }, [])
}
