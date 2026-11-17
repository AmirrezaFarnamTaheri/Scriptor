/** WeChat-safe HTML post-processing (ported from doocs/md export-content juice pipeline). */

const WECHAT_SHELL_VARS = `:root {
  --foreground: #3f3f3f;
  --blockquote-background: #f7f7f7;
  --md-primary-color: #576b95;
}`

const BASE_ELEMENT_STYLES: Record<string, string> = {
  h1: 'font-size: 22px; font-weight: bold; margin: 1.2em 0 0.6em; line-height: 1.4;',
  h2: 'font-size: 20px; font-weight: bold; margin: 1.1em 0 0.55em; line-height: 1.4;',
  h3: 'font-size: 18px; font-weight: bold; margin: 1em 0 0.5em; line-height: 1.4;',
  h4: 'font-size: 16px; font-weight: bold; margin: 0.9em 0 0.45em; line-height: 1.4;',
  p: 'margin: 0.75em 0; text-align: justify;',
  blockquote:
    'margin: 1em 0; padding: 0.5em 1em; border-left: 4px solid #576b95; background: #f7f7f7; color: #666;',
  pre: 'margin: 1em 0; padding: 12px; background: #f5f5f5; border-radius: 4px; overflow-x: auto; font-size: 14px;',
  code: 'font-family: Consolas, Monaco, monospace; background: #f5f5f5; padding: 2px 4px; border-radius: 3px; font-size: 14px;',
  img: 'max-width: 100%; height: auto; display: block; margin: 0.5em auto;',
  a: 'color: #576b95; text-decoration: none;',
  ul: 'margin: 0.75em 0; padding-left: 1.5em;',
  ol: 'margin: 0.75em 0; padding-left: 1.5em;',
  li: 'margin: 0.25em 0;',
  table: 'border-collapse: collapse; width: 100%; margin: 1em 0;',
  th: 'border: 1px solid #ddd; padding: 8px; background: #f7f7f7; font-weight: bold;',
  td: 'border: 1px solid #ddd; padding: 8px;',
}

