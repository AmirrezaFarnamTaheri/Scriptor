import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { COLOR_PALETTE_SCHEMES } from '../../src/brand/palettes.ts'

function relativeLuminance(hex) {
  const channels = hex.slice(1).match(/.{2}/g).map((value) => Number.parseInt(value, 16) / 255)
  const [red, green, blue] = channels.map((value) =>
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
  )
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

function contrastRatio(foreground, background) {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background))
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background))
  return (lighter + 0.05) / (darker + 0.05)
}

describe('Color Palette Scheme Catalog Verification', () => {
  it('defines at least 18 alternative color palette schemes', () => {
    assert.ok(COLOR_PALETTE_SCHEMES.length >= 18, `Expected at least 18 schemes, got ${COLOR_PALETTE_SCHEMES.length}`)
  })

  it('includes core classic and popular developer color schemes', () => {
    const ids = new Set(COLOR_PALETTE_SCHEMES.map((s) => s.id))
    const expectedIds = [
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
    ]

    for (const id of expectedIds) {
      assert.ok(ids.has(id), `Missing color palette scheme ID: ${id}`)
    }
  })

  it('validates color scheme properties and non-empty hex swatches', () => {
    for (const scheme of COLOR_PALETTE_SCHEMES) {
      assert.ok(scheme.id, 'Scheme missing ID')
      assert.ok(scheme.name, 'Scheme missing name')
      assert.ok(['light', 'dark', 'contrast'].includes(scheme.category), `Invalid category: ${scheme.category}`)
      assert.ok(scheme.description, 'Scheme missing description')
      assert.ok(scheme.author, 'Scheme missing author')
      assert.ok(scheme.colors.primary, 'Scheme missing primary color')
      assert.ok(scheme.colors.bg, 'Scheme missing bg color')
      assert.ok(scheme.colors.surface, 'Scheme missing surface color')
      assert.ok(scheme.colors.ink, 'Scheme missing ink color')
      assert.ok(scheme.colors.border, 'Scheme missing border color')
    }
  })

  it('keeps text and warning accents above the WCAG contrast floor', () => {
    for (const scheme of COLOR_PALETTE_SCHEMES) {
      assert.ok(
        contrastRatio(scheme.colors.ink, scheme.colors.bg) >= 4.5,
        `${scheme.id} ink/background contrast is below 4.5:1`,
      )
      assert.ok(
        contrastRatio(scheme.colors.ink, scheme.colors.surface) >= 4.5,
        `${scheme.id} ink/surface contrast is below 4.5:1`,
      )
      assert.ok(
        contrastRatio(scheme.colors.amber, scheme.colors.bg) >= 3,
        `${scheme.id} amber/background contrast is below 3:1`,
      )
    }
  })
})
