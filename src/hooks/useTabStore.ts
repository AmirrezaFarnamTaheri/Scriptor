/**
 * useTabStore
 *
 * Manages the open/closed tab list and active path. Previously these were
 * three separate useState calls baked inside `useWorkspaceEditor`, making it
 * hard for the tab bar component to subscribe without pulling in the full
 * editor bundle.
 *
 * Design notes:
 * - `OpenTab` is the minimal descriptor the tab bar needs. Full NoteDocument
 *   lives in `useWorkspaceEditor`.
 * - `closedTabs` is capped at 12 entries (same policy as before).
 * - All mutations are co-located here so there is one clear owner of tab
 *   lifecycle.
 */
import { useCallback, useState } from 'react'

export interface OpenTab {
  path: string
  title: string
  contentHash: string
  pinned?: boolean
}

interface TabState {
  openTabs: OpenTab[]
  closedTabs: OpenTab[]
  activePath: string | null
}

export function useTabStore() {
  const [state, setState] = useState<TabState>({
    openTabs: [],
    closedTabs: [],
    activePath: null,
  })

  /** Add or update a tab (upsert by path). */
  const upsertTab = useCallback((tab: OpenTab) => {
    setState((prev) => {
      const existing = prev.openTabs.find((t) => t.path === tab.path)
      const openTabs = existing
        ? prev.openTabs.map((t) => (t.path === tab.path ? tab : t))
        : [...prev.openTabs, tab]
      return { ...prev, openTabs }
    })
  }, [])

  /** Set a tab's title and contentHash after a successful save. */
  const updateTabMeta = useCallback((path: string, title: string, contentHash: string) => {
    setState((prev) => ({
      ...prev,
      openTabs: prev.openTabs.map((t) =>
        t.path === path ? { ...t, title, contentHash } : t,
      ),
    }))
  }, [])

  /** Change the active path. Does not load the note — caller handles that. */
  const setActivePath = useCallback((path: string | null) => {
    setState((prev) => (prev.activePath === path ? prev : { ...prev, activePath: path }))
  }, [])

  /**
   * Close a tab. If it was active, focus shifts to the previous tab.
   * Returns the fallback path to open, or null if no tabs remain.
   */
  const closeTab = useCallback(
    (path: string, force = false): string | null => {
      let fallback: string | null = null
      setState((prev) => {
        const closing = prev.openTabs.find((t) => t.path === path)
        if (closing?.pinned && !force) return prev

        const nextTabs = prev.openTabs.filter((t) => t.path !== path)
        const nextClosed = closing
          ? [closing, ...prev.closedTabs.filter((t) => t.path !== path)].slice(0, 12)
          : prev.closedTabs

        let nextActive = prev.activePath
        if (prev.activePath === path) {
          fallback = nextTabs.at(-1)?.path ?? null
          nextActive = fallback
        }

        return { openTabs: nextTabs, closedTabs: nextClosed, activePath: nextActive }
      })
      return fallback
    },
    [],
  )

  /** Restore tabs from a persisted session (e.g., on vault open). */
  const restoreTabs = useCallback(
    (tabs: Array<{ path: string; pinned?: boolean }>, active: string | null) => {
      const openTabs: OpenTab[] = tabs.map((tab) => ({
        path: tab.path,
        title: tab.path.split('/').pop()?.replace(/\.md$/i, '') ?? tab.path,
        contentHash: '',
        pinned: tab.pinned,
      }))
      const activePath =
        active && tabs.some((t) => t.path === active) ? active : (tabs[0]?.path ?? null)
      setState({ openTabs, closedTabs: [], activePath })
      return activePath
    },
    [],
  )

  /** Pop the most recently closed tab for reopen. Returns the tab or undefined. */
  const popClosedTab = useCallback((): OpenTab | undefined => {
    let popped: OpenTab | undefined
    setState((prev) => {
      const [first, ...rest] = prev.closedTabs
      popped = first
      return first ? { ...prev, closedTabs: rest } : prev
    })
    return popped
  }, [])

  const togglePinTab = useCallback((path: string) => {
    setState((prev) => ({
      ...prev,
      openTabs: prev.openTabs.map((t) => (t.path === path ? { ...t, pinned: !t.pinned } : t)),
    }))
  }, [])

  return {
    openTabs: state.openTabs,
    closedTabs: state.closedTabs,
    activePath: state.activePath,
    upsertTab,
    updateTabMeta,
    setActivePath,
    closeTab,
    restoreTabs,
    popClosedTab,
    togglePinTab,
  }
}
