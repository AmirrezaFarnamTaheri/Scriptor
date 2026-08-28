import { useState, useLayoutEffect, useRef } from 'react'
import { Palette, Plus, Trash2, Check, RotateCcw, Sliders, Eye, X } from 'lucide-react'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import {
  COLOR_PALETTE_SCHEMES,
} from '../../brand/palettes'
import {
  readStoredCustomThemes,
  type CustomColorPalette,
  type AppTheme,
} from '../../hooks/useAppTheme'
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

  // useLayoutEffect is the correct pattern here: localStorage read must sync before
  // first paint on re-open to prevent stale custom-theme list flash.
  useLayoutEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCustomThemes(readStoredCustomThemes())
    }
  }, [isOpen])

  const overlayRef = useRef<HTMLDivElement>(null)
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
      // ignore quota error
    }
  }

  const handleDelete = (id: string) => {
    const existing = readStoredCustomThemes()
    const updated = existing.filter((t) => t.id !== id)
    try {
      localStorage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(updated))
      setCustomThemes(updated)
      if (editingId === id) {
        setEditingId(null)
        setColors(DEFAULT_CUSTOM_COLORS)
      }
    } catch {
      // ignore
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
                    <div key={ct.id} className={`saved-theme-item ${editingId === ct.id ? 'active' : ''}`}>
                      <button type="button" className="theme-name-btn" onClick={() => handleEditExisting(ct)}>
                        <span className="swatch-mini" style={{ background: ct.colors.primary }} />
                        <span className="name-txt">{ct.name}</span>
                      </button>
                      <button
                        type="button"
                        className="btn-delete-theme"
                        title="Delete theme"
                        onClick={() => handleDelete(ct.id)}
                      >
                        <Trash2 />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="sidebar-section">
              <h3>
                <RotateCcw /> Load From Preset Template
              </h3>
              <select value={baseSchemeId} onChange={(e) => handleLoadBaseScheme(e.target.value)}>
              aria-label="Load base color scheme from preset template"
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

            <div className="color-pickers-grid">
              <div className="picker-card">
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
