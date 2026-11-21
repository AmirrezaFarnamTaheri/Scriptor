import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'

import { ACCENT_TOKENS, APPEARANCES, SURFACE_TOKENS, accentReport, cascade, contrast, hexToRgb, palettes, parseRootRules, resolveColor } from './palette-contrast.mjs'

const root = path.resolve(import.meta.dirname, '../..')
const indexCss = fs.readFileSync(path.join(root, 'src/index.css'), 'utf8')

test('contrast maths matches known WCAG values', () => {
  assert.equal(contrast(hexToRgb('#000000'), hexToRgb('#ffffff')).toFixed(1), '21.0')
  assert.equal(contrast(hexToRgb('#767676'), hexToRgb('#ffffff')).toFixed(2), '4.54')
})

test('cascade applies appearance and palette+appearance rules over the palette', () => {
  const rules = parseRootRules(`:root, [data-theme='light'] { --primary: #111111; --bg: #ffffff }
[data-theme='x'] { --primary: #222222 }
:root[data-appearance='light'] { --bg: color-mix(in oklch, #ffffff 100%, var(--primary)) }
:root[data-theme='x'][data-appearance='light'] { --primary: #333333 }`)
  assert.deepEqual(palettes(rules), ['light', 'x'])
  const tokens = cascade(rules, 'x', 'light')
  assert.equal(tokens.get('--primary'), '#333333')
  assert.deepEqual(resolveColor(tokens, tokens.get('--bg')).map((c) => Math.round(c * 255)), [255, 255, 255])
})

test('every palette checks every required accent/surface pair at 4.5:1', () => {
  const rules = parseRootRules(indexCss)
  const themes = palettes(rules)
  assert.ok(themes.length > 0, 'a zero-palette report cannot satisfy contrast coverage')
  let checked = 0
  for (const theme of themes) {
    for (const appearance of APPEARANCES) {
      const tokens = cascade(rules, theme, appearance)
      for (const surface of SURFACE_TOKENS) {
        const background = resolveColor(tokens, tokens.get(surface) ?? '')
        assert.ok(background, `missing background ${theme}/${appearance}/${surface}`)
        for (const accent of ACCENT_TOKENS) {
          const foreground = resolveColor(tokens, tokens.get(accent) ?? '')
          assert.ok(foreground, `missing accent ${theme}/${appearance}/${accent}`)
          assert.ok(contrast(foreground, background) >= 4.5,
            `low contrast ${theme}/${appearance}/${accent} on ${surface}`)
          checked++
        }
      }
    }
  }
  assert.equal(checked, themes.length * APPEARANCES.length * SURFACE_TOKENS.length * ACCENT_TOKENS.length)
  assert.deepEqual(accentReport(indexCss), [])
})

test('the runtime error banner is mixed from the theme surface, not literal white', () => {
  const css = fs.readFileSync(path.join(root, 'src/styles/layout/workspace.css'), 'utf8')
  const rule = /\.runtime-banner\.error\s*\{([^}]*)\}/.exec(css)
  assert.ok(rule, '.runtime-banner.error rule exists')
  assert.doesNotMatch(rule[1], /,\s*white\)/)
  assert.match(rule[1], /var\(--bg-elevated\)/)
  const background = /background:\s*([^;]+);/.exec(rule[1])
  const foreground = /(?:^|;)\s*color:\s*([^;]+);/.exec(rule[1])
  assert.ok(background && foreground, 'banner has both surface and foreground colours')
  const rules = parseRootRules(indexCss)
  let checked = 0
  for (const theme of palettes(rules)) {
    for (const appearance of APPEARANCES) {
      const tokens = cascade(rules, theme, appearance)
      const bg = resolveColor(tokens, background[1])
      const fg = resolveColor(tokens, foreground[1])
      assert.ok(bg && fg, `runtime banner colours resolve: ${theme}/${appearance}`)
      const ratio = contrast(fg, bg)
      assert.ok(ratio >= 4.5, `runtime banner contrast ${theme}/${appearance}: ${ratio.toFixed(2)}`)
      checked++
    }
  }
  assert.ok(checked >= 2, 'runtime banner contrast must be measured in multiple appearances')
})
