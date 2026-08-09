import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { COLOR_PALETTE_SCHEMES } from '../../src/brand/palettes.ts'

describe('Color Palette Scheme Catalog Verification', () => {
  it('defines at least 13 alternative color palette schemes', () => {
    assert.ok(COLOR_PALETTE_SCHEMES.length >= 13, `Expected at least 13 schemes, got ${COLOR_PALETTE_SCHEMES.length}`)
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
})
