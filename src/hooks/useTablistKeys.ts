import { useCallback } from 'react'

/**
 * APG tablist keyboard model: Arrow Left/Right wrap around, Home/End jump to
 * the ends. The caller supplies the ordered tab ids and a selection callback;
 * focus follows selection via `document.getElementById`.
 *
 * Returns an `onKeyDown` handler to attach to the `role="tablist"` container.
 * Each tab button must set `tabIndex={isActive ? 0 : -1}` for proper roving
 * `tabindex` semantics.
 */
export function useTablistKeys(
  tabIds: readonly string[],
  activeId: string,
  onActivate: (id: string) => void,
) {
  return useCallback(
    (event: React.KeyboardEvent) => {
      const current = tabIds.indexOf(activeId)
      let next = -1
      if (event.key === 'ArrowRight') next = (current + 1) % tabIds.length
      else if (event.key === 'ArrowLeft') next = (current - 1 + tabIds.length) % tabIds.length
      else if (event.key === 'Home') next = 0
      else if (event.key === 'End') next = tabIds.length - 1
      if (next === -1) return
      event.preventDefault()
      const target = tabIds[next]
      if (target === undefined) return
      onActivate(target)
      document.getElementById(target)?.focus()
    },
    [tabIds, activeId, onActivate],
  )
}

/** Roving `tabIndex` helper: the active tab is focusable, the rest are not. */
export function tabRovingIndex(activeId: string, id: string): 0 | -1 {
  return activeId === id ? 0 : -1
}
