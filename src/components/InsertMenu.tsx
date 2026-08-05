import { useId, useRef, useState } from 'react'
import { ChevronDown, Plus } from 'lucide-react'

import { MERMAID_SNIPPETS, MATH_SNIPPETS } from '@scriptor/editor'
import { ToolbarPopover } from './ToolbarPopover'

interface InsertMenuProps {
  disabled?: boolean
  onInsert: (content: string) => void
}

const TASK_LIST = '- [ ] '

export function InsertMenu({ disabled, onInsert }: InsertMenuProps) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const triggerId = useId()
  const menuId = useId()

  const items = [
    ...MERMAID_SNIPPETS.map((snippet) => ({
      id: snippet.name,
      label: snippet.description,
      content: snippet.content,
    })),
    ...MATH_SNIPPETS.map((snippet) => ({
      id: snippet.name,
      label: snippet.description,
      content: snippet.content,
    })),
    { id: 'task-list', label: 'Task list item', content: TASK_LIST },
    { id: 'toc', label: 'Table of contents marker', content: '[TOC]\n\n' },
    { id: 'dql', label: 'DQL query block', content: '```dql\npath has #tag\n```\n' },
    { id: 'import', label: 'MPE @import', content: '@import "chapter.md"\n' },
  ]

  return (
    <div className="insert-menu">
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
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
      >
        <Plus size={14} />
        Insert
        <ChevronDown size={14} />
      </button>
      <ToolbarPopover
        open={open}
        id={menuId}
        className="insert-menu-panel"
        triggerRef={triggerRef}
        labelledBy={triggerId}
        onClose={() => setOpen(false)}
      >
        {items.map((item) => (
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
