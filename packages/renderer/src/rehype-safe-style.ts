import { visit } from 'unist-util-visit'

/**
 * Filter dangerous declarations out of inline `style` attributes.
 *
 * `hast-util-sanitize` treats attribute values as opaque strings — it can allow
 * or drop `style` wholesale but never inspects the CSS inside it. The preview
 * schema *must* allow `style` on `<span>` because that is how KaTeX lays out
 * rendered math, which means raw `<span style="...">` written by a note author
 * reaches the DOM with arbitrary CSS. This pass closes that hole by stripping
 * the declarations that are actually weaponisable:
 *
 * - `url(...)` / `image-set(...)` / `element(...)` — outbound requests, so a
 *   note can beacon "this note was opened" to a third party.
 * - `javascript:` / `vbscript:` / `expression(...)` / `behavior` /
 *   `-moz-binding` — legacy script-execution-from-CSS primitives.
 * - `position: fixed | sticky` — viewport-anchored overlays, i.e. clickjacking
 *   / UI-spoofing over the rest of the app chrome. (`relative` and `absolute`
 *   stay allowed: KaTeX depends on them and they stay inside document flow.)
 * - vendor-prefixed properties and CSS comment/escape obfuscation, which exist
 *   only to smuggle the above past a naive filter.
 *
 * Run after `rehype-raw` (so author HTML is in the tree) and before
 * `rehype-sanitize`.
 */

const DANGEROUS_VALUE = /url\s*\(|image-set\s*\(|element\s*\(|expression\s*\(|javascript\s*:|vbscript\s*:|data\s*:|\\|\/\*|&#|&\w+;/i

const DANGEROUS_PROPERTY = /^(?:-|behavior$|binding$|filter$|content$)/i

const POSITION_VALUE = /^(?:fixed|sticky)$/i

/** Remove weaponisable declarations from a CSS declaration list. */
export function sanitizeStyleAttribute(style: string): string {
  const kept: string[] = []

  for (const rawDeclaration of style.split(';')) {
    const declaration = rawDeclaration.trim()
    if (declaration.length === 0) continue

    const colon = declaration.indexOf(':')
    if (colon <= 0) continue

    const property = declaration.slice(0, colon).trim().toLowerCase()
    const value = declaration.slice(colon + 1).trim()

    // Property names are `[a-z-]` only; anything else is obfuscation.
    if (!/^[a-z][a-z0-9-]*$/.test(property)) continue
    if (DANGEROUS_PROPERTY.test(property)) continue
    if (value.length === 0) continue
    if (DANGEROUS_VALUE.test(value)) continue
    if (property === 'position' && POSITION_VALUE.test(value)) continue

    kept.push(`${property}:${value}`)
  }

  return kept.join(';')
}

type StyledElement = {
  type: string
  properties?: Record<string, unknown> | null
}

export function rehypeSafeStyle() {
  return (tree: Parameters<typeof visit>[0]) => {
    visit(tree, 'element', (node: StyledElement) => {
      const properties = node.properties
      if (!properties) return
      const style = properties.style
      if (typeof style !== 'string' || style.length === 0) return

      const safe = sanitizeStyleAttribute(style)
      if (safe.length === 0) {
        delete properties.style
      } else {
        properties.style = safe
      }
    })
  }
}
