import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { XSS_FIXTURES } from './xss-fixtures.ts'
import { renderMarkdownPreview } from './preview.ts'

/*
 * Patterns that must never appear inside *live markup* — i.e. inside a tag's
 * name or attribute list. They are deliberately NOT applied to text content:
 * `renderMarkdownPreview` escapes `<` in text as `&#x3C;`, so a literal
 * `onerror=` sitting in a paragraph is inert prose, not a handler. Scanning the
 * raw HTML string (the previous behaviour) reported those as failures and hid
 * the real signal — see xss-51, where markdown parses the payload's backticks
 * as inline code and the whole `<img …>` never becomes an element at all.
 */
const DANGEROUS_PATTERNS = [
  /\bon\w+\s*=/i,
  /javascript\s*:/i,
  /vbscript\s*:/i,
  /data\s*:\s*text\s*\/\s*html/i,
  /expression\s*\(/i,
  /-moz-binding/i,
  /\bbehavior\s*:/i,
]

/** Elements that must never survive sanitization, whatever the payload. */
const FORBIDDEN_TAGS = new Set([
  'script',
  'iframe',
  'object',
  'embed',
  'style',
  'link',
  'meta',
  'base',
  'form',
  'frame',
  'frameset',
  'applet',
  'template',
  'noscript',
])

/** Attributes whose value is fetched/navigated to, so scheme matters. */
const URL_ATTRIBUTES = new Set([
  'href',
  'src',
  'srcset',
  'srcdoc',
  'action',
  'formaction',
  'data',
  'poster',
  'background',
  'ping',
  'xlink:href',
  'lowsrc',
  'dynsrc',
])

const DANGEROUS_SCHEME = /^\s*(?:javascript|vbscript|livescript|mocha|data)\s*:/i

/**
 * Split rendered HTML into its markup regions (`<tag …>` spans), quote-aware so
 * a `>` inside an attribute value cannot truncate the region and hide whatever
 * follows it.
 *
 * Text content is intentionally excluded: it is escaped by the serializer and
 * therefore inert. `<` only ever begins a real tag in the pipeline's output.
 */
export function extractMarkup(html: string): string[] {
  const regions: string[] = []
  let index = 0

  while (index < html.length) {
    const open = html.indexOf('<', index)
    if (open === -1) break
    const next = html[open + 1] ?? ''
    if (!/[a-zA-Z/!?]/.test(next)) {
      index = open + 1
      continue
    }

    let cursor = open + 1
    let quote = ''
    while (cursor < html.length) {
      const char = html[cursor]
      if (quote) {
        if (char === quote) quote = ''
      } else if (char === '"' || char === "'") {
        quote = char
      } else if (char === '>') {
        break
      }
      cursor += 1
    }

    regions.push(html.slice(open, Math.min(cursor + 1, html.length)))
    index = cursor + 1
  }

  return regions
}

interface ParsedTag {
  name: string
  attributes: Array<{ name: string; value: string }>
}

function parseTag(region: string): ParsedTag | null {
  const match = /^<\/?([a-zA-Z][a-zA-Z0-9:-]*)/.exec(region)
  if (!match) return null
  const name = (match[1] ?? '').toLowerCase()

  const attributes: Array<{ name: string; value: string }> = []
  const attrPattern = /([a-zA-Z_:@][-a-zA-Z0-9_:.]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>`]+)))?/g
  const body = region.slice(match[0].length)
  let attr: RegExpExecArray | null
  while ((attr = attrPattern.exec(body)) !== null) {
    attributes.push({
      name: (attr[1] ?? '').toLowerCase(),
      value: attr[2] ?? attr[3] ?? attr[4] ?? '',
    })
  }

  return { name, attributes }
}

/** Structural audit of the rendered markup, independent of fixture expectations. */
export function auditMarkup(html: string): string[] {
  const problems: string[] = []

  for (const region of extractMarkup(html)) {
    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(region)) {
        problems.push(`markup matches /${pattern.source}/ -> ${region}`)
      }
    }

    const tag = parseTag(region)
    if (!tag) continue

    if (FORBIDDEN_TAGS.has(tag.name)) {
      problems.push(`forbidden <${tag.name}> element survived -> ${region}`)
    }

    for (const attribute of tag.attributes) {
      if (/^on/i.test(attribute.name) && attribute.name.length > 2) {
        problems.push(`event handler attribute "${attribute.name}" survived -> ${region}`)
      }
      if (URL_ATTRIBUTES.has(attribute.name) && DANGEROUS_SCHEME.test(decodeEntities(attribute.value))) {
        problems.push(`${attribute.name} carries a dangerous scheme -> ${attribute.value}`)
      }
    }
  }

  return problems
}

function decodeEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);?/gi, (_m, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);?/g, (_m, dec: string) => String.fromCodePoint(Number.parseInt(dec, 10)))
    .replaceAll('&colon;', ':')
    .replaceAll('&tab;', '\t')
    .replaceAll('&newline;', '\n')
    .replaceAll('&amp;', '&')
}

/**
 * Fixtures that are still not fully contained, each with a documented reason.
 * The suite asserts this set *exactly*: a new leak fails the build, and fixing
 * one of these also fails the build until the entry is removed. That keeps
 * `check:renderer` green while keeping the residual gaps impossible to ignore.
 */
const EXPECTED_KNOWN_GAPS = new Map<string, string>([
  [
    'xss-34',
    'Wikilink embed target keeps the raw `javascript:` text in data-wikilink-target. Contained: the value is never used as a URL — hydrateWikilinkEmbeds passes it to the host fetchNote() as a vault path and otherwise renders it via textContent.',
  ],
  [
    'xss-35',
    'Same as xss-34 for `data:` targets. Contained for the same reason; the angle brackets in the attribute value are serializer-quoted, not parsed as markup.',
  ],
  [
    'xss-67',
    'Client-side template syntax `{{…}}` passes through as literal text. Accepted: the preview has no template engine, so there is nothing to interpolate it. Would only matter if preview output were ever re-hosted inside an Angular/Vue app.',
  ],
])

describe('XSS sanitization fixture suite', () => {
  const leaking = new Set<string>()

  for (const fixture of XSS_FIXTURES) {
    it(`${fixture.id}: ${fixture.label}`, () => {
      const html = renderMarkdownPreview(fixture.markdown)

      const problems = auditMarkup(html)
      for (const pattern of fixture.blockedPatterns) {
        if (html.toLowerCase().includes(pattern.toLowerCase())) {
          problems.push(`blocked pattern "${pattern}" still present in output`)
        }
      }

      const knownGap = EXPECTED_KNOWN_GAPS.get(fixture.id)
      if (problems.length > 0) {
        leaking.add(fixture.id)
        assert.ok(
          knownGap,
          `${fixture.id} (${fixture.label}) leaked:\n  - ${problems.join('\n  - ')}\n  rendered: ${html}`,
        )
        return
      }

      assert.equal(
        knownGap,
        undefined,
        `${fixture.id} is listed in EXPECTED_KNOWN_GAPS but is now fully contained — delete the entry so the gap list stays truthful.`,
      )
    })
  }

  it('known-gap ledger matches reality', () => {
    const expected = [...EXPECTED_KNOWN_GAPS.keys()].sort()
    const actual = [...leaking].sort()
    console.log(`\nXSS fixture suite: ${XSS_FIXTURES.length} vectors, ${actual.length} documented known gaps`)
    for (const id of actual) {
      console.log(`  known gap ${id}: ${EXPECTED_KNOWN_GAPS.get(id)}`)
    }
    assert.deepEqual(actual, expected, 'the set of leaking fixtures must match EXPECTED_KNOWN_GAPS exactly')
  })

  it('canonical escaping is applied in attribute context', () => {
    const html = renderMarkdownPreview('![[a"b\'c<d>e&f]]')
    // escapeAttr neutralises the quote characters that could terminate the
    // attribute; `<`/`>` are legal inside a quoted value and stay literal.
    assert.match(html, /data-wikilink-target="a&#x22;b&#x27;c<d>e&#x26;f"/)
    assert.doesNotMatch(html, /data-wikilink-target="a"b/)
  })
})
