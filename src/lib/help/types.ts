export type GuidePolicy = 'first-run' | 'first-use' | 'manual'
export type GuideCategory = 'Workspace' | 'Writing' | 'Knowledge' | 'Publishing' | 'Integrations' | 'Recovery'
export type GuideStep = readonly [title: string, instruction: string, target?: string]
export type GuideQuestion = readonly [question: string, answer: string]

/** Content is data, never executable commands, HTML, remote URLs, or selectors from user input. */
export interface HelpGuide {
  id: string
  title: string
  category: GuideCategory
  policy: GuidePolicy
  entry: string
  prerequisite: string
  safety: string
  source: string
  roots: readonly string[]
  steps: readonly GuideStep[]
  questions: readonly GuideQuestion[]
  related: readonly string[]
  experimental?: boolean
}

export interface GuideProgress {
  step: number
  completed: boolean
  offered: boolean
}
export interface HelpPreferences {
  version: 1
  hints: boolean
  progress: Record<string, GuideProgress>
}
export const HELP_STORAGE_KEY = 'scriptor:help-guides:v1'
export const HELP_EVENT = 'scriptor:open-help'
export type HelpView = 'guide' | 'tour' | 'questions'
export interface HelpRequest { id: string; view: HelpView }
