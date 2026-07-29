import { useEffect, type RefObject } from 'react'

// Selectors for natively focusable elements.
const FOCUSABLE_SELECTORS = [
  'a[href]:not([tabindex="-1"])',
  'button:not([disabled]):not([tabindex="-1"])',
  'textarea:not([disabled]):not([tabindex="-1"])',
  'input:not([disabled]):not([type="hidden"]):not([tabindex="-1"])',
  'select:not([disabled]):not([tabindex="-1"])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

interface FocusTrapOptions {
  /** When false, the trap is inactive. */
  active: boolean
  /** Element to return focus to when the trap deactivates. */
  restoreTo?: HTMLElement | null
  /** Whether to focus the first focusable element on activation (default true). */
  initialFocus?: boolean
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
  { active, restoreTo, initialFocus = true }: FocusTrapOptions,
): void {
  useEffect(() => {
    if (!active) return
    const container = containerRef.current
    if (!container) return

    const previouslyFocused = document.activeElement as HTMLElement | null

    let rafId: number | null = null
    if (initialFocus) {
      // Defer one frame so children mount before we search for focusable nodes.
      rafId = window.requestAnimationFrame(() => {
        rafId = null
        const first = container.querySelector<HTMLElement>(FOCUSABLE_SELECTORS)
        first?.focus()
      })
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return
      const focusable = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS),
      ).filter((el) => el.offsetParent !== null || el === document.activeElement)
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

    document.addEventListener('keydown', onKeyDown)
    return () => {
      // Cleanup rAF if effect tears down before it fires.
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId)
      }
      document.removeEventListener('keydown', onKeyDown)
      const target = restoreTo ?? previouslyFocused
      target?.focus?.()
    }
  }, [active, containerRef, restoreTo, initialFocus])
}
