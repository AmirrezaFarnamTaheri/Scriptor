import { writingTranslations } from './translations-writing.ts'
import { knowledgeTranslations } from './translations-knowledge.ts'
import { workflowTranslations } from './translations-workflows.ts'
import type { GuideTranslations } from './translationTypes.ts'

export const GUIDE_TRANSLATIONS: GuideTranslations = { ...writingTranslations, ...knowledgeTranslations, ...workflowTranslations }
