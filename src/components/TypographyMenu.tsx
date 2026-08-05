import { useId, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

import { TYPOGRAPHY_ACTIONS, type TypographyAction } from '@scriptor/editor'
import { ToolbarPopover } from './ToolbarPopover'

const LABELS: Record<TypographyAction, string> = {
  zapGremlins: 'Zap gremlins',
  stripDuplicateSpaces: 'Strip duplicate spaces',
  removeLineBreaks: 'Remove line breaks',
  straightenQuotes: 'Straighten quotes',
  toDoubleQuotes: 'To double quotes',
  doubleQuotesToSingle: 'Double → single quotes',
  singleQuotesToDouble: 'Single → double quotes',
  addSpacesAroundEmdashes: 'Spaces around em dashes',
  removeSpacesAroundEmdashes: 'Remove em dash spaces',
  toTitleCase: 'Title case',
  toSentenceCase: 'Sentence case',
  quotesToItalics: 'Quotes → italics',
  italicsToQuotes: 'Italics → quotes',
}

interface TypographyMenuProps {
  disabled?: boolean
  onSelect: (action: TypographyAction) => void
}

export function TypographyMenu({ disabled, onSelect }: TypographyMenuProps) {
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
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
      >
        Typography <ChevronDown size={14} />
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
              {LABELS[action]}
            </button>
          </li>
        ))}
      </ToolbarPopover>
    </div>
  )
}
