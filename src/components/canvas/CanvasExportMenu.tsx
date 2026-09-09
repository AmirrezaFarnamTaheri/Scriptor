import { useId, useRef, useState } from 'react'
import { ChevronDown, Download } from 'lucide-react'

import { ToolbarPopover } from '../ToolbarPopover'

interface CanvasExportMenuProps {
  disabled?: boolean
  onExport: (format: 'svg' | 'png' | 'pdf') => void
}

const FORMATS = [
  ['svg', 'SVG'],
  ['png', 'PNG'],
  ['pdf', 'PDF'],
] as const

export function CanvasExportMenu({ disabled, onExport }: CanvasExportMenuProps) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const triggerId = useId()
  const menuId = useId()

  return (
    <div className="canvas-export-menu">
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        className={open ? 'toolbar-button active' : 'toolbar-button'}
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowDown') return
          event.preventDefault()
          setOpen(true)
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
      >
        <Download size={14} aria-hidden="true" />
        Export
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      <ToolbarPopover
        open={open}
        id={menuId}
        className="canvas-export-menu-panel"
        triggerRef={triggerRef}
        labelledBy={triggerId}
        onClose={() => setOpen(false)}
      >
        {FORMATS.map(([format, label]) => (
          <li key={format} role="none">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onExport(format)
                setOpen(false)
                triggerRef.current?.focus()
              }}
            >
              Export {label}
            </button>
          </li>
        ))}
      </ToolbarPopover>
    </div>
  )
}
