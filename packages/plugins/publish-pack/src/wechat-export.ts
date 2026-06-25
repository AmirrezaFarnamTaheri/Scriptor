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

function mergeInlineStyle(existing: string | undefined, addition: string): string {
  if (!existing?.trim()) return addition
  const trimmed = existing.trim().replace(/;$/, '')
  return `${trimmed}; ${addition}`
}

function inlineStylesOnTag(html: string, tag: string, style: string): string {
  const openTag = new RegExp(`<${tag}(\\s[^>]*)?>`, 'gi')
  return html.replace(openTag, (_match, attrs = '') => {
    const styleMatch = /style="([^"]*)"/i.exec(attrs)
    const merged = mergeInlineStyle(styleMatch?.[1], style)
    const withoutStyle = attrs.replace(/\sstyle="[^"]*"/i, '')
    return `<${tag}${withoutStyle} style="${merged}">`
  })
}

function applyElementStyles(html: string, extraStyles: Record<string, string>): string {
  const styles = { ...BASE_ELEMENT_STYLES, ...extraStyles }
  let next = html
  for (const [tag, style] of Object.entries(styles)) {
    next = inlineStylesOnTag(next, tag, style)
  }
  return next
}

function fixWeChatImages(html: string): string {
  return html.replace(/<img([^>]*)>/gi, (_match, attrs: string) => {
    let nextAttrs = attrs
    const widthMatch = /\bwidth="([^"]+)"/i.exec(nextAttrs)
    const heightMatch = /\bheight="([^"]+)"/i.exec(nextAttrs)
    let style = /style="([^"]*)"/i.exec(nextAttrs)?.[1] ?? ''

    if (widthMatch) {
      const width = widthMatch[1]!
      nextAttrs = nextAttrs.replace(/\bwidth="[^"]+"/i, '')
      style = mergeInlineStyle(style, `width: ${/^\d+$/.test(width) ? `${width}px` : width};`)
    }
    if (heightMatch) {
      const height = heightMatch[1]!
      nextAttrs = nextAttrs.replace(/\bheight="[^"]+"/i, '')
      style = mergeInlineStyle(style, `height: ${/^\d+$/.test(height) ? `${height}px` : height};`)
    }
    style = mergeInlineStyle(style, 'max-width: 100%; height: auto; display: block; margin: 0.5em auto;')

    nextAttrs = nextAttrs.replace(/\sstyle="[^"]*"/i, '')
    return `<img${nextAttrs} style="${style}">`
  })
}

function modifyHtmlStructure(htmlString: string): string {
  return htmlString.replace(/(<li[^>]*>[\s\S]*?)(<ul[\s\S]*?<\/ul>)/gi, '$1</li>$2')
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
  let next = modifyHtmlStructure(html)
  next = next.replace(/([^-])top:(.*?)em/g, '$1transform: translateY($2em)')
  next = next.replace(/<a\b([^>]*)\bhref="#[^"]*"([^>]*)>/gi, '<a$1$2>')
  next = next.replace(
    /<span class="nodeLabel"([^>]*)><p[^>]*>(.*?)<\/p><\/span>/g,
    '<span class="nodeLabel"$1>$2</span>',
  )
  next = next.replace(
    /<span class="edgeLabel"([^>]*)><p[^>]*>(.*?)<\/p><\/span>/g,
    '<span class="edgeLabel"$1>$2</span>',
  )
  next = next.replace(
    /<tspan([^>]*)>/g,
    '<tspan$1 style="fill: #333333 !important; color: #333333 !important; stroke: none !important;">',
  )
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
