import { useCallback, useEffect, useRef, useState } from 'react'
import { HelpCenter } from './HelpCenter'
import { HelpInvitation } from './HelpInvitation'
import { getProgress, HelpProgressStore } from '../../lib/help/progress'
import { parseHelpRequest } from '../../lib/help/request'
import { contextGuide, findGuideTarget, isVisibleHelpTarget } from '../../lib/help/context'
import { HELP_EVENT, HELP_STORAGE_KEY, type HelpGuide, type HelpRequest } from '../../lib/help/types'
import { HELP_BY_ID } from '../../lib/help/catalog'
import { helpLabels } from '../../lib/help/labels'
import { useI18n } from '../../lib/i18n'
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
  const { locale } = useI18n()
  const labels = helpLabels(locale)
  const [store] = useState(createStore)
  const [session, setSession] = useState<HelpSession | null>(null)
  const [invitation, setInvitation] = useState<HelpGuide | null>(null)
  const lastInteraction = useRef<Element | null>(null)
  const highlightCleanup = useRef<(() => void) | null>(null)
  const open = useCallback((request: HelpRequest) => {
    highlightCleanup.current?.()
    const guide = HELP_BY_ID.get(request.id)
    if (guide?.policy === 'first-open') store.dispatch({ type: 'introduce', id: guide.id })
    setInvitation(null)
    const returnFocus = toFocusRestorer(document.activeElement)
    setSession((current) => ({
      ...request,
      sequence: (current?.sequence ?? 0) + 1,
      returnFocus,
    }))
  }, [store])
  const close = useCallback(() => setSession(null), [])

  const maybeOffer = useCallback((node: Node | null): boolean => {
    if (!node || session || invitation) return false
    try {
      if (window.localStorage.getItem('scriptor:onboarding-complete') !== 'true') return false
    } catch {
      return false
    }
    const elements: Element[] = []
    if (node instanceof Element) {
      if (node.matches('[data-help-topic]')) elements.push(node)
      elements.push(...Array.from(node.querySelectorAll('[data-help-topic]')))
    }
    for (const element of elements) {
      if (!isVisibleHelpTarget(element)) continue
      const id = (element as HTMLElement).dataset.helpTopic
      if (!id) continue
      const guide = HELP_BY_ID.get(id)
      if (!guide || guide.policy !== 'first-open') continue
      const progress = getProgress(store.getSnapshot().preferences, guide.id)
      if (progress.introduced || progress.completed) continue
      setInvitation(guide)
      return true
    }
    return false
  }, [invitation, session, store])

  useEffect(() => {
    const observer = new MutationObserver((records) => {
      if (session || invitation) return
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (maybeOffer(node)) return
        }
      }
    })
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [invitation, maybeOffer, session])

  useEffect(() => {
    const remember = (event: Event) => {
      if (event.target instanceof Element && !event.target.closest('.help-ui')) lastInteraction.current = event.target
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
      open({ id: guide.id, view: event.shiftKey ? 'tour' : progress.step > 0 && !progress.completed ? 'tour' : 'guide' })
    }
    const storage = (event: StorageEvent) => { if (event.key === HELP_STORAGE_KEY || event.key === null) store.acceptStorage(event.newValue) }
    const rememberAndOffer = (event: Event) => {
      remember(event)
      if (event.target instanceof Node) maybeOffer(event.target)
    }
    document.addEventListener('pointerdown', rememberAndOffer, true)
    document.addEventListener('focusin', rememberAndOffer, true)
    window.addEventListener(HELP_EVENT, request)
    window.addEventListener('keydown', keyboard, true)
    window.addEventListener('storage', storage)
    return () => {
      document.removeEventListener('pointerdown', rememberAndOffer, true)
      document.removeEventListener('focusin', rememberAndOffer, true)
      window.removeEventListener(HELP_EVENT, request)
      window.removeEventListener('keydown', keyboard, true)
      window.removeEventListener('storage', storage)
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
  if (invitation) {
    const acknowledge = () => store.dispatch({ type: 'introduce', id: invitation.id })
    return (
      <HelpInvitation
        guide={invitation}
        labels={labels}
        onGuide={() => { acknowledge(); open({ id: invitation.id, view: 'guide' }) }}
        onTour={() => { acknowledge(); open({ id: invitation.id, view: 'tour' }) }}
        onDismiss={() => { acknowledge(); setInvitation(null) }}
      />
    )
  }
  return null
}
