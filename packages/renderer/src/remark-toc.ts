import { visit } from 'unist-util-visit'

type HeadingInfo = {
  depth: number
  text: string
  id: string
}

/** doocs/md / MPE style table of contents marker: standalone `[TOC]` line. */
export function remarkToc() {
  return (tree: Parameters<typeof visit>[0]) => {
    const headings: HeadingInfo[] = []
    const slugger = createSlugger()

    visit(tree, 'heading', (node: { depth: number; children: unknown[] }) => {
      const text = collectText(node.children).trim()
      if (text.length === 0) return
      headings.push({ depth: node.depth, text, id: slugger(text) })
    })

    visit(
      tree,
      'paragraph',
      (node: { children: Array<{ type?: string; value?: string }> }, index, parent: { children: unknown[] } | undefined) => {
        if (!parent || index === undefined) return
        if (node.children.length !== 1) return
        const child = node.children[0]
        if (child.type !== 'text' || child.value?.trim() !== '[TOC]') return

        parent.children[index] = {
          type: 'html',
          value: renderToc(headings),
        }
      },
    )
  }
}

function collectText(children: unknown[]): string {
  let text = ''
  for (const child of children) {
    const node = child as { type?: string; value?: string; children?: unknown[] }
    if (node.type === 'text' && typeof node.value === 'string') {
      text += node.value
    } else if (Array.isArray(node.children)) {
      text += collectText(node.children)
    }
  }
  return text
}

/**
 * rehype-sanitize clobbers `id` attributes with this prefix, so TOC anchors
 * must target the prefixed ids to resolve after sanitization.
 */
export const HEADING_ANCHOR_PREFIX = 'user-content-'

function renderToc(headings: HeadingInfo[]): string {
  if (headings.length === 0) {
    return '<nav class="markdown-toc" aria-label="Table of contents"><p class="markdown-toc-empty">No headings</p></nav>'
  }

  const items = headings
    .map(
      (heading) =>
        `<li class="markdown-toc-item markdown-toc-depth-${heading.depth}"><a href="#${escapeAttr(`${HEADING_ANCHOR_PREFIX}${heading.id}`)}">${escapeHtml(heading.text)}</a></li>`,
    )
    .join('')
  return `<nav class="markdown-toc" aria-label="Table of contents"><ul class="markdown-toc-list">${items}</ul></nav>`
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-')
}

/**
 * Stateful slug generator that de-duplicates colliding ids with -1/-2 suffixes.
 * Used by both the `[TOC]` renderer and the heading-id rehype plugin so anchors
 * and heading ids always agree.
 */
export function createSlugger(): (text: string) => string {
  const counts = new Map<string, number>()
  return (text: string) => {
    const base = slugify(text)
    const count = counts.get(base) ?? 0
    counts.set(base, count + 1)
    return count === 0 ? base : `${base}-${count}`
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function escapeAttr(value: string): string {
  return escapeHtml(value).replaceAll('"', '&quot;')
}
