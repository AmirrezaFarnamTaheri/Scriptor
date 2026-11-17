import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'

import { accentReport, cascade, contrast, hexToRgb, palettes, parseRootRules, resolveColor } from './palette-contrast.mjs'

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

test('every palette keeps accent and status colours at 4.5:1 on its surfaces in both appearances', () => {
  const failures = accentReport(indexCss)
  assert.deepEqual(failures, [], `${failures.length} palette/appearance/token pairs fall below 4.5:1:\n${failures.map((f) => JSON.stringify(f)).join('\n')}`)
})

test('the runtime error banner is mixed from the theme surface, not literal white', () => {
  const css = fs.readFileSync(path.join(root, 'src/styles/layout/workspace.css'), 'utf8')
  const rule = /\.runtime-banner\.error\s*\{([^}]*)\}/.exec(css)
  assert.ok(rule, '.runtime-banner.error rule exists')
  assert.doesNotMatch(rule[1], /,\s*white\)/)
  assert.match(rule[1], /var\(--bg-elevated\)/)
})
