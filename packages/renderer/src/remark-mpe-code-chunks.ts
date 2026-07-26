import { visit } from 'unist-util-visit'

import { escapeAttr, escapeHtml } from './escape.ts'

/** Fence-meta keys are interpolated into attribute *names*, so they are charset-restricted. */
const SAFE_ATTRIBUTE_NAME = /^[a-z][a-z0-9-]*$/

const CODE_CHUNK_LANGS = new Set(['code-chunk', 'run', 'cmd', 'powershell', 'pwsh', 'python', 'node', 'sh'])

export type MpeCodeChunkAttributes = Record<string, string>

/** Parse MPE fence meta such as `{cmd=powershell hide output=html}`. */
export function parseMpeAttributes(meta: string | null | undefined): MpeCodeChunkAttributes {
  if (!meta?.trim()) return {}
  let content = meta.trim()
  const wrapped = /^\{(.+)\}$/.exec(content)
  if (wrapped?.[1]) content = wrapped[1]

  const attrs: MpeCodeChunkAttributes = {}
  const tokens = content.match(/(?:[^\s"']+|"(?:\\.|[^"])*"|'(?:\\.|[^'])*')+/g) ?? []

  for (const token of tokens) {
    const eq = token.indexOf('=')
    if (eq === -1) {
      attrs[token.toLowerCase()] = 'true'
      continue
    }
    const key = token.slice(0, eq).trim().toLowerCase()
    let value = token.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    attrs[key] = value
  }

  return attrs
}

/**
 * MPE-style fenced code chunks with optional execution (hydrated in preview).
 * Supports info-string attributes like ` ```powershell {cmd=powershell hide output=html} `.
 */
export function remarkMpeCodeChunks() {
  return (tree: Parameters<typeof visit>[0]) => {
    visit(
      tree,
      'code',
      (
        node: { lang?: string | null; meta?: string | null; value: string },
        index,
        parent: { children: unknown[] } | undefined,
      ) => {
        if (!parent || index === undefined) return
        const lang = (node.lang ?? '').trim().toLowerCase()
        if (!CODE_CHUNK_LANGS.has(lang)) return

        const attrs = parseMpeAttributes(node.meta)
        const execLang = attrs.cmd || (lang === 'code-chunk' || lang === 'run' ? 'powershell' : lang)
        const title = attrs.title || attrs.id || execLang
        const hide = attrs.hide ?? ''
        const outputMode = attrs.output ?? ''
        const value = node.value ?? ''

        const attrParts = [
          `data-mpe-chunk="true"`,
          `data-mpe-lang="${escapeAttr(execLang)}"`,
          `data-mpe-title="${escapeAttr(title)}"`,
        ]
        if (hide.length > 0) attrParts.push(`data-mpe-hide="${escapeAttr(hide)}"`)
        if (outputMode.length > 0) attrParts.push(`data-mpe-output="${escapeAttr(outputMode)}"`)
        for (const [key, valueAttr] of Object.entries(attrs)) {
          if (key === 'cmd' || key === 'hide' || key === 'output' || key === 'title' || key === 'id') continue
          // Attribute *names* cannot be made safe by escaping: entity-encoding a
          // `"` leaves it a literal `&quot;` in name position, while any
          // whitespace in the key simply starts a new attribute — so a fence
          // meta of `{a'" onload="alert(1)}` used to synthesise a live onload
          // handler. Names must be charset-validated instead.
          if (!SAFE_ATTRIBUTE_NAME.test(key)) continue
          attrParts.push(`data-mpe-${key}="${escapeAttr(valueAttr)}"`)
        }

        const hideClass = hide.length > 0 ? ' mpe-code-chunk-hidden' : ''
        parent.children[index] = {
          type: 'html',
          value: `<section class="mpe-code-chunk${hideClass}" ${attrParts.join(' ')}>
  <header class="mpe-code-chunk-header">
    <strong>${escapeHtml(title)}</strong>
    <button type="button" class="mpe-code-chunk-run" data-mpe-run="true">Run</button>
  </header>
  <pre class="mpe-code-chunk-body"><code>${escapeHtml(value)}</code></pre>
  <output class="mpe-code-chunk-output" hidden></output>
</section>`,
        }
      },
    )
  }
}
