export type HelpLocale = 'en' | 'de' | 'fa'
export interface GuideBodyTranslation {
  title: string
  entry: string
  prerequisite: string
  safety: string
  steps: readonly (readonly [string, string])[]
  questions: readonly (readonly [string, string])[]
}
export type GuideTranslations = Readonly<Record<string, { de: GuideBodyTranslation; fa: GuideBodyTranslation }>>
export function body(title: string, entry: string, prerequisite: string, safety: string,
  steps: GuideBodyTranslation['steps'], questions: GuideBodyTranslation['questions']): GuideBodyTranslation {
  return { title, entry, prerequisite, safety, steps, questions }
}
