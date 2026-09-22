import { useId, useRef, useState } from 'react'
import { ChevronDown, Plus } from 'lucide-react'

import { INSERT_TOOLS } from './editor/toolbar-catalog'
import { ToolbarPopover } from './ToolbarPopover'

interface InsertMenuProps {
  disabled?: boolean
  onInsert: (content: string) => void
}

export function InsertMenu({ disabled, onInsert }: InsertMenuProps) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const triggerId = useId()
  const menuId = useId()


  return (
    <div className="insert-menu" data-help-topic="insert">
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        className={open ? 'active' : undefined}
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowDown') return
          event.preventDefault()
          setOpen(true)
        }}
        aria-label="Insert"
        title="Insert content"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
      >
        <Plus size={14} aria-hidden="true" />
        <span className="toolbar-menu-trigger-label">Insert</span>
        <ChevronDown className="toolbar-menu-trigger-chevron" size={14} aria-hidden="true" />
      </button>
      <ToolbarPopover
        open={open}
        id={menuId}
        className="insert-menu-panel"
        triggerRef={triggerRef}
        labelledBy={triggerId}
        onClose={() => setOpen(false)}
      >
        {INSERT_TOOLS.map((item) => (
          <li key={item.id} role="none">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onInsert(item.content)
                setOpen(false)
                triggerRef.current?.focus()
              }}
            >
              {item.label}
            </button>
          </li>
        ))}
      </ToolbarPopover>
    </div>
  )
}
