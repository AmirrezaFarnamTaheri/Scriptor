import { useCallback, useEffect, useMemo, useState } from 'react'

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

/** Palette identity. Appearance is deliberately stored separately. */
export type AppTheme = BuiltinAppTheme | (string & {})
export type AppearanceMode = 'system' | 'light' | 'dark'
export type ResolvedAppearance = Exclude<AppearanceMode, 'system'>

const STORAGE_KEY = 'scriptor:app-theme'
const APPEARANCE_STORAGE_KEY = 'scriptor:appearance-mode'
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

const LIGHT_NATIVE_THEMES = new Set<AppTheme>(['light', 'sepia-paper'])

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

function storageGet(key: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function storageSet(key: string, value: string) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Storage is an enhancement. The in-memory theme still remains usable.
  }
}

export function readStoredCustomThemes(): CustomColorPalette[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(CUSTOM_THEMES_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    if (!Array.isArray(parsed)) return []
    return parsed.filter((candidate): candidate is CustomColorPalette => {
      if (!candidate || typeof candidate !== 'object') return false
      const palette = candidate as Partial<CustomColorPalette>
      const colors = palette.colors
      return typeof palette.id === 'string' && palette.id.startsWith('custom-') &&
        typeof palette.name === 'string' &&
        (palette.category === 'light' || palette.category === 'dark' || palette.category === 'contrast') &&
        !!colors && typeof colors.bg === 'string' && typeof colors.surface === 'string' &&
        typeof colors.primary === 'string' && typeof colors.amber === 'string' &&
        typeof colors.ink === 'string' && typeof colors.border === 'string'
    })
  } catch {
    return []
  }
}

function customThemeById(id: AppTheme): CustomColorPalette | undefined {
  if (!id.startsWith('custom-')) return undefined
  return readStoredCustomThemes().find((theme) => theme.id === id)
}

function nativeAppearanceForTheme(theme: AppTheme): ResolvedAppearance {
  const custom = customThemeById(theme)
  if (custom) return custom.category === 'light' ? 'light' : 'dark'
  return LIGHT_NATIVE_THEMES.has(theme) ? 'light' : 'dark'
}

function clearCustomElementStyle(el: HTMLElement) {
  for (const property of [
    '--bg', '--surface', '--surface-raised', '--surface-elevated', '--primary',
    '--primary-strong', '--primary-soft', '--amber', '--amber-soft', '--ink',
    '--ink-strong', '--text', '--border', '--border-strong',
  ]) {
    el.style.removeProperty(property)
  }
}

