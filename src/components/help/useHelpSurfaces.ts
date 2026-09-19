import { useEffect, useState } from 'react'
import { HELP_GUIDES, HELP_BY_ID } from '../../lib/help/catalog'
import { rootsForGuide, isVisibleHelpTarget } from '../../lib/help/context'
import type { HelpGuide } from '../../lib/help/types'

export interface HelpSurface { key: number; guide: HelpGuide; root: HTMLElement; host: HTMLElement }
const HEADER_SELECTORS = [
  ':scope > .unified-panel-header .unified-panel-header-actions',
  ':scope > .unified-panel-header', ':scope > .graph-header', ':scope > .canvas-header',
  ':scope > .plugin-manager-header', ':scope > .customizer-header', ':scope > .toolbar-customizer-header',
  ':scope > header', ':scope > .panel-heading',
]

function findHost(root: HTMLElement): HTMLElement | null {
  if (root.matches('header.topbar')) return root.querySelector('.top-actions')
  if (root.matches('.editor-toolbar')) return root.querySelector<HTMLElement>('.inline-editor-assist, .editor-primary-formatting') ?? root
  if (root.matches('.editor-panel')) return null // The toolbar has its own, more precise owner.
  if (root.matches('.inspector-panel')) return root.querySelector('.inspector-preset-control')
  for (const selector of HEADER_SELECTORS) {
    const host = root.querySelector<HTMLElement>(selector)
    if (host && !host.closest('.markdown-preview, .cm-editor, .monaco-editor')) return host
  }
  if (root.matches('[role="tabpanel"]')) return root.querySelector<HTMLElement>('.settings-section > h3, .settings-section h3')
  return null
}

/** Throttled discovery attaches React portals to existing chrome; it never reads document contents. */
export function useHelpSurfaces(): HelpSurface[] {
  const [surfaces, setSurfaces] = useState<HelpSurface[]>([])
  useEffect(() => {
    const keys = new WeakMap<Element, number>()
    let nextKey = 0
    let timer: number | undefined
    let disposed = false
    const scan = () => {
      timer = undefined
      if (disposed) return
      const next: HelpSurface[] = []
      const hosts = new Set<HTMLElement>()
      const add = (guide: HelpGuide, root: Element) => {
        if (!isVisibleHelpTarget(root) || root.closest('.onboarding-tour')) return
        const host = findHost(root)
        if (!host || hosts.has(host) || !isVisibleHelpTarget(host)) return
        hosts.add(host)
        if (!keys.has(root)) keys.set(root, ++nextKey)
        next.push({ key: keys.get(root)!, guide, root, host })
      }
      document.querySelectorAll<HTMLElement>('[data-help-topic]').forEach((root) => {
        const guide = HELP_BY_ID.get(root.dataset.helpTopic ?? '')
        if (guide) add(guide, root)
      })
      for (const guide of HELP_GUIDES) {
        if (guide.id === 'help') continue
        for (const selector of rootsForGuide(guide)) document.querySelectorAll(selector).forEach((root) => add(guide, root))
      }
      const bounded = next.slice(0, 100)
      setSurfaces((old) => old.length === bounded.length && old.every((item, index) => item.root === bounded[index]?.root && item.host === bounded[index]?.host && item.guide.id === bounded[index]?.guide.id) ? old : bounded)
    }
    const schedule = () => { if (timer === undefined && !disposed) timer = window.setTimeout(scan, 100) }
    const observer = new MutationObserver((records) => {
      if (records.some((record) => !(record.target instanceof Element) || !record.target.closest('.help-ui'))) schedule()
    })
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'aria-hidden', 'aria-selected', 'open', 'data-help-topic'] })
    window.addEventListener('resize', schedule)
    document.addEventListener('focusin', schedule)
    schedule()
    return () => {
      disposed = true
      if (timer !== undefined) window.clearTimeout(timer)
      observer.disconnect()
      window.removeEventListener('resize', schedule)
      document.removeEventListener('focusin', schedule)
    }
  }, [])
  return surfaces
}
