import type { AppLocale } from './i18n'

export type ReviewFeatureName = 'database' | 'capture' | 'publishing' | 'collaboration' | 'diagram' | 'runtime' | 'semantic' | 'assets'

const labels: Record<AppLocale, Record<ReviewFeatureName, string>> = {
  en: {
    database: 'Database studio', capture: 'Capture reviewer', publishing: 'Publishing studio',
    collaboration: 'Drive collaboration', diagram: 'Diagram studio', runtime: 'Runtime console',
    semantic: 'Semantic inspector', assets: 'Asset deck',
  },
  de: {
    database: 'Datenbank', capture: 'Webclip prüfen', publishing: 'Veröffentlichen',
    collaboration: 'Drive-Zusammenarbeit', diagram: 'Diagramme', runtime: 'Code-Konsole',
    semantic: 'Semantische Analyse', assets: 'Medienablage',
  },
  fa: {
    database: 'پایگاه داده', capture: 'بررسی مطلب', publishing: 'انتشار',
    collaboration: 'همکاری در درایو', diagram: 'نمودار', runtime: 'اجرای کد',
    semantic: 'تحلیل معنایی', assets: 'منابع و رسانه',
  },
}

export function reviewFeatureCopy(locale: AppLocale): Readonly<Record<ReviewFeatureName, string>> {
  return labels[locale]
}
