import type { ComponentProps } from 'react'
import { X } from 'lucide-react'
import { UnifiedPanelShell } from './UnifiedPanelShell'

/** A non-modal panel body for two panes that share one owning workspace shell. */
export type EmbeddedPanelShellProps = ComponentProps<typeof UnifiedPanelShell> & { hideHeader?: boolean }
export function EmbeddedPanelShell({ title, subtitle, ariaLabel, helpTopic, className, children, onClose, headerActions, hideHeader = false }: EmbeddedPanelShellProps) {
  return <section aria-label={ariaLabel} data-help-topic={helpTopic} className={`embedded-panel-shell ${className ?? ''}`}>
    {!hideHeader && <header><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{headerActions}<button className="icon-button" aria-label={`Close ${title}`} onClick={onClose}><X size={16} /></button></header>}
    <div className="embedded-panel-body">{children}</div>
  </section>
}
