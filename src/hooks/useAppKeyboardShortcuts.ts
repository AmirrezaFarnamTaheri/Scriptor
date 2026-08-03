import { useEffect } from 'react'

interface UseAppKeyboardShortcutsOptions {
  activePath: string | null
  chooseVaultFolder: () => Promise<unknown> | unknown
  setSidebarView: (view: 'vault' | 'inbox') => void
  createDailyNote: () => Promise<unknown> | unknown
  loadGraph: (path: string | null) => Promise<unknown> | unknown
  reopenClosedTab: () => void
  openNoteHistory: () => void
  openSnippets: () => void
  openGraph: () => void
  openCanvas: () => void
}

function isEditingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(target.closest('input, textarea, [contenteditable="true"]'))
}

/** Owns global workspace shortcuts and keeps their dependencies explicit. */
export function useAppKeyboardShortcuts({
  activePath,
  chooseVaultFolder,
  setSidebarView,
  createDailyNote,
  loadGraph,
  reopenClosedTab,
  openNoteHistory,
  openSnippets,
  openGraph,
  openCanvas,
}: UseAppKeyboardShortcutsOptions): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditingTarget(event.target)) return

      const key = event.key.toLowerCase()
      if (key === 'f' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault()
        document.querySelector<HTMLInputElement>('.vault-search input')?.focus()
        return
      }

      if (key === 'h' && event.ctrlKey && event.altKey && !event.metaKey) {
        event.preventDefault()
        openNoteHistory()
        return
      }

      if (!event.altKey || event.metaKey || event.ctrlKey) return
      switch (key) {
        case 'o':
          event.preventDefault()
          void chooseVaultFolder()
          break
        case 'i':
          event.preventDefault()
          setSidebarView('inbox')
          break
        case 'd':
          event.preventDefault()
          void createDailyNote()
          break
        case 's':
          event.preventDefault()
          openSnippets()
          break
        case 'g':
          event.preventDefault()
          openGraph()
          void loadGraph(activePath)
          break
        case 'c':
          event.preventDefault()
          openCanvas()
          break
        case 't':
          if (event.shiftKey) {
            event.preventDefault()
            reopenClosedTab()
          }
          break
        default:
          break
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    activePath,
    chooseVaultFolder,
    createDailyNote,
    loadGraph,
    openCanvas,
    openGraph,
    openNoteHistory,
    openSnippets,
    reopenClosedTab,
    setSidebarView,
  ])
}
