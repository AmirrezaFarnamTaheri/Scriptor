import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { CircleHelp, X } from 'lucide-react'
import { HelpCenter } from './HelpCenter'
import { useHelpSurfaces } from './useHelpSurfaces'
import { useI18n } from '../../lib/i18n'
import { helpLabels } from '../../lib/help/labels'
import { getProgress, HelpProgressStore } from '../../lib/help/progress'
import { parseHelpRequest } from '../../lib/help/request'
import { contextGuide, findGuideTarget } from '../../lib/help/context'
import { HELP_EVENT, HELP_STORAGE_KEY, type HelpGuide, type HelpRequest } from '../../lib/help/types'
import '../../styles/components/help.css'

function createStore(): HelpProgressStore {
  try { return new HelpProgressStore(window.localStorage) } catch { return new HelpProgressStore(null) }
}
interface HelpSession extends HelpRequest { sequence: number }

/** One read-only runtime owns contextual invocation, invitations, and replayable guidance. */
export function HelpRuntime() {
  const { locale } = useI18n()
  const labels = helpLabels(locale)
  const [store] = useState(createStore)
  const { preferences } = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  const [session, setSession] = useState<HelpSession | null>(null)
  const [invitation, setInvitation] = useState<string | null>(null)
  const lastInteraction = useRef<Element | null>(null)
  const highlightCleanup = useRef<(() => void) | null>(null)
  const surfaces = useHelpSurfaces()
  const open = useCallback((request: HelpRequest) => {
    highlightCleanup.current?.()
    store.dispatch({ type: 'offer', id: request.id })
    setInvitation(null)
    setSession((current) => ({ ...request, sequence: (current?.sequence ?? 0) + 1 }))
  }, [store])
  const close = useCallback(() => setSession(null), [])

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
      open({ id: guide.id, view: progress.step > 0 && !progress.completed ? 'tour' : 'guide' })
    }
    const storage = (event: StorageEvent) => { if (event.key === HELP_STORAGE_KEY || event.key === null) store.acceptStorage(event.newValue) }
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
      highlightCleanup.current?.()
    }
  }, [open, store])

  useEffect(() => {
    if (!preferences.hints || session || invitation || document.querySelector('.onboarding-tour')) return
    // Offer only after the feature has settled. Never move focus or start a tour.
    const candidate = surfaces.find(({ guide }) => guide.policy === 'first-use' && !getProgress(preferences, guide.id).offered)
    if (!candidate) return
    const timer = window.setTimeout(() => {
      if (!candidate.root.isConnected || document.querySelector('.onboarding-tour, .help-center[open]')) return
      store.dispatch({ type: 'offer', id: candidate.guide.id })
      setInvitation(candidate.guide.id)
    }, 900)
    return () => window.clearTimeout(timer)
  }, [invitation, preferences, session, store, surfaces])

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

  return <>
    {surfaces.map(({ key, guide, host }) => createPortal(
      <span className="help-affordance help-ui" data-help-topic={guide.id}>
        <button type="button" className="help-trigger" aria-label={guide.id === 'workspace' ? labels.title : `${labels.helpFor} ${guide.title}`} title={`${labels.helpFor} ${guide.title} (F1)`} onClick={() => open({ id: guide.id, view: 'guide' })}><CircleHelp aria-hidden="true" /></button>
        {preferences.hints && invitation === guide.id ? <span className="help-invitation" role="status">
          <button type="button" onClick={() => open({ id: guide.id, view: 'tour' })}>{labels.invite}</button>
          <button type="button" aria-label={labels.dismiss} onClick={() => setInvitation(null)}><X aria-hidden="true" /></button>
        </span> : null}
      </span>, host, `help-surface-${key}`,
    ))}
    {session ? <HelpCenter key={`${session.id}:${session.sequence}`} request={session} store={store} onClose={close} onReveal={reveal} /> : null}
  </>
}
