import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { HelpCenter } from './HelpCenter'
import { getProgress, HelpProgressStore } from '../../lib/help/progress'
import { parseHelpRequest } from '../../lib/help/request'
import { helpLabels } from '../../lib/help/labels'
import { useI18n } from '../../lib/i18n'
import { contextGuide, findGuideTarget } from '../../lib/help/context'
import { HELP_EVENT, HELP_STORAGE_KEY, type HelpGuide, type HelpRequest } from '../../lib/help/types'
import { toFocusRestorer, type FocusRestorer } from '../../lib/overlayEscapeCoordinator'
import '../../styles/components/help.css'

function createStore(): HelpProgressStore {
  try { return new HelpProgressStore(window.localStorage) } catch { return new HelpProgressStore(null) }
}
interface HelpSession extends HelpRequest {
  sequence: number
  returnFocus: FocusRestorer | null
}

/** One read-only runtime owns explicit Help invocation, contextual F1, and replayable guidance. */
export function HelpRuntime() {
  const [store] = useState(createStore)
  const { locale } = useI18n()
  const labels = helpLabels(locale)
  const [session, setSession] = useState<HelpSession | null>(null)
  const [invitation, setInvitation] = useState<HelpGuide | null>(null)
  const lastInteraction = useRef<Element | null>(null)
  const highlightCleanup = useRef<(() => void) | null>(null)
  const open = useCallback((request: HelpRequest) => {
    highlightCleanup.current?.()
    setInvitation(null)
    const returnFocus = toFocusRestorer(document.activeElement)
    setSession((current) => ({
      ...request,
      sequence: (current?.sequence ?? 0) + 1,
      returnFocus,
    }))
  }, [])
  const close = useCallback(() => setSession(null), [])
  const maybeOffer = useCallback((element: Element | null) => {
    if (!element || document.querySelector('.help-center[open]')) return
    const guide = contextGuide(element)
    if (guide.policy !== 'first-open') return
    const progress = getProgress(store.getSnapshot().preferences, guide.id)
    if (progress.offered || progress.completed) return
    store.dispatch({ type: 'offer', id: guide.id })
    setInvitation(guide)
  }, [store])

  useEffect(() => {
    const remember = (event: Event) => {
      if (event.target instanceof Element && !event.target.closest('.help-ui')) {
        lastInteraction.current = event.target
        maybeOffer(event.target)
      }
    }
    const request = (event: Event) => {
      const parsed = parseHelpRequest((event as CustomEvent<unknown>).detail)
      if (parsed) open(parsed)
    }
    const keyboard = (event: KeyboardEvent) => {
      if (event.key !== 'F1' || event.repeat || event.isComposing || event.ctrlKey || event.altKey || event.metaKey) return
      event.preventDefault()
      event.stopImmediatePropagation()
      if (document.querySelector('.help-center[open]')) return
      const focused = document.activeElement instanceof Element && document.activeElement !== document.body ? document.activeElement : null
      const previous = lastInteraction.current?.isConnected ? lastInteraction.current : null
      const guide = contextGuide(focused ?? previous)
      const progress = getProgress(store.getSnapshot().preferences, guide.id)
      open({ id: guide.id, view: progress.step > 0 && !progress.completed ? 'tour' : 'guide' })
    }
    const storage = (event: StorageEvent) => { if (event.key === HELP_STORAGE_KEY || event.key === null) store.acceptStorage(event.newValue) }
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (!(node instanceof Element)) continue
          if (node.matches('[data-help-topic]')) maybeOffer(node)
          for (const target of node.querySelectorAll('[data-help-topic]')) maybeOffer(target)
        }
      }
    })
    observer.observe(document.body, { childList: true, subtree: true })
    document.addEventListener('pointerdown', remember, true)
    document.addEventListener('focusin', remember, true)
    window.addEventListener(HELP_EVENT, request)
    window.addEventListener('keydown', keyboard, true)
    window.addEventListener('storage', storage)
    return () => {
      document.removeEventListener('pointerdown', remember, true)
      document.removeEventListener('focusin', remember, true)
      window.removeEventListener(HELP_EVENT, request)
      window.removeEventListener('keydown', keyboard, true)
      window.removeEventListener('storage', storage)
      observer.disconnect()
      highlightCleanup.current?.()
    }
  }, [maybeOffer, open, store])

  const reveal = useCallback((guide: HelpGuide, selector?: string): boolean => {
    const target = findGuideTarget(guide, selector)
    if (!target) return false
    setSession(null)
    window.requestAnimationFrame(() => {
      if (!target.isConnected) return
      highlightCleanup.current?.()
      target.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' })
      const hadTabindex = target.hasAttribute('tabindex')
      if (!hadTabindex && !target.matches('button, input, textarea, select, a[href]')) target.setAttribute('tabindex', '-1')
      target.setAttribute('data-help-highlight', 'true')
      target.focus({ preventScroll: true })
      const cleanup = () => {
        target.removeAttribute('data-help-highlight')
        if (!hadTabindex && target.getAttribute('tabindex') === '-1') target.removeAttribute('tabindex')
        window.clearTimeout(timer)
      }
      const timer = window.setTimeout(cleanup, 6000)
      highlightCleanup.current = cleanup
    })
    return true
  }, [])

  if (session) {
    return <HelpCenter key={`${session.id}:${session.sequence}`} request={session} store={store} onClose={close} onReveal={reveal} returnFocus={session.returnFocus} />
  }
  if (!invitation) return null
  return createPortal(
    <aside className="help-invitation help-ui" role="status" aria-label={`${labels.newHere} ${invitation.title}`}>
      <div>
        <strong>{labels.newHere} {invitation.title}</strong>
        <p>{labels.firstOpen}</p>
      </div>
      <div className="help-invitation-actions">
        <button type="button" className="toolbar-button" onClick={() => open({ id: invitation.id, view: 'guide' })}>{labels.openGuide}</button>
        <button type="button" className="toolbar-button" onClick={() => setInvitation(null)}>{labels.notNow}</button>
      </div>
    </aside>,
    document.body,
  )
}
