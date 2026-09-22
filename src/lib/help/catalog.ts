import type { HelpGuide } from './types.ts'
import { writingGuides } from './guides-writing.ts'
import { knowledgeGuides } from './guides-knowledge.ts'
import { workflowGuides } from './guides-workflows.ts'
import { settingsGuides } from './guides-settings.ts'
import { referenceGuides } from './guides-reference.ts'

export const HELP_GUIDES: readonly HelpGuide[] = [...writingGuides, ...knowledgeGuides, ...workflowGuides, ...settingsGuides, ...referenceGuides].map((guide) => {
  if (guide.id === 'export-jobs') return { ...guide, source: 'src/components/StatusDockPanel.tsx' }
  if (guide.id === 'settings') return { ...guide, steps: guide.steps.map((step, index) => index === 0 ? ['Choose a category', 'Use General, Appearance, Workspace, Integrations, Shortcuts, or Advanced according to the job rather than searching one long form.'] as const : step) }
  return guide
})
export const HELP_CATEGORIES = ['Workspace', 'Writing', 'Knowledge', 'Publishing', 'Integrations', 'Recovery'] as const
export const HELP_BY_ID: ReadonlyMap<string, HelpGuide> = new Map(HELP_GUIDES.map((guide) => [guide.id, guide]))

export function getGuide(id: string): HelpGuide { return HELP_BY_ID.get(id) ?? HELP_GUIDES[0]! }
function words(value: string): string[] {
  return value.normalize('NFKD').toLocaleLowerCase('en').replace(/\p{M}/gu, '').match(/[\p{L}\p{N}]+/gu) ?? []
}
const index = HELP_GUIDES.map((guide) => ({
  guide,
  title: words(`${guide.id} ${guide.title}`).join(' '),
  text: words([guide.category, guide.entry, guide.prerequisite, guide.safety, ...guide.steps.flat(), ...guide.questions.flat()].join(' ')).join(' '),
}))

/** Searches only bundled guidance, never vault content or a remote provider. */
export function searchGuides(query: string, category = ''): HelpGuide[] {
  const terms = words(query.slice(0, 256)).slice(0, 12)
  return index.filter(({ guide }) => !category || guide.category === category)
    .map(({ guide, title, text }) => ({ guide, score: terms.reduce((score, term) => score + (title.includes(term) ? 8 : text.includes(term) ? 1 : 0), 0) }))
    .filter(({ score }) => terms.length === 0 || score > 0)
    .sort((a, b) => b.score - a.score).map(({ guide }) => guide)
}

/**
 * Keep the default Help browser contextual instead of dumping the entire guide
 * catalog into the left rail. Search and category browsing still expose the
 * complete authored corpus; an idle browser shows only the current guide and
 * its explicitly related destinations.
 */
export function browseGuides(currentId: string, query: string, category = ''): HelpGuide[] {
  const matches = searchGuides(query, category)
  if (words(query.slice(0, 256)).length > 0 || category) return matches
  const current = getGuide(currentId)
  const byId = new Map(matches.map((guide) => [guide.id, guide]))
  return [current.id, ...current.related]
    .map((id) => byId.get(id))
    .filter((guide): guide is HelpGuide => Boolean(guide))
}
