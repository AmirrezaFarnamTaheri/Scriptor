import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'

const VIEWPORT_PADDING = 8
const POPOVER_GAP = 6
const MIN_POPOVER_WIDTH = 220

interface ToolbarPopoverProps {
  open: boolean
  id: string
  className: string
  triggerRef: RefObject<HTMLButtonElement | null>
  labelledBy: string
  onClose: () => void
  children: ReactNode
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum)
}

function menuItems(panel: HTMLElement): HTMLButtonElement[] {
  return [...panel.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')]
    .filter((item) => !item.disabled)
}

function adjacentToolbarControl(
  trigger: HTMLButtonElement,
  backwards: boolean,
): HTMLButtonElement | null {
  const toolbar = trigger.closest<HTMLElement>('[role="toolbar"], .editor-toolbar')
  if (!toolbar) return null
  const controls = [...toolbar.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')]
    .filter((control) => control.getClientRects().length > 0)
  const triggerIndex = controls.indexOf(trigger)
  if (triggerIndex < 0) return null
  return controls[triggerIndex + (backwards ? -1 : 1)] ?? null
}

/**
 * Renders an editor-toolbar menu into the document body so scroll containers
 * cannot clip it. Positioning mutates only the portal element's fixed-layout
 * styles; opening or scrolling the menu never causes an additional React render.
 */
export function ToolbarPopover({
  open,
  id,
  className,
  triggerRef,
  labelledBy,
  onClose,
  children,
}: ToolbarPopoverProps) {
  const panelRef = useRef<HTMLUListElement>(null)

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current
    const panel = panelRef.current
    if (!trigger || !panel) return

    const triggerRect = trigger.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const maximumWidth = Math.max(0, viewportWidth - VIEWPORT_PADDING * 2)
    const minimumWidth = Math.min(
      Math.max(MIN_POPOVER_WIDTH, triggerRect.width),
      maximumWidth,
    )

    panel.style.minWidth = `${minimumWidth}px`
    panel.style.maxWidth = `${maximumWidth}px`
    panel.style.maxHeight = 'none'

    const naturalWidth = Math.min(
      Math.max(panel.scrollWidth, minimumWidth),
      maximumWidth,
    )
    const naturalHeight = Math.min(
      panel.scrollHeight,
      Math.max(0, viewportHeight - VIEWPORT_PADDING * 2),
    )
    const availableBelow = Math.max(
      0,
      viewportHeight - triggerRect.bottom - POPOVER_GAP - VIEWPORT_PADDING,
    )
    const availableAbove = Math.max(
      0,
      triggerRect.top - POPOVER_GAP - VIEWPORT_PADDING,
    )
    const opensAbove = availableBelow < naturalHeight && availableAbove > availableBelow
    const availableHeight = opensAbove ? availableAbove : availableBelow
    const renderedHeight = Math.min(naturalHeight, availableHeight)
    const top = opensAbove
      ? triggerRect.top - POPOVER_GAP - renderedHeight
      : triggerRect.bottom + POPOVER_GAP
    const maximumLeft = Math.max(
      VIEWPORT_PADDING,
      viewportWidth - VIEWPORT_PADDING - naturalWidth,
    )

    panel.style.top = `${clamp(
      top,
      VIEWPORT_PADDING,
      Math.max(VIEWPORT_PADDING, viewportHeight - VIEWPORT_PADDING - renderedHeight),
    )}px`
    panel.style.left = `${clamp(triggerRect.left, VIEWPORT_PADDING, maximumLeft)}px`
    panel.style.maxHeight = `${availableHeight}px`
    panel.dataset.positioned = 'true'
  }, [triggerRef])

  useLayoutEffect(() => {
    if (!open) return undefined

    updatePosition()
    const frame = window.requestAnimationFrame(() => {
      updatePosition()
      const activeElement = document.activeElement
      if (activeElement !== document.body && activeElement !== triggerRef.current) return
      const panel = panelRef.current
      if (panel) menuItems(panel)[0]?.focus()
    })
    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(updatePosition)
    if (triggerRef.current) resizeObserver?.observe(triggerRef.current)
    if (panelRef.current) resizeObserver?.observe(panelRef.current)
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)

    return () => {
      window.cancelAnimationFrame(frame)
      resizeObserver?.disconnect()
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open, triggerRef, updatePosition])

  useEffect(() => {
    if (!open) return undefined

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return
      onClose()
    }
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      onClose()
      window.requestAnimationFrame(() => triggerRef.current?.focus())
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose, open, triggerRef])

  const handleMenuKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    if (event.key === 'Tab') {
      event.preventDefault()
      const trigger = triggerRef.current
      const focusTarget = trigger ? adjacentToolbarControl(trigger, event.shiftKey) : null
      onClose()
      window.requestAnimationFrame(() => (focusTarget ?? trigger)?.focus())
      return
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return

    const items = menuItems(event.currentTarget)
    if (items.length === 0) return
    event.preventDefault()
    const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement)
    if (event.key === 'Home') items[0].focus()
    else if (event.key === 'End') items.at(-1)?.focus()
    else if (event.key === 'ArrowDown') items[(currentIndex + 1 + items.length) % items.length].focus()
    else items[(currentIndex - 1 + items.length) % items.length].focus()
  }

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <ul
      id={id}
      ref={panelRef}
      className={`toolbar-menu-popover ${className}`}
      role="menu"
      aria-labelledby={labelledBy}
      aria-orientation="vertical"
      data-positioned="false"
      onKeyDown={handleMenuKeyDown}
    >
      {children}
    </ul>,
    document.body,
  )
}
