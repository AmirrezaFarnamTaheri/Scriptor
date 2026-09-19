import { Fragment, memo, useId, useRef, useState, type ReactNode } from 'react'
import { ArrowRight, MoreHorizontal } from 'lucide-react'
import { ToolbarPopover } from '../ToolbarPopover'
import { useI18n } from '../../lib/i18n'
import { widgetHelpTopic } from '../../lib/help/widgetTopics'

/** Renders a compact section heading with an optional local action menu. */
export const PanelHeader = memo(function PanelHeader({
  title,
  icon,
  menuItems,
  menuLabel,
}: {
  title: string
  icon: ReactNode
  menuItems?: Array<{ label: string; run: () => void; group?: string }>
  menuLabel?: string
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuId = useId()
  const triggerId = useId()

  const closeMenu = () => setMenuOpen(false)

  return (
    <div className="panel-heading">
      <div className="section-title">
        {icon}
        {title}
      </div>
      {menuItems && menuItems.length > 0 ? (
        <div className="panel-menu">
          <button
            ref={triggerRef}
            id={triggerId}
            type="button"
            className="icon-button has-custom-tooltip"
            aria-label={menuLabel ?? `${title} options`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-controls={menuOpen ? menuId : undefined}
            onClick={() => setMenuOpen((open) => !open)}
            onKeyDown={(event) => {
              if (event.key !== 'ArrowDown') return
              event.preventDefault()
              setMenuOpen(true)
            }}
          >
            <MoreHorizontal aria-hidden="true" />
            <span className="custom-tooltip" aria-hidden="true">{menuLabel ?? `${title} options`}</span>
          </button>
          <ToolbarPopover
            open={menuOpen}
            id={menuId}
            className="panel-menu-popover panel-menu-popover-portal"
            triggerRef={triggerRef}
            labelledBy={triggerId}
            onClose={closeMenu}
          >
            {menuItems.map((item, index) => (
              <Fragment key={`${item.group ?? 'ungrouped'}:${item.label}`}>
                {item.group && item.group !== menuItems[index - 1]?.group ? (
                  <li role="presentation" className="toolbar-menu-section-label">{item.group}</li>
                ) : null}
                <li role="none">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      item.run()
                      closeMenu()
                      window.requestAnimationFrame(() => triggerRef.current?.focus())
                    }}
                  >
                    {item.label}
                  </button>
                </li>
              </Fragment>
            ))}
          </ToolbarPopover>
        </div>
      ) : null}
    </div>
  )
})

type HeadingLevel = 2 | 3 | 4

/** Provides the shared heading and optional action treatment for dashboard widgets. */
export const WidgetCard = memo(function WidgetCard({
  title,
  action,
  onAction,
  children,
  headingLevel = 3,
  helpTopic,
}: {
  title: string
  action?: string
  onAction?: () => void
  children: ReactNode
  /** Semantic heading level. Defaults to h3 to avoid broken hierarchy inside panels that already have h2 titles. */
  headingLevel?: HeadingLevel
  /** Explicit guide id for a custom widget; built-in translated headings have stable defaults. */
  helpTopic?: string
}) {
  const { t } = useI18n()
  const Heading = `h${headingLevel}` as 'h2' | 'h3' | 'h4'
  return (
    <section className="widget-card" data-help-topic={helpTopic ?? widgetHelpTopic(title, t)}>
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
})

/**
 * Renders an icon-only button with a complete accessible name and a visual-only
 * tooltip. The optional shortcut is included in the button's accessible name.
 */
export const IconButton = memo(function IconButton({
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
})
