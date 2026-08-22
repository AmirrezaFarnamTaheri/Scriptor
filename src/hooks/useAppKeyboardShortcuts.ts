import { useEffect } from 'react'

import { getDefaultShortcut } from '../lib/commandShortcutRegistry'
import { matchesShortcut } from '../lib/keyboardShortcuts'
import { useKeyboardShortcuts } from './useKeyboardShortcuts'

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
  openKnowledgeWorkbench: () => void
  openGit: () => void
  openReader?: () => void
  openTasks?: () => void
  openKanban?: () => void
  toggleVaultSidebar: () => void
  toggleInspector: () => void
}

function isEditingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  )
}

/** Owns configured global workspace shortcuts and keeps their dependencies explicit. */
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
  openKnowledgeWorkbench,
  openGit,
  openReader,
  openTasks,
  openKanban,
  toggleVaultSidebar,
  toggleInspector,
}: UseAppKeyboardShortcutsOptions): void {
  const { getShortcut } = useKeyboardShortcuts()

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditingTarget(event.target)) return

      const run = (commandId: string, action: () => void): boolean => {
        if (!matchesShortcut(event, getShortcut(commandId, getDefaultShortcut(commandId)))) return false
        event.preventDefault()
        action()
        return true
      }

      if (run('focus-search', () => document.querySelector<HTMLInputElement>('.vault-search input')?.focus())) return
      if (run('open-note-history', openNoteHistory)) return
      if (run('open-vault', () => void chooseVaultFolder())) return
      if (run('open-inbox', () => setSidebarView('inbox'))) return
      if (run('open-daily-note', () => void createDailyNote())) return
      if (run('manage-snippets', openSnippets)) return
      if (run('open-knowledge-workbench', openKnowledgeWorkbench)) return
      if (run('open-graph', () => {
        openGraph()
        void loadGraph(activePath)
      })) return
      if (run('open-canvas', openCanvas)) return
      if (run('reopen-closed-tab', reopenClosedTab)) return
      if (run('open-git', openGit)) return
      if (openReader && run('open-reader', openReader)) return
      if (openTasks && run('open-tasks', openTasks)) return
      if (openKanban && run('open-kanban', openKanban)) return
      if (run('toggle-vault-sidebar', toggleVaultSidebar)) return
      run('toggle-inspector', toggleInspector)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    activePath,
    chooseVaultFolder,
    createDailyNote,
    getShortcut,
    loadGraph,
    openCanvas,
    openGit,
    openKanban,
    openGraph,
    openKnowledgeWorkbench,
    openNoteHistory,
    openReader,
    openSnippets,
    openTasks,
    reopenClosedTab,
    setSidebarView,
    toggleInspector,
    toggleVaultSidebar,
  ])
}
