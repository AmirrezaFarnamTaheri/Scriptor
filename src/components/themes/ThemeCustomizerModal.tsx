import { useMemo, useState, useLayoutEffect, useRef } from 'react'
import { Palette, Plus, Trash2, Check, RotateCcw, Sliders, Eye, X } from 'lucide-react'
import { useEscapeToClose } from '../../hooks/useEscapeToClose'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import {
  COLOR_PALETTE_SCHEMES,
} from '../../brand/palettes'
import {
  readStoredCustomThemes,
  type CustomColorPalette,
  type AppTheme,
} from '../../hooks/useAppTheme'
import { MutationConfirmation } from '../chrome/MutationConfirmation'
import '../../styles/components/theme-customizer.css'
import { useI18n } from '../../lib/i18n'

export interface ThemeCustomizerModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectTheme: (themeId: AppTheme) => void
}

const DEFAULT_CUSTOM_COLORS = {
  bg: '#0f172a',
  surface: '#1e293b',
  primary: '#38bdf8',
  amber: '#fbbf24',
  ink: '#f8fafc',
  border: 'rgba(148, 163, 184, 0.2)',
}

const CUSTOM_STORAGE_KEY = 'scriptor:custom-themes'

function parseHexRgb(value: string): [number, number, number] | null {
  const match = value.trim().match(/^#([0-9a-f]{6})$/i)
  if (!match) return null
  const hex = match[1]
  return [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16),
  ]
}

function relativeLuminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map((channel) => {
    const normalized = channel / 255
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrastRatio(foreground: string, background: string): number | null {
  const fg = parseHexRgb(foreground)
  const bg = parseHexRgb(background)
  if (!fg || !bg) return null
  const lighter = Math.max(relativeLuminance(fg), relativeLuminance(bg))
  const darker = Math.min(relativeLuminance(fg), relativeLuminance(bg))
  return (lighter + 0.05) / (darker + 0.05)
}

function accessibleTextColor(background: string): '#000000' | '#ffffff' {
  const darkRatio = contrastRatio('#000000', background) ?? 0
  const lightRatio = contrastRatio('#ffffff', background) ?? 0
  return darkRatio >= lightRatio ? '#000000' : '#ffffff'
}

export function ThemeCustomizerModal({
  isOpen,
  onClose,
  onSelectTheme,
}: ThemeCustomizerModalProps) {
  const { t } = useI18n()
  const [customThemes, setCustomThemes] = useState<CustomColorPalette[]>(() =>
    readStoredCustomThemes(),
  )
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState(() => t('themeCustomizer.defaultName'))
  const [category, setCategory] = useState<'dark' | 'light' | 'contrast'>('dark')
  const [colors, setColors] = useState(DEFAULT_CUSTOM_COLORS)
  const [baseSchemeId, setBaseSchemeId] = useState<string>('dark')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  const invalidColorKeys = useMemo(() => Object.entries(colors).flatMap(([key, value]) => {
    if (typeof CSS === 'undefined' || typeof CSS.supports !== 'function') return []
    return CSS.supports('color', value) ? [] : [key]
  }), [colors])

  const contrastChecks = useMemo(() => {
    const textMinimum = category === 'contrast' ? 7 : 4.5
    const pairs = [
      [t('themeCustomizer.contrastTextBackground'), colors.ink, colors.bg, textMinimum],
      [t('themeCustomizer.contrastTextSurface'), colors.ink, colors.surface, textMinimum],
      [t('themeCustomizer.contrastPrimaryBackground'), colors.primary, colors.bg, 3],
      [t('themeCustomizer.contrastAmberBackground'), colors.amber, colors.bg, 3],
    ] as const
    return pairs.flatMap(([label, foreground, background, minimum]) => {
      const ratio = contrastRatio(foreground, background)
      if (ratio === null) return []
      return [{ label, ratio, minimum, passes: ratio >= minimum }]
    })
  }, [category, colors.amber, colors.bg, colors.ink, colors.primary, colors.surface, t])

  const failingContrastChecks = contrastChecks.filter((check) => !check.passes)
  const primaryPreviewText = useMemo(() => accessibleTextColor(colors.primary), [colors.primary])
  const amberPreviewText = useMemo(() => accessibleTextColor(colors.amber), [colors.amber])

  // useLayoutEffect is the correct pattern here: localStorage read must sync before
  // first paint on re-open to prevent stale custom-theme list flash.
  useLayoutEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCustomThemes(readStoredCustomThemes())
    }
  }, [isOpen])

  const overlayRef = useRef<HTMLDivElement>(null)
  useEscapeToClose(isOpen, onClose)
  useFocusTrap(overlayRef, { active: isOpen })


  if (!isOpen) return null

  const handleColorChange = (key: keyof typeof DEFAULT_CUSTOM_COLORS, value: string) => {
    setColors((prev) => ({ ...prev, [key]: value }))
  }

  const handleLoadBaseScheme = (id: string) => {
    setBaseSchemeId(id)
    const base = COLOR_PALETTE_SCHEMES.find((s) => s.id === id)
    if (base) {
      setCategory(base.category)
      setColors({ ...base.colors })
      if (!editingId) {
        setName(t('themeCustomizer.customBaseName', { name: base.name }))
      }
    }
  }

  const handleSave = () => {
    const normalizedName = name.trim()
    if (!normalizedName) {
      setSaveError(t('themeCustomizer.errorEmptyName'))
      return
    }
    if (normalizedName.length > 80) {
      setSaveError(t('themeCustomizer.errorLongName'))
      return
    }
    if (invalidColorKeys.length > 0) {
      setSaveError(t('themeCustomizer.errorInvalidColor', { keys: invalidColorKeys.join(', ') }))
      return
    }
    if (contrastChecks.length < 4) {
      setSaveError(t('themeCustomizer.errorUnverifiableContrast'))
      return
    }
    if (failingContrastChecks.length > 0) {
      setSaveError(t('themeCustomizer.errorLowContrast', {
        details: failingContrastChecks.map((check) => `${check.label} ${check.ratio.toFixed(2)}:1`).join(', '),
      }))
      return
    }
    setSaveError(null)
    const targetId = editingId ?? `custom-${Date.now()}`
    const newTheme: CustomColorPalette = {
      id: targetId,
      name: normalizedName,
      category,
      colors,
    }

    const existing = readStoredCustomThemes()
    const updated = existing.filter((t) => t.id !== targetId)
    updated.push(newTheme)

    try {
      localStorage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(updated))
      setCustomThemes(updated)
      onSelectTheme(targetId)
      onClose()
    } catch {
      setSaveError(t('themeCustomizer.errorSaveStorage'))
    }
  }

  const handleDelete = (id: string) => {
    setSaveError(null)
    const existing = readStoredCustomThemes()
    const updated = existing.filter((t) => t.id !== id)
    try {
      localStorage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(updated))
      setCustomThemes(updated)
      if (editingId === id) {
        setEditingId(null)
        setColors(DEFAULT_CUSTOM_COLORS)
      }
      setPendingDeleteId(null)
      if (localStorage.getItem('scriptor:app-theme') === id) {
        onSelectTheme('dark')
      }
    } catch {
      setSaveError(t('themeCustomizer.errorDeleteStorage'))
    }
  }

  const handleEditExisting = (theme: CustomColorPalette) => {
    setEditingId(theme.id)
    setName(theme.name)
    setCategory(theme.category)
    setColors({ ...theme.colors })
  }

  const handleResetToNew = () => {
    setEditingId(null)
    setName(t('themeCustomizer.defaultName'))
    setCategory('dark')
    setColors(DEFAULT_CUSTOM_COLORS)
  }

  return (
    <div ref={overlayRef} className="customizer-overlay" role="dialog" aria-modal="true" aria-label={t('themeCustomizer.ariaLabel')}>
      <div className="customizer-modal">
        <div className="customizer-header">
          <h2>
            <Palette /> {t('themeCustomizer.title')}
          </h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label={t('themeCustomizer.close')}>
            <X />
          </button>
        </div>

        <div className="customizer-body">
          {/* Left Column: Preset Templates & Custom Themes List */}
          <div className="customizer-sidebar">
            <div className="sidebar-section">
              <h3>
                <Sliders /> {t('themeCustomizer.savedThemes', { count: customThemes.length })}
              </h3>
              <button type="button" className="btn-new-theme" onClick={handleResetToNew}>
                <Plus /> {t('themeCustomizer.createNew')}
              </button>
              <div className="saved-themes-list">
                {customThemes.length === 0 ? (
                  <p className="empty-hint">{t('themeCustomizer.empty')}</p>
                ) : (
                  customThemes.map((ct) => (
                    <div key={ct.id} className="saved-theme-entry">
                      <div className={`saved-theme-item ${editingId === ct.id ? 'active' : ''}`}>
                        <button type="button" className="theme-name-btn" onClick={() => handleEditExisting(ct)}>
                          <span className="swatch-mini" style={{ background: ct.colors.primary }} />
                          <span className="name-txt">{ct.name}</span>
                        </button>
                        <button
                          type="button"
                          className="btn-delete-theme"
                          aria-label={t('themeCustomizer.deleteAria', { name: ct.name })}
                          title={t('themeCustomizer.deleteAria', { name: ct.name })}
                          onClick={() => setPendingDeleteId(ct.id)}
                        >
                          <Trash2 />
                        </button>
                      </div>
                      {pendingDeleteId === ct.id ? (
                        <MutationConfirmation
                          ariaLabel={t('themeCustomizer.confirmDeleteAria', { name: ct.name })}
                          message={t('themeCustomizer.confirmDeleteMessage', { name: ct.name })}
                          confirmLabel={t('themeCustomizer.deleteTheme')}
                          onCancel={() => setPendingDeleteId(null)}
                          onConfirm={() => handleDelete(ct.id)}
                          className="theme-delete-confirmation"
                        />
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="sidebar-section">
              <h3>
                <RotateCcw /> {t('themeCustomizer.loadPreset')}
              </h3>
              <select
                value={baseSchemeId}
                aria-label={t('themeCustomizer.loadPresetAria')}
                onChange={(e) => handleLoadBaseScheme(e.target.value)}
              >
                {COLOR_PALETTE_SCHEMES.map((scheme) => (
                  <option key={scheme.id} value={scheme.id}>
                    {scheme.name} ({scheme.category})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Center/Right Column: Color Controls & Live Preview */}
          <div className="customizer-main">
            {saveError ? <p className="error-state" role="alert">{saveError}</p> : null}
            <div className="form-group">
              <label htmlFor="theme-name-input">{t('themeCustomizer.nameLabel')}</label>
              <input
                id="theme-name-input"
                type="text"
                value={name}
                maxLength={80}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('themeCustomizer.namePlaceholder')}
              />
            </div>

            <div className="form-group">
              <label>{t('themeCustomizer.baseCategory')}</label>
              <div className="category-toggle">
                {(['dark', 'light', 'contrast'] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    className={`cat-btn ${category === cat ? 'active' : ''}`}
                    aria-pressed={category === cat}
                    onClick={() => setCategory(cat)}
                  >
                    {t(`themeCustomizer.category${cat.charAt(0).toUpperCase() + cat.slice(1)}`)}
                  </button>
                ))}
              </div>
            </div>

            {contrastChecks.length > 0 ? (
              <div className="theme-contrast-status" role="status" aria-live="polite">
                <strong>{t('themeCustomizer.textContrast')}</strong>
                <span>{t('themeCustomizer.requiredMixed', { textRatio: category === 'contrast' ? '7:1' : '4.5:1', accentRatio: '3:1' })}</span>
                <ul>
                  {contrastChecks.map((check) => (
                    <li key={check.label} data-pass={check.passes ? 'true' : 'false'}>
                      <span>{check.label}</span>
                      <span>{check.ratio.toFixed(2)}:1 {check.passes ? '✓' : `— ${t('themeCustomizer.increaseContrast')}`}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="theme-contrast-status theme-contrast-status--unknown" role="note">
                {t('themeCustomizer.contrastUnknown')}
              </p>
            )}

            <div className="color-pickers-grid">
              <div className="picker-card">
                <label>{t('themeCustomizer.primaryAccent')}</label>
                <div className="picker-row">
                  <input
                    type="color"
                    value={colors.primary.startsWith('#') ? colors.primary : '#38bdf8'}
                    onChange={(e) => handleColorChange('primary', e.target.value)}
                  />
                  <input
                    type="text"
                    value={colors.primary}
                    onChange={(e) => handleColorChange('primary', e.target.value)}
                  />
                </div>
              </div>

              <div className="picker-card">
                <label>{t('themeCustomizer.secondaryAmber')}</label>
                <div className="picker-row">
                  <input
                    type="color"
                    value={colors.amber.startsWith('#') ? colors.amber : '#fbbf24'}
                    onChange={(e) => handleColorChange('amber', e.target.value)}
                  />
                  <input
                    type="text"
                    value={colors.amber}
                    onChange={(e) => handleColorChange('amber', e.target.value)}
                  />
                </div>
              </div>

              <div className="picker-card">
                <label>{t('themeCustomizer.background')}</label>
                <div className="picker-row">
                  <input
                    type="color"
                    value={colors.bg.startsWith('#') ? colors.bg : '#0f172a'}
                    onChange={(e) => handleColorChange('bg', e.target.value)}
                  />
                  <input
                    type="text"
                    value={colors.bg}
                    onChange={(e) => handleColorChange('bg', e.target.value)}
                  />
                </div>
              </div>

              <div className="picker-card">
                <label>{t('themeCustomizer.surface')}</label>
                <div className="picker-row">
                  <input
                    type="color"
                    value={colors.surface.startsWith('#') ? colors.surface : '#1e293b'}
                    onChange={(e) => handleColorChange('surface', e.target.value)}
                  />
                  <input
                    type="text"
                    value={colors.surface}
                    onChange={(e) => handleColorChange('surface', e.target.value)}
                  />
                </div>
              </div>

              <div className="picker-card">
                <label>{t('themeCustomizer.ink')}</label>
                <div className="picker-row">
                  <input
                    type="color"
                    value={colors.ink.startsWith('#') ? colors.ink : '#f8fafc'}
                    onChange={(e) => handleColorChange('ink', e.target.value)}
                  />
                  <input
                    type="text"
                    value={colors.ink}
                    onChange={(e) => handleColorChange('ink', e.target.value)}
                  />
                </div>
              </div>

              <div className="picker-card">
                <label>{t('themeCustomizer.border')}</label>
                <div className="picker-row">
                  <input
                    type="color"
                    value={colors.border.startsWith('#') ? colors.border : '#94a3b8'}
                    onChange={(e) => handleColorChange('border', e.target.value)}
                  />
                  <input
                    type="text"
                    value={colors.border}
                    onChange={(e) => handleColorChange('border', e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Real-time Interactive UI Live Preview Card */}
            <div className="preview-container">
              <h4>
                <Eye /> {t('themeCustomizer.livePreview')}
              </h4>
              <div
                className="live-preview-box"
                style={{
                  background: colors.bg,
                  color: colors.ink,
                  borderColor: colors.border,
                }}
              >
                <div
                  className="preview-header"
                  style={{ background: colors.surface, borderBottomColor: colors.border }}
                >
                  <span className="preview-title" style={{ color: colors.ink }}>
                    {t('themeCustomizer.previewTitle')}
                  </span>
                  <span className="preview-badge" style={{ background: colors.primary, color: primaryPreviewText }}>
                    {t('themeCustomizer.active')}
                  </span>
                </div>
                <div className="preview-content">
                  <p style={{ color: colors.ink }}>
                    {t('themeCustomizer.sample')}
                  </p>
                  <div className="preview-controls">
                    <button
                      type="button"
                      className="preview-btn-primary"
                      style={{ background: colors.primary, color: colors.bg }}
                    >
                      {t('themeCustomizer.primaryAction')}
                    </button>
                    <button
                      type="button"
                      className="preview-btn-amber"
                      style={{ background: colors.amber, color: amberPreviewText }}
                    >
                      {t('themeCustomizer.amberWarning')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="customizer-footer">
          <button type="button" className="btn-cancel" onClick={onClose}>
            {t('themeCustomizer.cancel')}
          </button>
          <button type="button" className="btn-save" onClick={handleSave}>
            <Check /> {editingId ? t('themeCustomizer.updateTheme') : t('themeCustomizer.saveApply')}
          </button>
        </div>
      </div>
    </div>
  )
}
