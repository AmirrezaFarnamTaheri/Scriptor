import type { ReactNode } from 'react'
import { CheckCircle2, ChevronDown, MoreHorizontal } from 'lucide-react'
import { useState } from 'react'

/** Returns the platform-appropriate display label for a single-key shortcut. */
export function shortcutLabel(key: string): string {
  if (typeof navigator === 'undefined') return `Ctrl+${key}`
  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform) ? `⌘${key}` : `Ctrl+${key}`
}

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
      <button type="button" className="section-title">
        {icon}
        {title}
        <ChevronDown />
      </button>
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

/** Provides the shared heading and optional action treatment for dashboard widgets. */
export function WidgetCard({
  title,
  action,
  onAction,
  children,
}: {
  title: string
  action?: string
  onAction?: () => void
  children: ReactNode
}) {
  return (
    <section className="widget-card">
      <header>
        <h2>{title}</h2>
        {action ? (
          onAction ? (
            <button type="button" className="widget-action" onClick={onAction}>
              <CheckCircle2 />
              {action}
            </button>
          ) : (
            <span>
              <CheckCircle2 />
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
