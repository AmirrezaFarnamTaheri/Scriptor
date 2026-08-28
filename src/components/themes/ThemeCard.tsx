import { Check } from 'lucide-react'
import type { ColorPaletteScheme } from '../../brand/palettes'
import type { AppTheme } from '../../hooks/useAppTheme'
import '../../styles/components/theme-card.css'

export interface ThemeCardProps {
  scheme: ColorPaletteScheme
  isActive: boolean
  onSelect: (id: AppTheme) => void
  onHoverPreviewStart?: (id: AppTheme) => void
  onHoverPreviewEnd?: () => void
}

export function ThemeCard({
  scheme,
  isActive,
  onSelect,
  onHoverPreviewStart,
  onHoverPreviewEnd,
}: ThemeCardProps) {
  return (
    <div
      className={`theme-card ${isActive ? 'is-active' : ''}`}
      onMouseEnter={() => onHoverPreviewStart?.(scheme.id)}
      onMouseLeave={() => onHoverPreviewEnd?.()}
      onFocus={() => onHoverPreviewStart?.(scheme.id)}
      onBlur={() => onHoverPreviewEnd?.()}
    >
      <div className="theme-card-header">
        <div className="theme-card-title-row">
          <h4 className="theme-card-name">{scheme.name}</h4>
          <span className={`theme-category-badge category-${scheme.category}`}>
            {scheme.category.toUpperCase()}
          </span>
        </div>
        <span className="theme-card-author">by {scheme.author}</span>
      </div>

      <p className="theme-card-description">{scheme.description}</p>

      {/* Color Swatch Strip */}
      <div className="theme-color-swatches" aria-label="Color Palette Swatches">
        <div
          className="swatch"
          style={{ backgroundColor: scheme.colors.primary }}
          title={`Primary: ${scheme.colors.primary}`}
        />
        <div
          className="swatch"
          style={{ backgroundColor: scheme.colors.amber }}
          title={`Accent: ${scheme.colors.amber}`}
        />
        <div
          className="swatch"
          style={{ backgroundColor: scheme.colors.bg }}
          title={`Background: ${scheme.colors.bg}`}
        />
        <div
          className="swatch"
          style={{ backgroundColor: scheme.colors.surface }}
          title={`Surface: ${scheme.colors.surface}`}
        />
        <div
          className="swatch"
          style={{ backgroundColor: scheme.colors.ink }}
          title={`Ink: ${scheme.colors.ink}`}
        />
      </div>

      {/* Mini UI Component Live Preview Box */}
      <div
        className="theme-live-preview-box"
        style={{
          backgroundColor: scheme.colors.bg,
          borderColor: scheme.colors.border,
          color: scheme.colors.ink,
        }}
      >
        <div
          className="preview-header"
          style={{
            backgroundColor: scheme.colors.surface,
            borderColor: scheme.colors.border,
          }}
        >
          <span className="preview-dot" style={{ backgroundColor: scheme.colors.primary }} />
          <span className="preview-title" style={{ color: scheme.colors.ink }}>
            Scriptor Preview
          </span>
          <span
            className="preview-badge"
            style={{
              backgroundColor: scheme.colors.primary,
              color: scheme.colors.bg,
            }}
          >
            v0.1
          </span>
        </div>
        <div className="preview-body">
          <div
            className="preview-input"
            style={{
              backgroundColor: scheme.colors.surface,
              borderColor: scheme.colors.border,
              color: scheme.colors.ink,
            }}
          >
            Type a Markdown command...
          </div>
          <button
            type="button"
            className="preview-btn"
            style={{
              backgroundColor: scheme.colors.primary,
              color: scheme.colors.bg,
            }}
          >
            Active State
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="theme-card-actions">
        {isActive ? (
          <button type="button" className="theme-action-btn active-btn" disabled>
            <Check /> Installed &amp; Active
          </button>
        ) : (
          <button
            type="button"
            className="theme-action-btn install-btn"
            onClick={() => onSelect(scheme.id)}
          >
            Install &amp; Activate Palette
          </button>
        )}
      </div>
    </div>
  )
}
