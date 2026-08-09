import { useCallback, useEffect, useState } from 'react'

export type BuiltinAppTheme =
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
  | 'rose-pine'
  | 'synthwave-84'
  | 'one-dark-pro'
  | 'vitesse-dark'
  | 'oled-black'

export type AppTheme = BuiltinAppTheme | (string & {})

const STORAGE_KEY = 'scriptor:app-theme'
const CUSTOM_THEMES_KEY = 'scriptor:custom-themes'

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
  'rose-pine',
  'synthwave-84',
  'one-dark-pro',
  'vitesse-dark',
  'oled-black',
])

export interface CustomColorPalette {
  id: string
  name: string
  category: 'light' | 'dark' | 'contrast'
  colors: {
    bg: string
    surface: string
    primary: string
    amber: string
    ink: string
    border: string
  }
}

export function readStoredCustomThemes(): CustomColorPalette[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(CUSTOM_THEMES_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function applyCustomPaletteToElement(el: HTMLElement, colors: CustomColorPalette['colors'], category: 'light' | 'dark' | 'contrast') {
  el.dataset.theme = category === 'light' ? 'light' : 'dark'
  el.style.setProperty('--bg', colors.bg)
  el.style.setProperty('--surface', colors.surface)
  el.style.setProperty('--surface-raised', colors.surface)
  el.style.setProperty('--surface-elevated', colors.surface)
  el.style.setProperty('--primary', colors.primary)
  el.style.setProperty('--primary-strong', colors.primary)
  el.style.setProperty('--amber', colors.amber)
  el.style.setProperty('--ink', colors.ink)
  el.style.setProperty('--ink-strong', colors.ink)
  el.style.setProperty('--text', colors.ink)
  el.style.setProperty('--border', colors.border)
}

function clearCustomElementStyle(el: HTMLElement) {
  el.style.removeProperty('--bg')
  el.style.removeProperty('--surface')
  el.style.removeProperty('--surface-raised')
  el.style.removeProperty('--surface-elevated')
  el.style.removeProperty('--primary')
  el.style.removeProperty('--primary-strong')
  el.style.removeProperty('--amber')
  el.style.removeProperty('--ink')
  el.style.removeProperty('--ink-strong')
  el.style.removeProperty('--text')
  el.style.removeProperty('--border')
}

function readStoredTheme(): AppTheme {
  if (typeof window === 'undefined') return 'light'
  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (!stored) return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  if (VALID_THEMES.has(stored) || stored.startsWith('custom-')) return stored
  return 'dark'
}

const THEME_CYCLE: AppTheme[] = ['light', 'dark', 'catppuccin', 'dracula', 'nord', 'tokyo-night', 'high-contrast']

export function useAppTheme() {
  const [theme, setThemeState] = useState<AppTheme>(() => readStoredTheme())

  useEffect(() => {
    const root = document.documentElement
    if (theme.startsWith('custom-')) {
      const customList = readStoredCustomThemes()
      const found = customList.find((c) => c.id === theme)
      if (found) {
        applyCustomPaletteToElement(root, found.colors, found.category)
      } else {
        clearCustomElementStyle(root)
        root.dataset.theme = 'dark'
      }
    } else {
      clearCustomElementStyle(root)
      root.dataset.theme = theme
    }
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