function hexToRgb(hex: string): [number, number, number] | null {
  const match = /^#([0-9a-f]{6})$/i.exec(hex.trim())
  if (!match) return null
  const value = Number.parseInt(match[1]!, 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

function rgbaFromHex(hex: string, alpha: number): string | null {
  const rgb = hexToRgb(hex)
  return rgb ? `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})` : null
}

/**
 * Apply a custom palette without coupling palette identity to day/night mode.
 * The palette's authored surfaces are used in its native mode. In the opposite
 * appearance Scriptor supplies accessible base surfaces while preserving the
 * palette accents, so the moon/sun control never changes palette families.
 */
export function applyCustomPaletteToElement(
  el: HTMLElement,
  colors: CustomColorPalette['colors'],
  category: CustomColorPalette['category'],
  appearance: ResolvedAppearance = category === 'light' ? 'light' : 'dark',
) {
  clearCustomElementStyle(el)
  el.dataset.theme = appearance
  el.dataset.appearance = appearance

  const nativeAppearance: ResolvedAppearance = category === 'light' ? 'light' : 'dark'
  if (nativeAppearance === appearance) {
    el.style.setProperty('--bg', colors.bg)
    el.style.setProperty('--surface', colors.surface)
    el.style.setProperty('--surface-raised', colors.surface)
    el.style.setProperty('--surface-elevated', colors.surface)
    el.style.setProperty('--ink', colors.ink)
    el.style.setProperty('--ink-strong', colors.ink)
    el.style.setProperty('--text', colors.ink)
    el.style.setProperty('--border', colors.border)
  }

  el.style.setProperty('--primary', colors.primary)
  el.style.setProperty('--primary-strong', colors.primary)
  el.style.setProperty('--primary-soft', rgbaFromHex(colors.primary, appearance === 'light' ? 0.12 : 0.18) ?? 'color-mix(in srgb, var(--primary) 16%, transparent)')
  el.style.setProperty('--amber', colors.amber)
  el.style.setProperty('--amber-soft', rgbaFromHex(colors.amber, appearance === 'light' ? 0.12 : 0.18) ?? 'color-mix(in srgb, var(--amber) 16%, transparent)')
}

/** Canonical DOM application path shared by runtime state and palette previews. */
export function applyThemeToElement(
  el: HTMLElement,
  theme: AppTheme,
  appearance: ResolvedAppearance,
) {
  clearCustomElementStyle(el)
  el.dataset.palette = theme
  el.dataset.appearance = appearance

  const custom = customThemeById(theme)
  if (custom) {
    applyCustomPaletteToElement(el, custom.colors, custom.category, appearance)
    el.dataset.palette = theme
    return
  }

  const validTheme = VALID_THEMES.has(theme) ? theme : 'dark'
  el.dataset.theme = validTheme
}

function validateStoredTheme(stored: string | null): AppTheme | null {
  if (!stored) return null
  if (VALID_THEMES.has(stored)) return stored
  if (stored.startsWith('custom-') && customThemeById(stored)) return stored
  return null
}

function readInitialTheme(): AppTheme {
  const stored = validateStoredTheme(storageGet(STORAGE_KEY))
  if (stored) return stored
  return 'dark'
}

function readInitialAppearance(theme: AppTheme): AppearanceMode {
  const stored = storageGet(APPEARANCE_STORAGE_KEY)
  if (stored === 'system' || stored === 'light' || stored === 'dark') return stored

  // Migration from the old model where the selected palette also encoded mode.
  // Existing users keep the same initial appearance, then future day/night
  // changes are stored independently from palette identity.
  const hadStoredTheme = validateStoredTheme(storageGet(STORAGE_KEY)) !== null
  return hadStoredTheme ? nativeAppearanceForTheme(theme) : 'system'
}

export function resolveAppearance(mode: AppearanceMode, systemDark: boolean): ResolvedAppearance {
  return mode === 'system' ? (systemDark ? 'dark' : 'light') : mode
}

export function getOppositeAppearance(appearance: ResolvedAppearance): ResolvedAppearance {
  return appearance === 'dark' ? 'light' : 'dark'
}

export function useAppTheme() {
  const [theme, setThemeState] = useState<AppTheme>(() => readInitialTheme())
  const [appearance, setAppearanceState] = useState<AppearanceMode>(() => readInitialAppearance(readInitialTheme()))
  const [systemDark, setSystemDark] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches,
  )
  const resolvedAppearance = useMemo(
    () => resolveAppearance(appearance, systemDark),
    [appearance, systemDark],
  )

  useEffect(() => {
    if (typeof window === 'undefined') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches)
    setSystemDark(media.matches)
    media.addEventListener?.('change', onChange)
    return () => media.removeEventListener?.('change', onChange)
  }, [])

  useEffect(() => {
    applyThemeToElement(document.documentElement, theme, resolvedAppearance)
    storageSet(STORAGE_KEY, theme)
    storageSet(APPEARANCE_STORAGE_KEY, appearance)
  }, [appearance, resolvedAppearance, theme])

  const toggleTheme = useCallback(() => {
    setAppearanceState(getOppositeAppearance(resolvedAppearance))
  }, [resolvedAppearance])

  const setTheme = useCallback((next: AppTheme) => {
    const valid = validateStoredTheme(next) ?? (VALID_THEMES.has(next) ? next : null)
    if (valid) setThemeState(valid)
  }, [])

  const setAppearance = useCallback((next: AppearanceMode) => {
    setAppearanceState(next)
  }, [])

  return {
    theme,
    palette: theme,
    appearance,
    resolvedAppearance,
    toggleTheme,
    toggleAppearance: toggleTheme,
    setTheme,
    setAppearance,
  }
}
