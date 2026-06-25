import { useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

import { TYPOGRAPHY_ACTIONS, type TypographyAction } from '@scriptor/editor'

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
  const rootRef = useRef<HTMLDivElement>(null)

  return (
    <div className="typography-menu" ref={rootRef}>
      <button
        type="button"
        className={open ? 'active' : undefined}
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        Typography <ChevronDown size={14} />
      </button>
      {open ? (
        <menu className="typography-menu-panel" role="menu">
          {TYPOGRAPHY_ACTIONS.map((action) => (
            <li key={action} role="none">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onSelect(action)
                  setOpen(false)
                }}
              >
                {LABELS[action]}
              </button>
            </li>
          ))}
        </menu>
      ) : null}
    </div>
  )
}
