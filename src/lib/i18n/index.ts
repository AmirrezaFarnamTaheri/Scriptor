import { useCallback, useMemo, useState } from 'react'

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

export function useI18n() {
  const [locale, setLocale] = useState<AppLocale>(() => getStoredLocale())

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      let result = translate(locale, key)
      if (params) {
        for (const [paramKey, paramValue] of Object.entries(params)) {
          result = result.replace(`{{${paramKey}}}`, String(paramValue))
        }
      }
      return result
    },
    [locale],
  )

  const changeLocale = useCallback((next: AppLocale) => {
    setStoredLocale(next)
    setLocale(next)
    if (isRtl(next)) {
      document.documentElement.dir = 'rtl'
      document.documentElement.lang = 'fa'
    } else {
      document.documentElement.dir = 'ltr'
      document.documentElement.lang = next
    }
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
