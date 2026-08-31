import { useEffect } from 'react'

/**
 * Publishes the live top-bar block size as `--topbar-bottom` on the document
 * root so fixed overlays (dialogs, docks, mobile panes) can start below the
 * bar even when it wraps to multiple rows at compact widths or high zoom.
 * The bar is measured with a ResizeObserver; when no top bar is rendered the
 * variable resolves to 0px and overlays may use the full viewport height.
 */
export function useTopBarHeightVar(): void {
  useEffect(() => {
    const root = document.documentElement
    const topbar = document.querySelector('.topbar')
    if (!(topbar instanceof HTMLElement)) {
      root.style.setProperty('--topbar-bottom', '0px')
      return undefined
    }
    const update = () => {
      root.style.setProperty(
        '--topbar-bottom',
        `${Math.round(topbar.getBoundingClientRect().bottom)}px`,
      )
    }
    update()
    window.addEventListener('resize', update)
    const observer = new ResizeObserver(update)
    observer.observe(topbar)
    return () => {
      window.removeEventListener('resize', update)
      observer.disconnect()
      root.style.setProperty('--topbar-bottom', '0px')
    }
  }, [])
}
