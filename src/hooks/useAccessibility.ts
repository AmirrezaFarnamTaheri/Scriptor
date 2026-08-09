/**
 * useAccessibility
 * -----------------
 * Implements accessibility items 12.1–12.5:
 *
 *  12.1  Reduced Motion  — honour prefers-reduced-motion + vault override
 *  12.2  High Contrast   — WCAG AA colour scheme toggle (CSS class on <html>)
 *  12.3  Font Scale      — zoom prose text 80 – 200 % without OS system zoom
 *  12.4  Live Regions    — ARIA live-region helpers for dynamic announcements
 *  12.5  Focus Outline   — configurable focus ring: default | thick | high-contrast
 *
 * Configuration is persisted in VaultConfig.accessibility and also reacts to
 * the OS-level media queries so users who prefer these at the OS level get them
 * automatically even before touching settings.
 */

import { useState, useEffect, useCallback, useRef } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FocusOutlineStyle = 'default' | 'thick' | 'high-contrast'
export type LiveRegionPoliteness = 'polite' | 'assertive'

export interface AccessibilityConfig {
  reduced_motion: boolean
  high_contrast: boolean
  /** Multiplier: 1.0 = 100 %, 1.25 = 125 %, etc. Range [0.8, 2.0]. */
  font_scale: number
  live_regions: boolean
  focus_outline: FocusOutlineStyle
}

export interface AccessibilityResult {
  // --- 12.1 Reduced motion ---
  /** True when reduced motion is active (OS or vault override). */
  reducedMotion: boolean
  setReducedMotion: (v: boolean) => void

  // --- 12.2 High contrast ---
  highContrast: boolean
  setHighContrast: (v: boolean) => void

  // --- 12.3 Font scale ---
  fontScale: number
  setFontScale: (v: number) => void

  // --- 12.4 Live regions ---
  /** Announce a message in the ARIA live region. */
  announce: (message: string, politeness?: LiveRegionPoliteness) => void

  // --- 12.5 Focus outline ---
  focusOutline: FocusOutlineStyle
  setFocusOutline: (v: FocusOutlineStyle) => void

  /** Serialisable delta to persist back to VaultConfig.accessibility. */
  toConfig: () => AccessibilityConfig
}

