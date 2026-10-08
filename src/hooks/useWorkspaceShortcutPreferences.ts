import { useCallback, useEffect, useState } from 'react'
import { parseWorkspaceShortcutPreferences, WORKSPACE_SHORTCUT_STORAGE_KEY, type WorkspaceShortcutPreferences } from '../lib/workspaceShortcuts'

function readPreferences() {
  try { return parseWorkspaceShortcutPreferences(localStorage.getItem(WORKSPACE_SHORTCUT_STORAGE_KEY)) }
  catch { return parseWorkspaceShortcutPreferences(null) }
}

export function useWorkspaceShortcutPreferences() {
  const [preferences, setPreferences] = useState(readPreferences)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const update = (event: StorageEvent) => {
      if (event.key === WORKSPACE_SHORTCUT_STORAGE_KEY || event.key === null) setPreferences(readPreferences())
    }
    window.addEventListener('storage', update)
    return () => window.removeEventListener('storage', update)
  }, [])
  const save = useCallback((next: WorkspaceShortcutPreferences): boolean => {
    // Retain settings for temporarily unavailable plugin shortcuts. Removing an
    // item from the bar uses shown=false, never an executable stored reference.
    const normalized = parseWorkspaceShortcutPreferences(JSON.stringify({ ...next, items: [
      ...next.items, ...preferences.items.filter(item => !next.items.some(entry => entry.id === item.id)),
    ] }))
    try { localStorage.setItem(WORKSPACE_SHORTCUT_STORAGE_KEY, JSON.stringify(normalized)) }
    catch { return false }
    setPreferences(normalized)
    return true
  }, [preferences])
  const show = useCallback(() => setOpen(true), [])
  const close = useCallback(() => setOpen(false), [])
  return { preferences, open, show, close, save }
}
