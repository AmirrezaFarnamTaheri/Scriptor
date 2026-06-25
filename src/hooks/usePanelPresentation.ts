import { useCallback, useState } from 'react'

export type PanelPresentation = 'modal' | 'dock-right'

const STORAGE_KEY = 'scriptor:panel-presentation'

function readPresentation(): PanelPresentation {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw === 'dock-right' || raw === 'modal') return raw
  } catch {
    // ignore storage failures
  }
  return 'modal'
}

export function usePanelPresentation() {
  const [presentation, setPresentationState] = useState<PanelPresentation>(() => readPresentation())

  const setPresentation = useCallback((next: PanelPresentation) => {
    setPresentationState(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // ignore storage failures
    }
  }, [])

  return { presentation, setPresentation }
}
