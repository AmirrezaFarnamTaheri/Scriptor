import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent } from 'react'
import { X } from 'lucide-react'
import { createPortal } from 'react-dom'
import { browseGuides, getGuide, HELP_CATEGORIES } from '../../lib/help/catalog'
import type { HelpGuide, HelpRequest, HelpView } from '../../lib/help/types'
import type { HelpProgressStore } from '../../lib/help/progress'
import { helpLabels } from '../../lib/help/labels'
import { useI18n } from '../../lib/i18n'
import { useEscapeToClose } from '../../hooks/useEscapeToClose'
import { HelpTopic } from './HelpTopic'

interface HelpCenterProps {
  request: HelpRequest
  store: HelpProgressStore
  onClose: () => void
  onReveal: (guide: HelpGuide, selector?: string) => boolean
  returnFocus?: HTMLElement | null
}

/** Native top-layer modality keeps an already-open feature intact underneath Help. */
export function HelpCenter({ request, store, onClose, onReveal, returnFocus = null }: HelpCenterProps) {
  const { locale } = useI18n()
  const labels = helpLabels(locale)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const [id, setId] = useState(request.id)
  const [view, setView] = useState<HelpView>(request.view)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [confirmReset, setConfirmReset] = useState(false)
  const { storageWarning } = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  const guide = getGuide(id)
  const results = browseGuides(id, query, category)
  useEscapeToClose(true, onClose)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const invoker = returnFocus?.isConnected
      ? returnFocus
      : document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    const oldOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.showModal()
    searchRef.current?.focus()
    return () => {
      if (dialog.open) dialog.close()
      if (document.body.style.overflow === 'hidden') document.body.style.overflow = oldOverflow
      if (invoker?.isConnected) invoker.focus({ preventScroll: true })
    }
  }, [])

  const selectGuide = (next: string) => { setId(next); setView('guide') }
  const keyDown = (event: KeyboardEvent<HTMLDialogElement>) => {
    // Underlying legacy feature focus traps listen on document. Keep their
    // handlers out of this top-layer dialog's tab sequence and text input.
    event.stopPropagation()
    if (event.key !== 'Tab') return
    const elements = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), summary, a[href], [tabindex="0"]'))
      .filter((element) => element.getClientRects().length > 0)
    if (elements.length === 0) { event.preventDefault(); return }
    const current = elements.indexOf(document.activeElement as HTMLElement)
    const next = event.shiftKey ? (current <= 0 ? elements.length - 1 : current - 1) : (current + 1) % elements.length
    event.preventDefault()
    elements[next]?.focus()
  }

  return createPortal(
    <dialog ref={dialogRef} className="help-center help-ui" aria-labelledby="help-center-title" onKeyDown={keyDown} onCancel={(event) => { event.preventDefault(); onClose() }} dir={locale === 'fa' ? 'rtl' : 'ltr'}>
      <header className="help-center-header">
        <div><h1 id="help-center-title">{labels.title}</h1><p>{labels.offline}</p></div>
        <button type="button" className="toolbar-button" aria-label={labels.close} onClick={onClose}><X aria-hidden="true" /></button>
      </header>
      {storageWarning ? <p className="help-notice" role="status">{labels.storage}</p> : null}
      {locale !== 'en' ? <p className="help-language-notice">{labels.language}</p> : null}
      <div className="help-center-body">
        <aside className="help-browser">
          <label>{labels.search}<input ref={searchRef} type="search" maxLength={256} value={query} onChange={(event) => setQuery(event.target.value)} /></label>
          <label>{labels.category}<select value={category} onChange={(event) => setCategory(event.target.value)}><option value="">{labels.all}</option>{HELP_CATEGORIES.map((name) => <option value={name} key={name} lang="en">{name}</option>)}</select></label>
          <p className="help-result-count" role="status">{labels.results}: {results.length}</p>
          <nav aria-label={labels.results}><ul>{results.map((item) => <li key={item.id}><button type="button" aria-current={id === item.id ? 'page' : undefined} onClick={() => selectGuide(item.id)} lang="en" dir="ltr">{item.title}</button></li>)}</ul></nav>
          {results.length === 0 ? <p role="status">{labels.noResults}</p> : null}
        </aside>
        <div className="help-reading-pane">
          <HelpTopic key={id} guide={guide} view={view} labels={labels} store={store} onView={setView} onGuide={selectGuide} onReveal={onReveal} />
        </div>
      </div>
      <footer className="help-center-footer">
        {!confirmReset ? <button type="button" className="toolbar-button" onClick={() => setConfirmReset(true)}>{labels.reset}</button> : (
          <div className="help-reset-confirmation" role="group" aria-label={labels.reset}>
            <p>{labels.resetAsk}</p>
            <button type="button" className="toolbar-button" onClick={() => setConfirmReset(false)}>{labels.cancel}</button>
            <button type="button" className="toolbar-button" onClick={() => { store.dispatch({ type: 'reset' }); setConfirmReset(false) }}>{labels.confirmReset}</button>
          </div>
        )}
      </footer>
    </dialog>, document.body,
  )
}
