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
  Pilcrow,
  Rows,
  Table,
} from 'lucide-react'

import type { EditorTransformAction } from '@scriptor/editor'
import { ToolbarPopover } from '../ToolbarPopover'
import { useI18n } from '../../lib/i18n'

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
  const { t } = useI18n()
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
        aria-label={t('editorStructure.ariaLabel')}
        title={t('editorStructure.ariaLabel')}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
      >
        <Pilcrow size={14} aria-hidden="true" />
        <span className="toolbar-menu-trigger-label">{t('editorStructure.label')}</span>
        <ChevronDown className="toolbar-menu-trigger-chevron" size={14} aria-hidden="true" />
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
            <Heading1 size={14} aria-hidden="true" /> {t('editorStructure.heading1')}
          </button>
        </li>
        <li role="none">
          <button type="button" role="menuitem" onClick={() => run(() => onTransform('h2'))}>
            <Heading2 size={14} aria-hidden="true" /> {t('editorStructure.heading2')}
          </button>
        </li>
        <li role="none">
          <button type="button" role="menuitem" onClick={() => run(() => onTransform('h3'))}>
            <Heading3 size={14} aria-hidden="true" /> {t('editorStructure.heading3')}
          </button>
        </li>
        <li role="separator" className="toolbar-menu-separator" />
        <li role="none">
          <button type="button" role="menuitem" onClick={() => run(onToggleToc)}>
            <ListTree size={14} aria-hidden="true" /> {t('editorStructure.tableOfContents')}
          </button>
        </li>
        <li role="none">
          <button type="button" role="menuitem" onClick={() => run(onOpenFrontmatter)}>
            <FileBox size={14} aria-hidden="true" /> {t('editorStructure.documentProperties')}
          </button>
        </li>
        <li role="separator" className="toolbar-menu-separator" />
        <li role="none">
          <button type="button" role="menuitem" onClick={() => run(() => onTransform('table'))}>
            <Table size={14} aria-hidden="true" /> {t('editorStructure.insertTable')}
          </button>
        </li>
        <li role="none">
          <button type="button" role="menuitem" onClick={() => run(() => onTransform('table-add-row'))}>
            <Rows size={14} aria-hidden="true" /> {t('editorStructure.addTableRow')}
          </button>
        </li>
        <li role="none">
          <button type="button" role="menuitem" onClick={() => run(() => onTransform('table-add-col'))}>
            <Columns size={14} aria-hidden="true" /> {t('editorStructure.addTableColumn')}
          </button>
        </li>
        <li role="separator" className="toolbar-menu-separator" />
        <li role="none">
          <button type="button" role="menuitem" onClick={() => run(() => onTransform('move-section-up'))}>
            <ArrowUpToLine size={14} aria-hidden="true" /> {t('editorStructure.moveSectionUp')}
          </button>
        </li>
        <li role="none">
          <button type="button" role="menuitem" onClick={() => run(() => onTransform('move-section-down'))}>
            <ArrowDownToLine size={14} aria-hidden="true" /> {t('editorStructure.moveSectionDown')}
          </button>
        </li>
      </ToolbarPopover>
    </div>
  )
}
