import { useEffect, useRef, useState } from 'react'

export function useCommandPalette(initial = false) {
  const [open, setOpen] = useState(initial)
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing || event.keyCode === 229) return
      if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'k') {
        // Modal forms retain ownership of their keyboard input. The palette's
        // own modal is allowed so pressing its chord again remains harmless.
        const blockingModal = [...document.querySelectorAll<HTMLElement>('[aria-modal="true"]')]
          .some(element => !element.classList.contains('command-palette-overlay') && element.getClientRects().length > 0)
        if (blockingModal) return
        event.preventDefault()
        // Editors consume Ctrl/Cmd+K before a bubbling window listener sees it.
        // Capture this global chord and leave every other editor key untouched.
        event.stopPropagation()
        setOpen(true)
      }
      // Only swallow Escape while the palette is actually open, otherwise this
      // handler runs on every Escape anywhere in the app.
      if (event.key === 'Escape' && open) {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [open])

  useEffect(() => {
    if (open) {
      inputRef.current?.focus()
    }
  }, [open])

  return { open, setOpen, inputRef }
}