function stripOutputScope(cssContent: string): string {
  return cssContent
    .replace(/#output\s*\{/g, 'body {')
    .replace(/#output\s+/g, '')
    .replace(/^#output\s*/gm, '')
}

function resolveCssVariables(css: string): string {
  return css
    .replace(/hsl\(var\(--foreground\)\)/g, '#3f3f3f')
    .replace(/var\(--blockquote-background\)/g, '#f7f7f7')
    .replace(/var\(--md-primary-color\)/g, '#576b95')
}

function mergeInlineStyle(existing: string | undefined | null, addition: string): string {
  if (!existing?.trim()) return addition
  const trimmed = existing.trim().replace(/;$/, '')
  return `${trimmed}; ${addition}`
}

/*
 * Tag-level rewriting goes through one left-to-right tokenizer. Each tag is
 * matched whole, quoted attribute values included, so markup-like text inside an
 * attribute (`title="a><img onerror=…>"`) is never seen as a tag, and a value is
 * only ever re-emitted inside quotes with `"`, `<` and `>` escaped. Earlier
 * per-tag regular expressions used `[^>]*`, which ended a tag at a `>` inside an
 * attribute value and could inject a live element into the export.
 */
type Attribute = [name: string, value: string | null]
type Tag = { name: string; closing: boolean; attributes: Attribute[]; selfClosing: boolean }

const TOKEN = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][\w:-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>|[^<]+|</g
const ATTRIBUTE = /([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g

function parseAttributes(raw: string): { attributes: Attribute[]; selfClosing: boolean } {
  const attributes: Attribute[] = []
  for (const match of raw.matchAll(ATTRIBUTE)) {
    attributes.push([match[1]!, match[2] ?? match[3] ?? match[4] ?? null])
  }
  return { attributes, selfClosing: /\/\s*$/.test(raw) }
}

function escapeAttribute(value: string): string {
  return value.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function serializeTag(tag: Tag): string {
  if (tag.closing) return `</${tag.name}>`
  const attributes = tag.attributes
    .map(([name, value]) => (value === null ? ` ${name}` : ` ${name}="${escapeAttribute(value)}"`))
    .join('')
  return `<${tag.name}${attributes}${tag.selfClosing ? ' /' : ''}>`
}

function getAttribute(tag: Tag, name: string): string | null | undefined {
  return tag.attributes.find(([key]) => key.toLowerCase() === name)?.[1]
}

function setAttribute(tag: Tag, name: string, value: string): void {
  const existing = tag.attributes.find(([key]) => key.toLowerCase() === name)
  if (existing) existing[1] = value
  else tag.attributes.push([name, value])
}

function removeAttribute(tag: Tag, name: string): void {
  tag.attributes = tag.attributes.filter(([key]) => key.toLowerCase() !== name)
}

/** Rewrite each tag; returning null drops it. Text and comments pass through. */
function rewriteTags(html: string, rewrite: (tag: Tag) => Tag | string | null): string {
  return html.replace(TOKEN, (token, closing: string | undefined, name: string | undefined, raw: string | undefined) => {
    if (name === undefined) return token
    const { attributes, selfClosing } = parseAttributes(raw ?? '')
    const result = rewrite({ name: name.toLowerCase(), closing: closing === '/', attributes, selfClosing })
    if (result === null) return ''
    return typeof result === 'string' ? result : serializeTag(result)
  })
}

function applyElementStyles(html: string, extraStyles: Record<string, string>): string {
  const styles: Record<string, string> = { ...BASE_ELEMENT_STYLES, ...extraStyles }
  return rewriteTags(html, tag => {
    const style = Object.hasOwn(styles, tag.name) ? styles[tag.name] : undefined
    if (!tag.closing && style) setAttribute(tag, 'style', mergeInlineStyle(getAttribute(tag, 'style'), style))
    return tag
  })
}

function fixWeChatImages(html: string): string {
  return rewriteTags(html, tag => {
    if (tag.closing || tag.name !== 'img') return tag
    let style = getAttribute(tag, 'style') ?? ''
    for (const dimension of ['width', 'height'] as const) {
      const value = getAttribute(tag, dimension)
      if (!value) continue
      removeAttribute(tag, dimension)
      style = mergeInlineStyle(style, `${dimension}: ${/^\d+$/.test(value) ? `${value}px` : value};`)
    }
    removeAttribute(tag, 'style')
    tag.attributes.push(['style', mergeInlineStyle(style, 'max-width: 100%; height: auto; display: block; margin: 0.5em auto;')])
    return tag
  })
}

/** WeChat drops a nested list unless its parent item is closed first. */
function modifyHtmlStructure(html: string): string {
  const open: string[] = []
  return rewriteTags(html, tag => {
    if (tag.selfClosing) return tag
    if (tag.closing) {
      const index = open.lastIndexOf(tag.name)
      if (index !== -1) open.length = index
      return tag
    }
    if (tag.name === 'ul' && open.at(-1) === 'li') {
      open.pop()
      open.push('ul')
      return `</li>${serializeTag(tag)}`
    }
    if (!['img', 'br', 'hr', 'input', 'meta', 'link'].includes(tag.name)) open.push(tag.name)
    return tag
  })
}

function createEmptyNode(): string {
  return '<p style="font-size:0;line-height:0;margin:0;">&nbsp;</p>'
}

function parseSimpleThemeRules(themeCss: string): Record<string, string> {
  const scoped = resolveCssVariables(stripOutputScope(themeCss))
  const rules: Record<string, string> = {}
  const rulePattern = /([a-z0-9#.\s,:-]+)\{([^}]+)\}/gi
  let match: RegExpExecArray | null
  while ((match = rulePattern.exec(scoped)) !== null) {
    const selector = match[1]?.trim()
    const declarations = match[2]?.trim().replace(/\s+/g, ' ')
    if (!selector || !declarations || selector.includes(',')) continue
    const tag = selector.replace(/^body\s+/i, '').replace(/^\./, '')
    if (/^(h[1-6]|p|blockquote|pre|code|a|ul|ol|li|table|th|td|img)$/.test(tag)) {
      rules[tag] = declarations
    }
  }
  return rules
}

function postProcessWeChatHtml(html: string): string {
  let dropLabelParagraph = false
  let previousWasLabel = false
  const next = rewriteTags(modifyHtmlStructure(html), tag => {
    const wasLabel = previousWasLabel
    previousWasLabel = false
    if (!tag.closing && tag.name === 'span') {
      const className = getAttribute(tag, 'class') ?? ''
      previousWasLabel = className === 'nodeLabel' || className === 'edgeLabel'
    }
    // Mermaid wraps label text in a <p> that WeChat renders as a block.
    if (wasLabel && !tag.closing && tag.name === 'p') {
      dropLabelParagraph = true
      return null
    }
    if (dropLabelParagraph && tag.closing && tag.name === 'p') {
      dropLabelParagraph = false
      return null
    }
    const style = getAttribute(tag, 'style')
    if (style) setAttribute(tag, 'style', style.replace(/(^|[^-])top:(.*?)em/g, '$1transform: translateY($2em)'))
    if (!tag.closing && tag.name === 'a' && getAttribute(tag, 'href')?.startsWith('#')) removeAttribute(tag, 'href')
    if (!tag.closing && tag.name === 'tspan') {
      setAttribute(tag, 'style', 'fill: #333333 !important; color: #333333 !important; stroke: none !important;')
    }
    return tag
  })
  return next
}

/**
 * Prepare rendered HTML for WeChat Official Account paste/export.
 * Inlines theme CSS onto key elements and applies WeChat-specific DOM fixes.
 */
export function prepareWeChatHtml(html: string, themeCss: string): string {
  const themeRules = parseSimpleThemeRules(`${WECHAT_SHELL_VARS}\n${themeCss}`)
  let processed = applyElementStyles(html, themeRules)
  processed = fixWeChatImages(processed)
  processed = postProcessWeChatHtml(processed)
  const wrapped = `<section style="width:100%;max-width:750px;margin:0 auto;padding:20px;box-sizing:border-box;">${processed}</section>`
  return `${createEmptyNode()}${wrapped}${createEmptyNode()}`
}
