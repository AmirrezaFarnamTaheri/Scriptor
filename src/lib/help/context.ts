import { HELP_GUIDES, HELP_BY_ID, getGuide } from './catalog'
import type { HelpGuide } from './types'

/** These adapters follow actual surface owners, not translated titles or user note HTML. */
export const HELP_ROOTS: Readonly<Record<string, readonly string[]>> = {
  workspace: ['header.topbar'],
  'knowledge-repair': ['.knowledge-filter-dialog', '.knowledge-workbench-embed:has(.knowledge-triage-bar)'],
  'saved-views': ['.saved-views-panel', '.knowledge-workbench-embed:has(.saved-views-form):not(.smart-collections-panel)'],
  gmail: ['.gmail-manager-panel'],
  'custom-theme': ['.customizer-modal'],
  frontmatter: ['.frontmatter-inspector'],
  collections: ['.smart-collections-panel'],
  templates: ['.template-picker-modal'],
  search: ['.vault-search', '#dock-panel-search'],
  problems: ['#dock-panel-problems'],
  'export-jobs': ['#dock-panel-jobs', '.publish-center-history'],
  'activity-output': ['#dock-panel-output'],
  export: ['.publish-center-panel', '.references-preview-panel'],
  publish: ['.publish-center-section[aria-labelledby="site-publishing-heading"]'],
  appearance: ['.settings-panel [role="tabpanel"][id$="-panel-appearance"]'],
  google: ['.settings-panel [role="tabpanel"][id$="-panel-integrations"]'],
  shortcuts: ['.settings-panel [role="tabpanel"][id$="-panel-shortcuts"]', '.shortcut-table'],
  advanced: ['.settings-panel [role="tabpanel"][id$="-panel-advanced"]'],
  docks: ['.settings-panel [role="tabpanel"][id$="-panel-workspace"]'],
  diagnostics: ['.diagnostics-panel', '.vault-health-dashboard', '.health-dashboard', '.health-panel'],
  annotations: ['.reader-panel__popover-anchor', '.reader-panel__annotation-error'],
  permissions: ['.mutation-confirmation', '.permission-review', '.plugin-permissions', '.external-deep-link-dialog', '.git-confirm-dialog'],
}
export function rootsForGuide(guide: HelpGuide): readonly string[] { return HELP_ROOTS[guide.id] ?? guide.roots }

export function isVisibleHelpTarget(element: Element): element is HTMLElement {
  if (!(element instanceof HTMLElement) || !element.isConnected || element.closest('.help-ui, [hidden], [aria-hidden="true"]')) return false
  const style = getComputedStyle(element)
  return element.getClientRects().length > 0 && style.display !== 'none' && style.visibility !== 'hidden'
}

/** Prefer a typed widget owner, then the deepest concrete panel; never inspect note content. */
export function contextGuide(element: Element | null): HelpGuide {
  const explicit = element?.closest<HTMLElement>('[data-help-topic]')?.dataset.helpTopic
  if (explicit && HELP_BY_ID.has(explicit)) return getGuide(explicit)
  let best: { guide: HelpGuide; root: Element } | undefined
  for (const guide of HELP_GUIDES) {
    if (guide.id === 'help') continue
    for (const selector of rootsForGuide(guide)) {
      const root = element?.closest(selector)
      if (root && (!best || (root !== best.root && best.root.contains(root)))) best = { guide, root }
    }
  }
  return best?.guide ?? getGuide('workspace')
}

/** Source-owned selectors only. Missing targets never trigger commands or hidden navigation. */
export function findGuideTarget(guide: HelpGuide, selector?: string): HTMLElement | null {
  // The overview button belongs to the top bar, but its tour covers the whole
  // workspace. Placement roots must not constrain overview highlight targets.
  const selectors = guide.id === 'workspace' ? ['main[aria-label="Scriptor workspace"]', ...guide.roots] : rootsForGuide(guide)
  const roots = selectors.flatMap((root) => Array.from(document.querySelectorAll(root))).filter(isVisibleHelpTarget)
  if (selector) {
    for (const root of roots) {
      if (root.matches(selector)) return root
      const found = Array.from(root.querySelectorAll(selector)).find(isVisibleHelpTarget)
      if (found) return found
    }
    return null
  }
  const explicit = Array.from(document.querySelectorAll<HTMLElement>('[data-help-topic]'))
    .find((element) => element.dataset.helpTopic === guide.id && !element.closest('.help-ui') && isVisibleHelpTarget(element))
  return explicit ?? roots[0] ?? null
}
