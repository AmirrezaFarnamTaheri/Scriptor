import { useEffect } from 'react'

/**
 * Publishes the live app-chrome block end as `--topbar-bottom` on the document
 * root so fixed overlays, dialogs, docks, and mobile panes start below every
 * visible chrome row. Runtime banners live in `.app-chrome` below the top bar;
 * measuring only `.topbar` allowed fixed surfaces to cover those banners.
 *
 * The legacy custom-property name is kept to avoid a broad CSS migration. The
 * block is measured with a ResizeObserver; when app chrome is absent the
 * variable resolves to 0px.
 */
export function useTopBarHeightVar(): void {
  useEffect(() => {
    const root = document.documentElement
    const chrome = document.querySelector('.app-chrome')
    if (!(chrome instanceof HTMLElement)) {
      root.style.setProperty('--topbar-bottom', '0px')
      return undefined
    }
    const update = () => {
      root.style.setProperty(
        '--topbar-bottom',
        `${Math.round(chrome.getBoundingClientRect().bottom)}px`,
      )
    }
    update()
    window.addEventListener('resize', update)
    const observer = new ResizeObserver(update)
    observer.observe(chrome)
    return () => {
      window.removeEventListener('resize', update)
      observer.disconnect()
      root.style.setProperty('--topbar-bottom', '0px')
    }
  }, [])
}
