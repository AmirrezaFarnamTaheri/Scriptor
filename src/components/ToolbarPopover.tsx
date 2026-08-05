import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'

const VIEWPORT_PADDING = 8
const POPOVER_GAP = 6
const MIN_POPOVER_WIDTH = 220
const MIN_POPOVER_HEIGHT = 120

interface ToolbarPopoverProps {
  open: boolean
  id: string
  className: string
  triggerRef: RefObject<HTMLButtonElement | null>
  labelledBy: string
  onClose: () => void
  children: ReactNode
}

interface PopoverPosition {
  top: number
  left: number
  minWidth: number
  maxHeight: number
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum)
}

function menuItems(panel: HTMLElement): HTMLButtonElement[] {
  return [...panel.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')]
    .filter((item) => !item.disabled)
}

export function ToolbarPopover({
  open,
  id,
  className,
  triggerRef,
  labelledBy,
  onClose,
  children,
}: ToolbarPopoverProps) {
  const panelRef = useRef<HTMLElement>(null)
  const [position, setPosition] = useState<PopoverPosition | null>(null)

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current
    const panel = panelRef.current
    if (!trigger || !panel) return

    const triggerRect = trigger.getBoundingClientRect()
    const panelRect = panel.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const minWidth = Math.min(
      Math.max(MIN_POPOVER_WIDTH, triggerRect.width),
      Math.max(0, viewportWidth - VIEWPORT_PADDING * 2),
    )
    const availableBelow = viewportHeight - triggerRect.bottom - POPOVER_GAP - VIEWPORT_PADDING
    const availableAbove = triggerRect.top - POPOVER_GAP - VIEWPORT_PADDING
    const opensAbove = availableBelow < Math.min(panelRect.height, MIN_POPOVER_HEIGHT)
      && availableAbove > availableBelow
    const availableHeight = Math.max(
      MIN_POPOVER_HEIGHT,
      opensAbove ? availableAbove : availableBelow,
    )
    const renderedHeight = Math.min(panelRect.height, availableHeight)
    const top = opensAbove
      ? Math.max(VIEWPORT_PADDING, triggerRect.top - POPOVER_GAP - renderedHeight)
      : Math.min(
          triggerRect.bottom + POPOVER_GAP,
          viewportHeight - VIEWPORT_PADDING - renderedHeight,
        )
    const maximumLeft = Math.max(
      VIEWPORT_PADDING,
      viewportWidth - VIEWPORT_PADDING - Math.max(panelRect.width, minWidth),
    )

    setPosition({
      top,
      left: clamp(triggerRect.left, VIEWPORT_PADDING, maximumLeft),
      minWidth,
      maxHeight: availableHeight,
    })
  }, [triggerRef])

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null)
      return undefined
    }

    updatePosition()
    const frame = window.requestAnimationFrame(updatePosition)
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

  useEffect(() => {
    if (!open || !position) return
    const activeElement = document.activeElement
    if (activeElement !== document.body && activeElement !== triggerRef.current) return
    const panel = panelRef.current
    if (!panel) return
    menuItems(panel)[0]?.focus()
  }, [open, position, triggerRef])

  const handleMenuKeyDown = (event: KeyboardEvent<HTMLElement>) => {
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

  const style: CSSProperties = position
    ? {
        top: position.top,
        left: position.left,
        minWidth: position.minWidth,
        maxHeight: position.maxHeight,
      }
    : { top: 0, left: 0, visibility: 'hidden' }

  return createPortal(
    <menu
      id={id}
      ref={panelRef}
      className={`toolbar-menu-popover ${className}`}
      role="menu"
      aria-labelledby={labelledBy}
      style={style}
      onKeyDown={handleMenuKeyDown}
    >
      {children}
    </menu>,
    document.body,
  )
}
