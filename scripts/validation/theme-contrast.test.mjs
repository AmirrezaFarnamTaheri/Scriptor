import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

// VIS-028: small status labels and secondary controls must remain readable in
// every shipped theme, including curated community themes.
const stylesheet = readFileSync(new URL('../../src/index.css', import.meta.url), 'utf8')
const themes = [...stylesheet.matchAll(/\[data-theme='([^']+)'\]\s*\{([\s\S]*?)\n\}/g)]

function luminance(hex) {
  const linear = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255)
    .map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722
}

function contrast(a, b) {
  const left = luminance(a)
  const right = luminance(b)
  return (Math.max(left, right) + 0.05) / (Math.min(left, right) + 0.05)
}

test('all built-in themes keep secondary and status text readable on opaque surfaces', () => {
  assert.ok(themes.length >= 18, `Expected all 18 built-in themes, found ${themes.length}`)
  for (const [, theme, body] of themes) {
    const colors = Object.fromEntries(
      [...body.matchAll(/--([a-z-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;/g)]
        .map(match => [match[1], match[2]]),
    )
    for (const textColor of ['muted', 'faint', 'primary', 'primary-strong', 'success', 'danger', 'amber']) {
      assert.match(colors[textColor] ?? '', /^#[\da-f]{6}$/i, `${theme} missing ${textColor}`)
      for (const background of ['bg', 'bg-elevated']) {
        assert.match(colors[background] ?? '', /^#[\da-f]{6}$/i, `${theme} missing ${background}`)
        const measured = contrast(colors[textColor], colors[background])
        const minimum = textColor === 'muted' ? 5.5 : 4.5
        assert.ok(measured >= minimum, `${theme}: --${textColor} on --${background} = ${measured.toFixed(2)}:1 (<${minimum}:1)`)
      }
    }
  }
})
