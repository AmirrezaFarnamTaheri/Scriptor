import { useEffect, type ReactNode } from 'react'

import { I18nContext, applyDocumentLocale, useI18nState } from './index'

/**
 * Holds the single app-wide locale so changing it in Settings propagates to
 * every consumer, and keeps <html dir/lang> in sync from the first render (a
 * stored `fa` locale used to start the app in LTR).
 */
export function I18nProvider({ children }: { children: ReactNode }) {
  const value = useI18nState()

  useEffect(() => {
    applyDocumentLocale(value.locale)
  }, [value.locale])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}
