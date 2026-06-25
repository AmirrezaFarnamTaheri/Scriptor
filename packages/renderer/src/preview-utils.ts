const ALLOWED_TAGS = new Set([
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'ul',
  'ol',
  'li',
  'strong',
  'em',
  'del',
  'code',
  'pre',
  'blockquote',
  'a',
  'hr',
  'br',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  'input',
])

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

export function sanitizeHtml(html: string): string {
  return html.replace(/<\/?([a-z0-9]+)([^>]*)>/gi, (match, tagName: string, attrs: string) => {
    const tag = tagName.toLowerCase()
    if (!ALLOWED_TAGS.has(tag)) {
      return ''
    }

    if (match.startsWith('</')) {
      return `</${tag}>`
    }

    if (tag === 'a') {
      const hrefMatch = /href\s*=\s*"([^"]+)"/i.exec(attrs)
      const href = hrefMatch?.[1] ?? '#'
      if (/^(https?:|mailto:|#)/i.test(href)) {
        return `<a href="${escapeHtml(href)}" rel="noopener noreferrer">`
      }
      return '<a href="#">'
    }

    if (tag === 'input') {
      const typeMatch = /type\s*=\s*"([^"]+)"/i.exec(attrs)
      const checkedMatch = /\schecked\b/i.test(attrs)
      const type = typeMatch?.[1] ?? 'checkbox'
      if (type !== 'checkbox') return ''
      return checkedMatch ? '<input type="checkbox" checked disabled>' : '<input type="checkbox" disabled>'
    }

    return `<${tag}>`
  })
}
