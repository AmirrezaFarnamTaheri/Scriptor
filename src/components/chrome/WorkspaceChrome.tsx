import type { ReactNode } from 'react'
import { CheckCircle2, ChevronDown, MoreHorizontal } from 'lucide-react'
import { useState } from 'react'

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
      {menuItems && menuItems.length > 0 && (
        <div className="panel-menu">
          <IconButton label={`${title} options`} onClick={() => setMenuOpen((open) => !open)}>
            <MoreHorizontal />
          </IconButton>
          {menuOpen && (
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
          )}
        </div>
      )}
    </div>
  )
}

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
        {action &&
          (onAction ? (
            <button type="button" className="widget-action" onClick={onAction}>
              <CheckCircle2 />
              {action}
            </button>
          ) : (
            <span>
              <CheckCircle2 />
              {action}
            </span>
          ))}
      </header>
      {children}
    </section>
  )
}

export function IconButton({
  label,
  children,
  onClick,
  disabled,
}: {
  label: string
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      className="icon-button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  )
}
