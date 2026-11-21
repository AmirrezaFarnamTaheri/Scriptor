// Resolves the root-level colour tokens that src/index.css gives each
// palette x appearance pair and measures WCAG contrast. Used by
// palette-contrast.test.mjs; run directly to print every failing pair.
import fs from 'node:fs'
import path from 'node:path'

export const ACCENT_TOKENS = ['--primary', '--primary-strong', '--danger', '--success', '--amber']
export const SURFACE_TOKENS = ['--bg', '--bg-elevated']
export const APPEARANCES = ['light', 'dark']

const ROOT_PIECE = /^(?::root|\[data-(theme|appearance)='([\w-]+)'\])/

/** Parses top-level `selector { declarations }` rules, skipping at-rules and comments. */
export function parseRootRules(css) {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const rules = []
  let depth = 0
  let start = 0
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === '{') {
      if (depth === 0) {
        const selector = text.slice(start, index).trim()
        const close = text.indexOf('}', index)
        const body = text.slice(index + 1, close)
        if (!selector.startsWith('@') && !body.includes('{')) {
          rules.push({ selector, declarations: parseDeclarations(body), order: rules.length })
          index = close
          start = close + 1
          continue
        }
      }
      depth += 1
    } else if (text[index] === '}') {
      depth -= 1
      if (depth === 0) start = index + 1
    }
  }
  return rules
}

function parseDeclarations(body) {
  const declarations = new Map()
  for (const part of body.split(';')) {
    const colon = part.indexOf(':')
    if (colon < 0) continue
    const name = part.slice(0, colon).trim()
    if (name.startsWith('--')) declarations.set(name, part.slice(colon + 1).trim())
  }
  return declarations
}

/** Specificity of a selector that targets the root element, or null when it targets anything else. */
function rootMatch(selector, theme, appearance) {
  let rest = selector.trim()
  let specificity = 0
  while (rest) {
    const piece = ROOT_PIECE.exec(rest)
    if (!piece) return null
    if (piece[1] === 'theme' && piece[2] !== theme) return null
    if (piece[1] === 'appearance' && piece[2] !== appearance) return null
    specificity += 1
    rest = rest.slice(piece[0].length)
  }
  return specificity
}

export function palettes(rules) {
  const names = new Set()
  for (const rule of rules) {
    for (const match of rule.selector.matchAll(/\[data-theme='([\w-]+)'\]/g)) names.add(match[1])
  }
  return [...names]
}

export function cascade(rules, theme, appearance) {
  const winners = new Map()
  for (const rule of rules) {
    const matches = rule.selector.split(',').map((selector) => rootMatch(selector, theme, appearance)).filter((value) => value !== null)
    if (matches.length === 0) continue
    const specificity = Math.max(...matches)
    for (const [name, value] of rule.declarations) {
      const current = winners.get(name)
      if (!current || current.specificity < specificity || (current.specificity === specificity && current.order <= rule.order)) {
        winners.set(name, { value, specificity, order: rule.order })
      }
    }
  }
  return new Map([...winners].map(([name, entry]) => [name, entry.value]))
}

// ---- colour maths (sRGB, OKLab/OKLCH, WCAG luminance) ----

const toLinear = (channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
const fromLinear = (channel) => (channel <= 0.0031308 ? channel * 12.92 : 1.055 * channel ** (1 / 2.4) - 0.055)

export function hexToRgb(hex) {
  const value = hex.replace('#', '')
  const full = value.length === 3 ? [...value].map((char) => char + char).join('') : value.slice(0, 6)
  return [0, 2, 4].map((offset) => parseInt(full.slice(offset, offset + 2), 16) / 255)
}

export function rgbToHex(rgb) {
  return `#${rgb.map((channel) => Math.round(Math.min(1, Math.max(0, channel)) * 255).toString(16).padStart(2, '0')).join('')}`
}

export function rgbToOklch([r, g, b]) {
  const [lr, lg, lb] = [r, g, b].map(toLinear)
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb)
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb)
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb)
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  return [L, Math.hypot(A, B), (Math.atan2(B, A) * 180) / Math.PI]
}

export function oklchToRgb([L, C, H]) {
  const A = C * Math.cos((H * Math.PI) / 180)
  const B = C * Math.sin((H * Math.PI) / 180)
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map(fromLinear)
}

export function luminance(rgb) {
  const [r, g, b] = rgb.map((channel) => toLinear(Math.min(1, Math.max(0, channel))))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrast(a, b) {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (high + 0.05) / (low + 0.05)
}

function mixOklch(a, b, weightA) {
  const [la, ca, ha] = rgbToOklch(a)
  const [lb, cb, hb] = rgbToOklch(b)
  let delta = hb - ha
  if (delta > 180) delta -= 360
  if (delta < -180) delta += 360
  const t = 1 - weightA
  return oklchToRgb([la + (lb - la) * t, ca + (cb - ca) * t, ha + delta * t])
}

/** Resolves a token to sRGB. Supports hex, var() and two-colour color-mix(); returns null otherwise. */
export function resolveColor(tokens, value, seen = new Set()) {
  const text = value.trim()
  const variable = /^var\((--[\w-]+)\)$/.exec(text)
  if (variable) {
    if (seen.has(variable[1]) || !tokens.has(variable[1])) return null
    return resolveColor(tokens, tokens.get(variable[1]), new Set([...seen, variable[1]]))
  }
  if (/^#[0-9a-f]{3,8}$/i.test(text)) return hexToRgb(text)
  const mix = /^color-mix\(in (oklch|srgb),\s*(.+?)\s+(\d+(?:\.\d+)?)%,\s*(.+?)(?:\s+\d+(?:\.\d+)?%)?\)$/.exec(text)
  if (mix) {
    const a = resolveColor(tokens, mix[2], seen)
    const b = resolveColor(tokens, mix[4], seen)
    if (!a || !b) return null
    const weight = Number(mix[3]) / 100
    return mix[1] === 'srgb' ? a.map((channel, index) => channel * weight + b[index] * (1 - weight)) : mixOklch(a, b, weight)
  }
  return null
}

export function accentReport(css, minimum = 4.5) {
  const rules = parseRootRules(css)
  const failures = []
  for (const theme of palettes(rules)) {
    for (const appearance of APPEARANCES) {
      const tokens = cascade(rules, theme, appearance)
      for (const surface of SURFACE_TOKENS) {
        const background = resolveColor(tokens, tokens.get(surface) ?? '')
        if (!background) continue
        for (const accent of ACCENT_TOKENS) {
          const foreground = resolveColor(tokens, tokens.get(accent) ?? '')
          if (!foreground) continue
          const ratio = contrast(foreground, background)
          if (ratio < minimum) failures.push({ theme, appearance, accent, surface, ratio: Number(ratio.toFixed(2)) })
        }
      }
    }
  }
  return failures
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const css = fs.readFileSync(path.resolve(import.meta.dirname, '../../src/index.css'), 'utf8')
  for (const failure of accentReport(css)) console.log(JSON.stringify(failure))
}
