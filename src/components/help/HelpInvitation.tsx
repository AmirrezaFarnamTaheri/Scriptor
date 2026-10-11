import type { HelpLabels } from '../../lib/help/labels'
import type { HelpGuide } from '../../lib/help/types'
import type { HelpLocale } from '../../lib/help/translationTypes'

interface HelpInvitationProps {
  guide: HelpGuide
  locale: HelpLocale
  labels: HelpLabels
  onGuide: () => void
  onTour: () => void
  onDismiss: () => void
}

/**
 * One-time, non-modal orientation for complex surfaces. It never starts a tour
 * or mutates the feature by itself; users explicitly choose Guide or Tour.
 */
export function HelpInvitation({ guide, locale, labels, onGuide, onTour, onDismiss }: HelpInvitationProps) {
  return (
    <aside className="help-invitation help-ui" role="region" aria-labelledby="help-invitation-title" lang={locale} dir={locale === 'fa' ? 'rtl' : 'ltr'}>
      <div className="help-invitation-copy">
        <p className="help-eyebrow">{labels.firstOpen}</p>
        <h2 id="help-invitation-title">{guide.title}</h2>
        <p>{labels.firstOpenBody}</p>
      </div>
      <div className="help-invitation-actions">
        <button type="button" className="toolbar-button" onClick={onGuide}>{labels.openGuide}</button>
        <button type="button" className="primary-button" onClick={onTour}>{labels.start}</button>
        <button type="button" className="toolbar-button" onClick={onDismiss}>{labels.dismiss}</button>
      </div>
      <p className="help-invitation-shortcut">{labels.contextShortcut}</p>
    </aside>
  )
}