// ---------------------------------------------------------------------------
// CSS class constants applied to <html>
// ---------------------------------------------------------------------------
const CLS_REDUCED_MOTION = 'a11y-reduced-motion'
const CLS_HIGH_CONTRAST = 'a11y-high-contrast'
const FOCUS_CLS: Record<FocusOutlineStyle, string> = {
  default: '',
  thick: 'a11y-focus-thick',
  'high-contrast': 'a11y-focus-high-contrast',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clampFontScale(v: number): number {
  return Math.max(0.8, Math.min(2.0, Math.round(v * 100) / 100))
}

function setHtmlClass(cls: string, active: boolean): void {
  if (!cls) return
  document.documentElement.classList.toggle(cls, active)
}

function applyFontScale(scale: number): void {
  // Apply to the editor host and prose containers, not the full shell
  document.documentElement.style.setProperty('--a11y-font-scale', String(scale))
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAccessibility(
  initialConfig?: Partial<AccessibilityConfig>,
  onConfigChange?: (config: AccessibilityConfig) => void,
): AccessibilityResult {
  // --- 12.1 Reduced motion ---
  const osReducedMotion =
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false

  const [reducedMotion, _setReducedMotion] = useState<boolean>(
    initialConfig?.reduced_motion ?? osReducedMotion,
  )

  // --- 12.2 High contrast ---
  const osHighContrast =
    typeof window !== 'undefined'
      ? window.matchMedia('(forced-colors: active)').matches
      : false

  const [highContrast, _setHighContrast] = useState<boolean>(
    initialConfig?.high_contrast ?? osHighContrast,
  )

  // --- 12.3 Font scale ---
  const [fontScale, _setFontScale] = useState<number>(
    clampFontScale(initialConfig?.font_scale ?? 1.0),
  )

  // --- 12.5 Focus outline ---
  const [focusOutline, _setFocusOutline] = useState<FocusOutlineStyle>(
    initialConfig?.focus_outline ?? 'default',
  )

  // 12.4 live region container ref
  const liveRef = useRef<HTMLDivElement | null>(null)

  // ---------------------------------------------------------------------------
  // Sync initial config → DOM on mount
  // ---------------------------------------------------------------------------
  useEffect(() => {
    setHtmlClass(CLS_REDUCED_MOTION, reducedMotion)
    setHtmlClass(CLS_HIGH_CONTRAST, highContrast)
    applyFontScale(fontScale)
    // Focus outline: clear old, set new
    Object.values(FOCUS_CLS).forEach((c) => c && setHtmlClass(c, false))
    setHtmlClass(FOCUS_CLS[focusOutline], true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---------------------------------------------------------------------------
  // OS media-query listeners (12.1, 12.2)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const motionMq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const contrastMq = window.matchMedia('(forced-colors: active)')

    const onMotion = (e: MediaQueryListEvent) => {
      _setReducedMotion(e.matches)
      setHtmlClass(CLS_REDUCED_MOTION, e.matches)
    }
    const onContrast = (e: MediaQueryListEvent) => {
      _setHighContrast(e.matches)
      setHtmlClass(CLS_HIGH_CONTRAST, e.matches)
    }

    motionMq.addEventListener('change', onMotion)
    contrastMq.addEventListener('change', onContrast)
    return () => {
      motionMq.removeEventListener('change', onMotion)
      contrastMq.removeEventListener('change', onContrast)
    }
  }, [])

  // ---------------------------------------------------------------------------
  // Live region mount (12.4)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!initialConfig?.live_regions && initialConfig?.live_regions !== undefined) return
    const div = document.createElement('div')
    div.id = 'scriptor-live-region'
    div.setAttribute('aria-live', 'polite')
    div.setAttribute('aria-atomic', 'true')
    div.style.cssText =
      'position:absolute;left:-9999px;top:0;width:1px;height:1px;overflow:hidden;'
    document.body.appendChild(div)
    liveRef.current = div
    return () => {
      div.remove()
      liveRef.current = null
    }
  }, [initialConfig?.live_regions])

  // ---------------------------------------------------------------------------
  // Setters with DOM side-effects
  // ---------------------------------------------------------------------------
  const setReducedMotion = useCallback(
    (v: boolean) => {
      _setReducedMotion(v)
      setHtmlClass(CLS_REDUCED_MOTION, v)
      onConfigChange?.({
        reduced_motion: v,
        high_contrast: highContrast,
        font_scale: fontScale,
        live_regions: initialConfig?.live_regions ?? true,
        focus_outline: focusOutline,
      })
    },
    [highContrast, fontScale, focusOutline, initialConfig?.live_regions, onConfigChange],
  )

  const setHighContrast = useCallback(
    (v: boolean) => {
      _setHighContrast(v)
      setHtmlClass(CLS_HIGH_CONTRAST, v)
      onConfigChange?.({
        reduced_motion: reducedMotion,
        high_contrast: v,
        font_scale: fontScale,
        live_regions: initialConfig?.live_regions ?? true,
        focus_outline: focusOutline,
      })
    },
    [reducedMotion, fontScale, focusOutline, initialConfig?.live_regions, onConfigChange],
  )

  const setFontScale = useCallback(
    (v: number) => {
      const clamped = clampFontScale(v)
      _setFontScale(clamped)
      applyFontScale(clamped)
      onConfigChange?.({
        reduced_motion: reducedMotion,
        high_contrast: highContrast,
        font_scale: clamped,
        live_regions: initialConfig?.live_regions ?? true,
        focus_outline: focusOutline,
      })
    },
    [reducedMotion, highContrast, focusOutline, initialConfig?.live_regions, onConfigChange],
  )

  const setFocusOutline = useCallback(
    (v: FocusOutlineStyle) => {
      _setFocusOutline(v)
      Object.values(FOCUS_CLS).forEach((c) => c && setHtmlClass(c, false))
      setHtmlClass(FOCUS_CLS[v], true)
      onConfigChange?.({
        reduced_motion: reducedMotion,
        high_contrast: highContrast,
        font_scale: fontScale,
        live_regions: initialConfig?.live_regions ?? true,
        focus_outline: v,
      })
    },
    [reducedMotion, highContrast, fontScale, initialConfig?.live_regions, onConfigChange],
  )

  // 12.4 announce
  const announce = useCallback(
    (message: string, politeness: LiveRegionPoliteness = 'polite') => {
      const el = liveRef.current
      if (!el) return
      el.setAttribute('aria-live', politeness)
      // Clear then set so screen-readers re-announce identical messages
      el.textContent = ''
      requestAnimationFrame(() => {
        if (el) el.textContent = message
      })
    },
    [],
  )

  const toConfig = useCallback(
    (): AccessibilityConfig => ({
      reduced_motion: reducedMotion,
      high_contrast: highContrast,
      font_scale: fontScale,
      live_regions: initialConfig?.live_regions ?? true,
      focus_outline: focusOutline,
    }),
    [reducedMotion, highContrast, fontScale, focusOutline, initialConfig?.live_regions],
  )

  return {
    reducedMotion,
    setReducedMotion,
    highContrast,
    setHighContrast,
    fontScale,
    setFontScale,
    announce,
    focusOutline,
    setFocusOutline,
    toConfig,
  }
}
