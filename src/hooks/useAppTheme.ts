import { useCallback, useEffect, useState } from 'react'

export type AppTheme =
  | 'light'
  | 'dark'
  | 'high-contrast'
  | 'nord'
  | 'dracula'
  | 'catppuccin'
  | 'tokyo-night'
  | 'solarized-dark'
  | 'gruvbox'
  | 'emerald'
  | 'cyberpunk'
  | 'monokai'
  | 'sepia-paper'

const STORAGE_KEY = 'scriptor:app-theme'

const VALID_THEMES: Set<string> = new Set([
  'light',
  'dark',
  'high-contrast',
  'nord',
  'dracula',
  'catppuccin',
  'tokyo-night',
  'solarized-dark',
  'gruvbox',
  'emerald',
  'cyberpunk',
  'monokai',
  'sepia-paper',
])

function readStoredTheme(): AppTheme {
  if (typeof window === 'undefined') return 'light'
  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (stored && VALID_THEMES.has(stored)) return stored as AppTheme
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

const THEME_CYCLE: AppTheme[] = ['light', 'dark', 'catppuccin', 'dracula', 'nord', 'tokyo-night', 'high-contrast']

export function useAppTheme() {
  const [theme, setThemeState] = useState<AppTheme>(() => readStoredTheme())

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  const toggleTheme = useCallback(() => {
    setThemeState((current) => {
      const index = THEME_CYCLE.indexOf(current)
      if (index === -1) return THEME_CYCLE[0]
      return THEME_CYCLE[(index + 1) % THEME_CYCLE.length]
    })
  }, [])

  const setTheme = useCallback((next: AppTheme) => {
    setThemeState(next)
  }, [])

  return { theme, toggleTheme, setTheme }
}
