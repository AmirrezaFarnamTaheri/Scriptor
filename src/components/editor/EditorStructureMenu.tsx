import { useId, useRef, useState } from 'react'
import {
  ArrowDownToLine,
  ArrowUpToLine,
  ChevronDown,
  Columns,
  FileBox,
  Heading1,
  Heading2,
  Heading3,
  ListTree,
  Rows,
  Table,
} from 'lucide-react'

import type { EditorTransformAction } from '@scriptor/editor'
import { ToolbarPopover } from '../ToolbarPopover'

interface EditorStructureMenuProps {
  disabled?: boolean
  onTransform: (action: EditorTransformAction) => void
  onToggleToc: () => void
  onOpenFrontmatter: () => void
}

export function EditorStructureMenu({
  disabled,
  onTransform,
  onToggleToc,
  onOpenFrontmatter,
}: EditorStructureMenuProps) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const triggerId = useId()
  const menuId = useId()

  const run = (action: () => void) => {
    action()
    setOpen(false)
    triggerRef.current?.focus()
  }

  return (
    <div className="editor-structure-menu">
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
        Structure <ChevronDown size={14} aria-hidden="true" />
      </button>
      <ToolbarPopover
        open={open}
        id={menuId}
        className="editor-structure-menu-panel"
        triggerRef={triggerRef}
        labelledBy={triggerId}
        onClose={() => setOpen(false)}
      >
        <li role="none">
          <button type="button" role="menuitem" onClick={() => run(() => onTransform('h1'))}>
            <Heading1 size={14} aria-hidden="true" /> Heading 1
          </button>
        </li>
        <li role="none">
          <button type="button" role="menuitem" onClick={() => run(() => onTransform('h2'))}>
            <Heading2 size={14} aria-hidden="true" /> Heading 2
          </button>
        </li>
        <li role="none">
          <button type="button" role="menuitem" onClick={() => run(() => onTransform('h3'))}>
            <Heading3 size={14} aria-hidden="true" /> Heading 3
          </button>
        </li>
        <li role="separator" className="toolbar-menu-separator" />
        <li role="none">
          <button type="button" role="menuitem" onClick={() => run(onToggleToc)}>
            <ListTree size={14} aria-hidden="true" /> Table of contents
          </button>
        </li>
        <li role="none">
          <button type="button" role="menuitem" onClick={() => run(onOpenFrontmatter)}>
            <FileBox size={14} aria-hidden="true" /> Document properties
          </button>
        </li>
        <li role="separator" className="toolbar-menu-separator" />
        <li role="none">
          <button type="button" role="menuitem" onClick={() => run(() => onTransform('table'))}>
            <Table size={14} aria-hidden="true" /> Insert table
          </button>
        </li>
        <li role="none">
          <button type="button" role="menuitem" onClick={() => run(() => onTransform('table-add-row'))}>
            <Rows size={14} aria-hidden="true" /> Add table row
          </button>
        </li>
        <li role="none">
          <button type="button" role="menuitem" onClick={() => run(() => onTransform('table-add-col'))}>
            <Columns size={14} aria-hidden="true" /> Add table column
          </button>
        </li>
        <li role="separator" className="toolbar-menu-separator" />
        <li role="none">
          <button type="button" role="menuitem" onClick={() => run(() => onTransform('move-section-up'))}>
            <ArrowUpToLine size={14} aria-hidden="true" /> Move section up
          </button>
        </li>
        <li role="none">
          <button type="button" role="menuitem" onClick={() => run(() => onTransform('move-section-down'))}>
            <ArrowDownToLine size={14} aria-hidden="true" /> Move section down
          </button>
        </li>
      </ToolbarPopover>
    </div>
  )
}
