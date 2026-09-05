import { createContext, useCallback, useContext, useMemo, useState } from 'react'

import en from './en.json'
import de from './de.json'
import fa from './fa.json'

export type AppLocale = 'en' | 'de' | 'fa'

const STORAGE_KEY = 'scriptor:locale'

const LOCALE_DATA: Record<AppLocale, Record<string, unknown>> = { en, de, fa }

const LOCALE_LABELS: Record<AppLocale, string> = {
  en: 'English',
  de: 'Deutsch',
  fa: 'فارسی',
}

function getNestedValue(obj: Record<string, unknown>, path: string): string | undefined {
  const parts = path.split('.')
  let current: unknown = obj
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return typeof current === 'string' ? current : undefined
}

export function getStoredLocale(): AppLocale {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === 'en' || stored === 'de' || stored === 'fa') return stored
  } catch {
    // ignore
  }
  const browserLang = navigator.language?.slice(0, 2)
  if (browserLang === 'de') return 'de'
  if (browserLang === 'fa') return 'fa'
  return 'en'
}

export function setStoredLocale(locale: AppLocale): void {
  window.localStorage.setItem(STORAGE_KEY, locale)
}

export function translate(locale: AppLocale, key: string): string {
  return getNestedValue(LOCALE_DATA[locale], key) ?? getNestedValue(LOCALE_DATA.en, key) ?? key
}

export function isRtl(locale: AppLocale): boolean {
  return locale === 'fa'
}

export const SUPPORTED_LOCALES: AppLocale[] = ['en', 'de', 'fa']

/** Mirror the active locale onto <html dir/lang> so RTL applies on first paint. */
export function applyDocumentLocale(locale: AppLocale): void {
  if (typeof document === 'undefined') return
  document.documentElement.dir = isRtl(locale) ? 'rtl' : 'ltr'
  document.documentElement.lang = locale
}

if (typeof window !== 'undefined') {
  try {
    applyDocumentLocale(getStoredLocale())
  } catch {
    // ignore
  }
}

export interface I18nValue {
  locale: AppLocale
  t: (key: string, params?: Record<string, string | number>) => string
  changeLocale: (next: AppLocale) => void
  supportedLocales: AppLocale[]
  localeLabels: Record<AppLocale, string>
  rtl: boolean
}

export const I18nContext = createContext<I18nValue | null>(null)

/**
 * Builds the shared i18n value. Used by `I18nProvider`; also used as a
 * self-contained fallback by `useI18n` so a component rendered outside the
 * provider still works instead of crashing.
 */
export function useI18nState(): I18nValue {
  const [locale, setLocale] = useState<AppLocale>(() => getStoredLocale())

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      let result = translate(locale, key)
      if (params) {
        for (const [paramKey, paramValue] of Object.entries(params)) {
          // replaceAll: a translation using the same placeholder twice used to
          // render the second occurrence literally.
          result = result.replaceAll(`{{${paramKey}}}`, String(paramValue))
        }
      }
      return result
    },
    [locale],
  )

  const changeLocale = useCallback((next: AppLocale) => {
    setStoredLocale(next)
    setLocale(next)
    applyDocumentLocale(next)
  }, [])

  return useMemo(
    () => ({
      locale,
      t,
      changeLocale,
      supportedLocales: SUPPORTED_LOCALES,
      localeLabels: LOCALE_LABELS,
      rtl: isRtl(locale),
    }),
    [changeLocale, locale, t],
  )
}

/**
 * Read the app-wide locale. Consumes `I18nContext` so a locale change in
 * Settings re-renders every panel; falls back to local state when no provider
 * is mounted.
 */
export function useI18n(): I18nValue {
  const shared = useContext(I18nContext)
  const standalone = useI18nState()
  return shared ?? standalone
}
