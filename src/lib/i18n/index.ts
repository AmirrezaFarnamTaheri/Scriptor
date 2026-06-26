import { useCallback, useMemo, useState } from 'react'

export type AppLocale = 'en'

const STORAGE_KEY = 'scriptor:locale'

const MESSAGES: Record<AppLocale, Record<string, string>> = {
  en: {
    'app.title': 'Scriptor',
    'workspace.openVault': 'Open Vault',
    'publish.center': 'Publish center',
    'settings.language': 'Language',
    'settings.updater.placeholder': 'Updater signing key not configured for this build.',
  },
}

export function getStoredLocale(): AppLocale {
  const stored = window.localStorage.getItem(STORAGE_KEY)
  return stored === 'en' ? 'en' : 'en'
}

export function setStoredLocale(locale: AppLocale): void {
  window.localStorage.setItem(STORAGE_KEY, locale)
}

export function translate(locale: AppLocale, key: string): string {
  return MESSAGES[locale][key] ?? key
}

export function useI18n() {
  const [locale, setLocale] = useState<AppLocale>(() => getStoredLocale())

  const t = useCallback((key: string) => translate(locale, key), [locale])

  const changeLocale = useCallback((next: AppLocale) => {
    setStoredLocale(next)
    setLocale(next)
  }, [])

  return useMemo(() => ({ locale, t, changeLocale, supportedLocales: ['en'] as const }), [changeLocale, locale, t])
}
