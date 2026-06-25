import { useRef, useState } from 'react'
import { ChevronDown, Plus } from 'lucide-react'

import { MERMAID_SNIPPETS, MATH_SNIPPETS } from '@scriptor/editor'

interface InsertMenuProps {
  disabled?: boolean
  onInsert: (content: string) => void
}

const TASK_LIST = '- [ ] '

export function InsertMenu({ disabled, onInsert }: InsertMenuProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

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
    <div className="insert-menu" ref={rootRef}>
      <button
        type="button"
        className={open ? 'active' : undefined}
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Plus size={14} />
        Insert
        <ChevronDown size={14} />
      </button>
      {open ? (
        <menu className="insert-menu-panel" role="menu">
          {items.map((item) => (
            <li key={item.id} role="none">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onInsert(item.content)
                  setOpen(false)
                }}
              >
                {item.label}
              </button>
            </li>
          ))}
        </menu>
      ) : null}
    </div>
  )
}
