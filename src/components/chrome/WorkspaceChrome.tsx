import type { ReactNode } from 'react'
import { ArrowRight, ChevronDown, MoreHorizontal } from 'lucide-react'
import { useState } from 'react'

/** Renders a compact section heading with an optional local action menu. */
export function PanelHeader({
  title,
  icon,
  menuItems,
}: {
  title: string
  icon: ReactNode
  menuItems?: Array<{ label: string; run: () => void }>
}) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="panel-heading">
      {/* Use a plain div — this heading is structural, not interactive */}
      <div className="section-title">
        {icon}
        {title}
        <ChevronDown aria-hidden="true" />
      </div>
      {menuItems && menuItems.length > 0 ? (
        <div className="panel-menu">
          <IconButton label={`${title} options`} onClick={() => setMenuOpen((open) => !open)}>
            <MoreHorizontal />
          </IconButton>
          {menuOpen ? (
            <div className="panel-menu-popover" role="menu">
              {menuItems.map((item) => (
                <button
                  type="button"
                  key={item.label}
                  role="menuitem"
                  onClick={() => {
                    item.run()
                    setMenuOpen(false)
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

type HeadingLevel = 2 | 3 | 4

/** Provides the shared heading and optional action treatment for dashboard widgets. */
export function WidgetCard({
  title,
  action,
  onAction,
  children,
  headingLevel = 3,
}: {
  title: string
  action?: string
  onAction?: () => void
  children: ReactNode
  /** Semantic heading level. Defaults to h3 to avoid broken hierarchy inside panels that already have h2 titles. */
  headingLevel?: HeadingLevel
}) {
  const Heading = `h${headingLevel}` as 'h2' | 'h3' | 'h4'
  return (
    <section className="widget-card">
      <header>
        <Heading>{title}</Heading>
        {action ? (
          onAction ? (
            <button type="button" className="widget-action" onClick={onAction}>
              <ArrowRight aria-hidden="true" />
              {action}
            </button>
          ) : (
            <span>
              <ArrowRight aria-hidden="true" />
              {action}
            </span>
          )
        ) : null}
      </header>
      {children}
    </section>
  )
}

/**
 * Renders an icon-only button with a complete accessible name and a visual-only
 * tooltip. The optional shortcut is included in the button's accessible name.
 */
export function IconButton({
  label,
  shortcut,
  children,
  onClick,
  disabled,
  className,
}: {
  label: string
  shortcut?: string
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  className?: string
}) {
  return (
    <button
      type="button"
      className={`icon-button has-custom-tooltip ${className ?? ''}`.trim()}
      aria-label={shortcut ? `${label} (${shortcut})` : label}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
      <span className="custom-tooltip" aria-hidden="true">
        {label}
        {shortcut ? <kbd className="shortcut-badge">{shortcut}</kbd> : null}
      </span>
    </button>
  )
}
