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

export function ThemeCustomizerModal({
  isOpen,
  onClose,
  onSelectTheme,
}: ThemeCustomizerModalProps) {
  const [customThemes, setCustomThemes] = useState<CustomColorPalette[]>(() =>
    readStoredCustomThemes(),
  )
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('My Custom Theme')
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
    const minimum = category === 'contrast' ? 7 : 4.5
    const pairs = [
      ['Text / background', colors.ink, colors.bg],
      ['Text / surface', colors.ink, colors.surface],
    ] as const
    return pairs.flatMap(([label, foreground, background]) => {
      const ratio = contrastRatio(foreground, background)
      if (ratio === null) return []
      return [{ label, ratio, minimum, passes: ratio >= minimum }]
    })
  }, [category, colors.bg, colors.ink, colors.surface])

  const failingContrastChecks = contrastChecks.filter((check) => !check.passes)

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
        setName(`Custom ${base.name}`)
      }
    }
  }

  const handleSave = () => {
    if (invalidColorKeys.length > 0) {
      setSaveError(`Invalid CSS color: ${invalidColorKeys.join(', ')}`)
      return
    }
    if (failingContrastChecks.length > 0) {
      setSaveError(
        `Text contrast is too low: ${failingContrastChecks.map((check) => `${check.label} ${check.ratio.toFixed(2)}:1`).join(', ')}.`,
      )
      return
    }
    setSaveError(null)
    const targetId = editingId ?? `custom-${Date.now()}`
    const newTheme: CustomColorPalette = {
      id: targetId,
      name: name.trim() || 'Custom Theme',
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
      setSaveError('Could not save the custom theme. Browser storage may be unavailable or full.')
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
      setSaveError('Could not delete the custom theme from browser storage.')
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
    setName('My Custom Theme')
    setCategory('dark')
    setColors(DEFAULT_CUSTOM_COLORS)
  }

  return (
    <div ref={overlayRef} className="customizer-overlay" role="dialog" aria-modal="true" aria-label="Theme Customizer & Builder">
      <div className="customizer-modal">
        <div className="customizer-header">
          <h2>
            <Palette /> Custom Theme Builder &amp; Color Editor
          </h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
            <X />
          </button>
        </div>

        <div className="customizer-body">
          {/* Left Column: Preset Templates & Custom Themes List */}
          <div className="customizer-sidebar">
            <div className="sidebar-section">
              <h3>
                <Sliders /> Saved Custom Themes ({customThemes.length})
              </h3>
              <button type="button" className="btn-new-theme" onClick={handleResetToNew}>
                <Plus /> Create New Theme
              </button>
              <div className="saved-themes-list">
                {customThemes.length === 0 ? (
                  <p className="empty-hint">No custom themes saved yet.</p>
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
                          aria-label={`Delete ${ct.name}`}
                          title={`Delete ${ct.name}`}
                          onClick={() => setPendingDeleteId(ct.id)}
                        >
                          <Trash2 />
                        </button>
                      </div>
                      {pendingDeleteId === ct.id ? (
                        <MutationConfirmation
                          ariaLabel={`Confirm deletion of ${ct.name}`}
                          message={`Delete the custom theme “${ct.name}”? This cannot be undone.`}
                          confirmLabel="Delete theme"
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
                <RotateCcw /> Load From Preset Template
              </h3>
              <select
                value={baseSchemeId}
                aria-label="Load base color scheme from preset template"
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
              <label htmlFor="theme-name-input">Theme Name:</label>
              <input
                id="theme-name-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Neon Emerald Night"
              />
            </div>

            <div className="form-group">
              <label>Theme Base Category:</label>
              <div className="category-toggle">
                {(['dark', 'light', 'contrast'] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    className={`cat-btn ${category === cat ? 'active' : ''}`}
                    onClick={() => setCategory(cat)}
                  >
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {contrastChecks.length > 0 ? (
              <div className="theme-contrast-status" role="status" aria-live="polite">
                <strong>Text contrast</strong>
                <span>Required: {category === 'contrast' ? '7:1' : '4.5:1'}</span>
                <ul>
                  {contrastChecks.map((check) => (
                    <li key={check.label} data-pass={check.passes ? 'true' : 'false'}>
                      <span>{check.label}</span>
                      <span>{check.ratio.toFixed(2)}:1 {check.passes ? '✓' : '— increase contrast'}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="theme-contrast-status theme-contrast-status--unknown" role="note">
                Contrast preview is available for six-digit hex text, background, and surface colors.
              </p>
            )}

            <div className="color-pickers-grid">\n              <div className="picker-card">
                <label>Primary Accent</label>
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
                <label>Secondary Amber</label>
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
                <label>Background</label>
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
                <label>Surface Panel</label>
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
                <label>Ink / Text</label>
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
                <label>Border Highlight</label>
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
                <Eye /> Real-time Interactive Live Preview
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
                    Document Title.md
                  </span>
                  <span className="preview-badge" style={{ background: colors.primary, color: colors.bg }}>
                    Active
                  </span>
                </div>
                <div className="preview-content">
                  <p style={{ color: colors.ink }}>
                    Here is sample markdown text rendered with your customized palette.
                  </p>
                  <div className="preview-controls">
                    <button
                      type="button"
                      className="preview-btn-primary"
                      style={{ background: colors.primary, color: colors.bg }}
                    >
                      Primary Action
                    </button>
                    <button
                      type="button"
                      className="preview-btn-amber"
                      style={{ background: colors.amber, color: colors.bg }}
                    >
                      Amber Warning
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="customizer-footer">
          <button type="button" className="btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn-save" onClick={handleSave}>
            <Check /> {editingId ? 'Update Theme' : 'Save & Apply Theme'}
          </button>
        </div>
      </div>
    </div>
  )
}
