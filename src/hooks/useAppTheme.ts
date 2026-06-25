import { useCallback, useEffect, useState } from 'react'

export type AppTheme = 'light' | 'dark'

const STORAGE_KEY = 'scriptor:app-theme'

function readStoredTheme(): AppTheme {
  if (typeof window === 'undefined') return 'light'
  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (stored === 'dark' || stored === 'light') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function useAppTheme() {
  const [theme, setThemeState] = useState<AppTheme>(() => readStoredTheme())

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  const toggleTheme = useCallback(() => {
    setThemeState((current) => (current === 'light' ? 'dark' : 'light'))
  }, [])

  const setTheme = useCallback((next: AppTheme) => {
    setThemeState(next)
  }, [])

  return { theme, toggleTheme, setTheme }
}
