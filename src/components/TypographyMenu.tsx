import { useId, useRef, useState } from 'react'
import { ChevronDown, Type } from 'lucide-react'

import { TYPOGRAPHY_ACTIONS, type TypographyAction } from '@scriptor/editor/pure'
import { useI18n } from '../lib/i18n'
import { ToolbarPopover } from './ToolbarPopover'

const LABEL_KEYS: Record<TypographyAction, string> = {
  zapGremlins: 'typography.zapGremlins',
  stripDuplicateSpaces: 'typography.stripDuplicateSpaces',
  removeLineBreaks: 'typography.removeLineBreaks',
  straightenQuotes: 'typography.straightenQuotes',
  toDoubleQuotes: 'typography.toDoubleQuotes',
  doubleQuotesToSingle: 'typography.doubleQuotesToSingle',
  singleQuotesToDouble: 'typography.singleQuotesToDouble',
  addSpacesAroundEmdashes: 'typography.addSpacesAroundEmdashes',
  removeSpacesAroundEmdashes: 'typography.removeSpacesAroundEmdashes',
  toTitleCase: 'typography.toTitleCase',
  toSentenceCase: 'typography.toSentenceCase',
  quotesToItalics: 'typography.quotesToItalics',
  italicsToQuotes: 'typography.italicsToQuotes',
}

interface TypographyMenuProps {
  disabled?: boolean
  onSelect: (action: TypographyAction) => void
}

export function TypographyMenu({ disabled, onSelect }: TypographyMenuProps) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const triggerId = useId()
  const menuId = useId()

  return (
    <div className="typography-menu">
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
        aria-label={t('typography.trigger')}
        title={t('typography.trigger')}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
      >
        <Type size={14} aria-hidden="true" />
        <span className="toolbar-menu-trigger-label">{t('typography.trigger')}</span>
        <ChevronDown className="toolbar-menu-trigger-chevron" size={14} aria-hidden="true" />
      </button>
      <ToolbarPopover
        open={open}
        id={menuId}
        className="typography-menu-panel"
        triggerRef={triggerRef}
        labelledBy={triggerId}
        onClose={() => setOpen(false)}
      >
        {TYPOGRAPHY_ACTIONS.map((action) => (
          <li key={action} role="none">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onSelect(action)
                setOpen(false)
                triggerRef.current?.focus()
              }}
            >
              {t(LABEL_KEYS[action])}
            </button>
          </li>
        ))}
      </ToolbarPopover>
    </div>
  )
}
