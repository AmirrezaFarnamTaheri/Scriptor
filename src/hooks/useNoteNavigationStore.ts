/**
 * useNoteNavigationStore
 *
 * Manages the browser-style back/forward note history that was previously
 * tightly coupled into `useWorkspaceEditor` alongside save logic and
 * tab management.
 *
 * Decoupling benefits:
 * - Navigation logic is now independently testable.
 * - The `navigateBack` / `navigateForward` actions simply push a path; they
 *   do not load the note. The caller (`useWorkspaceEditor`) calls `openNote`
 *   after navigation so the dependency direction stays clean.
 *
 * Design notes:
 * - `paths` is a fixed-cap ring buffer (100 entries max).
 * - `historyNavigating` is a flag so `recordPath` can be skipped when the
 *   navigation itself triggers `openNote`, which would otherwise double-push.
 */
import { useCallback, useRef, useState } from 'react'

interface NoteNavState {
  paths: string[]
  index: number
}

interface NavigateResult {
  /** The path the caller should now open, or null if no movement occurred. */
  path: string | null
}

export function useNoteNavigationStore() {
  const [nav, setNav] = useState<NoteNavState>({ paths: [], index: -1 })
  const [isNavigating, setIsNavigating] = useState(false)
  /** Prevents recording a new history entry when back/forward triggers loadNote. */
  const isNavigatingRef = useRef(false)

  /**
   * Record a path in the history. Call this after every user-initiated note
   * open. Skip it when `isNavigating.current` is true (back/forward traversal).
   */
  const recordPath = useCallback((path: string) => {
    if (isNavigatingRef.current) return
    setNav(({ paths, index }) => {
      if (paths[index] === path) return { paths, index }
      const truncated = index >= 0 ? paths.slice(0, index + 1) : []
      const nextPaths = [...truncated, path].slice(-100)
      return { paths: nextPaths, index: nextPaths.length - 1 }
    })
  }, [])

  /**
   * Navigate backward. Returns the path to open, or null if at the start.
   * Set `isNavigating.current = false` after `openNote` completes.
   */
  const navigateBack = useCallback((): NavigateResult => {
    let result: NavigateResult = { path: null }
    setNav(({ paths, index }) => {
      if (index <= 0) return { paths, index }
      const nextIndex = index - 1
      const path = paths[nextIndex] ?? null
      isNavigatingRef.current = true
      setIsNavigating(true)
      result = { path }
      return { paths, index: nextIndex }
    })
    return result
  }, [])

  /**
   * Navigate forward. Returns the path to open, or null if at the end.
   */
  const navigateForward = useCallback((): NavigateResult => {
    let result: NavigateResult = { path: null }
    setNav(({ paths, index }) => {
      if (index >= paths.length - 1) return { paths, index }
      const nextIndex = index + 1
      const path = paths[nextIndex] ?? null
      isNavigatingRef.current = true
      setIsNavigating(true)
      result = { path }
      return { paths, index: nextIndex }
    })
    return result
  }, [])

  /**
   * Signal that a back/forward navigation's `openNote` has completed.
   * Must be called after the navigation-triggered open finishes.
   */
  const clearNavigating = useCallback(() => {
    isNavigatingRef.current = false
    setIsNavigating(false)
  }, [])

  /** Reset history (e.g., when a new vault is opened). */
  const reset = useCallback(() => {
    setNav({ paths: [], index: -1 })
    isNavigatingRef.current = false
    setIsNavigating(false)
  }, [])

  return {
    canNavigateBack: nav.index > 0,
    canNavigateForward: nav.index >= 0 && nav.index < nav.paths.length - 1,
    isNavigating,
    recordPath,
    navigateBack,
    navigateForward,
    clearNavigating,
    reset,
  }
}
