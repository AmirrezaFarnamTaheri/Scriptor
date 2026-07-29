/**
 * Canonical HTML escaping + slug helpers for the renderer.
 *
 * These used to be re-implemented privately in seven modules with *divergent*
 * behaviour (some omitted `"`, some omitted `'`, some omitted both), which is
 * precisely how attribute-context sanitizer bypasses appear. Every renderer
 * module MUST import from here instead of hand-rolling another copy.
 *
 * NOTE: these live in the renderer rather than `@scriptor/core` because
 * `@scriptor/core` is a types-only contracts package (its `src/` contains only
 * `contracts/*.ts` and an index that re-exports them), and `@scriptor/renderer`
 * does not declare `@scriptor/core` in its `package.json` dependencies — it only
 * resolves `@scriptor/core/contracts/plugin` for a *type* import via workspace
 * hoisting. Shipping runtime code across that undeclared edge would be a real
 * dependency, so the canonical helpers stay renderer-internal.
 */

const HTML_ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

/**
 * Escape a string for interpolation into HTML **text** content.
 *
 * Escapes all five characters that matter: `&`, `<`, `>`, `"` and `'`. Quotes
 * are included even though text context does not strictly require them, so that
 * a value which later migrates into an attribute cannot break out.
 */
export function escapeHtml(value: string): string {
  return String(value ?? '').replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char)
}

/**
 * Escape a string for interpolation into a quoted HTML **attribute** value.
 *
 * Everything {@link escapeHtml} does, plus the backtick — legacy IE treats
 * `` ` `` as an attribute-value delimiter, which is the classic mutation-XSS
 * (mXSS) primitive for escaping a double-quoted attribute.
 */
export function escapeAttr(value: string): string {
  return escapeHtml(value).replaceAll('`', '&#96;')
}

/**
 * Unicode-aware slug generator shared by the `[TOC]` renderer, the heading-id
 * rehype plugin and the wikilink embed section matcher.
 *
 * Unicode-aware on purpose: an ASCII-only (`[^\w\s-]`) variant collapses
 * non-Latin headings such as `π` and `Ω` to the *same* empty slug, so a section
 * embed could resolve to the wrong heading.
 */
export function slugify(value: string): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-')
}
