import { writingTranslations } from './translations-writing.ts'
import { knowledgeTranslations } from './translations-knowledge.ts'
import { workflowTranslations } from './translations-workflows.ts'
import { settingsTranslations } from './translations-settings.ts'
import { surfaceTranslations } from './translations-surfaces.ts'
import { operationTranslations } from './translations-operations.ts'
import { inspectionTranslations } from './translations-inspection.ts'
import { navigationTranslations } from './translations-navigation.ts'
import type { GuideTranslations } from './translationTypes.ts'

/** Only authored bodies are eligible for locale display and search. */
export const GUIDE_TRANSLATIONS: GuideTranslations = {
  ...writingTranslations, ...knowledgeTranslations, ...workflowTranslations, ...settingsTranslations,
  ...surfaceTranslations, ...operationTranslations, ...inspectionTranslations, ...navigationTranslations,
}
