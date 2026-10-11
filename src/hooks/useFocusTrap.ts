import { useEffect, useRef, type RefObject } from 'react'

// Nested dialogs suspend their parent's trap until the inner dialog closes.
const activeTraps: HTMLElement[] = []

// Selectors for natively focusable elements.
export const FOCUSABLE_SELECTORS = [
  'a[href]:not([tabindex="-1"])',
  'button:not([disabled]):not([tabindex="-1"])',
  'textarea:not([disabled]):not([tabindex="-1"])',
  'input:not([disabled]):not([type="hidden"]):not([tabindex="-1"])',
  'select:not([disabled]):not([tabindex="-1"])',
  'details > summary:first-of-type:not([tabindex="-1"])',
  'iframe:not([tabindex="-1"])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

interface FocusTrapOptions {
  /** When false, the trap is inactive. */
  active: boolean
  /** Element to return focus to when the trap deactivates. */
  restoreTo?: HTMLElement | null
  /** Whether/how to move focus when the trap activates (default: first focusable element). */
  initialFocus?: boolean | (() => HTMLElement | null)
  /** Re-run initial-focus behavior when a multi-step dialog advances. */
  initialFocusKey?: unknown
}

/**
 * Trap keyboard focus inside the referenced container while `active` is true.
 *
 * - Cycles Tab / Shift+Tab within the container.
 * - On deactivation, returns focus to the element that had it when activated
 *   (or to `restoreTo` if provided).
 *
 * Use with a `role="dialog"` / `role="alertdialog"` container that also sets
 * `aria-modal="true"`.
 */
export function useFocusTrap<T extends HTMLElement>(
  containerRef: RefObject<T | null>,
  { active, restoreTo, initialFocus = true, initialFocusKey }: FocusTrapOptions,
): void {
  const initialFocusRef = useRef(initialFocus)
  const restoreToRef = useRef(restoreTo)

  useEffect(() => {
    initialFocusRef.current = initialFocus
    restoreToRef.current = restoreTo
  }, [initialFocus, restoreTo])

  useEffect(() => {
    if (!active) return
    // The key intentionally participates in this effect so step changes can
    // re-run the initial-focus cycle without rebuilding the trap API.
    void initialFocusKey
    const container = containerRef.current
    if (!container) return

    const previouslyFocused = document.activeElement as HTMLElement | null
    activeTraps.push(container)
    const ownsFocus = () => activeTraps.at(-1) === container
    const visibleTargets = () => Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)).filter(el => {
      if (el.dataset.focusGuard || el.getClientRects().length === 0) return false
      for (let parent = el.parentElement; parent && parent !== container; parent = parent.parentElement) {
        if (parent instanceof HTMLDetailsElement && !parent.open) {
          const summary = Array.from(parent.children).find(child => child.tagName === 'SUMMARY')
          if (!summary?.contains(el)) return false
        }
      }
      return true
    })
    const makeGuard = () => {
      const guard = document.createElement('span')
      guard.tabIndex = 0
      guard.dataset.focusGuard = 'true'
      guard.setAttribute('aria-hidden', 'true')
      Object.assign(guard.style, { position: 'fixed', width: '1px', height: '1px', overflow: 'hidden', opacity: '0' })
      return guard
    }
    const startGuard = makeGuard()
    const endGuard = makeGuard()
    container.prepend(startGuard)
    container.append(endGuard)
    // React can append newly rendered source previews after our end sentinel.
    // Keep sentinels at the actual boundaries without moving React's children.
    const observer = new MutationObserver(() => {
      if (container.firstChild !== startGuard) container.prepend(startGuard)
      if (container.lastChild !== endGuard) container.append(endGuard)
    })
    observer.observe(container, { childList: true })
    const focusBoundary = (last: boolean) => {
      if (!ownsFocus()) return
      const targets = visibleTargets()
      const target = last ? targets.at(-1) : targets[0]
      target?.focus()
    }
    startGuard.addEventListener('focus', () => focusBoundary(true))
    endGuard.addEventListener('focus', () => focusBoundary(false))

    let rafId: number | null = null
    const initFocus = initialFocusRef.current
    if (initFocus) {
      // Defer one frame so children mount before we search for focusable nodes.
      rafId = window.requestAnimationFrame(() => {
        rafId = null
        const target =
          typeof initFocus === 'function'
            ? initFocus()
            : visibleTargets()[0]
        if (ownsFocus()) target?.focus()
      })
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !ownsFocus()) return
      const focusable = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS),
      ).filter((el) => {
        if (el.dataset.focusGuard) return false
        if (el === document.activeElement) return true
        if (el.getClientRects().length === 0) return false
        // Chromium can report layout boxes for descendants of closed details;
        // its keyboard navigation nevertheless skips them.
        for (let parent = el.parentElement; parent && parent !== container; parent = parent.parentElement) {
          if (parent instanceof HTMLDetailsElement && !parent.open) {
            const summary = Array.from(parent.children).find((child) => child.tagName === 'SUMMARY')
            if (!summary?.contains(el)) return false
          }
        }
        return true
      })
      if (focusable.length === 0) {
        event.preventDefault()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const activeEl = document.activeElement

      if (event.shiftKey) {
        if (activeEl === first || !container.contains(activeEl)) {
          event.preventDefault()
          last.focus()
        }
      } else {
        if (activeEl === last || !container.contains(activeEl)) {
          event.preventDefault()
          first.focus()
        }
      }
    }

    // Sandboxed frame key events do not bubble into this document. Reclaim
    // focus when browser navigation leaves the modal through such a frame.
    const onFocusIn = (event: FocusEvent) => {
      if (ownsFocus() && event.target instanceof Node && !container.contains(event.target)) {
        focusBoundary(false)
      }
    }
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      // Cleanup rAF if effect tears down before it fires.
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId)
      }
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('focusin', onFocusIn)
      observer.disconnect()
      const index = activeTraps.lastIndexOf(container)
      if (index >= 0) activeTraps.splice(index, 1)
      startGuard.remove()
      endGuard.remove()
      const target = restoreToRef.current ?? previouslyFocused
      if (!activeTraps.length || activeTraps.at(-1)?.contains(target)) target?.focus?.()
    }
  }, [active, containerRef, initialFocusKey])
}
