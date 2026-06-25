import type { ReactNode } from 'react'
import { X } from 'lucide-react'

import { useEscapeToClose } from '../../hooks/useEscapeToClose'
import type { PanelPresentation } from '../../hooks/usePanelPresentation'

export interface PanelTab {
  id: string
  label: string
}

interface UnifiedPanelShellProps {
  title: string
  subtitle?: string
  icon?: ReactNode
  ariaLabel: string
  onClose: () => void
  tabs?: PanelTab[]
  activeTab?: string
  onTabChange?: (tabId: string) => void
  headerActions?: ReactNode
  children: ReactNode
  className?: string
  wide?: boolean
  presentation?: PanelPresentation
}

export function UnifiedPanelShell({
  title,
  subtitle,
  icon,
  ariaLabel,
  onClose,
  tabs,
  activeTab,
  onTabChange,
  headerActions,
  children,
  className = 'knowledge-filters-panel',
  wide = false,
  presentation = 'modal',
}: UnifiedPanelShellProps) {
  useEscapeToClose(true, onClose)

  const docked = presentation === 'dock-right'

  return (
    <div
      className={docked ? 'dock-backdrop' : 'modal-backdrop'}
      role="presentation"
      onClick={docked ? undefined : onClose}
    >
      <section
        className={`unified-panel-shell ${className}${wide ? ' unified-panel-wide' : ''}${docked ? ' unified-panel-docked' : ''}`}
        role="dialog"
        aria-label={ariaLabel}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="unified-panel-header">
          <div>
            <h2>
              {icon}
              {title}
            </h2>
            {subtitle ? <p className="health-subtitle">{subtitle}</p> : null}
          </div>
          <div className="unified-panel-header-actions">
            {headerActions}
            <button type="button" className="icon-button" onClick={onClose} aria-label={`Close ${title}`}>
              <X />
            </button>
          </div>
        </header>

        {tabs && tabs.length > 0 && activeTab && onTabChange ? (
          <div className="unified-panel-tabs" role="tablist" aria-label={`${title} sections`}>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                className={activeTab === tab.id ? 'active' : undefined}
                onClick={() => onTabChange(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        ) : null}

        <div className="unified-panel-body">{children}</div>
      </section>
    </div>
  )
}
