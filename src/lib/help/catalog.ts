import type { HelpGuide } from './types.ts'
import { writingGuides } from './guides-writing.ts'
import { knowledgeGuides } from './guides-knowledge.ts'
import { workflowGuides } from './guides-workflows.ts'
import { settingsGuides } from './guides-settings.ts'
import { referenceGuides } from './guides-reference.ts'
import { surfaceGuides } from './guides-surfaces.ts'
import { GUIDE_TRANSLATIONS } from './translations.ts'
import type { HelpLocale } from './translationTypes.ts'

/**
 * First-open invitations are reserved for complex, optional, experimental, or
 * higher-consequence surfaces. Simple writing/navigation controls stay manual
 * so the application never turns into a cascade of tutorial popups.
 */
export const FIRST_OPEN_GUIDE_IDS = new Set([
  'workbench', 'graph', 'canvas', 'tasks', 'kanban', 'reader',
  'export', 'plugins', 'modules', 'integrations', 'gmail', 'mcp',
  'custom-theme', 'resource-sync',
])

export const HELP_GUIDES: readonly HelpGuide[] = [...writingGuides, ...knowledgeGuides, ...workflowGuides, ...settingsGuides, ...referenceGuides, ...surfaceGuides].map((guide) => {
  if (FIRST_OPEN_GUIDE_IDS.has(guide.id)) guide = { ...guide, policy: 'first-open' }
  if (guide.id === 'export-jobs') return { ...guide, source: 'src/components/StatusDockPanel.tsx' }
  if (guide.id === 'settings') return { ...guide, steps: guide.steps.map((step, index) => index === 0 ? ['Choose a category', 'Use General, Appearance, Workspace, Integrations, Shortcuts, or Advanced according to the job rather than searching one long form.'] as const : step) }
  return guide
})
export const HELP_CATEGORIES = ['Workspace', 'Writing', 'Knowledge', 'Publishing', 'Integrations', 'Recovery'] as const
export const HELP_BY_ID: ReadonlyMap<string, HelpGuide> = new Map(HELP_GUIDES.map((guide) => [guide.id, guide]))

export function helpLocale(locale: string): HelpLocale { return locale === 'de' || locale === 'fa' ? locale : 'en' }

const CATEGORY_LABELS: Record<HelpLocale, Record<HelpGuide['category'], string>> = {
  en: { Workspace: 'Workspace', Writing: 'Writing', Knowledge: 'Knowledge', Publishing: 'Publishing', Integrations: 'Integrations', Recovery: 'Recovery' },
  de: { Workspace: 'Arbeitsbereich', Writing: 'Schreiben', Knowledge: 'Wissen', Publishing: 'Veröffentlichen', Integrations: 'Integrationen', Recovery: 'Wiederherstellung' },
  fa: { Workspace: 'فضای کار', Writing: 'نوشتن', Knowledge: 'دانش', Publishing: 'انتشار', Integrations: 'یکپارچه‌سازی', Recovery: 'بازیابی' },
}
export function helpCategory(category: HelpGuide['category'], locale = 'en'): string { return CATEGORY_LABELS[helpLocale(locale)][category] }

/** Content-only overlays retain canonical selectors, policies, and progress IDs. */
const localizedGuides: Record<HelpLocale, readonly HelpGuide[]> = {
  en: HELP_GUIDES,
  de: HELP_GUIDES.map((guide) => localize(guide, 'de')),
  fa: HELP_GUIDES.map((guide) => localize(guide, 'fa')),
}
function localize(guide: HelpGuide, locale: 'de' | 'fa'): HelpGuide {
  const translation = GUIDE_TRANSLATIONS[guide.id]?.[locale]
  if (!translation) throw new Error(`Missing ${locale} Help translation: ${guide.id}`)
  return { ...guide, ...translation, steps: translation.steps.map(([title, instruction], index) => {
    const selector = guide.steps[index]?.[2]
    return selector ? [title, instruction, selector] as const : [title, instruction] as const
  }) }
}
export function getGuide(id: string, locale = 'en'): HelpGuide {
  const guides = localizedGuides[helpLocale(locale)]
  return guides.find((guide) => guide.id === id) ?? guides[0]!
}
function words(value: string): string[] {
  return value.normalize('NFKD').toLocaleLowerCase('en').replace(/\p{M}/gu, '').match(/[\p{L}\p{N}]+/gu) ?? []
}
const indexes = Object.fromEntries(Object.entries(localizedGuides).map(([locale, guides]) => [locale, guides.map((guide) => ({
  guide,
  title: words(`${guide.id} ${guide.title}`).join(' '),
  text: words([guide.category, guide.entry, guide.prerequisite, guide.safety, ...guide.steps.flat(), ...guide.questions.flat()].join(' ')).join(' '),
}))])) as Record<HelpLocale, { guide: HelpGuide; title: string; text: string }[]>

/** Searches only bundled guidance, never vault content or a remote provider. */
export function searchGuides(query: string, category = '', locale = 'en'): HelpGuide[] {
  const terms = words(query.slice(0, 256)).slice(0, 12)
  return indexes[helpLocale(locale)].filter(({ guide }) => !category || guide.category === category)
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
export function browseGuides(currentId: string, query: string, category = '', locale = 'en'): HelpGuide[] {
  const matches = searchGuides(query, category, locale)
  if (words(query.slice(0, 256)).length > 0 || category) return matches
  const current = getGuide(currentId, locale)
  const byId = new Map(matches.map((guide) => [guide.id, guide]))
  return [current.id, ...current.related]
    .map((id) => byId.get(id))
    .filter((guide): guide is HelpGuide => Boolean(guide))
}

export interface HelpAnswerHit {
  guide: HelpGuide
  question: string
  answer: string
  score: number
}

/** Return direct bundled answers for natural-language Help queries. */
export function searchAnswers(query: string, category = '', locale = 'en'): HelpAnswerHit[] {
  const terms = words(query.slice(0, 256)).slice(0, 12)
  if (terms.length === 0) return []
  const hits: HelpAnswerHit[] = []
  for (const guide of localizedGuides[helpLocale(locale)]) {
    if (category && guide.category !== category) continue
    for (const [question, answer] of guide.questions) {
      const q = words(question).join(' ')
      const a = words(answer).join(' ')
      const title = words(guide.title).join(' ')
      const score = terms.reduce((total, term) => total + (q.includes(term) ? 8 : title.includes(term) ? 4 : a.includes(term) ? 2 : 0), 0)
      if (score > 0) hits.push({ guide, question, answer, score })
    }
  }
  return hits.sort((left, right) => right.score - left.score || left.question.localeCompare(right.question))
}
