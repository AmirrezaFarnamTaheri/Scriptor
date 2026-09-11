import { useId, useRef, useState } from 'react'
import { FileOutput, MoreHorizontal, Quote } from 'lucide-react'

import { ToolbarPopover } from '../ToolbarPopover'
import { useI18n } from '../../lib/i18n'

interface InlineEditorAssistProps {
  activePath: string | null
  brokenLinkCount?: number
  citationCount?: number
  onInsertCitation: () => void
  onOpenExport: () => void
}

/** Keeps document-scoped secondary actions available without expanding the persistent editor row. */
export function InlineEditorAssist({
  activePath,
  brokenLinkCount = 0,
  citationCount = 0,
  onInsertCitation,
  onOpenExport,
}: InlineEditorAssistProps) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const triggerId = useId()
  const menuId = useId()

  if (!activePath) return null

  const runAndClose = (action: () => void) => {
    action()
    setOpen(false)
    triggerRef.current?.focus()
  }

  return (
    <div className="format-group inline-editor-assist" aria-label={t('editorAssist.documentActions')}>
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        className={open ? 'toolbar-button active' : 'toolbar-button'}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowDown') return
          event.preventDefault()
          setOpen(true)
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        title={t('editorAssist.moreActions')}
      >
        <MoreHorizontal size={15} aria-hidden="true" />
        <span className="sr-only">{t('editorAssist.moreActions')}</span>
      </button>
      <ToolbarPopover
        open={open}
        id={menuId}
        className="inline-editor-assist-menu"
        triggerRef={triggerRef}
        labelledBy={triggerId}
        onClose={() => setOpen(false)}
      >
        <li role="none">
          <button type="button" role="menuitem" onClick={() => runAndClose(onInsertCitation)}>
            <Quote size={14} aria-hidden="true" />
            <span>{t('editorAssist.insertCitation')}{citationCount > 0 ? ` (${citationCount})` : ''}</span>
          </button>
        </li>
        <li role="none">
          <button type="button" role="menuitem" onClick={() => runAndClose(onOpenExport)}>
            <FileOutput size={14} aria-hidden="true" />
            <span>{t('editorAssist.exportPublish')}{brokenLinkCount > 0 ? ` · ${t('editorAssist.issueCount', { count: brokenLinkCount })}` : ''}</span>
          </button>
        </li>
      </ToolbarPopover>
    </div>
  )
}